import { useState, useEffect, useCallback, useRef } from "react";
import {
  GameState,
  GameSave,
  GameMeta,
  PrestigeData,
  UpgradeState,
  AutomationSettings,
  OfflineProgress,
  BuildingType,
  ForgerRecipe,
  Position,
  SorterFilter,
  PRESTIGE_UPGRADES,
  PrestigeUpgradeId,
} from "./types";
import {
  loadGame,
  createGame,
  saveGame,
  getState,
  getMeta,
  getPrestige,
  getUpgrades,
  getAutomation,
  setAutomation,
  getCurrentSave,
  setCurrentSave,
  updateMetaStats,
} from "./state";
import {
  loadFromLocalStorage,
  saveToLocalStorage,
  createDefaultPrestige,
  createDefaultUpgrades,
  createDefaultAutomation,
  createDefaultMeta,
} from "./persistence";
import { calculateOfflineProgress, applyOfflineProgress } from "./offline";
import { tick } from "./loop";
import {
  placeBuilding as actionPlaceBuilding,
  placeBelt as actionPlaceBelt,
  setRecipe as actionSetRecipe,
  demolishBuilding as actionDemolishBuilding,
  upgradeBuilding as actionUpgradeBuilding,
  purchaseLand as actionPurchaseLand,
  setSorterFilter as actionSetSorterFilter,
  resetGame as actionResetGame,
  resetGameCompletely as actionResetGameCompletely,
  applySmartDefaults,
} from "./actions";
import { getPrestigeUpgradeLevel } from "./modifiers";

const PLAYER_ID = "default";

export interface GameEngine {
  state: GameState | null;
  meta: GameMeta | null;
  prestige: PrestigeData | null;
  upgrades: UpgradeState | null;
  automation: AutomationSettings | null;
  offlineProgress: OfflineProgress | null;
  loaded: boolean;

  // Actions
  placeBuilding: (type: BuildingType, position: Position) => { state?: GameState; error?: string };
  placeBelt: (from: Position, to: Position) => { state?: GameState; error?: string };
  setRecipe: (buildingId: string, recipe: ForgerRecipe) => { state?: GameState; error?: string };
  demolishBuilding: (buildingId: string) => { state?: GameState; error?: string };
  upgradeBuilding: (buildingId: string) => { state?: GameState; error?: string };
  purchaseLand: (side: "right" | "bottom") => { state?: GameState; error?: string };
  setSorterFilter: (buildingId: string, filter: SorterFilter) => { state?: GameState; error?: string };
  resetGame: () => GameState;
  resetGameCompletely: () => void;

  // Automation
  updateAutomation: (settings: Partial<AutomationSettings>) => AutomationSettings;
  applySmartDefaults: () => AutomationSettings;

  // Prestige
  getPrestigeInfo: () => PrestigeInfo;
  performPrestige: () => { success: boolean; error?: string };
  buyPrestigeUpgrade: (upgradeId: PrestigeUpgradeId) => { success: boolean; error?: string };

  // Upgrades
  getUpgradeInfo: () => UpgradeInfo;
  buyUpgrade: (upgradeId: string) => { success: boolean; error?: string };

  // Offline
  dismissOfflineProgress: () => void;

  // Force update
  forceUpdate: () => void;
}

export interface PrestigeInfo {
  starEssence: number;
  prestigeCount: number;
  bonuses: PrestigeData["bonuses"];
  upgradeLevels: Record<PrestigeUpgradeId, number>;
  canPrestige: boolean;
  potentialEssence: number;
}

export interface UpgradeInfo {
  purchased: string[];
  available: string[];
  locked: string[];
  definitions: Record<string, {
    id: string;
    name: string;
    description: string;
    cost: number;
    tier: number;
    category: string;
    requires: string[];
  }>;
}

