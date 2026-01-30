export interface Position {
  x: number;
  y: number;
}

export type BuildingType = "miner" | "smelter" | "forger" | "shop" | "warehouse" | "geologist";

export type OreType = "iron" | "copper";

export type ForgerRecipe = "dagger" | "armour" | "wand" | "magic_powder";

export type NpcType = "warrior" | "mage" | "collector" | "merchant";

export type FinishedGood = "dagger" | "armour" | "wand" | "magic_powder";

export interface Npc {
  id: string;
  npcType: NpcType;
  wantedItem: FinishedGood;
  patienceLeft: number;
  maxPatience: number;
}

export interface Building {
  id: string;
  type: BuildingType;
  position: Position;
  progress: number; // 0 → 1 (production progress)
  constructionProgress: number; // 0 → 1 (1 = complete)
  storage: Inventory;
  recipe: ForgerRecipe; // only used by forgers
  npcQueue: Npc[]; // only used by shops
}

// Construction time in ticks per building type
export const CONSTRUCTION_TICKS: Record<BuildingType, number> = {
  miner: 3,
  smelter: 5,
  forger: 6,
  shop: 8,
  warehouse: 10,
  geologist: 12,
};

export interface BeltItem {
  itemType: ItemType;
  progress: number; // 0 to 1, where 1 = delivered
}

export interface Belt {
  id: string;
  from: Position;
  to: Position;
  itemsInTransit: BeltItem[];
}

// Calculate belt travel time: base 1 tick + 1 tick per 5 cells distance
export function getBeltTravelTime(from: Position, to: Position): number {
  const distance = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
  return 1 + Math.floor(distance / 5);
}

export interface OreNode {
  id: string;
  position: Position;
  type: OreType;
}

export type ItemType =
  | "iron_ore"
  | "iron_bar"
  | "dagger"
  | "armour"
  | "copper_ore"
  | "copper_bar"
  | "wand"
  | "magic_powder";

export type Inventory = Record<ItemType, number>;

export interface GameState {
  tick: number;
  currency: number;
  inventory: Inventory;
  buildings: Building[];
  belts: Belt[];
  oreNodes: OreNode[];
  mapWidth: number;
  mapHeight: number;
  aiMode: boolean;
}

export const BUILDING_COSTS: Record<BuildingType, number> = {
  miner: 10,
  smelter: 25,
  forger: 50,
  shop: 75,
  warehouse: 100,
  geologist: 200,
};

// Geologist building settings
export const GEOLOGIST_UPKEEP = 5; // Cost per tick to operate
export const GEOLOGIST_DISCOVERY_TICKS = 15; // Ticks between discoveries
export const GEOLOGIST_MAX_COUNT = 1; // Only one allowed

// Warehouse wholesale settings
export const WHOLESALE_THRESHOLD = 10; // Minimum items to trigger sale
export const WHOLESALE_MULTIPLIER = 0.5; // 50% of base price

export const BELT_COST = 5;

export const MINER_TICKS: Record<OreType, number> = {
  iron: 3,
  copper: 4,
};

export const SMELT_TICKS: Record<OreType, number> = {
  iron: 5,
  copper: 4,
};

export const SMELT_ORE_COST = 2;

export const SELL_PRICES: Record<string, number> = {
  dagger: 20,
  armour: 30,
  wand: 25,
  magic_powder: 60,
};

export const RECIPE_BARS_COST: Record<ForgerRecipe, number> = {
  dagger: 1,
  armour: 2,
  wand: 1,
  magic_powder: 3,
};

export const RECIPE_TICKS: Record<ForgerRecipe, number> = {
  dagger: 5,
  armour: 8,
  wand: 6,
  magic_powder: 10,
};

export const RECIPE_BAR_TYPE: Record<ForgerRecipe, "iron_bar" | "copper_bar"> = {
  dagger: "iron_bar",
  armour: "iron_bar",
  wand: "copper_bar",
  magic_powder: "copper_bar",
};

export const FINISHED_GOODS: FinishedGood[] = ["dagger", "armour", "wand", "magic_powder"];

export const NPC_SPAWN_CHANCE = 0.15;
export const NPC_MAX_QUEUE = 4;

export const NPC_PATIENCE: Record<NpcType, [number, number]> = {
  warrior: [15, 25],
  mage: [15, 25],
  collector: [20, 30],
  merchant: [30, 45],
};

export const NPC_PRICE_MULTIPLIER: Record<NpcType, { iron: number; copper: number }> = {
  warrior: { iron: 1.5, copper: 0.75 },
  mage: { iron: 0.75, copper: 1.5 },
  collector: { iron: 1.25, copper: 1.25 },
  merchant: { iron: 1.0, copper: 1.0 },
};

// API payloads
export interface PlaceBuildingRequest {
  type: BuildingType;
  position: Position;
}

export interface PlaceBeltRequest {
  from: Position;
  to: Position;
}

export interface SetRecipeRequest {
  buildingId: string;
  recipe: ForgerRecipe;
}

export interface DemolishBuildingRequest {
  buildingId: string;
}
