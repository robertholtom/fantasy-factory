import {
  GameState,
  AutomationSettings,
  BuildingType,
  ForgerRecipe,
  Position,
  Inventory,
  BUILDING_COSTS,
  BELT_COST,
  FINISHED_GOODS,
  FinishedGood,
  SELL_PRICES,
  RECIPE_BAR_TYPE,
  NPC_PRICE_MULTIPLIER,
  MINER_TICKS,
  SMELT_TICKS,
  SMELT_ORE_COST,
  RECIPE_BARS_COST,
  RECIPE_TICKS,
  WHOLESALE_MULTIPLIER,
  SorterFilter,
  findPath,
  getBeltEndpoints,
  UpgradeState,
} from "./types";
import { isAutomationUnlocked } from "./modifiers";

function emptyInventory(): Inventory {
  return { iron_ore: 0, iron_bar: 0, dagger: 0, armour: 0, copper_ore: 0, copper_bar: 0, wand: 0, magic_powder: 0 };
}

interface BuildAction {
  type: "miner" | "smelter" | "forger" | "shop" | "warehouse" | "geologist" | "chain" | "belt" | "junction" | "sorter";
  cost: number;
  profitPerTick: number;
  roi: number;
  execute: () => boolean;
  description: string;
}

function calculateChainProfitPerTick(oreType: "iron" | "copper"): number {
  const minerTicks = MINER_TICKS[oreType];
  const smeltTicks = SMELT_TICKS[oreType];

  const orePerTick = 2 / minerTicks;
  const barsPerTick = Math.min(orePerTick / SMELT_ORE_COST, 1 / smeltTicks);

  const recipes: ForgerRecipe[] = oreType === "iron" ? ["dagger", "armour"] : ["wand", "magic_powder"];
  let bestProfitPerTick = 0;

  for (const recipe of recipes) {
    const forgeTicks = RECIPE_TICKS[recipe];
    const barsCost = RECIPE_BARS_COST[recipe];
    const itemsPerTick = Math.min(barsPerTick / barsCost, 1 / forgeTicks);
    const basePrice = SELL_PRICES[recipe];
    const profitPerTick = itemsPerTick * basePrice;
    bestProfitPerTick = Math.max(bestProfitPerTick, profitPerTick);
  }

  return bestProfitPerTick;
}

function calculateMinerAdditionProfit(oreType: "iron" | "copper", currentMinerCount: number): number {
  const minerTicks = MINER_TICKS[oreType];
  const smeltTicks = SMELT_TICKS[oreType];

  const currentOrePerTick = currentMinerCount / minerTicks;
  const currentBarsPerTick = Math.min(currentOrePerTick / SMELT_ORE_COST, 1 / smeltTicks);

  const newOrePerTick = (currentMinerCount + 1) / minerTicks;
  const newBarsPerTick = Math.min(newOrePerTick / SMELT_ORE_COST, 1 / smeltTicks);

  const marginalBarsPerTick = newBarsPerTick - currentBarsPerTick;

  const recipe: ForgerRecipe = oreType === "iron" ? "dagger" : "wand";
  const forgeTicks = RECIPE_TICKS[recipe];
  const barsCost = RECIPE_BARS_COST[recipe];
  const marginalItemsPerTick = Math.min(marginalBarsPerTick / barsCost, 1 / forgeTicks);

  return marginalItemsPerTick * SELL_PRICES[recipe];
}

function calculateWarehouseProfit(forgerCount: number): number {
  const productionPerTick = forgerCount * 0.15;
  const shopSalesPerTick = Math.min(productionPerTick, 0.16);
  const excessProduction = productionPerTick - shopSalesPerTick;
  const avgPrice = 25;
  return excessProduction * avgPrice * WHOLESALE_MULTIPLIER;
}

function pickRecipeForOreType(state: GameState, oreType: "iron" | "copper"): ForgerRecipe {
  const demand = analyzeDemand(state);

  if (oreType === "iron") {
    return demand.armour > demand.dagger ? "armour" : "dagger";
  } else {
    return demand.magic_powder > demand.wand ? "magic_powder" : "wand";
  }
}

function analyzeDemand(state: GameState): Record<FinishedGood, number> {
  const demand: Record<FinishedGood, number> = { dagger: 0, armour: 0, wand: 0, magic_powder: 0 };

  for (const building of state.buildings) {
    if (building.type === "shop") {
      for (const npc of building.npcQueue) {
        const urgencyWeight = 1 + (1 - npc.patienceLeft / npc.maxPatience) * 2;

        if (npc.multiItemDemand) {
          for (const { item, quantity } of npc.multiItemDemand.items) {
            const value = SELL_PRICES[item] * npc.multiItemDemand.bonusMultiplier * quantity * urgencyWeight;
            demand[item] += value;
          }
        } else if (npc.kingDemand) {
          for (const { item, quantity } of npc.kingDemand.items) {
            const value = SELL_PRICES[item] * 4.0 * quantity * urgencyWeight;
            demand[item] += value;
          }
        } else {
          const basePrice = SELL_PRICES[npc.wantedItem];
          const isIron = RECIPE_BAR_TYPE[npc.wantedItem] === "iron_bar";
          const mult = isIron
            ? NPC_PRICE_MULTIPLIER[npc.npcType].iron
            : NPC_PRICE_MULTIPLIER[npc.npcType].copper;
          const value = basePrice * mult * urgencyWeight;
          demand[npc.wantedItem] += value;
        }
      }
    }
  }

  return demand;
}

