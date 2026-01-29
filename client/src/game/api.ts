import { GameState, BuildingType, ForgerRecipe, Position } from "../../../shared/types";

const BASE = "/api/game";

export async function getGameState(): Promise<GameState> {
  const res = await fetch(`${BASE}/state`);
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

export async function autoPlay(): Promise<{ state?: GameState; error?: string }> {
  const res = await fetch(`${BASE}/autoplay`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) {
    return { error: data.error, state: data.state };
  }
  return { state: data };
}

export async function toggleAiMode(): Promise<GameState> {
  const res = await fetch(`${BASE}/ai-mode`, { method: "POST" });
  return res.json();
}
