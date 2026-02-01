import {
  GameState,
  PrestigeData,
  PrestigeUpgradeId,
  PrestigeBonuses,
  PRESTIGE_UPGRADES,
} from "../../shared/types.js";
import { getPrestige, setPrestige, createGame, getCurrentPlayerId, getMeta } from "./state.js";

// Minimum currency required to prestige
const MIN_PRESTIGE_CURRENCY = 5000;

// Calculate star essence from total currency earned
// Uses sqrt scaling with diminishing returns
export function calculateStarEssence(totalCurrencyEarned: number): number {
  if (totalCurrencyEarned < MIN_PRESTIGE_CURRENCY) {
    return 0;
  }
  return Math.floor(Math.sqrt(totalCurrencyEarned / 10000));
}

// Check if player can prestige
export function canPrestige(): { canPrestige: boolean; currentEssence: number; potentialEssence: number } {
  const meta = getMeta();
  const prestige = getPrestige();

  const potentialEssence = calculateStarEssence(meta.totalCurrencyEarned);
  const canDo = meta.totalCurrencyEarned >= MIN_PRESTIGE_CURRENCY && potentialEssence > 0;

  return {
    canPrestige: canDo,
    currentEssence: prestige.starEssence,
    potentialEssence,
  };
}

// Perform prestige reset
export function performPrestige(): { success: boolean; error?: string; prestige?: PrestigeData } {
  const { canPrestige: can, potentialEssence } = canPrestige();

  if (!can) {
    return { success: false, error: `Need at least ${MIN_PRESTIGE_CURRENCY} total currency earned to prestige` };
  }

  const prestige = getPrestige();

  // Award star essence
  prestige.starEssence += potentialEssence;
  prestige.prestigeCount += 1;

  // Save updated prestige
  setPrestige(prestige);

  // Create new game (preserves prestige data)
  const playerId = getCurrentPlayerId();
  createGame(playerId);

  return { success: true, prestige };
}

// Get current level of a prestige upgrade
export function getPrestigeUpgradeLevel(upgradeId: PrestigeUpgradeId): number {
  const prestige = getPrestige();
  const upgrade = PRESTIGE_UPGRADES[upgradeId];

  // Calculate level from current bonus value
  const bonusKey = getBonusKey(upgradeId);
  const currentBonus = prestige.bonuses[bonusKey];

  // Find level that matches current bonus
  for (let level = 0; level <= upgrade.maxLevel; level++) {
    const expectedBonus = upgrade.effect(level);
    // Use approximate comparison for floating point
    if (Math.abs(expectedBonus - currentBonus) < 0.001) {
      return level;
    }
  }

  return 0;
}

function getBonusKey(upgradeId: PrestigeUpgradeId): keyof PrestigeBonuses {
  switch (upgradeId) {
    case "swift_production": return "productionSpeed";
    case "merchant_favor": return "sellPrice";
    case "inheritance": return "startingCurrency";
    case "tireless_workers": return "offlineEfficiency";
    case "express_belts_prestige": return "beltSpeed";
  }
}

// Purchase a prestige upgrade
export function purchasePrestigeUpgrade(upgradeId: PrestigeUpgradeId): { success: boolean; error?: string; prestige?: PrestigeData } {
  const upgrade = PRESTIGE_UPGRADES[upgradeId];
  if (!upgrade) {
    return { success: false, error: "Invalid upgrade" };
  }

  const prestige = getPrestige();
  const currentLevel = getPrestigeUpgradeLevel(upgradeId);

  if (currentLevel >= upgrade.maxLevel) {
    return { success: false, error: "Upgrade already at max level" };
  }

  const cost = upgrade.costPerLevel;
  if (prestige.starEssence < cost) {
    return { success: false, error: `Need ${cost} Star Essence` };
  }

  // Deduct cost
  prestige.starEssence -= cost;

  // Apply upgrade
  const newLevel = currentLevel + 1;
  const bonusKey = getBonusKey(upgradeId);
  prestige.bonuses[bonusKey] = upgrade.effect(newLevel);

  setPrestige(prestige);

  return { success: true, prestige };
}

// Get prestige info for display
export function getPrestigeInfo(): {
  starEssence: number;
  prestigeCount: number;
  bonuses: PrestigeBonuses;
  upgradeLevels: Record<PrestigeUpgradeId, number>;
  canPrestige: boolean;
  potentialEssence: number;
} {
  const prestige = getPrestige();
  const { canPrestige: can, potentialEssence } = canPrestige();

  const upgradeLevels: Record<PrestigeUpgradeId, number> = {
    swift_production: getPrestigeUpgradeLevel("swift_production"),
    merchant_favor: getPrestigeUpgradeLevel("merchant_favor"),
    inheritance: getPrestigeUpgradeLevel("inheritance"),
    tireless_workers: getPrestigeUpgradeLevel("tireless_workers"),
    express_belts_prestige: getPrestigeUpgradeLevel("express_belts_prestige"),
  };

  return {
    starEssence: prestige.starEssence,
    prestigeCount: prestige.prestigeCount,
    bonuses: prestige.bonuses,
    upgradeLevels,
    canPrestige: can,
    potentialEssence,
  };
}