const UPGRADE_DEFINITIONS: Record<string, { name: string; description: string; cost: number; tier: number; category: string; requires: string[] }> = {
  mining_efficiency_1: { name: "Mining Efficiency I", description: "+10% mining speed", cost: 500, tier: 1, category: "production", requires: [] },
  mining_efficiency_2: { name: "Mining Efficiency II", description: "+15% mining speed", cost: 2000, tier: 2, category: "production", requires: ["mining_efficiency_1"] },
  mining_efficiency_3: { name: "Mining Efficiency III", description: "+20% mining speed", cost: 8000, tier: 3, category: "production", requires: ["mining_efficiency_2"] },
  smelting_efficiency_1: { name: "Smelting Efficiency I", description: "+10% smelting speed", cost: 750, tier: 1, category: "production", requires: [] },
  smelting_efficiency_2: { name: "Smelting Efficiency II", description: "+15% smelting speed", cost: 3000, tier: 2, category: "production", requires: ["smelting_efficiency_1"] },
  forging_efficiency_1: { name: "Forging Efficiency I", description: "+10% forging speed", cost: 1000, tier: 1, category: "production", requires: [] },
  forging_efficiency_2: { name: "Forging Efficiency II", description: "+15% forging speed", cost: 4000, tier: 2, category: "production", requires: ["forging_efficiency_1"] },
  belt_maintenance_1: { name: "Belt Maintenance", description: "+10% belt speed", cost: 600, tier: 1, category: "logistics", requires: [] },
  express_belts: { name: "Express Belts", description: "+25% belt speed", cost: 2500, tier: 2, category: "logistics", requires: ["belt_maintenance_1"] },
  extended_storage: { name: "Extended Storage", description: "+2 storage slots", cost: 1500, tier: 1, category: "storage", requires: [] },
  patient_customers: { name: "Patient Customers", description: "+20% NPC patience", cost: 1200, tier: 1, category: "commerce", requires: [] },
  premium_pricing: { name: "Premium Pricing", description: "+15% sell prices", cost: 3500, tier: 2, category: "commerce", requires: [] },
  auto_recipe: { name: "Auto Recipe", description: "Unlock auto recipe switching", cost: 2000, tier: 2, category: "automation", requires: [] },
  automation_mastery: { name: "Automation Mastery", description: "Unlock full automation", cost: 5000, tier: 3, category: "automation", requires: ["auto_recipe"] },
  warehouse_efficiency: { name: "Warehouse Efficiency", description: "+10% wholesale prices", cost: 2500, tier: 2, category: "commerce", requires: [] },
  map_expansion: { name: "Map Expansion", description: "+10 map tiles", cost: 4000, tier: 2, category: "expansion", requires: [] },
};

