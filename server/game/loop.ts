import {
  Building,
  ItemType,
  Position,
  GameState,
  GeologistExplorer,
  ExplorerCharacter,
  Inventory,
  KingDemand,
  MultiItemDemand,
  MINER_TICKS,
  SMELT_TICKS,
  SMELT_ORE_COST,
  RECIPE_BARS_COST,
  RECIPE_TICKS,
  RECIPE_BAR_TYPE,
  FINISHED_GOODS,
  FinishedGood,
  NpcType,
  Npc,
  NPC_SPAWN_CHANCE,
  NPC_MAX_QUEUE,
  NPC_PATIENCE,
  NPC_PRICE_MULTIPLIER,
  SELL_PRICES,
  getBeltTravelTime,
  WHOLESALE_THRESHOLD,
  WHOLESALE_MULTIPLIER,
  CONSTRUCTION_TICKS,
  GEOLOGIST_UPKEEP,
  GEOLOGIST_DISCOVERY_TICKS_MIN,
  GEOLOGIST_DISCOVERY_TICKS_MAX,
  EXPLORER_UPKEEP,
  EXPLORER_EXPANSION_TICKS_MIN,
  EXPLORER_EXPANSION_TICKS_MAX,
  EXPLORER_EXPANSION_SIZE,
  KING_SPAWN_CHANCE,
  KING_MIN_TICK,
  KING_COOLDOWN_TICKS,
  KING_PRICE_MULTIPLIER,
  KING_PENALTY_DURATION,
  MULTI_ITEM_BONUS,
  OreType,
} from "../../shared/types.js";
import { getState, getUpgrades, getPrestige, getAutomation, tickAutoSave, updateMetaStats, getMeta } from "./state.js";
import { getModifiers } from "./modifiers.js";
import { runAutomation } from "./automation.js";

let intervalId: ReturnType<typeof setInterval> | null = null;

function findBuildingAt(buildings: Building[], x: number, y: number): Building | undefined {
  return buildings.find((b) => b.position.x === x && b.position.y === y);
}

