import {
  Building,
  ItemType,
  Position,
  BuildingType,
  ForgerRecipe,
  GameState,
  Inventory,
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
  BUILDING_COSTS,
  BELT_COST,
  getBeltTravelTime,
  WHOLESALE_THRESHOLD,
  WHOLESALE_MULTIPLIER,
  CONSTRUCTION_TICKS,
  GEOLOGIST_UPKEEP,
  GEOLOGIST_DISCOVERY_TICKS,
} from "../../shared/types.js";
import { getState } from "./state.js";

let intervalId: ReturnType<typeof setInterval> | null = null;

function findBuildingAt(buildings: Building[], x: number, y: number): Building | undefined {
  return buildings.find((b) => b.position.x === x && b.position.y === y);
}

function tick(): void {
  const state = getState();
  state.tick++;

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
        const ticksNeeded = MINER_TICKS[oreNode.type];
        building.progress += 1 / ticksNeeded;
        if (building.progress >= 1 - EPSILON) {
          const oreItem: ItemType = oreNode.type === "iron" ? "iron_ore" : "copper_ore";
          building.storage[oreItem] += 1;
          building.progress = 0;
        }
      }
    } else if (building.type === "smelter") {
      if (building.storage.iron_ore >= SMELT_ORE_COST) {
        building.progress += 1 / SMELT_TICKS.iron;
        if (building.progress >= 1 - EPSILON) {
          building.storage.iron_ore -= SMELT_ORE_COST;
          building.storage.iron_bar += 1;
          building.progress = 0;
        }
      } else if (building.storage.copper_ore >= SMELT_ORE_COST) {
        building.progress += 1 / SMELT_TICKS.copper;
        if (building.progress >= 1 - EPSILON) {
          building.storage.copper_ore -= SMELT_ORE_COST;
          building.storage.copper_bar += 1;
          building.progress = 0;
        }
      }
    } else if (building.type === "forger") {
      const barsCost = RECIPE_BARS_COST[building.recipe];
      const forgeTicks = RECIPE_TICKS[building.recipe];
      const barType = RECIPE_BAR_TYPE[building.recipe];
      if (building.storage[barType] >= barsCost) {
        building.progress += 1 / forgeTicks;
        if (building.progress >= 1 - EPSILON) {
          building.storage[barType] -= barsCost;
          building.storage[building.recipe] += 1;
          building.progress = 0;
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

    const travelTime = getBeltTravelTime(belt.from, belt.to);
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
      building.npcQueue.push(spawnNpc());
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
        state.currency += Math.round(basePrice * mult);
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
        const wholesalePrice = Math.floor(basePrice * WHOLESALE_MULTIPLIER);
        state.currency += wholesalePrice * count;
        building.storage[item] = 0;
      }
    }
  }

  // 5. Geologist ore discovery
  for (const building of state.buildings) {
    if (building.type !== "geologist") continue;
    if (building.constructionProgress < 1) continue; // Not yet built

    // Deduct upkeep if player can afford it
    if (state.currency >= GEOLOGIST_UPKEEP) {
      state.currency -= GEOLOGIST_UPKEEP;

      // Progress towards discovering a new node
      building.progress += 1 / GEOLOGIST_DISCOVERY_TICKS;

      if (building.progress >= 1) {
        building.progress = 0;

        // Find empty position for new ore node
        const occupiedPositions = new Set<string>();
        state.oreNodes.forEach(n => occupiedPositions.add(`${n.position.x},${n.position.y}`));
        state.buildings.forEach(b => occupiedPositions.add(`${b.position.x},${b.position.y}`));

        // Try to find an empty spot
        let attempts = 0;
        while (attempts < 100) {
          const x = Math.floor(Math.random() * state.mapWidth);
          const y = Math.floor(Math.random() * state.mapHeight);
          const key = `${x},${y}`;
          if (!occupiedPositions.has(key)) {
            const oreType = Math.random() < 0.5 ? "iron" : "copper";
            state.oreNodes.push({
              id: `ore-discovered-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              position: { x, y },
              type: oreType,
            });
            break;
          }
          attempts++;
        }
      }
    }
  }

  // 6. AI expansion (if enabled)
  aiExpand(state);
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

function randomNpcType(): NpcType {
  const types: NpcType[] = ["warrior", "mage", "collector", "merchant"];
  return types[Math.floor(Math.random() * types.length)];
}

function randomWantedItem(): FinishedGood {
  return FINISHED_GOODS[Math.floor(Math.random() * FINISHED_GOODS.length)];
}

function spawnNpc(): Npc {
  const npcType = randomNpcType();
  const [minP, maxP] = NPC_PATIENCE[npcType];
  const patience = randomInt(minP, maxP);
  return {
    id: `npc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    npcType,
    wantedItem: randomWantedItem(),
    patienceLeft: patience,
    maxPatience: patience,
  };
}

// AI recipe optimization - switch forgers to maximize profit
function aiOptimizeRecipes(state: GameState): void {
  const shops = state.buildings.filter(b => b.type === "shop");
  const forgers = state.buildings.filter(b => b.type === "forger");

  if (shops.length === 0 || forgers.length === 0) return;

  // Calculate profit for each NPC (price × multiplier) with urgency weight
  interface NpcProfit {
    item: FinishedGood;
    profit: number;
    urgency: number; // Lower patience = higher urgency
    score: number;   // Combined profit + urgency score
  }

  const npcProfits: NpcProfit[] = [];
  for (const shop of shops) {
    for (const npc of shop.npcQueue) {
      const basePrice = SELL_PRICES[npc.wantedItem];
      const isIron = RECIPE_BAR_TYPE[npc.wantedItem] === "iron_bar";
      const mult = isIron
        ? NPC_PRICE_MULTIPLIER[npc.npcType].iron
        : NPC_PRICE_MULTIPLIER[npc.npcType].copper;
      const profit = Math.round(basePrice * mult);
      // Urgency: invert patience ratio (0 patience = max urgency)
      const urgency = 1 - (npc.patienceLeft / npc.maxPatience);
      // Score: profit weighted by urgency (urgent high-value NPCs first)
      const score = profit * (1 + urgency * 2);
      npcProfits.push({ item: npc.wantedItem, profit, urgency, score });
    }
  }

  if (npcProfits.length === 0) return;

  // Sort by score descending (highest profit + urgency first)
  npcProfits.sort((a, b) => b.score - a.score);

  // Count supply in shop storage
  const supply: Record<FinishedGood, number> = { dagger: 0, armour: 0, wand: 0, magic_powder: 0 };
  for (const shop of shops) {
    for (const item of FINISHED_GOODS) {
      supply[item] += shop.storage[item];
    }
  }

  // Track which NPCs can be served by existing supply
  const unservedNpcs: NpcProfit[] = [];
  const tempSupply = { ...supply };
  for (const npc of npcProfits) {
    if (tempSupply[npc.item] > 0) {
      tempSupply[npc.item]--;
    } else {
      unservedNpcs.push(npc);
    }
  }

  if (unservedNpcs.length === 0) return;

  // Determine which bar type each forger uses
  function getForgerBarType(forger: Building): "iron_bar" | "copper_bar" | null {
    const feedBelt = state.belts.find(b =>
      b.to.x === forger.position.x && b.to.y === forger.position.y
    );
    if (!feedBelt) return null;

    const smelter = state.buildings.find(b =>
      b.type === "smelter" && b.position.x === feedBelt.from.x && b.position.y === feedBelt.from.y
    );
    if (!smelter) return null;

    const minerBelt = state.belts.find(b =>
      b.to.x === smelter.position.x && b.to.y === smelter.position.y
    );
    if (!minerBelt) return null;

    const miner = state.buildings.find(b =>
      b.type === "miner" && b.position.x === minerBelt.from.x && b.position.y === minerBelt.from.y
    );
    if (!miner) return null;

    const oreNode = state.oreNodes.find(n =>
      n.position.x === miner.position.x && n.position.y === miner.position.y
    );

    return oreNode?.type === "copper" ? "copper_bar" : "iron_bar";
  }

  // Find highest-value unserved NPC we can produce for
  for (const npc of unservedNpcs) {
    const neededBarType = RECIPE_BAR_TYPE[npc.item];

    // Find a forger that can switch to this item
    for (const forger of forgers) {
      if (forger.recipe === npc.item) continue; // Already producing
      if (forger.progress > 0.3) continue; // Don't interrupt if >30% done

      const forgerBarType = getForgerBarType(forger);
      if (forgerBarType !== neededBarType) continue;

      // Check if current recipe is serving any high-value unserved NPCs
      const currentRecipeValue = unservedNpcs
        .filter(n => n.item === forger.recipe)
        .reduce((sum, n) => sum + n.score, 0);

      // Only switch if new item has higher total value
      if (npc.score > currentRecipeValue) {
        forger.recipe = npc.item;
        forger.progress = 0;
        return; // One switch per tick
      }
    }
  }
}

// AI expansion logic - runs when aiMode is enabled
function aiExpand(state: GameState): void {
  if (!state.aiMode) return;

  // Priority 0: Optimize forger recipes based on NPC demand
  aiOptimizeRecipes(state);

  const posKey = (p: Position) => `${p.x},${p.y}`;

  function isOccupied(pos: Position): boolean {
    return state.buildings.some(b => b.position.x === pos.x && b.position.y === pos.y);
  }

  function inBounds(pos: Position): boolean {
    return pos.x >= 0 && pos.x < state.mapWidth && pos.y >= 0 && pos.y < state.mapHeight;
  }

  function emptyInventory(): Inventory {
    return { iron_ore: 0, iron_bar: 0, dagger: 0, armour: 0, copper_ore: 0, copper_bar: 0, wand: 0, magic_powder: 0 };
  }

  function findEmptyNear(target: Position, reserved: Set<string>): Position | null {
    const directions = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
      { dx: 1, dy: 1 }, { dx: -1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: -1 },
    ];
    for (let radius = 1; radius <= 10; radius++) {
      for (const dir of directions) {
        const pos = { x: target.x + dir.dx * radius, y: target.y + dir.dy * radius };
        if (!inBounds(pos)) continue;
        if (reserved.has(posKey(pos))) continue;
        if (isOccupied(pos)) continue;
        const onOre = state.oreNodes.some(n => n.position.x === pos.x && n.position.y === pos.y);
        if (!onOre) return pos;
      }
    }
    return null;
  }

  function placeBuilding(type: BuildingType, pos: Position, recipe?: ForgerRecipe): boolean {
    if (state.currency < BUILDING_COSTS[type]) return false;
    if (isOccupied(pos)) return false;

    state.currency -= BUILDING_COSTS[type];
    state.buildings.push({
      id: `building-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      position: pos,
      progress: 0,
      constructionProgress: 0,
      storage: emptyInventory(),
      recipe: recipe || "dagger",
      npcQueue: [],
    });
    return true;
  }

  function placeBelt(from: Position, to: Position): boolean {
    if (state.currency < BELT_COST) return false;
    // Check belt doesn't already exist
    const exists = state.belts.some(
      b => b.from.x === from.x && b.from.y === from.y && b.to.x === to.x && b.to.y === to.y
    );
    if (exists) return false;

    state.currency -= BELT_COST;
    state.belts.push({
      id: `belt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      from,
      to,
      itemsInTransit: [],
    });
    return true;
  }

  // Get existing building counts
  const miners = state.buildings.filter(b => b.type === "miner");
  const smelters = state.buildings.filter(b => b.type === "smelter");
  const forgers = state.buildings.filter(b => b.type === "forger");
  const shops = state.buildings.filter(b => b.type === "shop");
  const warehouses = state.buildings.filter(b => b.type === "warehouse");
  const geologists = state.buildings.filter(b => b.type === "geologist");

  // Find ore nodes without miners
  const minedPositions = new Set(miners.map(m => posKey(m.position)));
  const unmined = state.oreNodes.filter(n => !minedPositions.has(posKey(n.position)));

  const reserved = new Set<string>();
  state.buildings.forEach(b => reserved.add(posKey(b.position)));

  // Priority 1: If no shop exists but we have a forger, add a shop
  if (shops.length === 0 && forgers.length > 0) {
    const cost = BUILDING_COSTS.shop + BELT_COST;
    if (state.currency >= cost) {
      const forger = forgers[0];
      const shopPos = findEmptyNear(forger.position, reserved);
      if (shopPos) {
        if (placeBuilding("shop", shopPos)) {
          placeBelt(forger.position, shopPos);
          return; // One action per tick
        }
      }
    }
  }

  // Priority 2: If no complete chain exists, build one
  if (miners.length === 0 && unmined.length > 0) {
    const cost = BUILDING_COSTS.miner;
    if (state.currency >= cost) {
      placeBuilding("miner", unmined[0].position);
      return;
    }
  }

  if (miners.length > 0 && smelters.length === 0) {
    const cost = BUILDING_COSTS.smelter + BELT_COST;
    if (state.currency >= cost) {
      const miner = miners[0];
      const smelterPos = findEmptyNear(miner.position, reserved);
      if (smelterPos) {
        if (placeBuilding("smelter", smelterPos)) {
          placeBelt(miner.position, smelterPos);
          return;
        }
      }
    }
  }

  if (smelters.length > 0 && forgers.length === 0) {
    const cost = BUILDING_COSTS.forger + BELT_COST;
    if (state.currency >= cost) {
      const smelter = smelters[0];
      const forgerPos = findEmptyNear(smelter.position, reserved);
      if (forgerPos) {
        // Determine recipe based on what ore type feeds this smelter
        const minerBelt = state.belts.find(b => b.to.x === smelter.position.x && b.to.y === smelter.position.y);
        let recipe: ForgerRecipe = "dagger";
        if (minerBelt) {
          const miner = state.buildings.find(b => b.position.x === minerBelt.from.x && b.position.y === minerBelt.from.y);
          if (miner) {
            const oreNode = state.oreNodes.find(n => n.position.x === miner.position.x && n.position.y === miner.position.y);
            if (oreNode?.type === "copper") {
              recipe = "wand";
            }
          }
        }
        if (placeBuilding("forger", forgerPos, recipe)) {
          placeBelt(smelter.position, forgerPos);
          return;
        }
      }
    }
  }

  if (forgers.length > 0 && shops.length === 0) {
    const cost = BUILDING_COSTS.shop + BELT_COST;
    if (state.currency >= cost) {
      const forger = forgers[0];
      const shopPos = findEmptyNear(forger.position, reserved);
      if (shopPos) {
        if (placeBuilding("shop", shopPos)) {
          placeBelt(forger.position, shopPos);
          return;
        }
      }
    }
  }

  // Priority 3: Add more miners to existing smelters (only same ore type, max 2 per smelter)
  if (unmined.length > 0 && smelters.length > 0) {
    const cost = BUILDING_COSTS.miner + BELT_COST;
    if (state.currency >= cost) {
      for (const smelter of smelters) {
        const feedingBelts = state.belts.filter(b =>
          b.to.x === smelter.position.x && b.to.y === smelter.position.y
        );

        let smelterOreType: string | null = null;
        for (const belt of feedingBelts) {
          const srcMiner = state.buildings.find(b =>
            b.position.x === belt.from.x && b.position.y === belt.from.y && b.type === "miner"
          );
          if (srcMiner) {
            const oreNode = state.oreNodes.find(n =>
              n.position.x === srcMiner.position.x && n.position.y === srcMiner.position.y
            );
            if (oreNode) {
              smelterOreType = oreNode.type;
              break;
            }
          }
        }

        // Max 2 miners per smelter to maintain throughput balance
        if (feedingBelts.length < 2 && smelterOreType) {
          const sameTypeUnmined = unmined.filter(n => n.type === smelterOreType);
          const oreByDistance = sameTypeUnmined.map(n => ({
            node: n,
            dist: Math.abs(n.position.x - smelter.position.x) + Math.abs(n.position.y - smelter.position.y)
          })).sort((a, b) => a.dist - b.dist);

          for (const { node } of oreByDistance) {
            if (placeBuilding("miner", node.position)) {
              placeBelt(node.position, smelter.position);
              return;
            }
          }
        }
      }
    }
  }

  // Priority 4: Connect unconnected forgers to shop or warehouse
  if (shops.length > 0 || warehouses.length > 0) {
    const salesBuilding = shops[0] || warehouses[0];
    for (const forger of forgers) {
      const hasBeltToSales = state.belts.some(
        b => b.from.x === forger.position.x && b.from.y === forger.position.y &&
             (shops.some(s => b.to.x === s.position.x && b.to.y === s.position.y) ||
              warehouses.some(w => b.to.x === w.position.x && b.to.y === w.position.y))
      );
      if (!hasBeltToSales) {
        if (state.currency >= BELT_COST) {
          placeBelt(forger.position, salesBuilding.position);
          return;
        }
      }
    }
  }

  // Priority 5: Build warehouse when production exceeds shop capacity
  if (shops.length > 0 && warehouses.length === 0 && forgers.length >= 2) {
    // Check if production is backing up (forgers have items in storage)
    let backlogCount = 0;
    for (const forger of forgers) {
      for (const item of FINISHED_GOODS) {
        backlogCount += forger.storage[item];
      }
    }

    // Check if shop queue is often full
    const shop = shops[0];
    const queueFull = shop.npcQueue.length >= 3;

    // Build warehouse if significant backlog or queue pressure
    if (backlogCount >= 5 || (queueFull && backlogCount >= 2)) {
      const cost = BUILDING_COSTS.warehouse + BELT_COST * forgers.length;
      if (state.currency >= cost) {
        // Place warehouse near the shop
        const warehousePos = findEmptyNear(shop.position, reserved);
        if (warehousePos) {
          if (placeBuilding("warehouse", warehousePos)) {
            // Connect all forgers to warehouse
            for (const forger of forgers) {
              placeBelt(forger.position, warehousePos);
            }
            return;
          }
        }
      }
    }
  }

  // Priority 6: Build new production chains for any unmined ore (expand capacity)
  const salesBuildings = [...shops, ...warehouses];
  if (salesBuildings.length > 0 && unmined.length > 0) {
    const fullChainCost = BUILDING_COSTS.miner + BUILDING_COSTS.smelter + BUILDING_COSTS.forger + BELT_COST * 3;
    if (state.currency >= fullChainCost) {
      // Pick closest unmined ore to any sales building for efficiency
      const salesBuilding = salesBuildings[0];
      const oreByDistance = unmined.map(n => ({
        node: n,
        dist: Math.abs(n.position.x - salesBuilding.position.x) + Math.abs(n.position.y - salesBuilding.position.y)
      })).sort((a, b) => a.dist - b.dist);

      for (const { node } of oreByDistance) {
        const minerPos = node.position;
        reserved.add(posKey(minerPos));

        const smelterPos = findEmptyNear(minerPos, reserved);
        if (smelterPos) {
          reserved.add(posKey(smelterPos));
          const forgerPos = findEmptyNear(smelterPos, reserved);

          if (forgerPos) {
            const recipe: ForgerRecipe = node.type === "copper" ? "wand" : "dagger";

            placeBuilding("miner", minerPos);
            placeBuilding("smelter", smelterPos);
            placeBuilding("forger", forgerPos, recipe);
            placeBelt(minerPos, smelterPos);
            placeBelt(smelterPos, forgerPos);
            placeBelt(forgerPos, salesBuilding.position);
            return;
          }
        }
        // Clean up reserved if we couldn't place
        reserved.delete(posKey(minerPos));
      }
    }
  }

  // Priority 7: Build geologist when established and few unmined nodes left
  if (geologists.length === 0 && shops.length > 0 && forgers.length >= 2) {
    // Build geologist when running low on unmined nodes or have good income
    const shouldBuildGeologist = unmined.length <= 5 || (state.currency >= 500 && unmined.length <= 10);

    if (shouldBuildGeologist && state.currency >= BUILDING_COSTS.geologist) {
      // Place near the shop
      const shop = shops[0];
      const geoPos = findEmptyNear(shop.position, reserved);
      if (geoPos) {
        placeBuilding("geologist", geoPos);
        return;
      }
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
