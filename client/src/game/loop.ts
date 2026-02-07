import {
  Building,
  ItemType,
  Position,
  GameState,
  GeologistExplorer,
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
  getBeltEndpoints,
  WHOLESALE_THRESHOLD,
  WHOLESALE_MULTIPLIER,
  CONSTRUCTION_TICKS,
  GEOLOGIST_UPKEEP,
  GEOLOGIST_DISCOVERY_TICKS_MIN,
  GEOLOGIST_DISCOVERY_TICKS_MAX,
  KING_SPAWN_CHANCE,
  KING_MIN_TICK,
  KING_COOLDOWN_TICKS,
  KING_PRICE_MULTIPLIER,
  KING_PENALTY_DURATION,
  MULTI_ITEM_BONUS,
  UPGRADE_SPEED_BONUS,
  ALL_ITEMS,
  ITEM_CATEGORIES,
  UpgradeState,
  PrestigeData,
  AutomationSettings,
  GameMeta,
} from "./types";
import { getModifiers } from "./modifiers";
import { runAutomation } from "./automation";

function findBuildingAt(buildings: Building[], x: number, y: number): Building | undefined {
  return buildings.find((b) => b.position.x === x && b.position.y === y);
}

function getUpgradeMultiplier(level: number): number {
  return Math.pow(UPGRADE_SPEED_BONUS, level);
}