function analyzeBottlenecks(state: GameState): {
  needMoreMiners: boolean;
  needMoreSmelters: boolean;
  needMoreForgers: boolean;
  oreTypeNeeded: "iron" | "copper" | null;
} {
  const miners = state.buildings.filter(b => b.type === "miner" && b.constructionProgress >= 1);
  const smelters = state.buildings.filter(b => b.type === "smelter" && b.constructionProgress >= 1);
  const forgers = state.buildings.filter(b => b.type === "forger" && b.constructionProgress >= 1);

  let oreInSmelters = 0;
  for (const smelter of smelters) {
    oreInSmelters += smelter.storage.iron_ore + smelter.storage.copper_ore;
  }

  let barsInForgers = 0;
  for (const forger of forgers) {
    barsInForgers += forger.storage.iron_bar + forger.storage.copper_bar;
  }

  let finishedGoods = 0;
  for (const forger of forgers) {
    for (const item of FINISHED_GOODS) {
      finishedGoods += forger.storage[item];
    }
  }

  const demand = analyzeDemand(state);
  const ironDemand = demand.dagger + demand.armour;
  const copperDemand = demand.wand + demand.magic_powder;
  const oreTypeNeeded = ironDemand > copperDemand ? "iron" : copperDemand > ironDemand ? "copper" : null;

  return {
    needMoreMiners: oreInSmelters < 4 && miners.length < smelters.length * 2,
    needMoreSmelters: barsInForgers < 3 && smelters.length < forgers.length,
    needMoreForgers: finishedGoods > 5,
    oreTypeNeeded,
  };
}

function advancedOptimizeRecipes(state: GameState, upgrades: UpgradeState): void {
  const shops = state.buildings.filter(b => b.type === "shop");
  const forgers = state.buildings.filter(b => b.type === "forger");

  if (shops.length === 0 || forgers.length === 0) return;

  interface NpcProfit {
    item: FinishedGood;
    profit: number;
    urgency: number;
    score: number;
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
      const urgency = 1 - (npc.patienceLeft / npc.maxPatience);
      const score = profit * (1 + urgency * 2);
      npcProfits.push({ item: npc.wantedItem, profit, urgency, score });
    }
  }

  if (npcProfits.length === 0) return;

  npcProfits.sort((a, b) => b.score - a.score);

  const supply: Record<FinishedGood, number> = { dagger: 0, armour: 0, wand: 0, magic_powder: 0 };
  for (const shop of shops) {
    for (const item of FINISHED_GOODS) {
      supply[item] += shop.storage[item];
    }
  }

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

  function getForgerBarType(forger: typeof forgers[0]): "iron_bar" | "copper_bar" | null {
    const feedBelt = state.belts.find(b => {
      const { to } = getBeltEndpoints(b);
      return to.x === forger.position.x && to.y === forger.position.y;
    });
    if (!feedBelt) return null;

    const { from: feedFrom } = getBeltEndpoints(feedBelt);
    const smelter = state.buildings.find(b =>
      b.type === "smelter" && b.position.x === feedFrom.x && b.position.y === feedFrom.y
    );
    if (!smelter) return null;

    const minerBelt = state.belts.find(b => {
      const { to } = getBeltEndpoints(b);
      return to.x === smelter.position.x && to.y === smelter.position.y;
    });
    if (!minerBelt) return null;

    const { from: minerBeltFrom } = getBeltEndpoints(minerBelt);
    const miner = state.buildings.find(b =>
      b.type === "miner" && b.position.x === minerBeltFrom.x && b.position.y === minerBeltFrom.y
    );
    if (!miner) return null;

    const oreNode = state.oreNodes.find(n =>
      n.position.x === miner.position.x && n.position.y === miner.position.y
    );

    return oreNode?.type === "copper" ? "copper_bar" : "iron_bar";
  }

  for (const npc of unservedNpcs) {
    const neededBarType = RECIPE_BAR_TYPE[npc.item];

    for (const forger of forgers) {
      if (forger.recipe === npc.item) continue;
      if (forger.progress > 0.3) continue;

      const forgerBarType = getForgerBarType(forger);
      if (forgerBarType !== neededBarType) continue;

      const currentRecipeValue = unservedNpcs
        .filter(n => n.item === forger.recipe)
        .reduce((sum, n) => sum + n.score, 0);

      if (npc.score > currentRecipeValue) {
        forger.recipe = npc.item;
        forger.progress = 0;
        return;
      }
    }
  }
}

