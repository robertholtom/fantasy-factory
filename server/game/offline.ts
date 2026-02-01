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
  RECIPE_BAR_TYPE,
  SELL_PRICES,
  FINISHED_GOODS,
  FinishedGood,
} from "../../shared/types.js";
import { getModifiers, Modifiers } from "./modifiers.js";

// Analytical offline progress calculation
// Instead of simulating each tick, we estimate steady-state production rates

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

  // Find all complete chains: miner -> smelter -> forger -> (shop|warehouse)
  const forgers = state.buildings.filter(b => b.type === "forger" && b.constructionProgress >= 1);

  for (const forger of forgers) {
    // Find smelter feeding this forger
    const smelterBelt = state.belts.find(b => b.to.x === forger.position.x && b.to.y === forger.position.y);
    if (!smelterBelt) continue;

    const smelter = state.buildings.find(
      b => b.type === "smelter" && b.position.x === smelterBelt.from.x && b.position.y === smelterBelt.from.y
    );
    if (!smelter || smelter.constructionProgress < 1) continue;

    // Find miners feeding this smelter
    const minerBelts = state.belts.filter(b => b.to.x === smelter.position.x && b.to.y === smelter.position.y);
    let minerCount = 0;
    let oreType: "iron" | "copper" = "iron";

    for (const belt of minerBelts) {
      const miner = state.buildings.find(
        b => b.type === "miner" && b.position.x === belt.from.x && b.position.y === belt.from.y
      );
      if (miner && miner.constructionProgress >= 1) {
        const oreNode = state.oreNodes.find(n => n.position.x === miner.position.x && n.position.y === miner.position.y);
        if (oreNode) {
          oreType = oreNode.type;
          minerCount++;
        }
      }
    }

    if (minerCount === 0) continue;

    // Check if forger connects to shop or warehouse
    const outputBelt = state.belts.find(b => b.from.x === forger.position.x && b.from.y === forger.position.y);
    let hasShop = false;
    let hasWarehouse = false;

    if (outputBelt) {
      const target = state.buildings.find(
        b => b.position.x === outputBelt.to.x && b.position.y === outputBelt.to.y && b.constructionProgress >= 1
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
  // Calculate items per tick for each stage
  const minerTicksNeeded = MINER_TICKS[chain.oreType] / modifiers.productionSpeed;
  const smelterTicksNeeded = SMELT_TICKS[chain.oreType] / modifiers.productionSpeed;
  const forgerTicksNeeded = RECIPE_TICKS[chain.recipe] / modifiers.productionSpeed;

  // Ore per tick from all miners
  const orePerTick = chain.minerCount / minerTicksNeeded;

  // Bars per tick (limited by ore input and smelter capacity)
  const smelterCapacity = chain.smelterCount / smelterTicksNeeded;
  const oreNeededPerBar = SMELT_ORE_COST;
  const barsFromOre = orePerTick / oreNeededPerBar;
  const barsPerTick = Math.min(barsFromOre, smelterCapacity);

  // Items per tick (limited by bar input and forger capacity)
  const forgerCapacity = chain.forgerCount / forgerTicksNeeded;
  const barsNeededPerItem = RECIPE_BARS_COST[chain.recipe];
  const itemsFromBars = barsPerTick / barsNeededPerItem;
  const itemsPerTick = Math.min(itemsFromBars, forgerCapacity);

  // Total items produced
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

  // Cap at max offline hours
  const maxOfflineSeconds = OFFLINE_CONFIG.maxOfflineHours * 3600;
  const cappedSeconds = Math.min(elapsedSeconds, maxOfflineSeconds);

  // Get modifiers
  const modifiers = getModifiers(upgrades, prestige);

  // Base offline efficiency + prestige bonus
  const offlineEfficiency = OFFLINE_CONFIG.baseOfflineEfficiency * modifiers.offlineEfficiency;

  // Effective ticks (1 tick = 1 second)
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
      },
      efficiency: offlineEfficiency,
    };
  }

  // Analyze production chains
  const chains = analyzeProductionChains(state);

  // Calculate production per chain
  const itemsProduced: Record<ItemType, number> = {
    iron_ore: 0,
    iron_bar: 0,
    dagger: 0,
    armour: 0,
    copper_ore: 0,
    copper_bar: 0,
    wand: 0,
    magic_powder: 0,
  };

  let currencyEarned = 0;

  for (const chain of chains) {
    const itemCount = calculateChainOutput(chain, effectiveTicks, modifiers);
    if (itemCount > 0) {
      itemsProduced[chain.recipe] += itemCount;

      // Calculate earnings (only if connected to shop or warehouse)
      if (chain.hasShop || chain.hasWarehouse) {
        const basePrice = SELL_PRICES[chain.recipe];
        const multiplier = chain.hasWarehouse ? 0.5 : 1; // Warehouse sells at 50%
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
  // Add currency
  state.currency += progress.currencyEarned;

  // Add items to inventory (items not sold go to global inventory)
  for (const item of FINISHED_GOODS) {
    state.inventory[item] += progress.itemsProduced[item];
  }

  // Advance tick counter
  state.tick += progress.ticksSimulated;
}
