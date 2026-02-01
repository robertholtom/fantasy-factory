import {
  BuildingType,
  Position,
  ForgerRecipe,
  BUILDING_COSTS,
  BELT_COST,
  GameState,
  Inventory,
  GEOLOGIST_MAX_COUNT,
} from "../../shared/types.js";
import { getState, setState, createInitialState } from "./state.js";
import { applySmartDefaults } from "./automation.js";

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

  if (type === "geologist") {
    const existingGeologists = state.buildings.filter(b => b.type === "geologist").length;
    if (existingGeologists >= GEOLOGIST_MAX_COUNT) {
      return { state, error: "Only one geologist building allowed" };
    }
  }

  state.currency -= cost;
  state.buildings.push({
    id: `building-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    position,
    progress: 0,
    constructionProgress: 0,
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

export { applySmartDefaults };
