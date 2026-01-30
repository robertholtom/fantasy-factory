import {
  BuildingType,
  Position,
  ForgerRecipe,
  BUILDING_COSTS,
  BELT_COST,
  GameState,
  Inventory,
} from "../../shared/types.js";
import { getState, setState, createInitialState } from "./state.js";

function emptyInventory(): Inventory {
  return { iron_ore: 0, iron_bar: 0, dagger: 0, armour: 0, copper_ore: 0, copper_bar: 0, wand: 0, magic_powder: 0 };
}

function inBounds(pos: Position, state: GameState): boolean {
  return pos.x >= 0 && pos.x < state.mapWidth && pos.y >= 0 && pos.y < state.mapHeight;
}

export function placeBuilding(
  type: BuildingType,
  position: Position
): { state: GameState; error?: string } {
  const state = getState();
  const cost = BUILDING_COSTS[type];

  if (state.currency < cost) {
    return { state, error: "Not enough currency" };
  }

  if (!inBounds(position, state)) {
    return { state, error: "Out of bounds" };
  }

  const occupied = state.buildings.some(
    (b) => b.position.x === position.x && b.position.y === position.y
  );
  if (occupied) {
    return { state, error: "Cell already occupied" };
  }

  if (type === "miner") {
    const onOre = state.oreNodes.some(
      (n) => n.position.x === position.x && n.position.y === position.y
    );
    if (!onOre) {
      return { state, error: "Must place miner on ore node" };
    }
  }

  state.currency -= cost;
  state.buildings.push({
    id: `building-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    position,
    progress: 0,
    storage: emptyInventory(),
    recipe: "dagger",
    npcQueue: [],
  });

  return { state };
}

export function placeBelt(
  from: Position,
  to: Position
): { state: GameState; error?: string } {
  const state = getState();

  if (state.currency < BELT_COST) {
    return { state, error: "Not enough currency" };
  }

  if (!inBounds(from, state) || !inBounds(to, state)) {
    return { state, error: "Out of bounds" };
  }

  if (from.x === to.x && from.y === to.y) {
    return { state, error: "Cannot belt to same cell" };
  }

  // Source must have a building
  const srcBuilding = state.buildings.some(
    (b) => b.position.x === from.x && b.position.y === from.y
  );
  if (!srcBuilding) {
    return { state, error: "Source must have a building" };
  }

  // Destination must have a building
  const dstBuilding = state.buildings.some(
    (b) => b.position.x === to.x && b.position.y === to.y
  );
  if (!dstBuilding) {
    return { state, error: "Destination must have a building" };
  }

  // No duplicate belts
  const duplicate = state.belts.some(
    (b) => b.from.x === from.x && b.from.y === from.y && b.to.x === to.x && b.to.y === to.y
  );
  if (duplicate) {
    return { state, error: "Belt already exists" };
  }

  state.currency -= BELT_COST;
  state.belts.push({
    id: `belt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    from,
    to,
    itemsInTransit: [],
  });

  return { state };
}

export function setRecipe(
  buildingId: string,
  recipe: ForgerRecipe
): { state: GameState; error?: string } {
  const state = getState();
  const building = state.buildings.find((b) => b.id === buildingId);

  if (!building) {
    return { state, error: "Building not found" };
  }

  if (building.type !== "forger") {
    return { state, error: "Only forgers have recipes" };
  }

  building.recipe = recipe;
  building.progress = 0;

  return { state };
}

export function demolishBuilding(
  buildingId: string
): { state: GameState; error?: string } {
  const state = getState();
  const idx = state.buildings.findIndex((b) => b.id === buildingId);

  if (idx === -1) {
    return { state, error: "Building not found" };
  }

  const building = state.buildings[idx];
  const refund = Math.floor(BUILDING_COSTS[building.type] * 0.75);

  // Remove belts connected to this building
  const pos = building.position;
  state.belts = state.belts.filter(
    (b) =>
      !(b.from.x === pos.x && b.from.y === pos.y) &&
      !(b.to.x === pos.x && b.to.y === pos.y)
  );

  // Remove building
  state.buildings.splice(idx, 1);
  state.currency += refund;

  return { state };
}

export function resetGame(): GameState {
  const newState = createInitialState();
  setState(newState);
  return newState;
}

export function toggleAiMode(): { state: GameState; error?: string } {
  const state = getState();

  // If turning ON and no buildings exist, run auto-play setup
  if (!state.aiMode && state.buildings.length === 0) {
    return autoPlay();
  }

  // Otherwise just toggle the flag
  state.aiMode = !state.aiMode;
  return { state };
}

