export interface Position {
  x: number;
  y: number;
}

export type BuildingType = "miner" | "smelter" | "forger" | "shop" | "warehouse" | "geologist";

export type OreType = "iron" | "copper";

export type ForgerRecipe = "dagger" | "armour" | "wand" | "magic_powder";

export type NpcType = "warrior" | "mage" | "collector" | "merchant" | "noble" | "adventurer" | "king";

export type FinishedGood = "dagger" | "armour" | "wand" | "magic_powder";

export interface KingDemand {
  items: { item: FinishedGood; quantity: number }[];
  totalValue: number;
}

export interface MultiItemDemand {
  items: { item: FinishedGood; quantity: number }[];
  totalValue: number;
  bonusMultiplier: number;
}

export const MULTI_ITEM_BONUS = 1.75;

export interface Npc {
  id: string;
  npcType: NpcType;
  wantedItem: FinishedGood;
  kingDemand?: KingDemand;  // Only for king
  multiItemDemand?: MultiItemDemand;  // For noble/adventurer
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
  geologistExplorer: GeologistExplorer | null; // Animated character when geologist building exists
  kingPenaltyTicksLeft: number;  // 0 = no penalty
  lastKingTick: number;          // Track cooldown
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
export const GEOLOGIST_UPKEEP = 2; // Cost per tick to operate
export const GEOLOGIST_DISCOVERY_TICKS_MIN = 10; // Minimum ticks between discoveries
export const GEOLOGIST_DISCOVERY_TICKS_MAX = 20; // Maximum ticks between discoveries
export const GEOLOGIST_MAX_COUNT = 1; // Only one allowed

// Geologist explorer (animated character that walks around)
export interface GeologistExplorer {
  position: Position; // Current position (can be fractional for smooth movement)
  targetPosition: Position; // Where the explorer is heading
  searchProgress: number; // 0-1, when 1 = found ore at current location
  ticksUntilDiscovery: number; // Random countdown to next discovery
}

// Warehouse wholesale settings
export const WHOLESALE_THRESHOLD = 10; // Minimum items to trigger sale
export const WHOLESALE_MULTIPLIER = 0.7; // 70% of base price

export const BELT_COST = 5;

export const MINER_TICKS: Record<OreType, number> = {
  iron: 3,
  copper: 4,
};

export const SMELT_TICKS: Record<OreType, number> = {
  iron: 5,
  copper: 4,
};

export const SMELT_ORE_COST = 3;

export const SELL_PRICES: Record<string, number> = {
  dagger: 35,
  armour: 60,
  wand: 40,
  magic_powder: 65,
};

export const RECIPE_BARS_COST: Record<ForgerRecipe, number> = {
  dagger: 2,
  armour: 3,
  wand: 2,
  magic_powder: 4,
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
  noble: [25, 35],
  adventurer: [20, 30],
  king: [40, 60],
};

export const NPC_PRICE_MULTIPLIER: Record<NpcType, { iron: number; copper: number }> = {
  warrior: { iron: 1.5, copper: 0.75 },
  mage: { iron: 0.75, copper: 1.5 },
  collector: { iron: 1.25, copper: 1.25 },
  merchant: { iron: 1.0, copper: 1.0 },
  noble: { iron: 1.75, copper: 1.0 },  // Prefers iron items
  adventurer: { iron: 1.0, copper: 1.75 },  // Prefers copper items
  king: { iron: 4.0, copper: 4.0 },  // Used for display, actual calc uses totalValue
};

// King NPC constants
export const KING_SPAWN_CHANCE = 0.02;     // 2% when eligible
export const KING_MIN_TICK = 100;          // Can't spawn before tick 100
export const KING_COOLDOWN_TICKS = 50;     // Min ticks between King visits
export const KING_PRICE_MULTIPLIER = 4.0;  // 4x base prices
export const KING_PENALTY_DURATION = 30;   // Ticks of reduced spawns
export const KING_PENALTY_MULTIPLIER = 0.25; // 25% spawn rate during penalty

// === IDLE GAME TYPES ===

export interface GameMeta {
  lastTickAt: number;
  totalCurrencyEarned: number;
  totalItemsProduced: number;
}

export interface PrestigeBonuses {
  productionSpeed: number;    // Multiplier (1.0 = no bonus)
  sellPrice: number;          // Multiplier
  startingCurrency: number;   // Added to base 400
  offlineEfficiency: number;  // Multiplier
  beltSpeed: number;          // Multiplier
}

export interface PrestigeData {
  starEssence: number;
  prestigeCount: number;
  bonuses: PrestigeBonuses;
}

export type UpgradeId =
  | "mining_efficiency_1" | "mining_efficiency_2" | "mining_efficiency_3"
  | "smelting_efficiency_1" | "smelting_efficiency_2"
  | "forging_efficiency_1" | "forging_efficiency_2"
  | "belt_maintenance_1" | "express_belts"
  | "extended_storage"
  | "patient_customers"
  | "premium_pricing"
  | "auto_recipe" | "automation_mastery"
  | "warehouse_efficiency"
  | "map_expansion";

export interface UpgradeState {
  purchased: UpgradeId[];
}

export interface AutomationSettings {
  enabled: boolean;

