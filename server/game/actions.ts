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

export function toggleAiMode(): GameState {
  const state = getState();
  state.aiMode = !state.aiMode;
  return state;
}

// Auto-play: Build an optimal factory layout and enable AI mode
export function autoPlay(): { state: GameState; error?: string } {
  // Reset to fresh state with AI mode enabled
  const state = createInitialState();
  state.aiMode = true;
  setState(state);

  const posKey = (p: Position) => `${p.x},${p.y}`;

  // Track which cells have buildings
  function isOccupied(pos: Position): boolean {
    return state.buildings.some(b => b.position.x === pos.x && b.position.y === pos.y);
  }

  // Helper to find nearest empty cell to a position
  function findEmptyNear(target: Position, reserved: Set<string>): Position | null {
    // Check adjacent cells first (distance 1), then expand
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

  // Helper to place a building
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
    return true;
  }

  // Helper to place a belt
  function belt(from: Position, to: Position): boolean {
    if (state.currency < BELT_COST) return false;
    state.currency -= BELT_COST;
    state.belts.push({
      id: `belt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      from,
      to,
    });
    return true;
  }

  // Group ore nodes by type
  const ironNodes = state.oreNodes.filter(n => n.type === "iron");
  const copperNodes = state.oreNodes.filter(n => n.type === "copper");

  // Pick primary ore type (whichever has more nodes)
  const primaryNodes = ironNodes.length >= copperNodes.length ? ironNodes : copperNodes;
  const secondaryNodes = ironNodes.length >= copperNodes.length ? copperNodes : ironNodes;
  const primaryRecipe: ForgerRecipe = primaryNodes === ironNodes ? "dagger" : "wand";
  const secondaryRecipe: ForgerRecipe = primaryNodes === ironNodes ? "wand" : "dagger";

  // STEP 1: Build one complete chain first
  if (primaryNodes.length === 0) {
    return { state, error: "No ore nodes found" };
  }

  // Plan positions before placing anything
  const reserved = new Set<string>();

  const minerPos = primaryNodes[0].position;
  reserved.add(posKey(minerPos));

  const smelterPos = findEmptyNear(minerPos, reserved);
  if (!smelterPos) return { state, error: "No space for smelter" };
  reserved.add(posKey(smelterPos));

  const forgerPos = findEmptyNear(smelterPos, reserved);
  if (!forgerPos) return { state, error: "No space for forger" };
  reserved.add(posKey(forgerPos));

  const shopPos = findEmptyNear(forgerPos, reserved);
  if (!shopPos) return { state, error: "No space for shop" };
  reserved.add(posKey(shopPos));

  // Place buildings
  place("miner", minerPos);
  place("smelter", smelterPos);
  place("forger", forgerPos, primaryRecipe);
  place("shop", shopPos);

  // Place belts for primary chain
  belt(minerPos, smelterPos);
  belt(smelterPos, forgerPos);
  belt(forgerPos, shopPos);

  // STEP 2: Add more miners to primary chain if budget allows
  for (let i = 1; i < primaryNodes.length; i++) {
    const node = primaryNodes[i];
    if (state.currency < BUILDING_COSTS.miner + BELT_COST) break;
    if (place("miner", node.position)) {
      belt(node.position, smelterPos);
    }
  }

  // STEP 3: If we have enough budget, add a secondary chain
  // Need: miner(10) + smelter(25) + forger(50) + 3 belts(15) = 100 (reuse shop)
  if (secondaryNodes.length > 0 && state.currency >= 100) {
    const secMinerPos = secondaryNodes[0].position;
    reserved.add(posKey(secMinerPos));

    const secSmelterPos = findEmptyNear(secMinerPos, reserved);
    if (secSmelterPos) reserved.add(posKey(secSmelterPos));

    const secForgerPos = secSmelterPos ? findEmptyNear(secSmelterPos, reserved) : null;

    if (secSmelterPos && secForgerPos) {
      place("miner", secMinerPos);
      place("smelter", secSmelterPos);
      place("forger", secForgerPos, secondaryRecipe);
      belt(secMinerPos, secSmelterPos);
      belt(secSmelterPos, secForgerPos);
      belt(secForgerPos, shopPos);

      // Add more secondary miners if budget allows
      for (let i = 1; i < secondaryNodes.length; i++) {
        const node = secondaryNodes[i];
        if (state.currency < BUILDING_COSTS.miner + BELT_COST) break;
        if (place("miner", node.position)) {
          belt(node.position, secSmelterPos);
        }
      }
    }
  }

  return { state };
}
