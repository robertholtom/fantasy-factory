import {
  UpgradeId,
  UpgradeState,
  GameState,
} from "../../shared/types.js";
import { getUpgrades, setUpgrades, getState } from "./state.js";

// Upgrade tier definitions
export interface UpgradeDefinition {
  id: UpgradeId;
  name: string;
  description: string;
  cost: number;
  tier: number;
  category: "production" | "logistics" | "commerce" | "automation";
  requires: UpgradeId[];
}

export const UPGRADE_DEFINITIONS: Record<UpgradeId, UpgradeDefinition> = {
  // TIER 1 (100-200 currency)
  mining_efficiency_1: {
    id: "mining_efficiency_1",
    name: "Mining Efficiency I",
    description: "+10% miner speed",
    cost: 100,
    tier: 1,
    category: "production",
    requires: [],
  },
  smelting_efficiency_1: {
    id: "smelting_efficiency_1",
    name: "Smelting Efficiency I",
    description: "+10% smelter speed",
    cost: 150,
    tier: 1,
    category: "production",
    requires: [],
  },
  belt_maintenance_1: {
    id: "belt_maintenance_1",
    name: "Belt Maintenance",
    description: "+10% belt speed",
    cost: 200,
    tier: 1,
    category: "logistics",
    requires: [],
  },

  // TIER 2 (300-600 currency)
  mining_efficiency_2: {
    id: "mining_efficiency_2",
    name: "Mining Efficiency II",
    description: "+15% miner speed",
    cost: 400,
    tier: 2,
    category: "production",
    requires: ["mining_efficiency_1"],
  },
  smelting_efficiency_2: {
    id: "smelting_efficiency_2",
    name: "Smelting Efficiency II",
    description: "+15% smelter speed",
    cost: 500,
    tier: 2,
    category: "production",
    requires: ["smelting_efficiency_1"],
  },
  extended_storage: {
    id: "extended_storage",
    name: "Extended Storage",
    description: "+2 building storage capacity",
    cost: 300,
    tier: 2,
    category: "logistics",
    requires: [],
  },
  patient_customers: {
    id: "patient_customers",
    name: "Patient Customers",
    description: "+20% NPC patience",
    cost: 400,
    tier: 2,
    category: "commerce",
    requires: [],
  },
  auto_belt: {
    id: "auto_belt",
    name: "Auto-Belt Basics",
    description: "Unlock automatic belt placement",
    cost: 600,
    tier: 2,
    category: "automation",
    requires: [],
  },

  // TIER 3 (1500-2500 currency)
  mining_efficiency_3: {
    id: "mining_efficiency_3",
    name: "Mining Efficiency III",
    description: "+20% miner speed",
    cost: 1500,
    tier: 3,
    category: "production",
    requires: ["mining_efficiency_2"],
  },
  forging_efficiency_1: {
    id: "forging_efficiency_1",
    name: "Forging Efficiency I",
    description: "+10% forger speed",
    cost: 1800,
    tier: 3,
    category: "production",
    requires: ["smelting_efficiency_2"],
  },
  express_belts: {
    id: "express_belts",
    name: "Express Belts",
    description: "+25% belt speed",
    cost: 2000,
    tier: 3,
    category: "logistics",
    requires: ["belt_maintenance_1"],
  },
  premium_pricing: {
    id: "premium_pricing",
    name: "Premium Pricing",
    description: "+15% sell prices",
    cost: 2500,
    tier: 3,
    category: "commerce",
    requires: ["patient_customers"],
  },
  auto_recipe: {
    id: "auto_recipe",
    name: "Recipe Optimizer",
    description: "Unlock automatic recipe switching",
    cost: 2000,
    tier: 3,
    category: "automation",
    requires: ["auto_belt"],
  },

  // TIER 4 (6000-10000 currency)
  forging_efficiency_2: {
    id: "forging_efficiency_2",
    name: "Forging Efficiency II",
    description: "+15% forger speed",
    cost: 6000,
    tier: 4,
    category: "production",
    requires: ["forging_efficiency_1"],
  },
  warehouse_efficiency: {
    id: "warehouse_efficiency",
    name: "Warehouse Efficiency",
    description: "+10% wholesale prices",
    cost: 8000,
    tier: 4,
    category: "commerce",
    requires: ["premium_pricing"],
  },

  // TIER 5 (40000-100000 currency)
  map_expansion: {
    id: "map_expansion",
    name: "Map Expansion",
    description: "+10 width/height",
    cost: 50000,
    tier: 5,
    category: "logistics",
    requires: ["express_belts"],
  },
  automation_mastery: {
    id: "automation_mastery",
    name: "Automation Mastery",
    description: "Full auto-play with smarter decisions",
    cost: 100000,
    tier: 5,
    category: "automation",
    requires: ["auto_recipe"],
  },
};