function basicOptimizeRecipes(state: GameState, settings: AutomationSettings, upgrades: UpgradeState): void {
  if (!settings.autoRecipeSwitch || !isAutomationUnlocked(upgrades, "autoRecipe")) {
    return;
  }

  const forgers = state.buildings.filter(b => b.type === "forger" && b.constructionProgress >= 1);
  if (forgers.length === 0) return;

  const demand = analyzeDemand(state);

  const itemsByDemand = (Object.entries(demand) as [FinishedGood, number][])
    .sort((a, b) => b[1] - a[1]);

  for (const forger of forgers) {
    if (forger.progress > 0.3) continue;

    const feedBelt = state.belts.find(b => {
      const { to } = getBeltEndpoints(b);
      return to.x === forger.position.x && to.y === forger.position.y;
    });
    if (!feedBelt) continue;

    const { from: feedFrom } = getBeltEndpoints(feedBelt);
    const smelter = state.buildings.find(b =>
      b.type === "smelter" && b.position.x === feedFrom.x && b.position.y === feedFrom.y
    );
    if (!smelter) continue;

    const hasIronBars = smelter.storage.iron_bar > 0 || forger.storage.iron_bar > 0;
    const hasCopperBars = smelter.storage.copper_bar > 0 || forger.storage.copper_bar > 0;

    for (const [item] of itemsByDemand) {
      const neededBar = RECIPE_BAR_TYPE[item];
      if (neededBar === "iron_bar" && hasIronBars) {
        if (forger.recipe !== item) {
          forger.recipe = item;
          forger.progress = 0;
        }
        break;
      }
      if (neededBar === "copper_bar" && hasCopperBars) {
        if (forger.recipe !== item) {
          forger.recipe = item;
          forger.progress = 0;
        }
        break;
      }
    }
  }
}

export function optimizeRecipes(state: GameState, settings: AutomationSettings, upgrades: UpgradeState): void {
  if (!settings.autoRecipeSwitch || !isAutomationUnlocked(upgrades, "autoRecipe")) {
    return;
  }

  if (settings.useAdvancedRecipeLogic) {
    advancedOptimizeRecipes(state, upgrades);
  } else {
    basicOptimizeRecipes(state, settings, upgrades);
  }
}

