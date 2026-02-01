import {
  Building,
  ItemType,
  Position,
  GameState,
  GeologistExplorer,
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
} from "../../shared/types.js";
import { getState, getUpgrades, getPrestige, getAutomation, tickAutoSave, updateMetaStats } from "./state.js";
import { getModifiers } from "./modifiers.js";
import { runAutomation } from "./automation.js";

let intervalId: ReturnType<typeof setInterval> | null = null;

function findBuildingAt(buildings: Building[], x: number, y: number): Building | undefined {
  return buildings.find((b) => b.position.x === x && b.position.y === y);
}

function tick(): void {
  const state = getState();
  state.tick++;

  // Get modifiers from upgrades and prestige
  const modifiers = getModifiers(getUpgrades(), getPrestige());
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
  for (const building of state.buildings) {
    if (building.type !== "shop") continue;

    // Spawn: if queue < max and random chance
    if (building.npcQueue.length < NPC_MAX_QUEUE && Math.random() < NPC_SPAWN_CHANCE) {
      building.npcQueue.push(spawnNpc(modifiers.npcPatience));
    }

    // Fulfill: serve NPCs whose wanted item is in shop storage
    building.npcQueue = building.npcQueue.filter((npc) => {
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
      return npc.patienceLeft > 0;
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

  // 6. Automation
  const automation = getAutomation();
  if (automation.enabled) {
    runAutomation(state);
  }

  // 7. Update meta stats and auto-save
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
