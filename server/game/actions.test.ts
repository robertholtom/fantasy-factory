import { describe, it, expect, beforeEach } from "vitest";
import { setState } from "./state.js";
import {
  placeBuilding,
  placeBelt,
  setRecipe,
  demolishBuilding,
  resetGame,
} from "./actions.js";
import { GameState, Inventory } from "../../shared/types.js";

function emptyInventory(): Inventory {
  return { iron_ore: 0, iron_bar: 0, dagger: 0, armour: 0, copper_ore: 0, copper_bar: 0, wand: 0, magic_powder: 0 };
}

function makeState(overrides?: Partial<GameState>): GameState {
  return {
    tick: 0,
    currency: 350,
    inventory: emptyInventory(),
    buildings: [],
    belts: [],
    oreNodes: [{ id: "ore-0", position: { x: 5, y: 5 }, type: "iron" as const }],
    mapWidth: 30,
    mapHeight: 20,
    aiMode: false,
    ...overrides,
  };
}

describe("placeBuilding", () => {
  beforeEach(() => setState(makeState()));

  it("places a miner on an ore node", () => {
    const { state, error } = placeBuilding("miner", { x: 5, y: 5 });
    expect(error).toBeUndefined();
    expect(state.buildings).toHaveLength(1);
    expect(state.buildings[0].type).toBe("miner");
    expect(state.currency).toBe(340); // 350 - 10
  });

  it("rejects miner not on ore node", () => {
    const { error } = placeBuilding("miner", { x: 0, y: 0 });
    expect(error).toBe("Must place miner on ore node");
  });

  it("places smelter anywhere", () => {
    const { state, error } = placeBuilding("smelter", { x: 0, y: 0 });
    expect(error).toBeUndefined();
    expect(state.buildings[0].type).toBe("smelter");
    expect(state.currency).toBe(325); // 350 - 25
  });

  it("places forger anywhere", () => {
    const { state, error } = placeBuilding("forger", { x: 1, y: 1 });
    expect(error).toBeUndefined();
    expect(state.buildings[0].type).toBe("forger");
    expect(state.buildings[0].recipe).toBe("dagger");
    expect(state.currency).toBe(300); // 350 - 50
  });

  it("rejects when not enough currency", () => {
    setState(makeState({ currency: 5 }));
    const { error } = placeBuilding("miner", { x: 5, y: 5 });
    expect(error).toBe("Not enough currency");
  });

  it("rejects out of bounds", () => {
    const { error } = placeBuilding("smelter", { x: -1, y: 0 });
    expect(error).toBe("Out of bounds");
  });

  it("rejects occupied cell", () => {
    placeBuilding("smelter", { x: 0, y: 0 });
    const { error } = placeBuilding("smelter", { x: 0, y: 0 });
    expect(error).toBe("Cell already occupied");
  });

  it("building starts with empty storage, zero progress, and empty npcQueue", () => {
    const { state } = placeBuilding("smelter", { x: 0, y: 0 });
    const b = state.buildings[0];
    expect(b.progress).toBe(0);
    expect(b.storage).toEqual(emptyInventory());
    expect(b.npcQueue).toEqual([]);
  });

  it("places shop anywhere", () => {
    const { state, error } = placeBuilding("shop", { x: 0, y: 0 });
    expect(error).toBeUndefined();
    expect(state.buildings[0].type).toBe("shop");
    expect(state.currency).toBe(275); // 350 - 75
  });

  it("rejects shop when not enough currency", () => {
    setState(makeState({ currency: 50 }));
    const { error } = placeBuilding("shop", { x: 0, y: 0 });
    expect(error).toBe("Not enough currency");
  });

  it("shop can be placed on ore node (unlike miner requirement)", () => {
    // Shop doesn't require ore node, but can be placed on one
    const { state, error } = placeBuilding("shop", { x: 5, y: 5 });
    expect(error).toBeUndefined();
    expect(state.buildings[0].type).toBe("shop");
  });
});