export function tick(
  state: GameState,
  upgrades: UpgradeState,
  prestige: PrestigeData,
  automation: AutomationSettings,
  meta: GameMeta
): { currencyEarned: number; itemsProduced: number } {
  state.tick++;

  if (state.kingPenaltyTicksLeft > 0) {
    state.kingPenaltyTicksLeft--;
  }

  const modifiers = getModifiers(upgrades, prestige, state);
  let currencyEarnedThisTick = 0;
  let itemsProducedThisTick = 0;

  // 0. Construction
  for (const building of state.buildings) {
    if (building.constructionProgress < 1) {
      const ticksNeeded = CONSTRUCTION_TICKS[building.type];
      building.constructionProgress += 1 / ticksNeeded;
      if (building.constructionProgress > 1) building.constructionProgress = 1;
    }
  }

  // 1. Production
  const EPSILON = 1e-9;
  for (const building of state.buildings) {
    if (building.constructionProgress < 1) continue;

    if (building.type === "miner") {
      const oreNode = state.oreNodes.find(
        (n) => n.position.x === building.position.x && n.position.y === building.position.y
      );
      if (oreNode) {
        const upgradeBonus = getUpgradeMultiplier(building.upgradeLevel ?? 0);
        const ticksNeeded = MINER_TICKS[oreNode.type] / (modifiers.miningSpeed * upgradeBonus);
        building.progress += 1 / ticksNeeded;
        if (building.progress >= 1 - EPSILON) {
          const oreItem: ItemType = oreNode.type === "iron" ? "iron_ore" : "copper_ore";
          building.storage[oreItem] += 1;
          building.progress = 0;
          itemsProducedThisTick++;
        }
      }
    } else if (building.type === "smelter") {
      const upgradeBonus = getUpgradeMultiplier(building.upgradeLevel ?? 0);
      if (building.storage.iron_ore >= SMELT_ORE_COST) {
        const ticksNeeded = SMELT_TICKS.iron / (modifiers.smeltingSpeed * upgradeBonus);
        building.progress += 1 / ticksNeeded;
        if (building.progress >= 1 - EPSILON) {
          building.storage.iron_ore -= SMELT_ORE_COST;
          building.storage.iron_bar += 1;
          building.progress = 0;
          itemsProducedThisTick++;
        }
      } else if (building.storage.copper_ore >= SMELT_ORE_COST) {
        const ticksNeeded = SMELT_TICKS.copper / (modifiers.smeltingSpeed * upgradeBonus);
        building.progress += 1 / ticksNeeded;
        if (building.progress >= 1 - EPSILON) {
          building.storage.copper_ore -= SMELT_ORE_COST;
          building.storage.copper_bar += 1;
          building.progress = 0;
          itemsProducedThisTick++;
        }
      }
    } else if (building.type === "forger") {
      const upgradeBonus = getUpgradeMultiplier(building.upgradeLevel ?? 0);
      const barsCost = RECIPE_BARS_COST[building.recipe];
      const forgeTicks = RECIPE_TICKS[building.recipe] / (modifiers.forgingSpeed * upgradeBonus);
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

  // 2. Belt transfer
  for (const belt of state.belts) {
    const { from, to } = getBeltEndpoints(belt);
    const src = findBuildingAt(state.buildings, from.x, from.y);
    const dst = findBuildingAt(state.buildings, to.x, to.y);
    if (!src || !dst) continue;
    if (src.constructionProgress < 1 || dst.constructionProgress < 1) continue;

    const internalCells = getBeltTravelTime(belt);
    const cellsPerTick = modifiers.beltSpeed;

    if (!belt.itemsInTransit) {
      belt.itemsInTransit = [];
    }

    belt.itemsInTransit = belt.itemsInTransit.filter((item) => {
      const legacyItem = item as any;
      if (legacyItem.progress !== undefined && item.cellIndex === undefined) {
        item.cellIndex = Math.floor(legacyItem.progress * internalCells);
        delete legacyItem.progress;
      }
      if (item.cellIndex === undefined) item.cellIndex = 0;
      item.cellIndex += cellsPerTick;
      if (item.cellIndex >= internalCells) {
        dst.storage[item.itemType] += 1;
        return false;
      }
      return true;
    });

    const maxItemsOnBelt = Math.max(1, internalCells);
    if (belt.itemsInTransit.length < maxItemsOnBelt) {
      const transferable = getTransferableItem(src, dst);
      if (transferable && src.storage[transferable] > 0) {
        src.storage[transferable] -= 1;
        belt.itemsInTransit.push({ itemType: transferable, cellIndex: 0 });
      }
    }
  }

  // 3. Shop NPC processing
  for (const building of state.buildings) {
    if (building.type !== "shop") continue;

    trySpawnKing(state, building, modifiers.npcPatience);
    trySpawnMultiItemNpc(building, modifiers.npcPatience);

    const effectiveSpawnChance = NPC_SPAWN_CHANCE * modifiers.npcSpawnChance;
    if (building.npcQueue.length < NPC_MAX_QUEUE && Math.random() < effectiveSpawnChance) {
      building.npcQueue.push(spawnNpc(modifiers.npcPatience));
    }

    building.npcQueue = building.npcQueue.filter((npc) => {
      if (npc.npcType === "king" && npc.kingDemand) {
        if (canFulfillKingDemand(building.storage, npc.kingDemand)) {
          fulfillKingDemand(building.storage, npc.kingDemand);
          const earned = Math.round(npc.kingDemand.totalValue * modifiers.sellPrice);
          state.currency += earned;
          currencyEarnedThisTick += earned;
          meta.totalCurrencyEarned += earned;
          return false;
        }
        return true;
      }

      if (npc.multiItemDemand) {
        if (canFulfillMultiItemDemand(building.storage, npc.multiItemDemand)) {
          fulfillMultiItemDemand(building.storage, npc.multiItemDemand);
          const earned = Math.round(npc.multiItemDemand.totalValue * modifiers.sellPrice);
          state.currency += earned;
          currencyEarnedThisTick += earned;
          meta.totalCurrencyEarned += earned;
          return false;
        }
        return true;
      }

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
        return false;
      }
      return true;
    });

    building.npcQueue = building.npcQueue.filter((npc) => {
      npc.patienceLeft -= 1;
      if (npc.patienceLeft <= 0) {
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

    for (const item of FINISHED_GOODS) {
      const count = building.storage[item];
      if (count >= WHOLESALE_THRESHOLD) {
        const basePrice = SELL_PRICES[item];
        const wholesalePrice = Math.floor(basePrice * WHOLESALE_MULTIPLIER * modifiers.sellPrice);
        const earned = wholesalePrice * count;
        state.currency += earned;
        currencyEarnedThisTick += earned;
        building.storage[item] = 0;
      }
    }
  }

  // 5. Geologist explorer
  const activeGeologist = state.buildings.find(
    b => b.type === "geologist" && b.constructionProgress >= 1
  );

  if (activeGeologist) {
    if (state.currency >= GEOLOGIST_UPKEEP) {
      state.currency -= GEOLOGIST_UPKEEP;

      if (!state.geologistExplorer) {
        state.geologistExplorer = createGeologistExplorer(state, activeGeologist.position);
      }

      const explorer = state.geologistExplorer;

      const moveSpeed = 0.5;
      const dx = explorer.targetPosition.x - explorer.position.x;
      const dy = explorer.targetPosition.y - explorer.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > moveSpeed) {
        explorer.position.x += (dx / dist) * moveSpeed;
        explorer.position.y += (dy / dist) * moveSpeed;
      } else {
        explorer.position.x = explorer.targetPosition.x;
        explorer.position.y = explorer.targetPosition.y;
        explorer.targetPosition = pickRandomExplorerTarget(state);
      }

      explorer.ticksUntilDiscovery--;

      if (explorer.ticksUntilDiscovery <= 0) {
        const occupiedPositions = new Set<string>();
        state.oreNodes.forEach(n => occupiedPositions.add(`${n.position.x},${n.position.y}`));
        state.buildings.forEach(b => occupiedPositions.add(`${b.position.x},${b.position.y}`));

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

        explorer.ticksUntilDiscovery = randomInt(GEOLOGIST_DISCOVERY_TICKS_MIN, GEOLOGIST_DISCOVERY_TICKS_MAX);
      }

      const totalTicks = (GEOLOGIST_DISCOVERY_TICKS_MIN + GEOLOGIST_DISCOVERY_TICKS_MAX) / 2;
      explorer.searchProgress = 1 - (explorer.ticksUntilDiscovery / totalTicks);
    }
  } else {
    state.geologistExplorer = null;
  }

  // 6. Automation
  if (automation.enabled) {
    runAutomation(state, upgrades, automation);
  }

  return { currencyEarned: currencyEarnedThisTick, itemsProduced: itemsProducedThisTick };
}

function getTransferableItem(src: Building, dst: Building): ItemType | null {
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
    for (const item of FINISHED_GOODS) {
      if (src.storage[item] > 0) return item;
    }
    return null;
  }

  if (dst.type === "junction") {
    for (const item of ALL_ITEMS) {
      if (src.storage[item] > 0) return item;
    }
    return null;
  }

  if (dst.type === "sorter") {
    const allowed = ITEM_CATEGORIES[dst.sorterFilter ?? "all"];
    for (const item of allowed) {
      if (src.storage[item] > 0) return item;
    }
    return null;
  }

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
      wantedItem: "dagger",
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
  if (Math.random() >= 0.03) return false;

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
    wantedItem: items[0].item,
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