// Auto-play: Build an optimal factory layout and enable AI mode
// Uses 2:1:1 ratio (2 miners : 1 smelter : 1 forger) for optimal throughput
export function autoPlay(): { state: GameState; error?: string } {
  const state = createInitialState();
  state.aiMode = true;
  setState(state);

  const posKey = (p: Position) => `${p.x},${p.y}`;
  const reserved = new Set<string>();

  function isOccupied(pos: Position): boolean {
    return state.buildings.some(b => b.position.x === pos.x && b.position.y === pos.y);
  }

  function findEmptyNear(target: Position): Position | null {
    const directions = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
      { dx: 1, dy: 1 }, { dx: -1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: -1 },
    ];
    for (let radius = 1; radius <= 10; radius++) {
      for (const dir of directions) {
        const pos = { x: target.x + dir.dx * radius, y: target.y + dir.dy * radius };
        if (!inBounds(pos, state)) continue;
        if (reserved.has(posKey(pos))) continue;
        if (isOccupied(pos)) continue;
        const onOre = state.oreNodes.some(n => n.position.x === pos.x && n.position.y === pos.y);
        if (!onOre) return pos;
      }
    }
    return null;
  }

  function place(type: BuildingType, pos: Position, recipe?: ForgerRecipe): boolean {
    if (state.currency < BUILDING_COSTS[type]) return false;
    if (isOccupied(pos)) return false;
    state.currency -= BUILDING_COSTS[type];
    state.buildings.push({
      id: `building-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      position: pos,
      progress: 0,
      storage: emptyInventory(),
      recipe: recipe || "dagger",
      npcQueue: [],
    });
    reserved.add(posKey(pos));
    return true;
  }

  function belt(from: Position, to: Position): boolean {
    if (state.currency < BELT_COST) return false;
    const exists = state.belts.some(b =>
      b.from.x === from.x && b.from.y === from.y && b.to.x === to.x && b.to.y === to.y
    );
    if (exists) return false;
    state.currency -= BELT_COST;
    state.belts.push({
      id: `belt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      from,
      to,
      itemsInTransit: [],
    });
    return true;
  }

  // Build a production chain: up to 2 miners -> smelter -> forger
  // Returns true if chain was built
  function buildChain(oreNodes: typeof state.oreNodes, recipe: ForgerRecipe, shopPos: Position | null): Position | null {
    if (oreNodes.length === 0) return shopPos;

    // Cost: 1-2 miners + smelter + forger + 3-4 belts (+ shop if first)
    const chainCost = BUILDING_COSTS.miner + BUILDING_COSTS.smelter + BUILDING_COSTS.forger + BELT_COST * 3;
    const shopCost = shopPos ? 0 : BUILDING_COSTS.shop + BELT_COST;
    if (state.currency < chainCost + shopCost) return shopPos;

    const miner1Pos = oreNodes[0].position;
    reserved.add(posKey(miner1Pos));

    const smelterPos = findEmptyNear(miner1Pos);
    if (!smelterPos) return shopPos;
    reserved.add(posKey(smelterPos));

    const forgerPos = findEmptyNear(smelterPos);
    if (!forgerPos) return shopPos;
    reserved.add(posKey(forgerPos));

    let currentShopPos = shopPos;
    if (!currentShopPos) {
      currentShopPos = findEmptyNear(forgerPos);
      if (!currentShopPos) return shopPos;
      reserved.add(posKey(currentShopPos));
    }

    // Place buildings
    place("miner", miner1Pos);
    place("smelter", smelterPos);
    place("forger", forgerPos, recipe);
    if (!shopPos) place("shop", currentShopPos);

    // Place belts
    belt(miner1Pos, smelterPos);
    belt(smelterPos, forgerPos);
    belt(forgerPos, currentShopPos);

    // Add second miner if available (2:1 ratio)
    if (oreNodes.length > 1 && state.currency >= BUILDING_COSTS.miner + BELT_COST) {
      const miner2Pos = oreNodes[1].position;
      if (place("miner", miner2Pos)) {
        belt(miner2Pos, smelterPos);
      }
    }

    return currentShopPos;
  }

  // Group ore nodes by type
  const ironNodes = [...state.oreNodes.filter(n => n.type === "iron")];
  const copperNodes = [...state.oreNodes.filter(n => n.type === "copper")];

  if (ironNodes.length === 0 && copperNodes.length === 0) {
    return { state, error: "No ore nodes found" };
  }

  let shopPos: Position | null = null;

  // Build chains for iron (2 nodes per chain)
  while (ironNodes.length > 0 && state.currency >= 100) {
    const nodesToUse = ironNodes.splice(0, 2);
    const newShopPos = buildChain(nodesToUse, "dagger", shopPos);
    if (newShopPos === shopPos && shopPos !== null) break; // Failed to build
    shopPos = newShopPos;
  }

  // Build chains for copper (2 nodes per chain)
  while (copperNodes.length > 0 && state.currency >= 100) {
    const nodesToUse = copperNodes.splice(0, 2);
    const newShopPos = buildChain(nodesToUse, "wand", shopPos);
    if (newShopPos === shopPos && shopPos !== null) break;
    shopPos = newShopPos;
  }

  return { state };
}