  // Building toggles
  autoPlaceMiner: boolean;
  autoPlaceSmelter: boolean;
  autoPlaceForger: boolean;
  autoPlaceShop: boolean;
  autoPlaceBelt: boolean;
  autoPlaceWarehouse: boolean;
  autoPlaceGeologist: boolean;

  // Strategy
  autoRecipeSwitch: boolean;
  useAdvancedRecipeLogic: boolean;
  buildCompleteChains: boolean;
  useROICalculations: boolean;
  saveForBetterOptions: boolean;

  // Settings
  priorityOreType: "iron" | "copper" | "balanced";
  reserveCurrency: number;
}

export interface GameSave {
  version: number;
  playerId: string;
  state: GameState;
  meta: GameMeta;
  prestige: PrestigeData;
  upgrades: UpgradeState;
  automation: AutomationSettings;
  savedAt: number;
}

// Prestige upgrade definitions
export type PrestigeUpgradeId =
  | "swift_production"
  | "merchant_favor"
  | "inheritance"
  | "tireless_workers"
  | "express_belts_prestige";

export interface PrestigeUpgrade {
  id: PrestigeUpgradeId;
  name: string;
  description: string;
  maxLevel: number;
  costPerLevel: number;
  effect: (level: number) => number; // Returns multiplier or bonus value
}

export const PRESTIGE_UPGRADES: Record<PrestigeUpgradeId, PrestigeUpgrade> = {
  swift_production: {
    id: "swift_production",
    name: "Swift Production",
    description: "+5% production speed per level",
    maxLevel: 10,
    costPerLevel: 5,
    effect: (level) => 1 + level * 0.05,
  },
  merchant_favor: {
    id: "merchant_favor",
    name: "Merchant Favor",
    description: "+5% sell prices per level",
    maxLevel: 10,
    costPerLevel: 5,
    effect: (level) => 1 + level * 0.05,
  },
  inheritance: {
    id: "inheritance",
    name: "Inheritance",
    description: "+500 starting currency per level",
    maxLevel: 5,
    costPerLevel: 10,
    effect: (level) => level * 500,
  },
  tireless_workers: {
    id: "tireless_workers",
    name: "Tireless Workers",
    description: "+10% offline efficiency per level",
    maxLevel: 5,
    costPerLevel: 8,
    effect: (level) => 1 + level * 0.10,
  },
  express_belts_prestige: {
    id: "express_belts_prestige",
    name: "Express Belts",
    description: "+10% belt speed per level",
    maxLevel: 5,
    costPerLevel: 6,
    effect: (level) => 1 + level * 0.10,
  },
};

export interface PrestigeUpgradeLevels {
  swift_production: number;
  merchant_favor: number;
  inheritance: number;
  tireless_workers: number;
  express_belts_prestige: number;
}

// Offline progress config
export const OFFLINE_CONFIG = {
  maxOfflineHours: 24,
  baseOfflineEfficiency: 0.5,
};

// Save version for migration
export const SAVE_VERSION = 3;

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

export interface CreateGameRequest {
  playerId: string;
}

export interface LoadGameRequest {
  playerId: string;
}

export interface BuyPrestigeUpgradeRequest {
  upgradeId: PrestigeUpgradeId;
}

export interface BuyUpgradeRequest {
  upgradeId: UpgradeId;
}

export interface UpdateAutomationRequest {
  settings: Partial<AutomationSettings>;
}

// Offline progress result
export interface OfflineProgress {
  ticksSimulated: number;
  currencyEarned: number;
  itemsProduced: Record<ItemType, number>;
  efficiency: number;
}
