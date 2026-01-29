import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { getState, setState } from "./state.js";
import { startGameLoop, stopGameLoop } from "./loop.js";
import { GameState, Building, Inventory } from "../../shared/types.js";

function emptyInventory(): Inventory {
  return { iron_ore: 0, iron_bar: 0, dagger: 0, armour: 0, copper_ore: 0, copper_bar: 0, wand: 0, magic_powder: 0 };
}

function makeBuilding(overrides: Partial<Building> & Pick<Building, "id" | "type" | "position">): Building {
  return {
    progress: 0,
    storage: emptyInventory(),
    recipe: "dagger",
    npcQueue: [],
    ...overrides,
  };
}

function makeState(overrides?: Partial<GameState>): GameState {
  return {
    tick: 0,
    currency: 350,
    inventory: emptyInventory(),
    buildings: [],
    belts: [],
    oreNodes: [],
    mapWidth: 30,
    mapHeight: 20,
    aiMode: false,
    ...overrides,
  };
}

function tickN(n: number): void {
  // Simulate n ticks by starting/stopping the loop with fake timers
  for (let i = 0; i < n; i++) {
    vi.advanceTimersByTime(1000);
  }
}

describe("game loop", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    stopGameLoop();
    vi.useRealTimers();
  });

  describe("miner production", () => {
    it("produces 1 ore after 3 ticks", () => {
      setState(makeState({
        buildings: [makeBuilding({ id: "m1", type: "miner", position: { x: 0, y: 0 } })],
        oreNodes: [{ id: "ore-1", position: { x: 0, y: 0 }, type: "iron" as const }],
      }));
      startGameLoop();
      tickN(3);
      const miner = getState().buildings[0];
      expect(miner.storage.iron_ore).toBe(1);
      expect(miner.progress).toBe(0);
    });

    it("produces 2 ore after 6 ticks", () => {
      setState(makeState({
        buildings: [makeBuilding({ id: "m1", type: "miner", position: { x: 0, y: 0 } })],
        oreNodes: [{ id: "ore-1", position: { x: 0, y: 0 }, type: "iron" as const }],
      }));
      startGameLoop();
      tickN(6);
      expect(getState().buildings[0].storage.iron_ore).toBe(2);
    });

    it("accumulates partial progress", () => {
      setState(makeState({
        buildings: [makeBuilding({ id: "m1", type: "miner", position: { x: 0, y: 0 } })],
        oreNodes: [{ id: "ore-1", position: { x: 0, y: 0 }, type: "iron" as const }],
      }));
      startGameLoop();
      tickN(1);
      const miner = getState().buildings[0];
      expect(miner.progress).toBeCloseTo(1 / 3);
      expect(miner.storage.iron_ore).toBe(0);
    });
  });

  describe("smelter production", () => {
    it("produces 1 bar when given 2 ore after 5 ticks", () => {
      setState(makeState({
        buildings: [makeBuilding({
          id: "s1",
          type: "smelter",
          position: { x: 0, y: 0 },
          storage: { ...emptyInventory(), iron_ore: 2 },
        })],
      }));
      startGameLoop();
      tickN(5);
      const smelter = getState().buildings[0];
      expect(smelter.storage.iron_bar).toBe(1);
      expect(smelter.storage.iron_ore).toBe(0);
    });

    it("stalls when insufficient ore", () => {
      setState(makeState({
        buildings: [makeBuilding({
          id: "s1",
          type: "smelter",
          position: { x: 0, y: 0 },
          storage: { ...emptyInventory(), iron_ore: 1 },
        })],
      }));
      startGameLoop();
      tickN(10);
      const smelter = getState().buildings[0];
      expect(smelter.progress).toBe(0);
      expect(smelter.storage.iron_bar).toBe(0);
    });
  });

  describe("forger production", () => {
    it("produces dagger from 1 bar in 5 ticks", () => {
      setState(makeState({
        buildings: [makeBuilding({
          id: "f1",
          type: "forger",
          position: { x: 0, y: 0 },
          recipe: "dagger",
          storage: { ...emptyInventory(), iron_bar: 1 },
        })],
      }));
      startGameLoop();
      tickN(5);
      const state = getState();
      const forger = state.buildings[0];
      // Finished goods stay in forger storage (must belt to shop to sell)
      expect(forger.storage.dagger).toBe(1);
      expect(forger.storage.iron_bar).toBe(0);
    });

    it("produces armour from 2 bars in 8 ticks", () => {
      setState(makeState({
        buildings: [makeBuilding({
          id: "f1",
          type: "forger",
          position: { x: 0, y: 0 },
          recipe: "armour",
          storage: { ...emptyInventory(), iron_bar: 2 },
        })],
      }));
      startGameLoop();
      tickN(8);
      const state = getState();
      const forger = state.buildings[0];
      // Finished goods stay in forger storage (must belt to shop to sell)
      expect(forger.storage.armour).toBe(1);
      expect(forger.storage.iron_bar).toBe(0);
    });

    it("stalls when insufficient bars for armour", () => {
      setState(makeState({
        buildings: [makeBuilding({
          id: "f1",
          type: "forger",
          position: { x: 0, y: 0 },
          recipe: "armour",
          storage: { ...emptyInventory(), iron_bar: 1 },
        })],
      }));
      startGameLoop();
      tickN(10);
      const forger = getState().buildings[0];
      expect(forger.progress).toBe(0);
      expect(forger.storage.armour).toBe(0);
    });
  });

  describe("belt transfer", () => {
    it("transfers ore from miner to smelter", () => {
      setState(makeState({
        buildings: [
          makeBuilding({
            id: "m1", type: "miner", position: { x: 0, y: 0 },
            storage: { ...emptyInventory(), iron_ore: 3 },
          }),
          makeBuilding({ id: "s1", type: "smelter", position: { x: 1, y: 0 } }),
        ],
        belts: [{ id: "belt-1", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }],
        oreNodes: [{ id: "ore-1", position: { x: 0, y: 0 }, type: "iron" as const }],
      }));
      startGameLoop();
      tickN(1);
      const state = getState();
      const miner = state.buildings[0];
      const smelter = state.buildings[1];
      // Miner produced ore and belt moved 1
      expect(smelter.storage.iron_ore).toBe(1);
      expect(miner.storage.iron_ore).toBe(2); // 3 - 1 transferred (+ partial production not yet complete)
    });

    it("transfers bars from smelter to forger", () => {
      setState(makeState({
        buildings: [
          makeBuilding({
            id: "s1", type: "smelter", position: { x: 0, y: 0 },
            storage: { ...emptyInventory(), iron_bar: 2 },
          }),
          makeBuilding({ id: "f1", type: "forger", position: { x: 1, y: 0 } }),
        ],
        belts: [{ id: "belt-1", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }],
      }));
      startGameLoop();
      tickN(1);
      const state = getState();
      expect(state.buildings[0].storage.iron_bar).toBe(1);
      expect(state.buildings[1].storage.iron_bar).toBe(1);
    });

    it("does not transfer wrong items to smelter", () => {
      setState(makeState({
        buildings: [
          makeBuilding({
            id: "m1", type: "miner", position: { x: 0, y: 0 },
            storage: { ...emptyInventory(), iron_bar: 5 },
          }),
          makeBuilding({ id: "s1", type: "smelter", position: { x: 1, y: 0 } }),
        ],
        belts: [{ id: "belt-1", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }],
      }));
      startGameLoop();
      tickN(3);
      const smelter = getState().buildings[1];
      expect(smelter.storage.iron_bar).toBe(0);
      expect(smelter.storage.iron_ore).toBe(0);
    });

    it("does not transfer wrong items to forger", () => {
      setState(makeState({
        buildings: [
          makeBuilding({
            id: "s1", type: "smelter", position: { x: 0, y: 0 },
            storage: { ...emptyInventory(), iron_ore: 5 },
          }),
          makeBuilding({ id: "f1", type: "forger", position: { x: 1, y: 0 } }),
        ],
        belts: [{ id: "belt-1", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }],
      }));
      startGameLoop();
      tickN(3);
      const forger = getState().buildings[1];
      expect(forger.storage.iron_ore).toBe(0);
      expect(forger.storage.iron_bar).toBe(0);
    });
  });

  describe("forger storage without shop", () => {
    it("keeps finished goods in forger storage", () => {
      setState(makeState({
        buildings: [makeBuilding({
          id: "f1", type: "forger", position: { x: 0, y: 0 },
          storage: { ...emptyInventory(), dagger: 3 },
        })],
      }));
      startGameLoop();
      tickN(1);
      const state = getState();
      // No auto-collect: goods stay in forger
      expect(state.inventory.dagger).toBe(0);
      expect(state.buildings[0].storage.dagger).toBe(3);
    });
  });

  describe("full production chain", () => {
    it("miner → smelter → forger produces daggers in forger storage", () => {
      setState(makeState({
        buildings: [
          makeBuilding({ id: "m1", type: "miner", position: { x: 0, y: 0 } }),
          makeBuilding({ id: "s1", type: "smelter", position: { x: 1, y: 0 } }),
          makeBuilding({ id: "f1", type: "forger", position: { x: 2, y: 0 }, recipe: "dagger" }),
        ],
        belts: [
          { id: "belt-1", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
          { id: "belt-2", from: { x: 1, y: 0 }, to: { x: 2, y: 0 } },
        ],
        oreNodes: [{ id: "ore-1", position: { x: 0, y: 0 }, type: "iron" as const }],
      }));
      startGameLoop();
      // Run enough ticks for full chain: mine ore, transfer, smelt, transfer, forge
      tickN(30);
      const state = getState();
      const forger = state.buildings.find(b => b.id === "f1")!;
      // After 30 ticks, forger should have produced at least 1 dagger in storage
      expect(forger.storage.dagger).toBeGreaterThanOrEqual(1);
    });
  });

  describe("copper miner production", () => {
    it("produces 1 copper ore after 4 ticks", () => {
      setState(makeState({
        buildings: [makeBuilding({ id: "m1", type: "miner", position: { x: 0, y: 0 } })],
        oreNodes: [{ id: "ore-1", position: { x: 0, y: 0 }, type: "copper" as const }],
      }));
      startGameLoop();
      tickN(4);
      const miner = getState().buildings[0];
      expect(miner.storage.copper_ore).toBe(1);
      expect(miner.progress).toBe(0);
    });

    it("does not produce iron ore on copper node", () => {
      setState(makeState({
        buildings: [makeBuilding({ id: "m1", type: "miner", position: { x: 0, y: 0 } })],
        oreNodes: [{ id: "ore-1", position: { x: 0, y: 0 }, type: "copper" as const }],
      }));
      startGameLoop();
      tickN(4);
      expect(getState().buildings[0].storage.iron_ore).toBe(0);
    });
  });

  describe("copper smelter production", () => {
    it("produces 1 copper bar from 2 copper ore after 4 ticks", () => {
      setState(makeState({
        buildings: [makeBuilding({
          id: "s1",
          type: "smelter",
          position: { x: 0, y: 0 },
          storage: { ...emptyInventory(), copper_ore: 2 },
        })],
      }));
      startGameLoop();
      tickN(4);
      const smelter = getState().buildings[0];
      expect(smelter.storage.copper_bar).toBe(1);
      expect(smelter.storage.copper_ore).toBe(0);
    });

    it("prefers iron ore when both are available", () => {
      setState(makeState({
        buildings: [makeBuilding({
          id: "s1",
          type: "smelter",
          position: { x: 0, y: 0 },
          storage: { ...emptyInventory(), iron_ore: 2, copper_ore: 2 },
        })],
      }));
      startGameLoop();
      tickN(5);
      const smelter = getState().buildings[0];
      expect(smelter.storage.iron_bar).toBe(1);
      expect(smelter.storage.iron_ore).toBe(0);
    });
  });

  describe("copper forger production", () => {
    it("produces wand from 1 copper bar in 6 ticks", () => {
      setState(makeState({
        buildings: [makeBuilding({
          id: "f1",
          type: "forger",
          position: { x: 0, y: 0 },
          recipe: "wand",
          storage: { ...emptyInventory(), copper_bar: 1 },
        })],
      }));
      startGameLoop();
      tickN(6);
      const state = getState();
      const forger = state.buildings[0];
      // Finished goods stay in forger storage
      expect(forger.storage.wand).toBe(1);
      expect(forger.storage.copper_bar).toBe(0);
    });

    it("produces magic_powder from 3 copper bars in 10 ticks", () => {
      setState(makeState({
        buildings: [makeBuilding({
          id: "f1",
          type: "forger",
          position: { x: 0, y: 0 },
          recipe: "magic_powder",
          storage: { ...emptyInventory(), copper_bar: 3 },
        })],
      }));
      startGameLoop();
      tickN(10);
      const state = getState();
      const forger = state.buildings[0];
      // Finished goods stay in forger storage
      expect(forger.storage.magic_powder).toBe(1);
      expect(forger.storage.copper_bar).toBe(0);
    });
  });

  describe("tick counter", () => {
    it("increments tick each second", () => {
      setState(makeState());
      startGameLoop();
      tickN(5);
      expect(getState().tick).toBe(5);
    });
  });

  describe("shop NPC processing", () => {
    // Helper to create filler NPCs that won't interfere with tests
    const fillerNpc = (id: string) => ({
      id,
      npcType: "merchant" as const,
      wantedItem: "armour" as const,
      patienceLeft: 99,
      maxPatience: 99,
    });

    it("serves NPC when shop has wanted item", () => {
      setState(makeState({
        currency: 100,
        buildings: [makeBuilding({
          id: "shop1", type: "shop", position: { x: 0, y: 0 },
          storage: { ...emptyInventory(), dagger: 1 },
          npcQueue: [
            {
              id: "npc1",
              npcType: "merchant",
              wantedItem: "dagger",
              patienceLeft: 30,
              maxPatience: 30,
            },
            // Fill queue to max to prevent random spawning
            fillerNpc("filler1"),
            fillerNpc("filler2"),
            fillerNpc("filler3"),
          ],
        })],
      }));
      startGameLoop();
      tickN(1);
      const state = getState();
      const shop = state.buildings[0];
      // NPC served and left, dagger sold at base price (merchant 1.0x)
      // 3 filler NPCs remain (they want armour, not dagger)
      expect(shop.npcQueue).toHaveLength(3);
      expect(shop.storage.dagger).toBe(0);
      expect(state.currency).toBe(120); // 100 + 20 (dagger base price)
    });

    it("warrior pays 1.5x for iron items", () => {
      setState(makeState({
        currency: 100,
        buildings: [makeBuilding({
          id: "shop1", type: "shop", position: { x: 0, y: 0 },
          storage: { ...emptyInventory(), dagger: 1 },
          npcQueue: [{
            id: "npc1",
            npcType: "warrior",
            wantedItem: "dagger",
            patienceLeft: 20,
            maxPatience: 20,
          }],
        })],
      }));
      startGameLoop();
      tickN(1);
      const state = getState();
      // Warrior pays 1.5x for dagger (iron item): 20 * 1.5 = 30
      expect(state.currency).toBe(130);
    });

    it("mage pays 0.75x for iron items", () => {
      setState(makeState({
        currency: 100,
        buildings: [makeBuilding({
          id: "shop1", type: "shop", position: { x: 0, y: 0 },
          storage: { ...emptyInventory(), armour: 1 },
          npcQueue: [{
            id: "npc1",
            npcType: "mage",
            wantedItem: "armour",
            patienceLeft: 20,
            maxPatience: 20,
          }],
        })],
      }));
      startGameLoop();
      tickN(1);
      const state = getState();
      // Mage pays 0.75x for armour (iron item): 30 * 0.75 = 22.5 → 23 (rounded)
      expect(state.currency).toBe(123);
    });

    it("NPC leaves when patience runs out", () => {
      // Fill queue with NPCs that all timeout together to prevent new spawns
      setState(makeState({
        currency: 100,
        buildings: [makeBuilding({
          id: "shop1", type: "shop", position: { x: 0, y: 0 },
          storage: emptyInventory(),
          npcQueue: [
            { id: "npc1", npcType: "warrior", wantedItem: "dagger", patienceLeft: 1, maxPatience: 20 },
            { id: "npc2", npcType: "warrior", wantedItem: "dagger", patienceLeft: 1, maxPatience: 20 },
            { id: "npc3", npcType: "warrior", wantedItem: "dagger", patienceLeft: 1, maxPatience: 20 },
            { id: "npc4", npcType: "warrior", wantedItem: "dagger", patienceLeft: 1, maxPatience: 20 },
          ],
        })],
      }));
      startGameLoop();
      tickN(1);
      const state = getState();
      const shop = state.buildings[0];
      // All NPCs left without buying (patience ran out)
      expect(shop.npcQueue).toHaveLength(0);
      expect(state.currency).toBe(100); // No sale
    });

    it("respects max queue size of 4", () => {
      // Create shop with 4 NPCs already
      const fullQueue = Array.from({ length: 4 }, (_, i) => ({
        id: `npc${i}`,
        npcType: "merchant" as const,
        wantedItem: "dagger" as const,
        patienceLeft: 40,
        maxPatience: 40,
      }));
      setState(makeState({
        buildings: [makeBuilding({
          id: "shop1", type: "shop", position: { x: 0, y: 0 },
          storage: emptyInventory(),
          npcQueue: fullQueue,
        })],
      }));
      startGameLoop();
      // Run many ticks - queue should never exceed 4
      tickN(20);
      const shop = getState().buildings[0];
      expect(shop.npcQueue.length).toBeLessThanOrEqual(4);
    });

    it("mage pays 1.5x for copper items", () => {
      setState(makeState({
        currency: 100,
        buildings: [makeBuilding({
          id: "shop1", type: "shop", position: { x: 0, y: 0 },
          storage: { ...emptyInventory(), wand: 1 },
          npcQueue: [{
            id: "npc1",
            npcType: "mage",
            wantedItem: "wand",
            patienceLeft: 20,
            maxPatience: 20,
          }],
        })],
      }));
      startGameLoop();
      tickN(1);
      const state = getState();
      // Mage pays 1.5x for wand (copper item): 25 * 1.5 = 37.5 → 38 (rounded)
      expect(state.currency).toBe(138);
    });

    it("warrior pays 0.75x for copper items", () => {
      setState(makeState({
        currency: 100,
        buildings: [makeBuilding({
          id: "shop1", type: "shop", position: { x: 0, y: 0 },
          storage: { ...emptyInventory(), magic_powder: 1 },
          npcQueue: [{
            id: "npc1",
            npcType: "warrior",
            wantedItem: "magic_powder",
            patienceLeft: 20,
            maxPatience: 20,
          }],
        })],
      }));
      startGameLoop();
      tickN(1);
      const state = getState();
      // Warrior pays 0.75x for magic_powder (copper item): 60 * 0.75 = 45
      expect(state.currency).toBe(145);
    });

    it("collector pays 1.25x for iron items", () => {
      setState(makeState({
        currency: 100,
        buildings: [makeBuilding({
          id: "shop1", type: "shop", position: { x: 0, y: 0 },
          storage: { ...emptyInventory(), dagger: 1 },
          npcQueue: [{
            id: "npc1",
            npcType: "collector",
            wantedItem: "dagger",
            patienceLeft: 25,
            maxPatience: 25,
          }],
        })],
      }));
      startGameLoop();
      tickN(1);
      const state = getState();
      // Collector pays 1.25x for dagger (iron item): 20 * 1.25 = 25
      expect(state.currency).toBe(125);
    });

    it("collector pays 1.25x for copper items", () => {
      setState(makeState({
        currency: 100,
        buildings: [makeBuilding({
          id: "shop1", type: "shop", position: { x: 0, y: 0 },
          storage: { ...emptyInventory(), wand: 1 },
          npcQueue: [{
            id: "npc1",
            npcType: "collector",
            wantedItem: "wand",
            patienceLeft: 25,
            maxPatience: 25,
          }],
        })],
      }));
      startGameLoop();
      tickN(1);
      const state = getState();
      // Collector pays 1.25x for wand (copper item): 25 * 1.25 = 31.25 → 31 (rounded)
      expect(state.currency).toBe(131);
    });

    it("serves multiple NPCs in same tick when items available", () => {
      setState(makeState({
        currency: 100,
        buildings: [makeBuilding({
          id: "shop1", type: "shop", position: { x: 0, y: 0 },
          storage: { ...emptyInventory(), dagger: 2 },
          npcQueue: [
            { id: "npc1", npcType: "merchant", wantedItem: "dagger", patienceLeft: 30, maxPatience: 30 },
            { id: "npc2", npcType: "merchant", wantedItem: "dagger", patienceLeft: 30, maxPatience: 30 },
            // Fill queue to prevent random spawning
            fillerNpc("f1"),
            fillerNpc("f2"),
          ],
        })],
      }));
      startGameLoop();
      tickN(1);
      const state = getState();
      const shop = state.buildings[0];
      // Both dagger NPCs served, 2 filler NPCs remain
      expect(shop.npcQueue).toHaveLength(2);
      expect(shop.storage.dagger).toBe(0);
      expect(state.currency).toBe(140); // 100 + 20 + 20
    });

    it("serves NPC before patience check (edge case)", () => {
      setState(makeState({
        currency: 100,
        buildings: [makeBuilding({
          id: "shop1", type: "shop", position: { x: 0, y: 0 },
          storage: { ...emptyInventory(), dagger: 1 },
          npcQueue: [{
            id: "npc1",
            npcType: "merchant",
            wantedItem: "dagger",
            patienceLeft: 1, // Would timeout, but item is available
            maxPatience: 20,
          }],
        })],
      }));
      startGameLoop();
      tickN(1);
      const state = getState();
      // NPC served before patience ran out
      expect(state.currency).toBe(120);
    });

    it("patience decrements over multiple ticks", () => {
      // Fill queue to prevent random spawning
      const fullQueue = [
        { id: "npc1", npcType: "merchant" as const, wantedItem: "dagger" as const, patienceLeft: 10, maxPatience: 10 },
        { id: "npc2", npcType: "merchant" as const, wantedItem: "armour" as const, patienceLeft: 40, maxPatience: 40 },
        { id: "npc3", npcType: "merchant" as const, wantedItem: "wand" as const, patienceLeft: 40, maxPatience: 40 },
        { id: "npc4", npcType: "merchant" as const, wantedItem: "magic_powder" as const, patienceLeft: 40, maxPatience: 40 },
      ];
      setState(makeState({
        buildings: [makeBuilding({
          id: "shop1", type: "shop", position: { x: 0, y: 0 },
          storage: emptyInventory(),
          npcQueue: fullQueue,
        })],
      }));
      startGameLoop();
      tickN(3);
      const shop = getState().buildings[0];
      expect(shop.npcQueue).toHaveLength(4);
      expect(shop.npcQueue[0].patienceLeft).toBe(7); // 10 - 3
    });

    it("multiple shops process independently", () => {
      setState(makeState({
        currency: 100,
        buildings: [
          makeBuilding({
            id: "shop1", type: "shop", position: { x: 0, y: 0 },
            storage: { ...emptyInventory(), dagger: 1 },
            npcQueue: [{ id: "npc1", npcType: "merchant", wantedItem: "dagger", patienceLeft: 30, maxPatience: 30 }],
          }),
          makeBuilding({
            id: "shop2", type: "shop", position: { x: 1, y: 0 },
            storage: { ...emptyInventory(), wand: 1 },
            npcQueue: [{ id: "npc2", npcType: "merchant", wantedItem: "wand", patienceLeft: 30, maxPatience: 30 }],
          }),
        ],
      }));
      startGameLoop();
      tickN(1);
      const state = getState();
      const shop1 = state.buildings[0];
      const shop2 = state.buildings[1];
      // Both shops processed their original NPCs (new ones may have spawned)
      expect(shop1.npcQueue.find(n => n.id === "npc1")).toBeUndefined(); // npc1 served
      expect(shop2.npcQueue.find(n => n.id === "npc2")).toBeUndefined(); // npc2 served
      expect(shop1.storage.dagger).toBe(0);
      expect(shop2.storage.wand).toBe(0);
      expect(state.currency).toBe(145); // 100 + 20 (dagger) + 25 (wand)
    });

    it("NPC not served when shop lacks wanted item", () => {
      // Fill queue to prevent random spawning
      setState(makeState({
        currency: 100,
        buildings: [makeBuilding({
          id: "shop1", type: "shop", position: { x: 0, y: 0 },
          storage: { ...emptyInventory(), armour: 1 }, // Has armour, not dagger
          npcQueue: [
            { id: "npc1", npcType: "merchant", wantedItem: "dagger", patienceLeft: 30, maxPatience: 30 },
            { id: "npc2", npcType: "merchant", wantedItem: "dagger", patienceLeft: 30, maxPatience: 30 },
            { id: "npc3", npcType: "merchant", wantedItem: "dagger", patienceLeft: 30, maxPatience: 30 },
            { id: "npc4", npcType: "merchant", wantedItem: "dagger", patienceLeft: 30, maxPatience: 30 },
          ],
        })],
      }));
      startGameLoop();
      tickN(1);
      const state = getState();
      const shop = state.buildings[0];
      // All NPCs still waiting (none want armour)
      expect(shop.npcQueue).toHaveLength(4);
      expect(shop.storage.armour).toBe(1); // Armour untouched
      expect(state.currency).toBe(100); // No sale
    });
  });

  describe("AI mode expansion", () => {
    it("builds complete production chain from scratch", () => {
      setState(makeState({
        aiMode: true,
        currency: 350,
        oreNodes: [
          { id: "ore-0", position: { x: 5, y: 5 }, type: "iron" as const },
        ],
      }));
      startGameLoop();
      // Run enough ticks for AI to build full chain
      tickN(10);
      const state = getState();

      // Should have miner, smelter, forger, shop
      const miners = state.buildings.filter(b => b.type === "miner");
      const smelters = state.buildings.filter(b => b.type === "smelter");
      const forgers = state.buildings.filter(b => b.type === "forger");
      const shops = state.buildings.filter(b => b.type === "shop");

      expect(miners.length).toBeGreaterThanOrEqual(1);
      expect(smelters.length).toBeGreaterThanOrEqual(1);
      expect(forgers.length).toBeGreaterThanOrEqual(1);
      expect(shops.length).toBeGreaterThanOrEqual(1);

      // Should have belts connecting them
      expect(state.belts.length).toBeGreaterThanOrEqual(3);
    });

    it("uses all ore nodes when profitable", () => {
      // Start with enough money and multiple ore nodes
      setState(makeState({
        aiMode: true,
        currency: 500,
        oreNodes: [
          { id: "ore-0", position: { x: 2, y: 2 }, type: "iron" as const },
          { id: "ore-1", position: { x: 4, y: 2 }, type: "iron" as const },
          { id: "ore-2", position: { x: 6, y: 2 }, type: "iron" as const },
          { id: "ore-3", position: { x: 8, y: 8 }, type: "copper" as const },
          { id: "ore-4", position: { x: 10, y: 8 }, type: "copper" as const },
        ],
      }));
      startGameLoop();
      // Run many ticks to let AI build and earn money
      tickN(100);
      const state = getState();

      // Count miners on ore nodes
      const minedPositions = new Set(
        state.buildings
          .filter(b => b.type === "miner")
          .map(b => `${b.position.x},${b.position.y}`)
      );
      const orePositions = state.oreNodes.map(n => `${n.position.x},${n.position.y}`);

      // All ore nodes should have miners
      for (const orePos of orePositions) {
        expect(minedPositions.has(orePos)).toBe(true);
      }
    });

    it("maximizes profitability by connecting all forgers to shop", () => {
      setState(makeState({
        aiMode: true,
        currency: 400,
        oreNodes: [
          { id: "ore-0", position: { x: 2, y: 2 }, type: "iron" as const },
          { id: "ore-1", position: { x: 10, y: 10 }, type: "copper" as const },
        ],
      }));
      startGameLoop();
      tickN(50);
      const state = getState();

      const shops = state.buildings.filter(b => b.type === "shop");
      const forgers = state.buildings.filter(b => b.type === "forger");

      expect(shops.length).toBeGreaterThanOrEqual(1);
      expect(forgers.length).toBeGreaterThanOrEqual(1);

      // Every forger should have a belt to a shop
      const shop = shops[0];
      for (const forger of forgers) {
        const hasBeltToShop = state.belts.some(
          b => b.from.x === forger.position.x && b.from.y === forger.position.y &&
               b.to.x === shop.position.x && b.to.y === shop.position.y
        );
        expect(hasBeltToShop).toBe(true);
      }
    });

    it("produces and sells items when AI mode is enabled", () => {
      // Fill shop queue with NPCs wanting daggers
      const daggerNpcs = Array.from({ length: 4 }, (_, i) => ({
        id: `npc${i}`,
        npcType: "merchant" as const,
        wantedItem: "dagger" as const,
        patienceLeft: 200,
        maxPatience: 200,
      }));

      setState(makeState({
        aiMode: true,
        currency: 350,
        oreNodes: [
          { id: "ore-0", position: { x: 5, y: 5 }, type: "iron" as const },
        ],
        buildings: [
          makeBuilding({ id: "m1", type: "miner", position: { x: 5, y: 5 } }),
          makeBuilding({ id: "s1", type: "smelter", position: { x: 6, y: 5 } }),
          makeBuilding({ id: "f1", type: "forger", position: { x: 7, y: 5 }, recipe: "dagger" }),
          makeBuilding({ id: "shop1", type: "shop", position: { x: 8, y: 5 }, npcQueue: daggerNpcs }),
        ],
        belts: [
          { id: "belt-1", from: { x: 5, y: 5 }, to: { x: 6, y: 5 } },
          { id: "belt-2", from: { x: 6, y: 5 }, to: { x: 7, y: 5 } },
          { id: "belt-3", from: { x: 7, y: 5 }, to: { x: 8, y: 5 } },
        ],
      }));

      const initialCurrency = getState().currency;
      startGameLoop();
      // Run enough ticks for full production cycle
      tickN(50);
      const state = getState();

      // Currency should have increased from sales
      expect(state.currency).toBeGreaterThan(initialCurrency);
    });

    it("builds both iron and copper chains for maximum output", () => {
      // Need enough money for 2 complete chains:
      // Chain 1: miner(10) + smelter(25) + forger(50) + shop(75) + 3 belts(15) = 175
      // Chain 2: miner(10) + smelter(25) + forger(50) + 3 belts(15) = 100 (reuse shop)
      // Total: 275 minimum
      setState(makeState({
        aiMode: true,
        currency: 400,
        oreNodes: [
          { id: "ore-0", position: { x: 2, y: 2 }, type: "iron" as const },
          { id: "ore-1", position: { x: 12, y: 12 }, type: "copper" as const },
        ],
      }));
      startGameLoop();
      // Run enough ticks for AI to build both chains (1 action per tick)
      tickN(50);
      const state = getState();

      const forgers = state.buildings.filter(b => b.type === "forger");

      // Should have forgers for both iron and copper recipes
      const ironForger = forgers.find(f => f.recipe === "dagger" || f.recipe === "armour");
      const copperForger = forgers.find(f => f.recipe === "wand" || f.recipe === "magic_powder");

      expect(ironForger).toBeDefined();
      expect(copperForger).toBeDefined();
    });

    it("does not build when AI mode is disabled", () => {
      setState(makeState({
        aiMode: false,
        currency: 500,
        oreNodes: [
          { id: "ore-0", position: { x: 5, y: 5 }, type: "iron" as const },
        ],
      }));
      startGameLoop();
      tickN(20);
      const state = getState();

      // No buildings should be placed
      expect(state.buildings).toHaveLength(0);
      expect(state.belts).toHaveLength(0);
      // Currency unchanged
      expect(state.currency).toBe(500);
    });
  });

  describe("belt transfer to shop", () => {
    it("transfers finished goods from forger to shop", () => {
      // Fill queue with NPCs that don't want daggers to prevent random spawning
      const fullQueue = Array.from({ length: 4 }, (_, i) => ({
        id: `npc${i}`, npcType: "merchant" as const, wantedItem: "armour" as const, patienceLeft: 40, maxPatience: 40,
      }));
      setState(makeState({
        buildings: [
          makeBuilding({
            id: "f1", type: "forger", position: { x: 0, y: 0 },
            storage: { ...emptyInventory(), dagger: 3 },
          }),
          makeBuilding({ id: "shop1", type: "shop", position: { x: 1, y: 0 }, npcQueue: fullQueue }),
        ],
        belts: [{ id: "belt-1", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }],
      }));
      startGameLoop();
      tickN(1);
      const state = getState();
      const forger = state.buildings[0];
      const shop = state.buildings[1];
      expect(forger.storage.dagger).toBe(2);
      expect(shop.storage.dagger).toBe(1);
    });

    it("transfers armour to shop", () => {
      // Fill queue with NPCs that don't want armour to prevent random spawning
      const fullQueue = Array.from({ length: 4 }, (_, i) => ({
        id: `npc${i}`, npcType: "merchant" as const, wantedItem: "dagger" as const, patienceLeft: 40, maxPatience: 40,
      }));
      setState(makeState({
        buildings: [
          makeBuilding({
            id: "f1", type: "forger", position: { x: 0, y: 0 },
            storage: { ...emptyInventory(), armour: 2 },
          }),
          makeBuilding({ id: "shop1", type: "shop", position: { x: 1, y: 0 }, npcQueue: fullQueue }),
        ],
        belts: [{ id: "belt-1", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }],
      }));
      startGameLoop();
      tickN(1);
      const shop = getState().buildings[1];
      expect(shop.storage.armour).toBe(1);
    });

    it("transfers wand to shop", () => {
      // Fill queue with NPCs that don't want wand to prevent random spawning
      const fullQueue = Array.from({ length: 4 }, (_, i) => ({
        id: `npc${i}`, npcType: "merchant" as const, wantedItem: "dagger" as const, patienceLeft: 40, maxPatience: 40,
      }));
      setState(makeState({
        buildings: [
          makeBuilding({
            id: "f1", type: "forger", position: { x: 0, y: 0 },
            storage: { ...emptyInventory(), wand: 2 },
          }),
          makeBuilding({ id: "shop1", type: "shop", position: { x: 1, y: 0 }, npcQueue: fullQueue }),
        ],
        belts: [{ id: "belt-1", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }],
      }));
      startGameLoop();
      tickN(1);
      const shop = getState().buildings[1];
      expect(shop.storage.wand).toBe(1);
    });

    it("transfers magic_powder to shop", () => {
      // Fill queue with NPCs that don't want magic_powder to prevent random spawning
      const fullQueue = Array.from({ length: 4 }, (_, i) => ({
        id: `npc${i}`, npcType: "merchant" as const, wantedItem: "dagger" as const, patienceLeft: 40, maxPatience: 40,
      }));
      setState(makeState({
        buildings: [
          makeBuilding({
            id: "f1", type: "forger", position: { x: 0, y: 0 },
            storage: { ...emptyInventory(), magic_powder: 2 },
          }),
          makeBuilding({ id: "shop1", type: "shop", position: { x: 1, y: 0 }, npcQueue: fullQueue }),
        ],
        belts: [{ id: "belt-1", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }],
      }));
      startGameLoop();
      tickN(1);
      const shop = getState().buildings[1];
      expect(shop.storage.magic_powder).toBe(1);
    });

    it("does not transfer raw materials to shop", () => {
      setState(makeState({
        buildings: [
          makeBuilding({
            id: "m1", type: "miner", position: { x: 0, y: 0 },
            storage: { ...emptyInventory(), iron_ore: 5 },
          }),
          makeBuilding({ id: "shop1", type: "shop", position: { x: 1, y: 0 } }),
        ],
        belts: [{ id: "belt-1", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }],
      }));
      startGameLoop();
      tickN(3);
      const shop = getState().buildings[1];
      expect(shop.storage.iron_ore).toBe(0);
      expect(shop.storage.iron_bar).toBe(0);
    });

    it("does not transfer bars to shop", () => {
      setState(makeState({
        buildings: [
          makeBuilding({
            id: "s1", type: "smelter", position: { x: 0, y: 0 },
            storage: { ...emptyInventory(), iron_bar: 5, copper_bar: 3 },
          }),
          makeBuilding({ id: "shop1", type: "shop", position: { x: 1, y: 0 } }),
        ],
        belts: [{ id: "belt-1", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }],
      }));
      startGameLoop();
      tickN(3);
      const shop = getState().buildings[1];
      expect(shop.storage.iron_bar).toBe(0);
      expect(shop.storage.copper_bar).toBe(0);
    });

    it("does not transfer copper ore to shop", () => {
      setState(makeState({
        buildings: [
          makeBuilding({
            id: "m1", type: "miner", position: { x: 0, y: 0 },
            storage: { ...emptyInventory(), copper_ore: 5 },
          }),
          makeBuilding({ id: "shop1", type: "shop", position: { x: 1, y: 0 } }),
        ],
        belts: [{ id: "belt-1", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }],
      }));
      startGameLoop();
      tickN(3);
      const shop = getState().buildings[1];
      expect(shop.storage.copper_ore).toBe(0);
    });

    it("full chain: forger → shop → NPC sale", () => {
      // Filler NPCs to prevent random spawning (want armour, not dagger)
      const filler = (id: string) => ({ id, npcType: "merchant" as const, wantedItem: "armour" as const, patienceLeft: 99, maxPatience: 99 });
      setState(makeState({
        currency: 100,
        buildings: [
          makeBuilding({
            id: "f1", type: "forger", position: { x: 0, y: 0 },
            storage: { ...emptyInventory(), dagger: 1 },
          }),
          makeBuilding({
            id: "shop1", type: "shop", position: { x: 1, y: 0 },
            npcQueue: [
              { id: "npc1", npcType: "merchant", wantedItem: "dagger", patienceLeft: 30, maxPatience: 30 },
              filler("f1"), filler("f2"), filler("f3"),
            ],
          }),
        ],
        belts: [{ id: "belt-1", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }],
      }));
      startGameLoop();
      tickN(1);
      const state = getState();
      // Dagger transferred to shop and sold to NPC in same tick
      // 3 filler NPCs remain
      expect(state.buildings[0].storage.dagger).toBe(0);
      expect(state.buildings[1].storage.dagger).toBe(0);
      expect(state.buildings[1].npcQueue).toHaveLength(3);
      expect(state.currency).toBe(120);
    });
  });
});
