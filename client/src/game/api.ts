import {
  GameState,
  GameMeta,
  PrestigeData,
  UpgradeState,
  AutomationSettings,
  OfflineProgress,
  BuildingType,
  ForgerRecipe,
  Position,
  PrestigeUpgradeId,
  UpgradeId,
  GameSave,
} from "../../../shared/types";

const BASE = "/api/game";

export interface FullState {
  state: GameState;
  meta: GameMeta;
  prestige: PrestigeData;
  upgrades: UpgradeState;
  automation: AutomationSettings;
}

export interface LoadResult {
  save: GameSave;
  offlineProgress: OfflineProgress | null;
  isNew?: boolean;
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
  purchased: UpgradeId[];
  available: UpgradeId[];
  locked: UpgradeId[];
  definitions: Record<UpgradeId, {
    id: UpgradeId;
    name: string;
    description: string;
    cost: number;
    tier: number;
    category: string;
    requires: UpgradeId[];
  }>;
}

export async function getGameState(): Promise<GameState> {
  const res = await fetch(`${BASE}/state`);
  return res.json();
}

export async function getFullState(): Promise<FullState> {
  const res = await fetch(`${BASE}/full-state`);
  return res.json();
}

export async function loadGame(playerId: string): Promise<LoadResult> {
  const res = await fetch(`${BASE}/load`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId }),
  });
  return res.json();
}

export async function createGame(playerId: string): Promise<{ save: GameSave; offlineProgress: null }> {
  const res = await fetch(`${BASE}/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId }),
  });
  return res.json();
}

export async function saveGame(): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${BASE}/save`, { method: "POST" });
  return res.json();
}

export async function placeBuilding(
  type: BuildingType,
  position: Position
): Promise<{ state?: GameState; error?: string }> {
  const res = await fetch(`${BASE}/place`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, position }),
  });
  const data = await res.json();
  if (!res.ok) {
    return { error: data.error, state: data.state };
  }
  return { state: data };
}

export async function placeBelt(
  from: Position,
  to: Position
): Promise<{ state?: GameState; error?: string }> {
  const res = await fetch(`${BASE}/belt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, to }),
  });
  const data = await res.json();
  if (!res.ok) {
    return { error: data.error, state: data.state };
  }
  return { state: data };
}

export async function setRecipe(
  buildingId: string,
  recipe: ForgerRecipe
): Promise<{ state?: GameState; error?: string }> {
  const res = await fetch(`${BASE}/recipe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ buildingId, recipe }),
  });
  const data = await res.json();
  if (!res.ok) {
    return { error: data.error, state: data.state };
  }
  return { state: data };
}

export async function demolishBuilding(
  buildingId: string
): Promise<{ state?: GameState; error?: string }> {
  const res = await fetch(`${BASE}/demolish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ buildingId }),
  });
  const data = await res.json();
  if (!res.ok) {
    return { error: data.error, state: data.state };
  }
  return { state: data };
}

export async function resetGame(): Promise<GameState> {
  const res = await fetch(`${BASE}/reset`, { method: "POST" });
  return res.json();
}

export async function applySmartDefaults(): Promise<{ automation: AutomationSettings }> {
  const res = await fetch(`${BASE}/automation/smart-defaults`, { method: "POST" });
  return res.json();
}

// Prestige endpoints
export async function getPrestigeInfo(): Promise<PrestigeInfo> {
  const res = await fetch(`${BASE}/prestige`);
  return res.json();
}

export async function performPrestige(): Promise<{ success: boolean; error?: string; prestige?: PrestigeData }> {
  const res = await fetch(`${BASE}/prestige`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) {
    return { success: false, error: data.error };
  }
  return data;
}

export async function buyPrestigeUpgrade(upgradeId: PrestigeUpgradeId): Promise<{ success: boolean; error?: string; prestige?: PrestigeData }> {
  const res = await fetch(`${BASE}/prestige/buy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ upgradeId }),
  });
  const data = await res.json();
  if (!res.ok) {
    return { success: false, error: data.error };
  }
  return data;
}

// Upgrade endpoints
export async function getUpgradeInfo(): Promise<UpgradeInfo> {
  const res = await fetch(`${BASE}/upgrades`);
  return res.json();
}

export async function buyUpgrade(upgradeId: UpgradeId): Promise<{ success: boolean; error?: string; upgrades?: UpgradeState; state?: GameState }> {
  const res = await fetch(`${BASE}/upgrades/buy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ upgradeId }),
  });
  const data = await res.json();
  if (!res.ok) {
    return { success: false, error: data.error };
  }
  return data;
}

// Automation endpoints
export async function getAutomation(): Promise<AutomationSettings> {
  const res = await fetch(`${BASE}/automation`);
  return res.json();
}

export async function updateAutomation(settings: Partial<AutomationSettings>): Promise<AutomationSettings> {
  const res = await fetch(`${BASE}/automation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ settings }),
  });
  return res.json();
}
