import { describe, it, expect } from "vitest";
import { createInitialState, getState, setState } from "./state.js";

describe("state", () => {
  it("creates initial state with correct defaults", () => {
    const state = createInitialState();
    expect(state.tick).toBe(0);
    expect(state.currency).toBe(350);
    expect(state.inventory).toEqual({
      iron_ore: 0,
      iron_bar: 0,
      dagger: 0,
      armour: 0,
      copper_ore: 0,
      copper_bar: 0,
      wand: 0,
      magic_powder: 0,
    });
    expect(state.buildings).toEqual([]);
    expect(state.belts).toEqual([]);
    expect(state.mapWidth).toBe(30);
    expect(state.mapHeight).toBe(20);
  });

  it("generates 15-20 ore nodes", () => {
    const state = createInitialState();
    expect(state.oreNodes.length).toBeGreaterThanOrEqual(15);
    expect(state.oreNodes.length).toBeLessThanOrEqual(20);
  });

  it("generates ore nodes with unique positions", () => {
    const state = createInitialState();
    const keys = state.oreNodes.map((n) => `${n.position.x},${n.position.y}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("generates ore nodes with valid type field", () => {
    const state = createInitialState();
    for (const node of state.oreNodes) {
      expect(["iron", "copper"]).toContain(node.type);
    }
  });

  it("getState and setState work", () => {
    const state = createInitialState();
    state.currency = 999;
    setState(state);
    expect(getState().currency).toBe(999);
  });
});
