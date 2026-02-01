import {
  GameState,
  GameSave,
  GameMeta,
  PrestigeData,
  UpgradeState,
  AutomationSettings,
  OreNode,
  OreType,
} from "../../shared/types.js";
import {
  createNewSave,
  saveToDisk,
  loadFromDisk,
  createDefaultMeta,
  createDefaultPrestige,
  createDefaultUpgrades,
  createDefaultAutomation,
} from "./persistence.js";

const MAP_WIDTH = 30;
const MAP_HEIGHT = 20;

function generateOreNodes(): OreNode[] {
  const nodes: OreNode[] = [];
  const positions = new Set<string>();

  // Place 25-35 ore nodes randomly
  const count = 25 + Math.floor(Math.random() * 11);
  while (nodes.length < count) {
    const x = Math.floor(Math.random() * MAP_WIDTH);
    const y = Math.floor(Math.random() * MAP_HEIGHT);
    const key = `${x},${y}`;
    if (!positions.has(key)) {
      positions.add(key);
      const type: OreType = Math.random() < 0.5 ? "iron" : "copper";
      nodes.push({ id: `ore-${nodes.length}`, position: { x, y }, type });
    }
  }
  return nodes;
}

export function createInitialState(): GameState {
  return {
    tick: 0,
    currency: 400,
    inventory: {
      iron_ore: 0,
      iron_bar: 0,
      dagger: 0,
      armour: 0,
      copper_ore: 0,
      copper_bar: 0,
      wand: 0,
      magic_powder: 0,
    },
    buildings: [],
    belts: [],
    oreNodes: generateOreNodes(),
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    geologistExplorer: null,
    kingPenaltyTicksLeft: 0,
    lastKingTick: 0,
  };
}

// Current active save
let currentSave: GameSave | null = null;
let currentPlayerId: string = "default";
let ticksSinceLastSave = 0;
const AUTO_SAVE_INTERVAL = 10; // Save every 10 ticks

// Legacy state for backwards compatibility
let gameState: GameState = createInitialState();
let legacyAutomation: AutomationSettings = createDefaultAutomation();
let legacyUpgrades: UpgradeState = createDefaultUpgrades();

export function getState(): GameState {
  if (currentSave) {
    return currentSave.state;
  }
  return gameState;
}

export function setState(state: GameState): void {
  if (currentSave) {
    currentSave.state = state;
  } else {
    gameState = state;
  }
}

export function getMeta(): GameMeta {
  if (currentSave) {
    return currentSave.meta;
  }
  return createDefaultMeta();
}

export function getPrestige(): PrestigeData {
  if (currentSave) {
    return currentSave.prestige;
  }
  return createDefaultPrestige();
}

export function setPrestige(prestige: PrestigeData): void {
  if (currentSave) {
    currentSave.prestige = prestige;
  }
}

export function getUpgrades(): UpgradeState {
  if (currentSave) {
    return currentSave.upgrades;
  }
  return legacyUpgrades;
}

export function setUpgrades(upgrades: UpgradeState): void {
  if (currentSave) {
    currentSave.upgrades = upgrades;
  } else {
    legacyUpgrades = upgrades;
  }
}

export function getAutomation(): AutomationSettings {
  if (currentSave) {
    return currentSave.automation;
  }
  return legacyAutomation;
}

export function setAutomation(automation: AutomationSettings): void {
  if (currentSave) {
    currentSave.automation = automation;
  } else {
    legacyAutomation = automation;
  }
}

export function getCurrentSave(): GameSave | null {
  return currentSave;
}

export function getCurrentPlayerId(): string {
  return currentPlayerId;
}

// Create a new game for a player
export function createGame(playerId: string): { save: GameSave; error?: string } {
  const prestige = currentSave?.prestige || createDefaultPrestige();
  const startingBonus = prestige.bonuses.startingCurrency;

  const save = createNewSave(playerId, startingBonus);
  // Preserve prestige data across resets
  if (currentSave) {
    save.prestige = currentSave.prestige;
  }

  currentSave = save;
  currentPlayerId = playerId;
  gameState = save.state;
  ticksSinceLastSave = 0;

  // Save immediately
  saveToDisk(save);

  return { save };
}

// Load an existing game
export function loadGame(playerId: string): { save: GameSave | null; error?: string; isNew?: boolean } {
  const result = loadFromDisk(playerId);

  if (result.error) {
    return { save: null, error: result.error };
  }

  if (!result.save) {
    // No save exists, create new one
    const newResult = createGame(playerId);
    return { save: newResult.save, isNew: true };
  }

  currentSave = result.save;
  currentPlayerId = playerId;
  gameState = result.save.state;
  ticksSinceLastSave = 0;

  return { save: result.save };
}

// Manual save
export function saveGame(): { success: boolean; error?: string } {
  if (!currentSave) {
    return { success: false, error: "No active game to save" };
  }

  currentSave.meta.lastTickAt = Date.now();
  const result = saveToDisk(currentSave);
  ticksSinceLastSave = 0;
  return result;
}

// Called each tick to handle auto-save
export function tickAutoSave(): void {
  if (!currentSave) return;

  ticksSinceLastSave++;
  if (ticksSinceLastSave >= AUTO_SAVE_INTERVAL) {
    saveGame();
  }
}

// Update meta stats after production
export function updateMetaStats(currencyEarned: number, itemsProduced: number): void {
  if (!currentSave) return;

  currentSave.meta.totalCurrencyEarned += currencyEarned;
  currentSave.meta.totalItemsProduced += itemsProduced;
}

// Save on server shutdown
export function saveOnShutdown(): void {
  if (currentSave) {
    console.log("Saving game on shutdown...");
    saveGame();
  }
}

// Register shutdown handlers
process.on("SIGINT", () => {
  saveOnShutdown();
  process.exit(0);
});

process.on("SIGTERM", () => {
  saveOnShutdown();
  process.exit(0);
});
