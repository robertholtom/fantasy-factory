import {
  BuildingType,
  Position,
  ForgerRecipe,
  BUILDING_COSTS,
  BELT_COST,
  GameState,
  Inventory,
  GEOLOGIST_MAX_COUNT,
  UPGRADE_COSTS,
  MAX_UPGRADE_LEVEL,
  BASE_LAND_COST,
  LAND_COST_MULTIPLIER,
  SorterFilter,
  ITEM_CATEGORIES,
  findPath,
  getBeltEndpoints,
} from "./types";
import { getState, setState, createInitialState, setPrestige, setUpgrades, setAutomation, setMeta, saveGame } from "./state";
import { createDefaultPrestige, createDefaultUpgrades, createDefaultAutomation, createDefaultMeta } from "./persistence";
import { applySmartDefaults } from "./automation";

function emptyInventory(): Inventory {
  return { iron_ore: 0, iron_bar: 0, dagger: 0, armour: 0, copper_ore: 0, copper_bar: 0, wand: 0, magic_powder: 0, coal: 0, steel_bar: 0, sword: 0 };
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
    upgradeLevel: 0,
  });

  return { state };
}

function buildObstacleSet(state: GameState): Set<string> {
  const obstacles = new Set<string>();
  const posKey = (p: Position) => `${p.x},${p.y}`;

  for (const b of state.buildings) {
    obstacles.add(posKey(b.position));
  }

  for (const belt of state.belts) {
    for (let i = 1; i < belt.path.length - 1; i++) {
      obstacles.add(posKey(belt.path[i]));
    }
  }

  return obstacles;
}

export function placeBelt(
  from: Position,
  to: Position
): { state: GameState; error?: string } {
  const state = getState();

  if (!inBounds(from, state) || !inBounds(to, state)) {
    return { state, error: "Out of bounds" };
  }

  if (from.x === to.x && from.y === to.y) {
    return { state, error: "Cannot belt to same cell" };
  }

  const srcBuilding = state.buildings.some(
    (b) => b.position.x === from.x && b.position.y === from.y
  );
  if (!srcBuilding) {
    return { state, error: "Source must have a building" };
  }

  const dstBuilding = state.buildings.some(
    (b) => b.position.x === to.x && b.position.y === to.y
  );
  if (!dstBuilding) {
    return { state, error: "Destination must have a building" };
  }

  const duplicate = state.belts.some((b) => {
    const { from: bFrom, to: bTo } = getBeltEndpoints(b);
    return bFrom.x === from.x && bFrom.y === from.y && bTo.x === to.x && bTo.y === to.y;
  });
  if (duplicate) {
    return { state, error: "Belt already exists" };
  }

  const obstacles = buildObstacleSet(state);
  const path = findPath(from, to, obstacles, state.mapWidth, state.mapHeight);

  if (!path) {
    return { state, error: "No valid path" };
  }

  if (path.length < 3) {
    return { state, error: "Belts require at least 1 space between buildings" };
  }

  const internalCells = path.length - 2;
  const totalCost = BELT_COST * internalCells;

  if (state.currency < totalCost) {
    return { state, error: "Not enough currency" };
  }

  state.currency -= totalCost;
  state.belts.push({
    id: `belt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    path,
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

  const pos = building.position;
  state.belts = state.belts.filter((b) => {
    const { from, to } = getBeltEndpoints(b);
    return !(from.x === pos.x && from.y === pos.y) &&
           !(to.x === pos.x && to.y === pos.y);
  });

  state.buildings.splice(idx, 1);
  state.currency += refund;

  return { state };
}

export function resetGame(): GameState {
  const newState = createInitialState();
  setState(newState);
  return newState;
}

export function resetGameCompletely(): GameState {
  const newState = createInitialState();
  setState(newState);
  setMeta(createDefaultMeta());
  setPrestige(createDefaultPrestige());
  setUpgrades(createDefaultUpgrades());
  setAutomation(createDefaultAutomation());
  saveGame();
  return newState;
}

export function upgradeBuilding(
  buildingId: string
): { state: GameState; error?: string } {
  const state = getState();
  const building = state.buildings.find((b) => b.id === buildingId);

  if (!building) {
    return { state, error: "Building not found" };
  }

  if (building.constructionProgress < 1) {
    return { state, error: "Cannot upgrade building under construction" };
  }

  const currentLevel = building.upgradeLevel ?? 0;
  if (currentLevel >= MAX_UPGRADE_LEVEL) {
    return { state, error: "Building already at max level" };
  }

  const cost = UPGRADE_COSTS[currentLevel];
  if (state.currency < cost) {
    return { state, error: "Not enough currency" };
  }

  state.currency -= cost;
  building.upgradeLevel = currentLevel + 1;

  return { state };
}

export function purchaseLand(
  side: "right" | "bottom"
): { state: GameState; error?: string } {
  const state = getState();
  const cost = Math.floor(BASE_LAND_COST * Math.pow(LAND_COST_MULTIPLIER, state.tilesPurchased));

  if (state.currency < cost) {
    return { state, error: "Not enough currency" };
  }

  state.currency -= cost;
  state.tilesPurchased++;

  if (side === "right") {
    state.mapWidth += 1;
  } else {
    state.mapHeight += 1;
  }

  return { state };
}

export function setSorterFilter(
  buildingId: string,
  filter: SorterFilter
): { state: GameState; error?: string } {
  const state = getState();
  const building = state.buildings.find((b) => b.id === buildingId);

  if (!building) {
    return { state, error: "Building not found" };
  }

  if (building.type !== "sorter") {
    return { state, error: "Only sorters have filters" };
  }

  if (!(filter in ITEM_CATEGORIES)) {
    return { state, error: "Invalid filter" };
  }

  building.sorterFilter = filter;

  return { state };
}

export { applySmartDefaults };
