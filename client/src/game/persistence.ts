import {
  GameSave,
  GameMeta,
  PrestigeData,
  UpgradeState,
  AutomationSettings,
  SAVE_VERSION,
  findPath,
  Position,
  Belt,
} from "./types";
import { createInitialState } from "./state";

const STORAGE_KEY_PREFIX = "fantasy-factory-save-";

function getStorageKey(playerId: string): string {
  const sanitized = playerId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${STORAGE_KEY_PREFIX}${sanitized}`;
}

export function createDefaultMeta(): GameMeta {
  return {
    lastTickAt: Date.now(),
    totalCurrencyEarned: 0,
    totalItemsProduced: 0,
  };
}

export function createDefaultPrestige(): PrestigeData {
  return {
    starEssence: 0,
    prestigeCount: 0,
    bonuses: {
      productionSpeed: 1,
      sellPrice: 1,
      startingCurrency: 0,
      offlineEfficiency: 1,
      beltSpeed: 1,
    },
  };
}

export function createDefaultUpgrades(): UpgradeState {
  return {
    purchased: [],
  };
}

export function createDefaultAutomation(): AutomationSettings {
  return {
    enabled: false,
    autoPlaceMiner: false,
    autoPlaceSmelter: false,
    autoPlaceForger: false,
    autoPlaceShop: false,
    autoPlaceBelt: false,
    autoPlaceWarehouse: false,
    autoPlaceGeologist: false,
    autoPlaceJunction: false,
    autoPlaceSorter: false,
    autoRecipeSwitch: false,
    useAdvancedRecipeLogic: false,
    buildCompleteChains: false,
    useROICalculations: false,
    saveForBetterOptions: false,
    useHubRouting: false,
    priorityOreType: "balanced",
    reserveCurrency: 100,
  };
}

export function createNewSave(playerId: string, startingCurrencyBonus = 0): GameSave {
  const state = createInitialState();
  state.currency += startingCurrencyBonus;

  return {
    version: SAVE_VERSION,
    playerId,
    state,
    meta: createDefaultMeta(),
    prestige: createDefaultPrestige(),
    upgrades: createDefaultUpgrades(),
    automation: createDefaultAutomation(),
    savedAt: Date.now(),
  };
}

export function saveToLocalStorage(save: GameSave): { success: boolean; error?: string } {
  try {
    save.savedAt = Date.now();
    save.meta.lastTickAt = Date.now();
    const key = getStorageKey(save.playerId);
    localStorage.setItem(key, JSON.stringify(save));
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export function loadFromLocalStorage(playerId: string): { save: GameSave | null; error?: string } {
  try {
    const key = getStorageKey(playerId);
    const data = localStorage.getItem(key);

    if (!data) {
      return { save: null };
    }

    const save = JSON.parse(data) as GameSave;

    // Version migration if needed
    if (save.version < SAVE_VERSION) {
      migrateSave(save);
    }

    return { save };
  } catch (err) {
    return { save: null, error: String(err) };
  }
}

export function deleteSave(playerId: string): { success: boolean; error?: string } {
  try {
    const key = getStorageKey(playerId);
    localStorage.removeItem(key);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export function listSaves(): string[] {
  try {
    const saves: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX)) {
        saves.push(key.replace(STORAGE_KEY_PREFIX, ""));
      }
    }
    return saves;
  } catch {
    return [];
  }
}

export function saveExists(playerId: string): boolean {
  const key = getStorageKey(playerId);
  return localStorage.getItem(key) !== null;
}

function migrateSave(save: GameSave): void {
  if (save.version < 2) {
    const wasAiMode = (save.state as any).aiMode ?? false;
    delete (save.state as any).aiMode;

    if (wasAiMode) {
      save.automation = {
        ...save.automation,
        enabled: true,
        autoPlaceMiner: true,
        autoPlaceSmelter: true,
        autoPlaceForger: true,
        autoPlaceShop: true,
        autoPlaceBelt: true,
        autoPlaceWarehouse: true,
        autoPlaceGeologist: true,
        buildCompleteChains: true,
        autoRecipeSwitch: true,
        useAdvancedRecipeLogic: true,
        useROICalculations: true,
        saveForBetterOptions: true,
      };
    }

    save.automation.autoPlaceShop ??= false;
    save.automation.autoPlaceWarehouse ??= false;
    save.automation.autoPlaceGeologist ??= false;
    save.automation.buildCompleteChains ??= false;
    save.automation.useAdvancedRecipeLogic ??= false;
    save.automation.useROICalculations ??= false;
    save.automation.saveForBetterOptions ??= false;
    save.automation.autoPlaceJunction ??= false;
    save.automation.autoPlaceSorter ??= false;
    save.automation.useHubRouting ??= false;

    delete (save.automation as any).autoPlaceExplorer;
  }

  if (save.version < 3) {
    save.state.kingPenaltyTicksLeft ??= 0;
    save.state.lastKingTick ??= 0;
  }

  // Migrate belts from {from, to} to {path} format
  const hasOldStyleBelts = save.state.belts.some((b: any) => b.from && !b.path);
  if (hasOldStyleBelts) {
    const posKey = (p: Position) => `${p.x},${p.y}`;
    const obstacles = new Set<string>();

    for (const b of save.state.buildings) {
      obstacles.add(posKey(b.position));
    }

    const migratedBelts: Belt[] = [];
    for (const oldBelt of save.state.belts as any[]) {
      if (oldBelt.path) {
        migratedBelts.push(oldBelt as Belt);
        continue;
      }

      const from: Position = oldBelt.from;
      const to: Position = oldBelt.to;

      const path = findPath(from, to, obstacles, save.state.mapWidth, save.state.mapHeight);

      if (path) {
        for (let i = 1; i < path.length - 1; i++) {
          obstacles.add(posKey(path[i]));
        }

        const internalCells = Math.max(1, path.length - 2);
        const itemsInTransit = (oldBelt.itemsInTransit || []).map((item: any) => ({
          itemType: item.itemType,
          cellIndex: Math.floor((item.progress ?? 0) * internalCells),
        }));

        migratedBelts.push({
          id: oldBelt.id,
          path,
          itemsInTransit,
        });
      } else {
        console.warn(`Migration: Dropping belt ${oldBelt.id} - no valid path from (${from.x},${from.y}) to (${to.x},${to.y})`);
      }
    }
    save.state.belts = migratedBelts;
  }

  delete (save.state as any).explorerCharacter;
  save.state.tilesPurchased ??= 0;

  save.state.buildings = save.state.buildings.filter((b: any) => b.type !== "explorer");

  for (const building of save.state.buildings) {
    building.upgradeLevel ??= 0;
  }

  save.version = SAVE_VERSION;
}

export function getOfflineSeconds(save: GameSave): number {
  const now = Date.now();
  const lastTick = save.meta.lastTickAt || save.savedAt;
  return Math.floor((now - lastTick) / 1000);
}