// Check if an upgrade can be purchased
export function canPurchaseUpgrade(upgradeId: UpgradeId): { canPurchase: boolean; reason?: string } {
  const upgrade = UPGRADE_DEFINITIONS[upgradeId];
  if (!upgrade) {
    return { canPurchase: false, reason: "Invalid upgrade" };
  }

  const upgrades = getUpgrades();
  const state = getState();

  // Already purchased
  if (upgrades.purchased.includes(upgradeId)) {
    return { canPurchase: false, reason: "Already purchased" };
  }

  // Check prerequisites
  for (const req of upgrade.requires) {
    if (!upgrades.purchased.includes(req)) {
      const reqName = UPGRADE_DEFINITIONS[req]?.name || req;
      return { canPurchase: false, reason: `Requires: ${reqName}` };
    }
  }

  // Check cost
  if (state.currency < upgrade.cost) {
    return { canPurchase: false, reason: `Need ${upgrade.cost} currency` };
  }

  return { canPurchase: true };
}

// Purchase an upgrade
export function purchaseUpgrade(upgradeId: UpgradeId): { success: boolean; error?: string; upgrades?: UpgradeState; state?: GameState } {
  const { canPurchase, reason } = canPurchaseUpgrade(upgradeId);
  if (!canPurchase) {
    return { success: false, error: reason };
  }

  const upgrade = UPGRADE_DEFINITIONS[upgradeId];
  const upgrades = getUpgrades();
  const state = getState();

  // Deduct cost
  state.currency -= upgrade.cost;

  // Add to purchased
  upgrades.purchased.push(upgradeId);
  setUpgrades(upgrades);

  // Apply immediate effects (like map expansion)
  if (upgradeId === "map_expansion") {
    state.mapWidth += 10;
    state.mapHeight += 10;
  }

  return { success: true, upgrades, state };
}

// Get upgrade info for display
export function getUpgradeInfo(): {
  purchased: UpgradeId[];
  available: UpgradeId[];
  locked: UpgradeId[];
  definitions: Record<UpgradeId, UpgradeDefinition>;
} {
  const upgrades = getUpgrades();
  const state = getState();

  const available: UpgradeId[] = [];
  const locked: UpgradeId[] = [];

  for (const [id, def] of Object.entries(UPGRADE_DEFINITIONS) as [UpgradeId, UpgradeDefinition][]) {
    if (upgrades.purchased.includes(id)) continue;

    // Check prerequisites
    const hasPrereqs = def.requires.every(req => upgrades.purchased.includes(req));
    if (hasPrereqs) {
      available.push(id);
    } else {
      locked.push(id);
    }
  }

  // Sort available by tier then cost
  available.sort((a, b) => {
    const defA = UPGRADE_DEFINITIONS[a];
    const defB = UPGRADE_DEFINITIONS[b];
    if (defA.tier !== defB.tier) return defA.tier - defB.tier;
    return defA.cost - defB.cost;
  });

  return {
    purchased: upgrades.purchased,
    available,
    locked,
    definitions: UPGRADE_DEFINITIONS,
  };
}