describe("placeBelt", () => {
  beforeEach(() => {
    const s = makeState();
    s.buildings.push(
      { id: "b1", type: "miner", position: { x: 5, y: 5 }, progress: 0, storage: emptyInventory(), recipe: "dagger", npcQueue: [] },
      { id: "b2", type: "smelter", position: { x: 6, y: 5 }, progress: 0, storage: emptyInventory(), recipe: "dagger", npcQueue: [] }
    );
    setState(s);
  });

  it("places a belt between two buildings", () => {
    const { state, error } = placeBelt({ x: 5, y: 5 }, { x: 6, y: 5 });
    expect(error).toBeUndefined();
    expect(state.belts).toHaveLength(1);
    expect(state.currency).toBe(345); // 350 - 5
  });

  it("rejects belt with no source building", () => {
    const { error } = placeBelt({ x: 0, y: 0 }, { x: 6, y: 5 });
    expect(error).toBe("Source must have a building");
  });

  it("rejects belt with no destination building", () => {
    const { error } = placeBelt({ x: 5, y: 5 }, { x: 0, y: 0 });
    expect(error).toBe("Destination must have a building");
  });

  it("rejects belt to same cell", () => {
    const { error } = placeBelt({ x: 5, y: 5 }, { x: 5, y: 5 });
    expect(error).toBe("Cannot belt to same cell");
  });

  it("rejects duplicate belt", () => {
    placeBelt({ x: 5, y: 5 }, { x: 6, y: 5 });
    const { error } = placeBelt({ x: 5, y: 5 }, { x: 6, y: 5 });
    expect(error).toBe("Belt already exists");
  });

  it("rejects belt when not enough currency", () => {
    setState({ ...makeState({ currency: 2 }), buildings: [
      { id: "b1", type: "miner", position: { x: 5, y: 5 }, progress: 0, storage: emptyInventory(), recipe: "dagger", npcQueue: [] },
      { id: "b2", type: "smelter", position: { x: 6, y: 5 }, progress: 0, storage: emptyInventory(), recipe: "dagger", npcQueue: [] },
    ]});
    const { error } = placeBelt({ x: 5, y: 5 }, { x: 6, y: 5 });
    expect(error).toBe("Not enough currency");
  });

  it("rejects out of bounds", () => {
    const { error } = placeBelt({ x: -1, y: 0 }, { x: 6, y: 5 });
    expect(error).toBe("Out of bounds");
  });

  it("creates belt with empty itemsInTransit array", () => {
    const { state, error } = placeBelt({ x: 5, y: 5 }, { x: 6, y: 5 });
    expect(error).toBeUndefined();
    expect(state.belts[0].itemsInTransit).toEqual([]);
  });
});

describe("setRecipe", () => {
  beforeEach(() => {
    const s = makeState();
    s.buildings.push(
      { id: "forger-1", type: "forger", position: { x: 1, y: 1 }, progress: 0.5, storage: emptyInventory(), recipe: "dagger", npcQueue: [] },
      { id: "miner-1", type: "miner", position: { x: 5, y: 5 }, progress: 0, storage: emptyInventory(), recipe: "dagger", npcQueue: [] }
    );
    setState(s);
  });

  it("changes recipe and resets progress", () => {
    const { state, error } = setRecipe("forger-1", "armour");
    expect(error).toBeUndefined();
    const forger = state.buildings.find((b) => b.id === "forger-1")!;
    expect(forger.recipe).toBe("armour");
    expect(forger.progress).toBe(0);
  });

  it("rejects non-forger buildings", () => {
    const { error } = setRecipe("miner-1", "armour");
    expect(error).toBe("Only forgers have recipes");
  });

  it("rejects unknown building id", () => {
    const { error } = setRecipe("nonexistent", "armour");
    expect(error).toBe("Building not found");
  });
});

describe("demolishBuilding", () => {
  beforeEach(() => {
    const s = makeState({ currency: 100 });
    s.buildings.push(
      { id: "s1", type: "smelter", position: { x: 2, y: 2 }, progress: 0, storage: emptyInventory(), recipe: "dagger", npcQueue: [] },
      { id: "m1", type: "miner", position: { x: 5, y: 5 }, progress: 0, storage: emptyInventory(), recipe: "dagger", npcQueue: [] }
    );
    s.belts.push(
      { id: "belt-1", from: { x: 5, y: 5 }, to: { x: 2, y: 2 }, itemsInTransit: [] },
      { id: "belt-2", from: { x: 2, y: 2 }, to: { x: 3, y: 3 }, itemsInTransit: [] }
    );
    setState(s);
  });

  it("removes building and refunds 50%", () => {
    const { state, error } = demolishBuilding("s1");
    expect(error).toBeUndefined();
    expect(state.buildings).toHaveLength(1);
    expect(state.buildings[0].id).toBe("m1");
    expect(state.currency).toBe(118); // 100 + floor(25*0.75)
  });

  it("removes connected belts", () => {
    const { state } = demolishBuilding("s1");
    // Both belts connect to s1 at (2,2), so both should be removed
    expect(state.belts).toHaveLength(0);
  });

  it("refunds correct amount for miner", () => {
    const { state } = demolishBuilding("m1");
    expect(state.currency).toBe(107); // 100 + floor(10*0.75)
  });

  it("refunds correct amount for shop", () => {
    const s = makeState({ currency: 100 });
    s.buildings.push(
      { id: "shop1", type: "shop", position: { x: 0, y: 0 }, progress: 0, storage: emptyInventory(), recipe: "dagger", npcQueue: [] }
    );
    setState(s);
    const { state } = demolishBuilding("shop1");
    expect(state.currency).toBe(156); // 100 + floor(75*0.75)
  });

  it("rejects unknown building", () => {
    const { error } = demolishBuilding("nonexistent");
    expect(error).toBe("Building not found");
  });
});

describe("resetGame", () => {
  it("returns fresh state", () => {
    setState(makeState({ currency: 0, tick: 999 }));
    const state = resetGame();
    expect(state.tick).toBe(0);
    expect(state.currency).toBe(350);
    expect(state.buildings).toEqual([]);
    expect(state.belts).toEqual([]);
  });
});
