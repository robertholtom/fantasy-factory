import { GameState, OreNode, OreType } from "../../shared/types.js";

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
    aiMode: false,
  };
}

let gameState: GameState = createInitialState();

export function getState(): GameState {
  return gameState;
}

export function setState(state: GameState): void {
  gameState = state;
}
