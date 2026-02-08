import {
  GameState,
  GameMeta,
  UpgradeState,
  PrestigeData,
  OfflineProgress,
  ItemType,
  OFFLINE_CONFIG,
  MINER_TICKS,
  SMELT_TICKS,
  SMELT_ORE_COST,
  RECIPE_TICKS,
  RECIPE_BARS_COST,
  SELL_PRICES,
  FINISHED_GOODS,
  FinishedGood,
  getBeltEndpoints,
} from "./types";
import { getModifiers, Modifiers } from "./modifiers";

interface ProductionChain {
  oreType: "iron" | "copper";
  minerCount: number;
  smelterCount: number;
  forgerCount: number;
  recipe: FinishedGood;
  hasShop: boolean;
  hasWarehouse: boolean;
}

function analyzeProductionChains(state: GameState): ProductionChain[] {
  const chains: ProductionChain[] = [];

  const forgers = state.buildings.filter(b => b.type === "forger" && b.constructionProgress >= 1);

  for (const forger of forgers) {
    const smelterBelt = state.belts.find(b => {
      const { to } = getBeltEndpoints(b);
      return to.x === forger.position.x && to.y === forger.position.y;
    });
    if (!smelterBelt) continue;

    const { from: smelterBeltFrom } = getBeltEndpoints(smelterBelt);
    const smelter = state.buildings.find(
      b => b.type === "smelter" && b.position.x === smelterBeltFrom.x && b.position.y === smelterBeltFrom.y
    );
    if (!smelter || smelter.constructionProgress < 1) continue;

    const minerBelts = state.belts.filter(b => {
      const { to } = getBeltEndpoints(b);
      return to.x === smelter.position.x && to.y === smelter.position.y;
    });
    let minerCount = 0;
    let oreType: "iron" | "copper" = "iron";

    for (const belt of minerBelts) {
      const { from: beltFrom } = getBeltEndpoints(belt);
      const miner = state.buildings.find(
        b => b.type === "miner" && b.position.x === beltFrom.x && b.position.y === beltFrom.y
      );
      if (miner && miner.constructionProgress >= 1) {
        const oreNode = state.oreNodes.find(n => n.position.x === miner.position.x && n.position.y === miner.position.y);
        if (oreNode) {
          oreType = oreNode.type === "copper" ? "copper" : "iron";
          minerCount++;
        }
      }
    }

    if (minerCount === 0) continue;

    const outputBelt = state.belts.find(b => {
      const { from } = getBeltEndpoints(b);
      return from.x === forger.position.x && from.y === forger.position.y;
    });
    let hasShop = false;
    let hasWarehouse = false;

    if (outputBelt) {
      const { to: outputTo } = getBeltEndpoints(outputBelt);
      const target = state.buildings.find(
        b => b.position.x === outputTo.x && b.position.y === outputTo.y && b.constructionProgress >= 1
      );
      if (target?.type === "shop") hasShop = true;
      if (target?.type === "warehouse") hasWarehouse = true;
    }

    chains.push({
      oreType,
      minerCount,
      smelterCount: 1,
      forgerCount: 1,
      recipe: forger.recipe as FinishedGood,
      hasShop,
      hasWarehouse,
    });
  }

  return chains;
}

function calculateChainOutput(chain: ProductionChain, ticks: number, modifiers: Modifiers): number {
  const minerTicksNeeded = MINER_TICKS[chain.oreType] / modifiers.productionSpeed;
  const smelterTicksNeeded = SMELT_TICKS[chain.oreType] / modifiers.productionSpeed;
  const forgerTicksNeeded = RECIPE_TICKS[chain.recipe] / modifiers.productionSpeed;

  const orePerTick = chain.minerCount / minerTicksNeeded;

  const smelterCapacity = chain.smelterCount / smelterTicksNeeded;
  const oreNeededPerBar = SMELT_ORE_COST;
  const barsFromOre = orePerTick / oreNeededPerBar;
  const barsPerTick = Math.min(barsFromOre, smelterCapacity);

  const forgerCapacity = chain.forgerCount / forgerTicksNeeded;
  const barsNeededPerItem = RECIPE_BARS_COST[chain.recipe];
  const itemsFromBars = barsPerTick / barsNeededPerItem;
  const itemsPerTick = Math.min(itemsFromBars, forgerCapacity);

  return Math.floor(itemsPerTick * ticks);
}

export function calculateOfflineProgress(
  state: GameState,
  meta: GameMeta,
  upgrades: UpgradeState,
  prestige: PrestigeData
): OfflineProgress {
  const now = Date.now();
  const lastTick = meta.lastTickAt;
  const elapsedMs = now - lastTick;
  const elapsedSeconds = Math.floor(elapsedMs / 1000);

  const maxOfflineSeconds = OFFLINE_CONFIG.maxOfflineHours * 3600;
  const cappedSeconds = Math.min(elapsedSeconds, maxOfflineSeconds);

  const modifiers = getModifiers(upgrades, prestige);

  const offlineEfficiency = OFFLINE_CONFIG.baseOfflineEfficiency * modifiers.offlineEfficiency;

  const effectiveTicks = Math.floor(cappedSeconds * offlineEfficiency);

  if (effectiveTicks <= 0) {
    return {
      ticksSimulated: 0,
      currencyEarned: 0,
      itemsProduced: {
        iron_ore: 0,
        iron_bar: 0,
        dagger: 0,
        armour: 0,
        copper_ore: 0,
        copper_bar: 0,
        wand: 0,
        magic_powder: 0,
        coal: 0,
        steel_bar: 0,
        sword: 0,
      },
      efficiency: offlineEfficiency,
    };
  }

  const chains = analyzeProductionChains(state);

  const itemsProduced: Record<ItemType, number> = {
    iron_ore: 0,
    iron_bar: 0,
    dagger: 0,
    armour: 0,
    copper_ore: 0,
    copper_bar: 0,
    wand: 0,
    magic_powder: 0,
    coal: 0,
    steel_bar: 0,
    sword: 0,
  };

  let currencyEarned = 0;

  for (const chain of chains) {
    const itemCount = calculateChainOutput(chain, effectiveTicks, modifiers);
    if (itemCount > 0) {
      itemsProduced[chain.recipe] += itemCount;

      if (chain.hasShop || chain.hasWarehouse) {
        const basePrice = SELL_PRICES[chain.recipe];
        const multiplier = chain.hasWarehouse ? 0.5 : 1;
        const sellPrice = Math.floor(basePrice * multiplier * modifiers.sellPrice);
        currencyEarned += itemCount * sellPrice;
      }
    }
  }

  return {
    ticksSimulated: effectiveTicks,
    currencyEarned,
    itemsProduced,
    efficiency: offlineEfficiency,
  };
}

export function applyOfflineProgress(state: GameState, progress: OfflineProgress): void {
  state.currency += progress.currencyEarned;

  for (const item of FINISHED_GOODS) {
    state.inventory[item] += progress.itemsProduced[item];
  }

  state.tick += progress.ticksSimulated;
}