export function useGameEngine(): GameEngine {
  const [state, setState] = useState<GameState | null>(null);
  const [meta, setMeta] = useState<GameMeta | null>(null);
  const [prestige, setPrestige] = useState<PrestigeData | null>(null);
  const [upgrades, setUpgrades] = useState<UpgradeState | null>(null);
  const [automation, setAutomationState] = useState<AutomationSettings | null>(null);
  const [offlineProgress, setOfflineProgress] = useState<OfflineProgress | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [, setTick] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load game on mount
  useEffect(() => {
    const result = loadFromLocalStorage(PLAYER_ID);

    if (result.save) {
      setCurrentSave(result.save);

      // Calculate offline progress
      const offline = calculateOfflineProgress(
        result.save.state,
        result.save.meta,
        result.save.upgrades,
        result.save.prestige
      );

      if (offline.ticksSimulated > 0) {
        applyOfflineProgress(result.save.state, offline);
        setOfflineProgress(offline);
      }

      setState(result.save.state);
      setMeta(result.save.meta);
      setPrestige(result.save.prestige);
      setUpgrades(result.save.upgrades);
      setAutomationState(result.save.automation);
    } else {
      // Create new game
      const { save } = createGame(PLAYER_ID);
      setState(save.state);
      setMeta(save.meta);
      setPrestige(save.prestige);
      setUpgrades(save.upgrades);
      setAutomationState(save.automation);
    }

    setLoaded(true);
  }, []);

  // Game loop
  useEffect(() => {
    if (!loaded || !state) return;

    const save = getCurrentSave();
    if (!save) return;

    intervalRef.current = setInterval(() => {
      const currentSave = getCurrentSave();
      if (!currentSave) return;

      const { currencyEarned, itemsProduced } = tick(
        currentSave.state,
        currentSave.upgrades,
        currentSave.prestige,
        currentSave.automation,
        currentSave.meta
      );

      updateMetaStats(currencyEarned, itemsProduced);

      // Auto-save every 10 ticks
      if (currentSave.state.tick % 10 === 0) {
        saveToLocalStorage(currentSave);
      }

      // Trigger re-render
      setState({ ...currentSave.state });
      setMeta({ ...currentSave.meta });
      setTick(t => t + 1);
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [loaded, state !== null]);

  const forceUpdate = useCallback(() => {
    const save = getCurrentSave();
    if (save) {
      setState({ ...save.state });
      setMeta({ ...save.meta });
      setPrestige({ ...save.prestige });
      setUpgrades({ ...save.upgrades });
      setAutomationState({ ...save.automation });
    }
  }, []);

  const placeBuilding = useCallback((type: BuildingType, position: Position) => {
    const result = actionPlaceBuilding(type, position);
    if (!result.error) {
      forceUpdate();
    }
    return result;
  }, [forceUpdate]);

  const placeBelt = useCallback((from: Position, to: Position) => {
    const result = actionPlaceBelt(from, to);
    if (!result.error) {
      forceUpdate();
    }
    return result;
  }, [forceUpdate]);

  const setRecipe = useCallback((buildingId: string, recipe: ForgerRecipe) => {
    const result = actionSetRecipe(buildingId, recipe);
    if (!result.error) {
      forceUpdate();
    }
    return result;
  }, [forceUpdate]);

  const demolishBuilding = useCallback((buildingId: string) => {
    const result = actionDemolishBuilding(buildingId);
    if (!result.error) {
      forceUpdate();
    }
    return result;
  }, [forceUpdate]);

  const upgradeBuilding = useCallback((buildingId: string) => {
    const result = actionUpgradeBuilding(buildingId);
    if (!result.error) {
      forceUpdate();
    }
    return result;
  }, [forceUpdate]);

  const purchaseLand = useCallback((side: "right" | "bottom") => {
    const result = actionPurchaseLand(side);
    if (!result.error) {
      forceUpdate();
    }
    return result;
  }, [forceUpdate]);

  const setSorterFilter = useCallback((buildingId: string, filter: SorterFilter) => {
    const result = actionSetSorterFilter(buildingId, filter);
    if (!result.error) {
      forceUpdate();
    }
    return result;
  }, [forceUpdate]);

  const resetGame = useCallback(() => {
    const newState = actionResetGame();
    forceUpdate();
    return newState;
  }, [forceUpdate]);

  const resetGameCompletely = useCallback(() => {
    actionResetGameCompletely();
    window.location.reload();
  }, []);

  const updateAutomation = useCallback((settings: Partial<AutomationSettings>) => {
    const save = getCurrentSave();
    if (!save) return getAutomation();

    const newAutomation = { ...save.automation, ...settings };
    setAutomation(newAutomation);
    setAutomationState(newAutomation);
    saveToLocalStorage(save);
    return newAutomation;
  }, []);

  const handleApplySmartDefaults = useCallback(() => {
    const defaults = applySmartDefaults();
    const save = getCurrentSave();
    if (save) {
      save.automation = defaults;
      setAutomationState(defaults);
      saveToLocalStorage(save);
    }
    return defaults;
  }, []);

  const getPrestigeInfo = useCallback((): PrestigeInfo => {
    const p = getPrestige();
    const m = getMeta();

    const upgradeLevels: Record<PrestigeUpgradeId, number> = {
      swift_production: getPrestigeUpgradeLevel(p, "swift_production"),
      merchant_favor: getPrestigeUpgradeLevel(p, "merchant_favor"),
      inheritance: getPrestigeUpgradeLevel(p, "inheritance"),
      tireless_workers: getPrestigeUpgradeLevel(p, "tireless_workers"),
      express_belts_prestige: getPrestigeUpgradeLevel(p, "express_belts_prestige"),
    };

    const canPrestige = m.totalCurrencyEarned >= 5000;
    const potentialEssence = Math.floor(m.totalCurrencyEarned / 1000);

    return {
      starEssence: p.starEssence,
      prestigeCount: p.prestigeCount,
      bonuses: p.bonuses,
      upgradeLevels,
      canPrestige,
      potentialEssence,
    };
  }, []);

  const performPrestige = useCallback(() => {
    const save = getCurrentSave();
    if (!save) return { success: false, error: "No active save" };

    const m = save.meta;
    if (m.totalCurrencyEarned < 5000) {
      return { success: false, error: "Need $5000+ total earned to prestige" };
    }

    const essenceGained = Math.floor(m.totalCurrencyEarned / 1000);
    save.prestige.starEssence += essenceGained;
    save.prestige.prestigeCount += 1;

    // Reset game state but keep prestige
    const { save: newSave } = createGame(PLAYER_ID);
    newSave.prestige = save.prestige;
    setCurrentSave(newSave);
    saveToLocalStorage(newSave);

    forceUpdate();
    return { success: true };
  }, [forceUpdate]);

  const buyPrestigeUpgrade = useCallback((upgradeId: PrestigeUpgradeId) => {
    const save = getCurrentSave();
    if (!save) return { success: false, error: "No active save" };

    const upgrade = PRESTIGE_UPGRADES[upgradeId];
    const currentLevel = getPrestigeUpgradeLevel(save.prestige, upgradeId);

    if (currentLevel >= upgrade.maxLevel) {
      return { success: false, error: "Already at max level" };
    }

    if (save.prestige.starEssence < upgrade.costPerLevel) {
      return { success: false, error: "Not enough Star Essence" };
    }

    save.prestige.starEssence -= upgrade.costPerLevel;

    // Apply upgrade effect to bonuses
    switch (upgradeId) {
      case "swift_production":
        save.prestige.bonuses.productionSpeed = upgrade.effect(currentLevel + 1);
        break;
      case "merchant_favor":
        save.prestige.bonuses.sellPrice = upgrade.effect(currentLevel + 1);
        break;
      case "inheritance":
        save.prestige.bonuses.startingCurrency = upgrade.effect(currentLevel + 1);
        break;
      case "tireless_workers":
        save.prestige.bonuses.offlineEfficiency = upgrade.effect(currentLevel + 1);
        break;
      case "express_belts_prestige":
        save.prestige.bonuses.beltSpeed = upgrade.effect(currentLevel + 1);
        break;
    }

    saveToLocalStorage(save);
    setPrestige({ ...save.prestige });
    return { success: true };
  }, []);

  const getUpgradeInfo = useCallback((): UpgradeInfo => {
    const u = getUpgrades();
    const s = getState();

    const purchased = u.purchased;
    const available: string[] = [];
    const locked: string[] = [];

    for (const [id, def] of Object.entries(UPGRADE_DEFINITIONS)) {
      if (purchased.includes(id as any)) continue;

      const requirementsMet = def.requires.every(req => purchased.includes(req as any));
      if (requirementsMet && s.currency >= def.cost) {
        available.push(id);
      } else {
        locked.push(id);
      }
    }

    const definitions: UpgradeInfo["definitions"] = {};
    for (const [id, def] of Object.entries(UPGRADE_DEFINITIONS)) {
      definitions[id] = { id, ...def };
    }

    return { purchased, available, locked, definitions };
  }, []);

  const buyUpgrade = useCallback((upgradeId: string) => {
    const save = getCurrentSave();
    if (!save) return { success: false, error: "No active save" };

    const def = UPGRADE_DEFINITIONS[upgradeId];
    if (!def) return { success: false, error: "Unknown upgrade" };

    if (save.upgrades.purchased.includes(upgradeId as any)) {
      return { success: false, error: "Already purchased" };
    }

    const requirementsMet = def.requires.every(req => save.upgrades.purchased.includes(req as any));
    if (!requirementsMet) {
      return { success: false, error: "Requirements not met" };
    }

    if (save.state.currency < def.cost) {
      return { success: false, error: "Not enough currency" };
    }

    save.state.currency -= def.cost;
    save.upgrades.purchased.push(upgradeId as any);

    saveToLocalStorage(save);
    forceUpdate();
    return { success: true };
  }, [forceUpdate]);

  const dismissOfflineProgress = useCallback(() => {
    setOfflineProgress(null);
  }, []);

  return {
    state,
    meta,
    prestige,
    upgrades,
    automation,
    offlineProgress,
    loaded,
    placeBuilding,
    placeBelt,
    setRecipe,
    demolishBuilding,
    upgradeBuilding,
    purchaseLand,
    setSorterFilter,
    resetGame,
    resetGameCompletely,
    updateAutomation,
    applySmartDefaults: handleApplySmartDefaults,
    getPrestigeInfo,
    performPrestige,
    buyPrestigeUpgrade,
    getUpgradeInfo,
    buyUpgrade,
    dismissOfflineProgress,
    forceUpdate,
  };
}
