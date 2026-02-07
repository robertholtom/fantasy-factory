import {
  UpgradeState,
  PrestigeData,
  UpgradeId,
  PRESTIGE_UPGRADES,
  PrestigeUpgradeId,
  GameState,
  KING_PENALTY_MULTIPLIER,
} from "./types";

export interface Modifiers {
  productionSpeed: number;
  miningSpeed: number;
  smeltingSpeed: number;
  forgingSpeed: number;
  beltSpeed: number;
  sellPrice: number;
  storageCapacity: number;
  npcPatience: number;
  npcSpawnChance: number;
  offlineEfficiency: number;
  startingCurrency: number;
  mapExpansion: number;
}

const UPGRADE_EFFECTS: Record<UpgradeId, (m: Modifiers) => void> = {
  mining_efficiency_1: (m) => { m.miningSpeed *= 1.10; },
  mining_efficiency_2: (m) => { m.miningSpeed *= 1.15; },
  mining_efficiency_3: (m) => { m.miningSpeed *= 1.20; },
  smelting_efficiency_1: (m) => { m.smeltingSpeed *= 1.10; },
  smelting_efficiency_2: (m) => { m.smeltingSpeed *= 1.15; },
  forging_efficiency_1: (m) => { m.forgingSpeed *= 1.10; },
  forging_efficiency_2: (m) => { m.forgingSpeed *= 1.15; },
  belt_maintenance_1: (m) => { m.beltSpeed *= 1.10; },
  express_belts: (m) => { m.beltSpeed *= 1.25; },
  extended_storage: (m) => { m.storageCapacity += 2; },
  patient_customers: (m) => { m.npcPatience *= 1.20; },
  premium_pricing: (m) => { m.sellPrice *= 1.15; },
  auto_recipe: () => { /* Unlocks auto-recipe in automation */ },
  automation_mastery: () => { /* Unlocks full auto-play */ },
  warehouse_efficiency: (m) => { m.sellPrice *= 1.10; },
  map_expansion: (m) => { m.mapExpansion += 10; },
};

export function getModifiers(upgrades: UpgradeState, prestige: PrestigeData, state?: GameState): Modifiers {
  const m: Modifiers = {
    productionSpeed: 1,
    miningSpeed: 1,
    smeltingSpeed: 1,
    forgingSpeed: 1,
    beltSpeed: 1,
    sellPrice: 1,
    storageCapacity: 0,
    npcPatience: 1,
    npcSpawnChance: 1,
    offlineEfficiency: 1,
    startingCurrency: 0,
    mapExpansion: 0,
  };

  // Apply prestige bonuses
  m.productionSpeed *= prestige.bonuses.productionSpeed;
  m.sellPrice *= prestige.bonuses.sellPrice;
  m.startingCurrency += prestige.bonuses.startingCurrency;
  m.offlineEfficiency *= prestige.bonuses.offlineEfficiency;
  m.beltSpeed *= prestige.bonuses.beltSpeed;

  // Apply purchased upgrades
  for (const upgradeId of upgrades.purchased) {
    const effect = UPGRADE_EFFECTS[upgradeId];
    if (effect) {
      effect(m);
    }
  }

  // Combine specific speeds with global production speed
  m.miningSpeed *= m.productionSpeed;
  m.smeltingSpeed *= m.productionSpeed;
  m.forgingSpeed *= m.productionSpeed;

  // Apply King penalty to NPC spawn chance
  if (state && state.kingPenaltyTicksLeft > 0) {
    m.npcSpawnChance *= KING_PENALTY_MULTIPLIER;
  }

  return m;
}

export function isAutomationUnlocked(upgrades: UpgradeState, feature: "autoRecipe" | "fullAuto"): boolean {
  switch (feature) {
    case "autoRecipe":
      return upgrades.purchased.includes("auto_recipe");
    case "fullAuto":
      return upgrades.purchased.includes("automation_mastery");
    default:
      return false;
  }
}

export function getPrestigeUpgradeLevel(prestige: PrestigeData, upgradeId: PrestigeUpgradeId): number {
  const upgrade = PRESTIGE_UPGRADES[upgradeId];
  const currentBonus = (() => {
    switch (upgradeId) {
      case "swift_production": return prestige.bonuses.productionSpeed;
      case "merchant_favor": return prestige.bonuses.sellPrice;
      case "inheritance": return prestige.bonuses.startingCurrency;
      case "tireless_workers": return prestige.bonuses.offlineEfficiency;
      case "express_belts_prestige": return prestige.bonuses.beltSpeed;
    }
  })();

  for (let level = upgrade.maxLevel; level >= 0; level--) {
    if (upgrade.effect(level) === currentBonus) {
      return level;
    }
  }
  return 0;
}