function tick(): void {
  const state = getState();
  state.tick++;

  // Decrement King penalty
  if (state.kingPenaltyTicksLeft > 0) {
    state.kingPenaltyTicksLeft--;
  }

  // Get modifiers from upgrades and prestige (pass state for King penalty)
  const modifiers = getModifiers(getUpgrades(), getPrestige(), state);
  let currencyEarnedThisTick = 0;
  let itemsProducedThisTick = 0;

  // 0. Construction: advance construction progress for incomplete buildings
  for (const building of state.buildings) {
    if (building.constructionProgress < 1) {
      const ticksNeeded = CONSTRUCTION_TICKS[building.type];
      building.constructionProgress += 1 / ticksNeeded;
      if (building.constructionProgress > 1) building.constructionProgress = 1;
    }
  }

  // 1. Production: buildings produce into their own storage (only if construction complete)
  const EPSILON = 1e-9;
  for (const building of state.buildings) {
    // Skip buildings under construction
    if (building.constructionProgress < 1) continue;

    if (building.type === "miner") {
      const oreNode = state.oreNodes.find(
        (n) => n.position.x === building.position.x && n.position.y === building.position.y
      );
      if (oreNode) {
        const ticksNeeded = MINER_TICKS[oreNode.type] / modifiers.miningSpeed;
        building.progress += 1 / ticksNeeded;
        if (building.progress >= 1 - EPSILON) {
          const oreItem: ItemType = oreNode.type === "iron" ? "iron_ore" : "copper_ore";
          building.storage[oreItem] += 1;
          building.progress = 0;
          itemsProducedThisTick++;
        }
      }
    } else if (building.type === "smelter") {
      if (building.storage.iron_ore >= SMELT_ORE_COST) {
        const ticksNeeded = SMELT_TICKS.iron / modifiers.smeltingSpeed;
        building.progress += 1 / ticksNeeded;
        if (building.progress >= 1 - EPSILON) {
          building.storage.iron_ore -= SMELT_ORE_COST;
          building.storage.iron_bar += 1;
          building.progress = 0;
          itemsProducedThisTick++;
        }
      } else if (building.storage.copper_ore >= SMELT_ORE_COST) {
        const ticksNeeded = SMELT_TICKS.copper / modifiers.smeltingSpeed;
        building.progress += 1 / ticksNeeded;
        if (building.progress >= 1 - EPSILON) {
          building.storage.copper_ore -= SMELT_ORE_COST;
          building.storage.copper_bar += 1;
          building.progress = 0;
          itemsProducedThisTick++;
        }
      }
    } else if (building.type === "forger") {
      const barsCost = RECIPE_BARS_COST[building.recipe];
      const forgeTicks = RECIPE_TICKS[building.recipe] / modifiers.forgingSpeed;
      const barType = RECIPE_BAR_TYPE[building.recipe];
      if (building.storage[barType] >= barsCost) {
        building.progress += 1 / forgeTicks;
        if (building.progress >= 1 - EPSILON) {
          building.storage[barType] -= barsCost;
          building.storage[building.recipe] += 1;
          building.progress = 0;
          itemsProducedThisTick++;
        }
      }
    }
  }

  // 2. Belt transfer: items travel based on distance (1 tick base + 1 tick per 5 cells)
  for (const belt of state.belts) {
    const src = findBuildingAt(state.buildings, belt.from.x, belt.from.y);
    const dst = findBuildingAt(state.buildings, belt.to.x, belt.to.y);
    if (!src || !dst) continue;
    // Skip if either building is under construction
    if (src.constructionProgress < 1 || dst.constructionProgress < 1) continue;

    const baseTravelTime = getBeltTravelTime(belt.from, belt.to);
    const travelTime = baseTravelTime / modifiers.beltSpeed;
    const progressPerTick = 1 / travelTime;

    // Initialize itemsInTransit if needed (for backwards compatibility)
    if (!belt.itemsInTransit) {
      belt.itemsInTransit = [];
    }

    // Advance progress on items in transit and deliver completed ones
    belt.itemsInTransit = belt.itemsInTransit.filter((item) => {
      item.progress += progressPerTick;
      if (item.progress >= 1) {
        // Deliver to destination
        dst.storage[item.itemType] += 1;
        return false; // Remove from transit
      }
      return true; // Keep in transit
    });

    // Try to add new item to belt (max 1 item per tick, limit total in transit)
    const maxItemsOnBelt = Math.max(1, travelTime); // Allow more items on longer belts
    if (belt.itemsInTransit.length < maxItemsOnBelt) {
      const transferable = getTransferableItem(src, dst);
      if (transferable && src.storage[transferable] > 0) {
        src.storage[transferable] -= 1;
        belt.itemsInTransit.push({ itemType: transferable, progress: 0 });
      }
    }
  }

  // 3. Shop NPC processing
  const meta = getMeta();
  for (const building of state.buildings) {
    if (building.type !== "shop") continue;

    // Try to spawn King first (separate from normal NPCs)
    trySpawnKing(state, building, modifiers.npcPatience);

    // Try to spawn multi-item NPCs (Noble/Adventurer)
    trySpawnMultiItemNpc(building, modifiers.npcPatience);

    // Spawn normal NPCs: if queue < max and random chance (affected by penalty)
    const effectiveSpawnChance = NPC_SPAWN_CHANCE * modifiers.npcSpawnChance;
    if (building.npcQueue.length < NPC_MAX_QUEUE && Math.random() < effectiveSpawnChance) {
      building.npcQueue.push(spawnNpc(modifiers.npcPatience));
    }

    // Fulfill: serve NPCs whose wanted item is in shop storage
    building.npcQueue = building.npcQueue.filter((npc) => {
      // Handle King NPCs specially
      if (npc.npcType === "king" && npc.kingDemand) {
        if (canFulfillKingDemand(building.storage, npc.kingDemand)) {
          fulfillKingDemand(building.storage, npc.kingDemand);
          const earned = Math.round(npc.kingDemand.totalValue * modifiers.sellPrice);
          state.currency += earned;
          currencyEarnedThisTick += earned;
          meta.totalCurrencyEarned += earned;
          return false; // King leaves after being served
        }
        return true; // King stays
      }

      // Handle multi-item NPCs (Noble/Adventurer)
      if (npc.multiItemDemand) {
        if (canFulfillMultiItemDemand(building.storage, npc.multiItemDemand)) {
          fulfillMultiItemDemand(building.storage, npc.multiItemDemand);
          const earned = Math.round(npc.multiItemDemand.totalValue * modifiers.sellPrice);
          state.currency += earned;
          currencyEarnedThisTick += earned;
          meta.totalCurrencyEarned += earned;
          return false; // NPC leaves after being served
        }
        return true; // NPC stays
      }

      // Normal NPC handling
      if (building.storage[npc.wantedItem] > 0) {
        building.storage[npc.wantedItem] -= 1;
        const basePrice = SELL_PRICES[npc.wantedItem];
        const isIronItem = RECIPE_BAR_TYPE[npc.wantedItem] === "iron_bar";
        const mult = isIronItem
          ? NPC_PRICE_MULTIPLIER[npc.npcType].iron
          : NPC_PRICE_MULTIPLIER[npc.npcType].copper;
        const earned = Math.round(basePrice * mult * modifiers.sellPrice);
        state.currency += earned;
        currencyEarnedThisTick += earned;
        return false; // NPC leaves after being served
      }
      return true; // NPC stays
    });

    // Patience: tick down and remove timed-out NPCs
    building.npcQueue = building.npcQueue.filter((npc) => {
      npc.patienceLeft -= 1;
      if (npc.patienceLeft <= 0) {
        // King leaving triggers penalty
        if (npc.npcType === "king") {
          state.kingPenaltyTicksLeft = KING_PENALTY_DURATION;
        }
        return false;
      }
      return true;
    });
  }

  // 4. Warehouse wholesale processing
  for (const building of state.buildings) {
    if (building.type !== "warehouse") continue;

    // Check each finished good type
    for (const item of FINISHED_GOODS) {
      const count = building.storage[item];
      if (count >= WHOLESALE_THRESHOLD) {
        // Sell all items at wholesale price
        const basePrice = SELL_PRICES[item];
        const wholesalePrice = Math.floor(basePrice * WHOLESALE_MULTIPLIER * modifiers.sellPrice);
        const earned = wholesalePrice * count;
        state.currency += earned;
        currencyEarnedThisTick += earned;
        building.storage[item] = 0;
      }
    }
  }

  // 5. Geologist explorer movement and ore discovery
  const activeGeologist = state.buildings.find(
    b => b.type === "geologist" && b.constructionProgress >= 1
  );

  if (activeGeologist) {
    // Deduct upkeep if player can afford it
    if (state.currency >= GEOLOGIST_UPKEEP) {
      state.currency -= GEOLOGIST_UPKEEP;

      // Initialize explorer if not exists
      if (!state.geologistExplorer) {
        state.geologistExplorer = createGeologistExplorer(state, activeGeologist.position);
      }

      const explorer = state.geologistExplorer;

      // Move explorer towards target
      const moveSpeed = 0.5; // cells per tick
      const dx = explorer.targetPosition.x - explorer.position.x;
      const dy = explorer.targetPosition.y - explorer.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > moveSpeed) {
        // Move towards target
        explorer.position.x += (dx / dist) * moveSpeed;
        explorer.position.y += (dy / dist) * moveSpeed;
      } else {
        // Reached target, pick new target
        explorer.position.x = explorer.targetPosition.x;
        explorer.position.y = explorer.targetPosition.y;
        explorer.targetPosition = pickRandomExplorerTarget(state);
      }

      // Count down to discovery
      explorer.ticksUntilDiscovery--;

      if (explorer.ticksUntilDiscovery <= 0) {
        // Discover ore at a random position near explorer
        const occupiedPositions = new Set<string>();
        state.oreNodes.forEach(n => occupiedPositions.add(`${n.position.x},${n.position.y}`));
        state.buildings.forEach(b => occupiedPositions.add(`${b.position.x},${b.position.y}`));

        // Try to find an empty spot near the explorer
        let discovered = false;
        for (let radius = 0; radius <= 5 && !discovered; radius++) {
          for (let attempt = 0; attempt < 8 && !discovered; attempt++) {
            const angle = (attempt / 8) * Math.PI * 2;
            const x = Math.round(explorer.position.x + Math.cos(angle) * radius);
            const y = Math.round(explorer.position.y + Math.sin(angle) * radius);

            if (x >= 0 && x < state.mapWidth && y >= 0 && y < state.mapHeight) {
              const key = `${x},${y}`;
              if (!occupiedPositions.has(key)) {
                const oreType = Math.random() < 0.5 ? "iron" : "copper";
                state.oreNodes.push({
                  id: `ore-discovered-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  position: { x, y },
                  type: oreType,
                });
                discovered = true;
              }
            }
          }
        }

        // Set new random discovery time
        explorer.ticksUntilDiscovery = randomInt(GEOLOGIST_DISCOVERY_TICKS_MIN, GEOLOGIST_DISCOVERY_TICKS_MAX);
      }

      // Update search progress for visual effect (based on ticks until discovery)
      const totalTicks = (GEOLOGIST_DISCOVERY_TICKS_MIN + GEOLOGIST_DISCOVERY_TICKS_MAX) / 2;
      explorer.searchProgress = 1 - (explorer.ticksUntilDiscovery / totalTicks);
    }
  } else {
    // No active geologist, remove explorer
    state.geologistExplorer = null;
  }

  // 6. Explorer character movement and map expansion
  const activeExplorer = state.buildings.find(
    b => b.type === "explorer" && b.constructionProgress >= 1
  );

  if (activeExplorer) {
    // Deduct upkeep if player can afford it
    if (state.currency >= EXPLORER_UPKEEP) {
      state.currency -= EXPLORER_UPKEEP;

      // Initialize explorer character if not exists
      if (!state.explorerCharacter) {
        state.explorerCharacter = createExplorerCharacter(state, activeExplorer.position);
      }

      const explorer = state.explorerCharacter;

      // Move explorer along map edges (0.4 cells/tick)
      const moveSpeed = 0.4;
      const dx = explorer.targetPosition.x - explorer.position.x;
      const dy = explorer.targetPosition.y - explorer.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > moveSpeed) {
        explorer.position.x += (dx / dist) * moveSpeed;
        explorer.position.y += (dy / dist) * moveSpeed;
      } else {
        // Reached target, pick new edge target
        explorer.position.x = explorer.targetPosition.x;
        explorer.position.y = explorer.targetPosition.y;
        explorer.targetPosition = pickEdgeTarget(state, explorer);
      }

      // Count down to expansion
      explorer.ticksUntilExpansion--;

      if (explorer.ticksUntilExpansion <= 0) {
        // Expand the map
        expandMap(state, explorer);

        // Reset countdown
        explorer.ticksUntilExpansion = randomInt(EXPLORER_EXPANSION_TICKS_MIN, EXPLORER_EXPANSION_TICKS_MAX);
      }

      // Update expansion progress for visual effect
      const totalTicks = (EXPLORER_EXPANSION_TICKS_MIN + EXPLORER_EXPANSION_TICKS_MAX) / 2;
      explorer.expansionProgress = 1 - (explorer.ticksUntilExpansion / totalTicks);
    }
  } else {
    // No active explorer, remove character
    state.explorerCharacter = null;
  }

  // 7. Automation
  const automation = getAutomation();
  if (automation.enabled) {
    runAutomation(state);
  }

  // 8. Update meta stats and auto-save
  updateMetaStats(currencyEarnedThisTick, itemsProducedThisTick);
  tickAutoSave();
}

function getTransferableItem(src: Building, dst: Building): ItemType | null {
  // Transfer what the destination building can consume
  if (dst.type === "smelter") {
    if (src.storage.iron_ore > 0) return "iron_ore";
    if (src.storage.copper_ore > 0) return "copper_ore";
    return null;
  }

  if (dst.type === "forger") {
    const neededBar = RECIPE_BAR_TYPE[dst.recipe];
    if (src.storage[neededBar] > 0) return neededBar;
    return null;
  }

  if (dst.type === "shop" || dst.type === "warehouse") {
    // Shops and warehouses accept any finished good
    for (const item of FINISHED_GOODS) {
      if (src.storage[item] > 0) return item;
    }
    return null;
  }

  // For miners or other sources with no specific need, transfer any item
  const items: ItemType[] = ["iron_ore", "iron_bar", "dagger", "armour", "copper_ore", "copper_bar", "wand", "magic_powder"];
  for (const item of items) {
    if (src.storage[item] > 0) return item;
  }
  return null;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createGeologistExplorer(state: GameState, startPos: Position): GeologistExplorer {
  return {
    position: { x: startPos.x, y: startPos.y },
    targetPosition: pickRandomExplorerTarget(state),
    searchProgress: 0,
    ticksUntilDiscovery: randomInt(GEOLOGIST_DISCOVERY_TICKS_MIN, GEOLOGIST_DISCOVERY_TICKS_MAX),
  };
}

function pickRandomExplorerTarget(state: GameState): Position {
  // Pick a random position on the map, preferring unexplored areas
  return {
    x: Math.floor(Math.random() * state.mapWidth),
    y: Math.floor(Math.random() * state.mapHeight),
  };
}

function randomNpcType(): NpcType {
  const types: NpcType[] = ["warrior", "mage", "collector", "merchant"];
  return types[Math.floor(Math.random() * types.length)];
}

function randomWantedItem(): FinishedGood {
  return FINISHED_GOODS[Math.floor(Math.random() * FINISHED_GOODS.length)];
}

function spawnNpc(patienceMultiplier = 1): Npc {
  const npcType = randomNpcType();
  const [minP, maxP] = NPC_PATIENCE[npcType];
  const basePatience = randomInt(minP, maxP);
  const patience = Math.floor(basePatience * patienceMultiplier);
  return {
    id: `npc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    npcType,
    wantedItem: randomWantedItem(),
    patienceLeft: patience,
    maxPatience: patience,
  };
}

function generateKingDemand(tick: number): KingDemand {
  const isLateGame = tick > 500;
  const numTypes = isLateGame ? randomInt(3, 4) : randomInt(2, 3);
  const items: { item: FinishedGood; quantity: number }[] = [];

  const shuffled = [...FINISHED_GOODS].sort(() => Math.random() - 0.5);
  for (let i = 0; i < numTypes; i++) {
    items.push({
      item: shuffled[i],
      quantity: isLateGame ? randomInt(2, 3) : randomInt(1, 2),
    });
  }

  const totalValue = items.reduce((sum, { item, quantity }) => {
    return sum + SELL_PRICES[item] * quantity * KING_PRICE_MULTIPLIER;
  }, 0);

  return { items, totalValue };
}

function trySpawnKing(state: GameState, shop: Building, patienceMultiplier: number): boolean {
  // Eligibility checks
  if (state.tick < KING_MIN_TICK) return false;
  if (state.tick - state.lastKingTick < KING_COOLDOWN_TICKS) return false;
  if (state.kingPenaltyTicksLeft > 0) return false;
  if (shop.npcQueue.length >= NPC_MAX_QUEUE) return false;
  if (shop.npcQueue.some(n => n.npcType === "king")) return false;

  if (Math.random() < KING_SPAWN_CHANCE) {
    const demand = generateKingDemand(state.tick);
    const [minP, maxP] = NPC_PATIENCE.king;
    const patience = Math.floor(randomInt(minP, maxP) * patienceMultiplier);

    shop.npcQueue.push({
      id: `king-${Date.now()}`,
      npcType: "king",
      wantedItem: "dagger",  // Unused for king
      kingDemand: demand,
      patienceLeft: patience,
      maxPatience: patience,
    });

    state.lastKingTick = state.tick;
    return true;
  }
  return false;
}

function canFulfillKingDemand(storage: Inventory, demand: KingDemand): boolean {
  return demand.items.every(({ item, quantity }) => storage[item] >= quantity);
}

function fulfillKingDemand(storage: Inventory, demand: KingDemand): void {
  for (const { item, quantity } of demand.items) {
    storage[item] -= quantity;
  }
}

function trySpawnMultiItemNpc(shop: Building, patienceMultiplier: number): boolean {
  if (shop.npcQueue.length >= NPC_MAX_QUEUE) return false;
  if (Math.random() >= 0.03) return false;  // 3% chance per tick

  const npcType: "noble" | "adventurer" = Math.random() < 0.5 ? "noble" : "adventurer";
  const items: { item: FinishedGood; quantity: number }[] = npcType === "noble"
    ? [{ item: "dagger", quantity: 1 }, { item: "armour", quantity: 1 }]
    : [{ item: "wand", quantity: 1 }, { item: "magic_powder", quantity: 1 }];

  const totalValue = items.reduce((sum, { item, quantity }) =>
    sum + SELL_PRICES[item] * quantity, 0) * MULTI_ITEM_BONUS;

  const [minP, maxP] = NPC_PATIENCE[npcType];
  const patience = Math.floor(randomInt(minP, maxP) * patienceMultiplier);

  shop.npcQueue.push({
    id: `${npcType}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    npcType,
    wantedItem: items[0].item,  // Fallback for display
    multiItemDemand: {
      items,
      totalValue,
      bonusMultiplier: MULTI_ITEM_BONUS,
    },
    patienceLeft: patience,
    maxPatience: patience,
  });

  return true;
}

function canFulfillMultiItemDemand(storage: Inventory, demand: MultiItemDemand): boolean {
  return demand.items.every(({ item, quantity }) => storage[item] >= quantity);
}

function fulfillMultiItemDemand(storage: Inventory, demand: MultiItemDemand): void {
  for (const { item, quantity } of demand.items) {
    storage[item] -= quantity;
  }
}

function createExplorerCharacter(state: GameState, startPos: Position): ExplorerCharacter {
  return {
    position: { x: startPos.x, y: startPos.y },
    targetPosition: pickEdgeTarget(state, null),
    expansionProgress: 0,
    ticksUntilExpansion: randomInt(EXPLORER_EXPANSION_TICKS_MIN, EXPLORER_EXPANSION_TICKS_MAX),
    lastExpandedSide: "right", // Will start with bottom on first expansion
  };
}

function pickEdgeTarget(state: GameState, explorer: ExplorerCharacter | null): Position {
  // Pick a position along the right or bottom edge of the map
  const edge = Math.random() < 0.5 ? "right" : "bottom";

  if (edge === "right") {
    return {
      x: state.mapWidth - 1,
      y: Math.floor(Math.random() * state.mapHeight),
    };
  } else {
    return {
      x: Math.floor(Math.random() * state.mapWidth),
      y: state.mapHeight - 1,
    };
  }
}

function expandMap(state: GameState, explorer: ExplorerCharacter): void {
  // Alternate between expanding right and bottom
  const side = explorer.lastExpandedSide === "right" ? "bottom" : "right";
  explorer.lastExpandedSide = side;

  if (side === "right") {
    state.mapWidth += EXPLORER_EXPANSION_SIZE;
  } else {
    state.mapHeight += EXPLORER_EXPANSION_SIZE;
  }

  // 25% chance to spawn ore in the newly expanded area
  if (Math.random() < 0.25) {
    const oreType: OreType = Math.random() < 0.5 ? "iron" : "copper";
    let x: number, y: number;

    if (side === "right") {
      // New area is on the right
      x = state.mapWidth - Math.floor(Math.random() * EXPLORER_EXPANSION_SIZE) - 1;
      y = Math.floor(Math.random() * state.mapHeight);
    } else {
      // New area is on the bottom
      x = Math.floor(Math.random() * state.mapWidth);
      y = state.mapHeight - Math.floor(Math.random() * EXPLORER_EXPANSION_SIZE) - 1;
    }

    // Check not occupied
    const occupied = state.buildings.some(b => b.position.x === x && b.position.y === y) ||
                     state.oreNodes.some(n => n.position.x === x && n.position.y === y);

    if (!occupied) {
      state.oreNodes.push({
        id: `ore-expanded-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        position: { x, y },
        type: oreType,
      });
    }
  }
}

export function startGameLoop(): void {
  if (intervalId) return;
  intervalId = setInterval(tick, 1000);
  console.log("Game loop started (1 tick/second)");
}

export function stopGameLoop(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
