import * as fs from "fs";
import * as path from "path";
import {
  GameSave,
  GameState,
  GameMeta,
  PrestigeData,
  UpgradeState,
  AutomationSettings,
  SAVE_VERSION,
} from "../../shared/types.js";
import { createInitialState } from "./state.js";

const SAVES_DIR = path.join(process.cwd(), "saves");

function ensureSavesDir(): void {
  if (!fs.existsSync(SAVES_DIR)) {
    fs.mkdirSync(SAVES_DIR, { recursive: true });
  }
}

function getSavePath(playerId: string): string {
  // Sanitize playerId to prevent path traversal
  const sanitized = playerId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(SAVES_DIR, `${sanitized}.json`);
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
    autoPlaceExplorer: false,
    autoRecipeSwitch: false,
    useAdvancedRecipeLogic: false,
    buildCompleteChains: false,
    useROICalculations: false,
    saveForBetterOptions: false,
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

export function saveToDisk(save: GameSave): { success: boolean; error?: string } {
  try {
    ensureSavesDir();
    save.savedAt = Date.now();
    save.meta.lastTickAt = Date.now();
    const savePath = getSavePath(save.playerId);
    fs.writeFileSync(savePath, JSON.stringify(save, null, 2), "utf-8");
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export function loadFromDisk(playerId: string): { save: GameSave | null; error?: string } {
  try {
    ensureSavesDir();
    const savePath = getSavePath(playerId);

    if (!fs.existsSync(savePath)) {
      return { save: null };
    }

    const data = fs.readFileSync(savePath, "utf-8");
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
    const savePath = getSavePath(playerId);
    if (fs.existsSync(savePath)) {
      fs.unlinkSync(savePath);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export function listSaves(): string[] {
  try {
    ensureSavesDir();
    const files = fs.readdirSync(SAVES_DIR);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
  } catch {
    return [];
  }
}

export function saveExists(playerId: string): boolean {
  const savePath = getSavePath(playerId);
  return fs.existsSync(savePath);
}

function migrateSave(save: GameSave): void {
  if (save.version < 2) {
    // Remove aiMode from state, migrate to automation settings
    const wasAiMode = (save.state as any).aiMode ?? false;
    delete (save.state as any).aiMode;

    if (wasAiMode) {
      // Enable full automation to match prior AI Mode behavior
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

    // Add defaults for new fields if missing
    save.automation.autoPlaceShop ??= false;
    save.automation.autoPlaceWarehouse ??= false;
    save.automation.autoPlaceGeologist ??= false;
    save.automation.autoPlaceExplorer ??= false;
    save.automation.buildCompleteChains ??= false;
    save.automation.useAdvancedRecipeLogic ??= false;
    save.automation.useROICalculations ??= false;
    save.automation.saveForBetterOptions ??= false;
  }

  if (save.version < 3) {
    // Add King NPC fields
    save.state.kingPenaltyTicksLeft ??= 0;
    save.state.lastKingTick ??= 0;
  }

  // Add explorer character field for existing saves
  save.state.explorerCharacter ??= null;

  save.version = SAVE_VERSION;
}

// Calculate time since last save for offline progress
export function getOfflineSeconds(save: GameSave): number {
  const now = Date.now();
  const lastTick = save.meta.lastTickAt || save.savedAt;
  return Math.floor((now - lastTick) / 1000);
}