export function runAutomation(state: GameState, upgrades: UpgradeState, settings: AutomationSettings): void {
  if (!settings.enabled) return;

  if (state.currency <= settings.reserveCurrency) return;

  const availableCurrency = state.currency - settings.reserveCurrency;

  const posKey = (p: Position) => `${p.x},${p.y}`;

  function isOccupied(pos: Position): boolean {
    return state.buildings.some(b => b.position.x === pos.x && b.position.y === pos.y);
  }

  function inBounds(pos: Position): boolean {
    return pos.x >= 0 && pos.x < state.mapWidth && pos.y >= 0 && pos.y < state.mapHeight;
  }

  function findEmptyNear(target: Position, reserved: Set<string>, requireBeltPath = true): Position | null {
    const directions = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
      { dx: 1, dy: 1 }, { dx: -1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: -1 },
    ];
    const obstacles = buildObstacleSet();
    const candidates: { pos: Position; dist: number }[] = [];

    for (let radius = 2; radius <= 15; radius++) {
      for (const dir of directions) {
        const pos = { x: target.x + dir.dx * radius, y: target.y + dir.dy * radius };
        if (!inBounds(pos)) continue;
        if (reserved.has(posKey(pos))) continue;
        if (isOccupied(pos)) continue;
        const onOre = state.oreNodes.some(n => n.position.x === pos.x && n.position.y === pos.y);
        if (onOre) continue;

        if (requireBeltPath) {
          const tempObstacles = new Set(obstacles);
          tempObstacles.delete(posKey(target));
          tempObstacles.delete(posKey(pos));
          const check = canPlaceBelt(target, pos, tempObstacles);
          if (!check.valid) continue;
        }

        candidates.push({ pos, dist: Math.abs(pos.x - target.x) + Math.abs(pos.y - target.y) });
      }
      if (candidates.length > 0) break;
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.dist - b.dist);
    return candidates[0].pos;
  }

  function placeBuilding(type: BuildingType, pos: Position, recipe?: ForgerRecipe, sorterFilter?: SorterFilter): boolean {
    if (availableCurrency < BUILDING_COSTS[type]) return false;
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
      upgradeLevel: 0,
      sorterFilter: type === "sorter" ? (sorterFilter || "all") : undefined,
    });
    return true;
  }

  function findOutputHub(): Position | null {
    if (!settings.useHubRouting) return null;
    for (const junction of junctions) {
      const hasOutputBelt = state.belts.some(b => {
        const { from, to } = getBeltEndpoints(b);
        return from.x === junction.position.x && from.y === junction.position.y &&
          [...shops, ...warehouses].some(s => s.position.x === to.x && s.position.y === to.y);
      });
      if (hasOutputBelt) return junction.position;
    }
    return null;
  }

  function buildObstacleSet(): Set<string> {
    const obstacles = new Set<string>();
    for (const b of state.buildings) {
      obstacles.add(posKey(b.position));
    }
    for (const belt of state.belts) {
      if (belt.path) {
        for (let i = 1; i < belt.path.length - 1; i++) {
          obstacles.add(posKey(belt.path[i]));
        }
      }
    }
    return obstacles;
  }

  function canPlaceBelt(from: Position, to: Position, obstacles?: Set<string>): { valid: boolean; path?: Position[]; cost?: number } {
    const exists = state.belts.some((b) => {
      const { from: bFrom, to: bTo } = getBeltEndpoints(b);
      return bFrom.x === from.x && bFrom.y === from.y && bTo.x === to.x && bTo.y === to.y;
    });
    if (exists) return { valid: false };

    const obs = obstacles || buildObstacleSet();
    const path = findPath(from, to, obs, state.mapWidth, state.mapHeight);
    if (!path || path.length < 3) return { valid: false };

    const internalCells = path.length - 2;
    const totalCost = BELT_COST * internalCells;
    return { valid: true, path, cost: totalCost };
  }

  function placeBelt(from: Position, to: Position): boolean {
    const result = canPlaceBelt(from, to);
    if (!result.valid || !result.path || !result.cost) return false;
    if (availableCurrency < result.cost) return false;

    state.currency -= result.cost;
    state.belts.push({
      id: `belt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      path: result.path,
      itemsInTransit: [],
    });
    return true;
  }

  function placeBeltWithFallback(from: Position, targets: Position[]): boolean {
    for (const to of targets) {
      if (placeBelt(from, to)) return true;
    }
    return false;
  }

  const miners = state.buildings.filter(b => b.type === "miner");
  const smelters = state.buildings.filter(b => b.type === "smelter");
  const forgers = state.buildings.filter(b => b.type === "forger");
  const shops = state.buildings.filter(b => b.type === "shop");
  const warehouses = state.buildings.filter(b => b.type === "warehouse");
  const geologists = state.buildings.filter(b => b.type === "geologist");
  const junctions = state.buildings.filter(b => b.type === "junction");
  const sorters = state.buildings.filter(b => b.type === "sorter");

  const minedPositions = new Set(miners.map(m => posKey(m.position)));
  let unmined = state.oreNodes.filter(n => !minedPositions.has(posKey(n.position)));

  if (settings.priorityOreType !== "balanced") {
    const priorityUnmined = unmined.filter(n => n.type === settings.priorityOreType);
    if (priorityUnmined.length > 0) {
      unmined = priorityUnmined;
    }
  }

  const reserved = new Set<string>();
  state.buildings.forEach(b => reserved.add(posKey(b.position)));

  const canAutoBelt = settings.autoPlaceBelt;

  if (settings.useROICalculations) {
    const actions: BuildAction[] = [];
    const salesBuildings = [...shops, ...warehouses];

    if (settings.autoPlaceMiner && miners.length === 0 && unmined.length > 0) {
      actions.push({
        type: "miner",
        cost: BUILDING_COSTS.miner,
        profitPerTick: 0,
        roi: Infinity,
        description: "First miner",
        execute: () => placeBuilding("miner", unmined[0].position),
      });
    }

    if (settings.autoPlaceSmelter && miners.length > 0 && smelters.length === 0) {
      const cost = BUILDING_COSTS.smelter + (canAutoBelt ? BELT_COST : 0);
      const miner = miners[0];
      const smelterPos = findEmptyNear(miner.position, reserved);
      if (smelterPos) {
        actions.push({
          type: "smelter",
          cost,
          profitPerTick: 0,
          roi: Infinity,
          description: "First smelter",
          execute: () => {
            if (placeBuilding("smelter", smelterPos)) {
              if (canAutoBelt) placeBelt(miner.position, smelterPos);
              return true;
            }
            return false;
          },
        });
      }
    }

    if (settings.autoPlaceForger && smelters.length > 0 && forgers.length === 0) {
      const cost = BUILDING_COSTS.forger + (canAutoBelt ? BELT_COST : 0);
      const smelter = smelters[0];
      const forgerPos = findEmptyNear(smelter.position, reserved);
      if (forgerPos) {
        const minerBelt = state.belts.find(b => {
          const { to } = getBeltEndpoints(b);
          return to.x === smelter.position.x && to.y === smelter.position.y;
        });
        let oreType: "iron" | "copper" = "iron";
        if (minerBelt) {
          const { from: minerBeltFrom } = getBeltEndpoints(minerBelt);
          const miner = state.buildings.find(b => b.position.x === minerBeltFrom.x && b.position.y === minerBeltFrom.y);
          if (miner) {
            const oreNode = state.oreNodes.find(n => n.position.x === miner.position.x && n.position.y === miner.position.y);
            if (oreNode?.type === "copper") oreType = "copper";
          }
        }
        const recipe = pickRecipeForOreType(state, oreType);
        actions.push({
          type: "forger",
          cost,
          profitPerTick: 0,
          roi: Infinity,
          description: "First forger",
          execute: () => {
            if (placeBuilding("forger", forgerPos, recipe)) {
              if (canAutoBelt) placeBelt(smelter.position, forgerPos);
              return true;
            }
            return false;
          },
        });
      }
    }

    if (settings.autoPlaceShop && forgers.length > 0 && shops.length === 0) {
      const cost = BUILDING_COSTS.shop + (canAutoBelt ? BELT_COST : 0);
      const forger = forgers[0];
      const shopPos = findEmptyNear(forger.position, reserved);
      if (shopPos) {
        const oreType = state.oreNodes.find(n => {
          const miner = miners.find(m => m.position.x === n.position.x && m.position.y === n.position.y);
          return miner !== undefined;
        })?.type || "iron";
        const profit = calculateChainProfitPerTick(oreType);

        actions.push({
          type: "shop",
          cost,
          profitPerTick: profit,
          roi: cost / profit,
          description: "First shop",
          execute: () => {
            if (placeBuilding("shop", shopPos)) {
              if (canAutoBelt) placeBelt(forger.position, shopPos);
              return true;
            }
            return false;
          },
        });
      }
    }

    if (settings.autoPlaceMiner && salesBuildings.length > 0 && unmined.length > 0) {
      for (const smelter of smelters) {
        const feedingBelts = state.belts.filter(b => {
          const { to } = getBeltEndpoints(b);
          return to.x === smelter.position.x && to.y === smelter.position.y;
        });

        let smelterOreType: "iron" | "copper" | null = null;
        for (const belt of feedingBelts) {
          const { from: beltFrom } = getBeltEndpoints(belt);
          const srcMiner = state.buildings.find(b =>
            b.position.x === beltFrom.x && b.position.y === beltFrom.y && b.type === "miner"
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

        if (feedingBelts.length < 2 && smelterOreType) {
          const sameTypeUnmined = unmined.filter(n => n.type === smelterOreType);
          const closest = sameTypeUnmined
            .map(n => ({
              node: n,
              dist: Math.abs(n.position.x - smelter.position.x) + Math.abs(n.position.y - smelter.position.y)
            }))
            .sort((a, b) => a.dist - b.dist)[0];

          if (closest) {
            const cost = BUILDING_COSTS.miner + (canAutoBelt ? BELT_COST : 0);
            const profit = calculateMinerAdditionProfit(smelterOreType, feedingBelts.length);

            actions.push({
              type: "miner",
              cost,
              profitPerTick: profit,
              roi: profit > 0 ? cost / profit : Infinity,
              description: `Add miner (${smelterOreType})`,
              execute: () => {
                if (placeBuilding("miner", closest.node.position)) {
                  if (canAutoBelt) placeBelt(closest.node.position, smelter.position);
                  return true;
                }
                return false;
              },
            });
          }
        }
      }
    }

    if (settings.autoPlaceWarehouse && shops.length > 0 && warehouses.length === 0 && forgers.length >= 2) {
      const shop = shops[0];
      const warehousePos = findEmptyNear(shop.position, reserved);

      if (warehousePos) {
        const cost = BUILDING_COSTS.warehouse + (canAutoBelt ? BELT_COST * forgers.length : 0);
        const profit = calculateWarehouseProfit(forgers.length);

        let backlogCount = 0;
        for (const forger of forgers) {
          for (const item of FINISHED_GOODS) {
            backlogCount += forger.storage[item];
          }
        }

        const adjustedProfit = backlogCount > 3 ? profit * 2 : profit;

        actions.push({
          type: "warehouse",
          cost,
          profitPerTick: adjustedProfit,
          roi: adjustedProfit > 0 ? cost / adjustedProfit : Infinity,
          description: `Build warehouse`,
          execute: () => {
            if (placeBuilding("warehouse", warehousePos)) {
              if (canAutoBelt) {
                for (const forger of forgers) {
                  placeBelt(forger.position, warehousePos);
                }
              }
              return true;
            }
            return false;
          },
        });
      }
    }

    if (settings.buildCompleteChains && salesBuildings.length > 0 && unmined.length > 0) {
      const salesBuilding = salesBuildings[0];
      const outputHub = findOutputHub();
      const closest = unmined
        .map(n => ({
          node: n,
          dist: Math.abs(n.position.x - salesBuilding.position.x) + Math.abs(n.position.y - salesBuilding.position.y)
        }))
        .sort((a, b) => a.dist - b.dist)[0];

      if (closest) {
        const minerPos = closest.node.position;
        const tempReserved = new Set(reserved);
        tempReserved.add(posKey(minerPos));
        const smelterPos = findEmptyNear(minerPos, tempReserved);

        if (smelterPos) {
          tempReserved.add(posKey(smelterPos));
          const forgerPos = findEmptyNear(smelterPos, tempReserved);

          if (forgerPos) {
            const cost = BUILDING_COSTS.miner + BUILDING_COSTS.smelter + BUILDING_COSTS.forger + (canAutoBelt ? BELT_COST * 3 : 0);
            const profit = calculateChainProfitPerTick(closest.node.type);
            const recipe = pickRecipeForOreType(state, closest.node.type);
            const outputTarget = outputHub || salesBuilding.position;

            actions.push({
              type: "chain",
              cost,
              profitPerTick: profit,
              roi: profit > 0 ? cost / profit : Infinity,
              description: `New ${closest.node.type} chain`,
              execute: () => {
                placeBuilding("miner", minerPos);
                placeBuilding("smelter", smelterPos);
                placeBuilding("forger", forgerPos, recipe);
                if (canAutoBelt) {
                  placeBelt(minerPos, smelterPos);
                  placeBelt(smelterPos, forgerPos);
                  placeBelt(forgerPos, outputTarget);
                }
                return true;
              },
            });
          }
        }
      }
    }

    if (settings.autoPlaceJunction && settings.useHubRouting && forgers.length >= 2 && salesBuildings.length > 0 && junctions.length === 0) {
      const salesBuilding = salesBuildings[0];
      const hubPos = findEmptyNear(salesBuilding.position, reserved);
      if (hubPos) {
        const cost = BUILDING_COSTS.junction + BELT_COST * (forgers.length + 1);
        const profit = forgers.length * 2;

        actions.push({
          type: "junction",
          cost,
          profitPerTick: profit,
          roi: cost / profit,
          description: "Create output hub",
          execute: () => {
            if (placeBuilding("junction", hubPos)) {
              placeBelt(hubPos, salesBuilding.position);
              for (const forger of forgers) {
                const existingBelt = state.belts.find(b => {
                  const { from } = getBeltEndpoints(b);
                  return from.x === forger.position.x && from.y === forger.position.y;
                });
                if (!existingBelt) {
                  placeBelt(forger.position, hubPos);
                }
              }
              return true;
            }
            return false;
          },
        });
      }
    }

    if (canAutoBelt && salesBuildings.length > 0) {
      const outputHub = findOutputHub();

      for (const forger of forgers) {
        const hasBeltOut = state.belts.some(b => {
          const { from } = getBeltEndpoints(b);
          return from.x === forger.position.x && from.y === forger.position.y;
        });
        if (!hasBeltOut) {
          const targets: Position[] = [];
          if (outputHub) targets.push(outputHub);
          const sortedSales = salesBuildings
            .map(s => ({ pos: s.position, d: Math.abs(s.position.x - forger.position.x) + Math.abs(s.position.y - forger.position.y) }))
            .sort((a, b) => a.d - b.d)
            .map(s => s.pos);
          targets.push(...sortedSales);

          actions.push({
            type: "belt",
            cost: BELT_COST,
            profitPerTick: 5,
            roi: BELT_COST / 5,
            description: outputHub ? "Connect forger to hub" : "Connect forger to shop",
            execute: () => placeBeltWithFallback(forger.position, targets),
          });
        }
      }
    }

    if (settings.autoPlaceGeologist && geologists.length === 0 && shops.length > 0 && forgers.length >= 2) {
      const shop = shops[0];
      const geoPos = findEmptyNear(shop.position, reserved);

      if (geoPos && (unmined.length <= 5 || state.currency >= 500)) {
        const cost = BUILDING_COSTS.geologist;
        const estimatedProfit = 100 / 30;

        actions.push({
          type: "geologist",
          cost,
          profitPerTick: estimatedProfit,
          roi: cost / estimatedProfit,
          description: "Build geologist",
          execute: () => placeBuilding("geologist", geoPos),
        });
      }
    }

    if (actions.length === 0) {
      if (settings.autoRecipeSwitch) optimizeRecipes(state, settings, upgrades);
      return;
    }

    const foundationActions = actions.filter(a =>
      a.roi === Infinity && (a.type === "miner" || a.type === "smelter" || a.type === "forger" || a.type === "shop")
    );

    const profitableActions = actions
      .filter(a => a.roi < Infinity && a.roi > 0)
      .sort((a, b) => a.roi - b.roi);

    if (foundationActions.length > 0) {
      const action = foundationActions[0];
      if (state.currency >= action.cost + settings.reserveCurrency) {
        action.execute();
        if (settings.autoRecipeSwitch) optimizeRecipes(state, settings, upgrades);
        return;
      }
      if (state.currency >= action.cost * 0.5 + settings.reserveCurrency) {
        if (settings.autoRecipeSwitch) optimizeRecipes(state, settings, upgrades);
        return;
      }
    }

    if (profitableActions.length === 0) {
      if (settings.autoRecipeSwitch) optimizeRecipes(state, settings, upgrades);
      return;
    }

    const bestAction = profitableActions[0];
    const canAffordBest = state.currency >= bestAction.cost + settings.reserveCurrency;

    if (settings.saveForBetterOptions) {
      const worthSavingFor = profitableActions.find(a =>
        a.cost > state.currency - settings.reserveCurrency &&
        a.cost <= (state.currency - settings.reserveCurrency) * 2 &&
        a.roi < bestAction.roi * 0.7
      );

      if (worthSavingFor && !canAffordBest) {
        if (settings.autoRecipeSwitch) optimizeRecipes(state, settings, upgrades);
        return;
      }

      if (worthSavingFor && canAffordBest) {
        const ticksToSave = (worthSavingFor.cost - (state.currency - settings.reserveCurrency)) / (bestAction.profitPerTick || 1);
        const savingBenefit = (bestAction.roi - worthSavingFor.roi);

        if (ticksToSave < 50 && savingBenefit > 20) {
          if (settings.autoRecipeSwitch) optimizeRecipes(state, settings, upgrades);
          return;
        }
      }
    }

    if (canAffordBest) {
      bestAction.execute();
    }

    if (settings.autoRecipeSwitch) optimizeRecipes(state, settings, upgrades);
    return;
  }

  // Bottleneck-based fallback
  if (settings.autoPlaceMiner && miners.length === 0 && unmined.length > 0) {
    const cost = BUILDING_COSTS.miner;
    if (availableCurrency >= cost) {
      const targetOre = unmined[0];
      if (placeBuilding("miner", targetOre.position)) {
        return;
      }
    }
  }

  if (settings.autoPlaceSmelter && miners.length > 0 && smelters.length === 0) {
    const cost = BUILDING_COSTS.smelter + (canAutoBelt ? BELT_COST : 0);
    if (availableCurrency >= cost) {
      const miner = miners[0];
      const smelterPos = findEmptyNear(miner.position, reserved);
      if (smelterPos && placeBuilding("smelter", smelterPos)) {
        if (canAutoBelt) {
          placeBelt(miner.position, smelterPos);
        }
        return;
      }
    }
  }

  if (settings.autoPlaceForger && smelters.length > 0 && forgers.length === 0) {
    const cost = BUILDING_COSTS.forger + (canAutoBelt ? BELT_COST : 0);
    if (availableCurrency >= cost) {
      const smelter = smelters[0];
      const forgerPos = findEmptyNear(smelter.position, reserved);
      if (forgerPos) {
        let oreType: "iron" | "copper" = "iron";
        const minerBelt = state.belts.find(b => {
          const { to } = getBeltEndpoints(b);
          return to.x === smelter.position.x && to.y === smelter.position.y;
        });
        if (minerBelt) {
          const { from: minerBeltFrom } = getBeltEndpoints(minerBelt);
          const miner = miners.find(m =>
            m.position.x === minerBeltFrom.x && m.position.y === minerBeltFrom.y
          );
          if (miner) {
            const ore = state.oreNodes.find(n =>
              n.position.x === miner.position.x && n.position.y === miner.position.y
            );
            if (ore?.type === "copper") oreType = "copper";
          }
        }
        const recipe = pickRecipeForOreType(state, oreType);

        if (placeBuilding("forger", forgerPos, recipe)) {
          if (canAutoBelt) {
            placeBelt(smelter.position, forgerPos);
          }
          return;
        }
      }
    }
  }

  if (settings.autoPlaceShop && forgers.length > 0 && shops.length === 0) {
    const cost = BUILDING_COSTS.shop + (canAutoBelt ? BELT_COST : 0);
    if (availableCurrency >= cost) {
      const forger = forgers[0];
      const shopPos = findEmptyNear(forger.position, reserved);
      if (shopPos && placeBuilding("shop", shopPos)) {
        if (canAutoBelt) {
          placeBelt(forger.position, shopPos);
        }
        return;
      }
    }
  }

  const bottlenecks = analyzeBottlenecks(state);

  // Repair orphaned buildings - prioritize fixing broken chains
  if (canAutoBelt) {
    // Find smelters without input belts
    for (const smelter of smelters) {
      const hasInput = state.belts.some(b => {
        const { to } = getBeltEndpoints(b);
        return to.x === smelter.position.x && to.y === smelter.position.y;
      });
      if (!hasInput) {
        const nearbyMiners = miners
          .filter(m => !state.belts.some(b => {
            const { from } = getBeltEndpoints(b);
            return from.x === m.position.x && from.y === m.position.y;
          }))
          .map(m => ({ pos: m.position, d: Math.abs(m.position.x - smelter.position.x) + Math.abs(m.position.y - smelter.position.y) }))
          .sort((a, b) => a.d - b.d)
          .map(m => m.pos);
        if (nearbyMiners.length > 0) {
          for (const minerPos of nearbyMiners) {
            if (placeBelt(minerPos, smelter.position)) return;
          }
        }
      }
    }

    // Find forgers without input belts
    for (const forger of forgers) {
      const hasInput = state.belts.some(b => {
        const { to } = getBeltEndpoints(b);
        return to.x === forger.position.x && to.y === forger.position.y;
      });
      if (!hasInput) {
        const nearbySmelters = smelters
          .filter(s => !state.belts.some(b => {
            const { from } = getBeltEndpoints(b);
            return from.x === s.position.x && from.y === s.position.y;
          }))
          .map(s => ({ pos: s.position, d: Math.abs(s.position.x - forger.position.x) + Math.abs(s.position.y - forger.position.y) }))
          .sort((a, b) => a.d - b.d)
          .map(s => s.pos);
        if (nearbySmelters.length > 0) {
          for (const smelterPos of nearbySmelters) {
            if (placeBelt(smelterPos, forger.position)) return;
          }
        }
      }
    }
  }

  if (canAutoBelt && shops.length > 0) {
    for (const miner of miners) {
      const hasBeltOut = state.belts.some(b => {
        const { from } = getBeltEndpoints(b);
        return from.x === miner.position.x && from.y === miner.position.y;
      });
      if (!hasBeltOut && smelters.length > 0) {
        const sortedSmelters = smelters
          .map(s => ({ pos: s.position, d: Math.abs(s.position.x - miner.position.x) + Math.abs(s.position.y - miner.position.y) }))
          .sort((a, b) => a.d - b.d)
          .map(s => s.pos);
        if (placeBeltWithFallback(miner.position, sortedSmelters)) return;
      }
    }

    for (const smelter of smelters) {
      const hasBeltOut = state.belts.some(b => {
        const { from } = getBeltEndpoints(b);
        return from.x === smelter.position.x && from.y === smelter.position.y;
      });
      if (!hasBeltOut && forgers.length > 0) {
        const sortedForgers = forgers
          .map(f => ({ pos: f.position, d: Math.abs(f.position.x - smelter.position.x) + Math.abs(f.position.y - smelter.position.y) }))
          .sort((a, b) => a.d - b.d)
          .map(f => f.pos);
        if (placeBeltWithFallback(smelter.position, sortedForgers)) return;
      }
    }

    const outputHub = findOutputHub();
    for (const forger of forgers) {
      const hasBeltOut = state.belts.some(b => {
        const { from } = getBeltEndpoints(b);
        return from.x === forger.position.x && from.y === forger.position.y;
      });
      if (!hasBeltOut) {
        const targets: Position[] = [];
        if (outputHub) targets.push(outputHub);
        const sortedShops = [...shops, ...warehouses]
          .map(s => ({ pos: s.position, d: Math.abs(s.position.x - forger.position.x) + Math.abs(s.position.y - forger.position.y) }))
          .sort((a, b) => a.d - b.d)
          .map(s => s.pos);
        targets.push(...sortedShops);
        if (placeBeltWithFallback(forger.position, targets)) return;
      }
    }
  }

  if (settings.autoPlaceJunction && settings.useHubRouting && forgers.length >= 3 && shops.length > 0 && junctions.length === 0) {
    const cost = BUILDING_COSTS.junction + BELT_COST;
    if (availableCurrency >= cost) {
      const shop = shops[0];
      const hubPos = findEmptyNear(shop.position, reserved);
      if (hubPos && placeBuilding("junction", hubPos)) {
        placeBelt(hubPos, shop.position);
        return;
      }
    }
  }

  if (settings.autoPlaceMiner && unmined.length > 0 && bottlenecks.needMoreMiners && smelters.length > 0) {
    const preferredOre = bottlenecks.oreTypeNeeded || settings.priorityOreType;
    const targetOre = preferredOre === "balanced" ? unmined[0] :
      unmined.find(n => n.type === preferredOre) || unmined[0];

    const cost = BUILDING_COSTS.miner + (canAutoBelt ? BELT_COST : 0);
    if (targetOre && availableCurrency >= cost) {
      const nearestSmelter = smelters
        .map(s => ({
          smelter: s,
          dist: Math.abs(s.position.x - targetOre.position.x) + Math.abs(s.position.y - targetOre.position.y)
        }))
        .sort((a, b) => a.dist - b.dist)[0];

      if (nearestSmelter && placeBuilding("miner", targetOre.position)) {
        if (canAutoBelt) {
          placeBelt(targetOre.position, nearestSmelter.smelter.position);
        }
        return;
      }
    }
  }

  if (settings.autoPlaceSmelter && bottlenecks.needMoreSmelters && miners.length > 0) {
    const cost = BUILDING_COSTS.smelter + (canAutoBelt ? BELT_COST : 0);
    if (availableCurrency >= cost) {
      for (const miner of miners) {
        const hasBeltOut = state.belts.some(b => {
          const { from } = getBeltEndpoints(b);
          return from.x === miner.position.x && from.y === miner.position.y;
        });
        if (!hasBeltOut) {
          const smelterPos = findEmptyNear(miner.position, reserved);
          if (smelterPos && placeBuilding("smelter", smelterPos)) {
            if (canAutoBelt) {
              placeBelt(miner.position, smelterPos);
            }
            return;
          }
        }
      }
    }
  }

  if (settings.autoPlaceForger && smelters.length > 0 && shops.length > 0 && !bottlenecks.needMoreForgers) {
    const smelterWithBars = smelters.find(s => s.storage.iron_bar > 3 || s.storage.copper_bar > 3);
    if (smelterWithBars) {
      const cost = BUILDING_COSTS.forger + (canAutoBelt ? BELT_COST * 2 : 0);
      if (availableCurrency >= cost) {
        const forgerPos = findEmptyNear(smelterWithBars.position, reserved);
        if (forgerPos) {
          const oreType: "iron" | "copper" = smelterWithBars.storage.copper_bar > smelterWithBars.storage.iron_bar ? "copper" : "iron";
          const recipe = pickRecipeForOreType(state, oreType);
          if (placeBuilding("forger", forgerPos, recipe)) {
            if (canAutoBelt) {
              placeBelt(smelterWithBars.position, forgerPos);
              placeBelt(forgerPos, shops[0].position);
            }
            return;
          }
        }
      }
    }
  }

  if (settings.autoPlaceWarehouse && shops.length > 0 && warehouses.length === 0 && forgers.length >= 2) {
    let backlogCount = 0;
    for (const forger of forgers) {
      for (const item of FINISHED_GOODS) {
        backlogCount += forger.storage[item];
      }
    }
    if (backlogCount > 3) {
      const cost = BUILDING_COSTS.warehouse + (canAutoBelt ? BELT_COST * forgers.length : 0);
      if (availableCurrency >= cost) {
        const shop = shops[0];
        const warehousePos = findEmptyNear(shop.position, reserved);
        if (warehousePos && placeBuilding("warehouse", warehousePos)) {
          if (canAutoBelt) {
            for (const forger of forgers) {
              placeBelt(forger.position, warehousePos);
            }
          }
          return;
        }
      }
    }
  }

  if (settings.autoPlaceGeologist && geologists.length === 0 && shops.length > 0 && unmined.length <= 3) {
    const cost = BUILDING_COSTS.geologist;
    if (availableCurrency >= cost) {
      const shop = shops[0];
      const geoPos = findEmptyNear(shop.position, reserved);
      if (geoPos && placeBuilding("geologist", geoPos)) {
        return;
      }
    }
  }

  if (settings.autoRecipeSwitch) {
    optimizeRecipes(state, settings, upgrades);
  }
}

export function applySmartDefaults(): AutomationSettings {
  return {
    enabled: true,
    autoPlaceMiner: true,
    autoPlaceSmelter: true,
    autoPlaceForger: true,
    autoPlaceShop: true,
    autoPlaceBelt: true,
    autoPlaceWarehouse: true,
    autoPlaceGeologist: false,
    autoPlaceJunction: true,
    autoPlaceSorter: true,
    buildCompleteChains: true,
    autoRecipeSwitch: true,
    useAdvancedRecipeLogic: true,
    priorityOreType: "balanced",
    reserveCurrency: 50,
    useROICalculations: true,
    saveForBetterOptions: true,
    useHubRouting: true,
  };
}
