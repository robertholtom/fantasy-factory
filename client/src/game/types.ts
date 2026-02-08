export interface Position {
  x: number;
  y: number;
}

export type BuildingType = "miner" | "smelter" | "forger" | "shop" | "warehouse" | "geologist" | "junction" | "sorter";

export type OreType = "iron" | "copper" | "coal";

export type ForgerRecipe = "dagger" | "armour" | "wand" | "magic_powder" | "sword";

export type SorterFilter = ItemType | "ore" | "bar" | "finished" | "all" | "coal" | "steel_bar" | "sword";

export type NpcType = "warrior" | "mage" | "collector" | "merchant" | "noble" | "adventurer" | "king" | "knight";

export type FinishedGood = "dagger" | "armour" | "wand" | "magic_powder" | "sword";

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
  kingDemand?: KingDemand;
  multiItemDemand?: MultiItemDemand;
  patienceLeft: number;
  maxPatience: number;
}

export interface Building {
  id: string;
  type: BuildingType;
  position: Position;
  progress: number;
  constructionProgress: number;
  storage: Inventory;
  recipe: ForgerRecipe;
  npcQueue: Npc[];
  upgradeLevel: number;
  sorterFilter?: SorterFilter;
}

export const CONSTRUCTION_TICKS: Record<BuildingType, number> = {
  miner: 3,
  smelter: 5,
  forger: 6,
  shop: 8,
  warehouse: 10,
  geologist: 12,
  junction: 2,
  sorter: 3,
};

export interface BeltItem {
  itemType: ItemType;
  cellIndex: number;
}

export interface Belt {
  id: string;
  path: Position[];
  itemsInTransit: BeltItem[];
}

export function getBeltTravelTime(belt: Belt): number {
  const legacyBelt = belt as any;
  if (legacyBelt.from && !belt.path) {
    const distance = Math.abs(legacyBelt.to.x - legacyBelt.from.x) + Math.abs(legacyBelt.to.y - legacyBelt.from.y);
    return 1 + Math.floor(distance / 5);
  }
  return Math.max(1, belt.path.length - 2);
}

export function findPath(
  from: Position,
  to: Position,
  obstacles: Set<string>,
  mapWidth: number,
  mapHeight: number
): Position[] | null {
  const posKey = (p: Position) => `${p.x},${p.y}`;
  const start = posKey(from);
  const goal = posKey(to);

  // Adjacent cells cannot have belts - require at least 1 space between buildings
  if (Math.abs(from.x - to.x) + Math.abs(from.y - to.y) <= 1) {
    return null;
  }

  interface Node {
    pos: Position;
    g: number;
    h: number;
    f: number;
    parent: Node | null;
  }

  const heuristic = (p: Position) => Math.abs(p.x - to.x) + Math.abs(p.y - to.y);

  const openSet = new Map<string, Node>();
  const closedSet = new Set<string>();

  const startNode: Node = { pos: from, g: 0, h: heuristic(from), f: heuristic(from), parent: null };
  openSet.set(start, startNode);

  const directions = [
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
  ];

  while (openSet.size > 0) {
    let current: Node | null = null;
    let currentKey = "";
    for (const [key, node] of openSet) {
      if (!current || node.f < current.f || (node.f === current.f && node.h < current.h)) {
        current = node;
        currentKey = key;
      }
    }

    if (!current) break;

    if (currentKey === goal) {
      const path: Position[] = [];
      let node: Node | null = current;
      while (node) {
        path.unshift(node.pos);
        node = node.parent;
      }
      return path;
    }

    openSet.delete(currentKey);
    closedSet.add(currentKey);

    for (const dir of directions) {
      const neighbor: Position = { x: current.pos.x + dir.dx, y: current.pos.y + dir.dy };
      const neighborKey = posKey(neighbor);

      if (neighbor.x < 0 || neighbor.x >= mapWidth || neighbor.y < 0 || neighbor.y >= mapHeight) {
        continue;
      }

      if (closedSet.has(neighborKey)) continue;

      if (obstacles.has(neighborKey) && neighborKey !== goal) continue;

      const tentativeG = current.g + 1;

      const existingNode = openSet.get(neighborKey);
      if (existingNode) {
        if (tentativeG < existingNode.g) {
          existingNode.g = tentativeG;
          existingNode.f = tentativeG + existingNode.h;
          existingNode.parent = current;
        }
      } else {
        const h = heuristic(neighbor);
        openSet.set(neighborKey, {
          pos: neighbor,
          g: tentativeG,
          h,
          f: tentativeG + h,
          parent: current,
        });
      }
    }
  }

  return null;
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
  | "magic_powder"
  | "coal"
  | "steel_bar"
  | "sword";

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
  geologistExplorer: GeologistExplorer | null;
  kingPenaltyTicksLeft: number;
  lastKingTick: number;
  tilesPurchased: number;
}

export const BUILDING_COSTS: Record<BuildingType, number> = {
  miner: 10,
  smelter: 25,
  forger: 50,
  shop: 75,
  warehouse: 100,
  geologist: 200,
  junction: 15,
  sorter: 30,
};

export const BASE_LAND_COST = 100;
export const LAND_COST_MULTIPLIER = 1.15;

export const UPGRADE_COSTS: number[] = [500, 2000, 10000];
export const MAX_UPGRADE_LEVEL = 3;
export const UPGRADE_SPEED_BONUS = 1.25;

export const GEOLOGIST_UPKEEP = 2;
export const GEOLOGIST_DISCOVERY_TICKS_MIN = 10;
export const GEOLOGIST_DISCOVERY_TICKS_MAX = 20;
export const GEOLOGIST_MAX_COUNT = 1;

export interface GeologistExplorer {
  position: Position;
  targetPosition: Position;
  searchProgress: number;
  ticksUntilDiscovery: number;
}

export const WHOLESALE_THRESHOLD = 10;
export const WHOLESALE_MULTIPLIER = 0.7;

export const BELT_COST = 5;

export const MINER_TICKS: Record<OreType, number> = {
  iron: 3,
  copper: 4,
  coal: 3,
};

export const SMELT_TICKS: Record<OreType, number> = {
  iron: 5,
  copper: 4,
  coal: 0, // coal not smelted directly
};

export const SMELT_ORE_COST = 3;

export const SMELT_STEEL_IRON_COST = 2;
export const SMELT_STEEL_COAL_COST = 2;
export const SMELT_STEEL_TICKS = 6;

export const SELL_PRICES: Record<string, number> = {
  dagger: 35,
  armour: 60,
  wand: 40,
  magic_powder: 65,
  sword: 90,
};

export const RECIPE_BARS_COST: Record<ForgerRecipe, number> = {
  dagger: 2,
  armour: 3,
  wand: 2,
  magic_powder: 4,
  sword: 3,
};

export const RECIPE_TICKS: Record<ForgerRecipe, number> = {
  dagger: 5,
  armour: 8,
  wand: 6,
  magic_powder: 10,
  sword: 7,
};

export const RECIPE_BAR_TYPE: Record<ForgerRecipe, "iron_bar" | "copper_bar" | "steel_bar"> = {
  dagger: "iron_bar",
  armour: "iron_bar",
  wand: "copper_bar",
  magic_powder: "copper_bar",
  sword: "steel_bar",
};

export const FINISHED_GOODS: FinishedGood[] = ["dagger", "armour", "wand", "magic_powder", "sword"];

export const ALL_ITEMS: ItemType[] = ["iron_ore", "copper_ore", "coal", "iron_bar", "copper_bar", "steel_bar", "dagger", "armour", "wand", "magic_powder", "sword"];

export const ITEM_CATEGORIES: Record<SorterFilter, ItemType[]> = {
  ore: ["iron_ore", "copper_ore", "coal"],
  bar: ["iron_bar", "copper_bar", "steel_bar"],
  finished: ["dagger", "armour", "wand", "magic_powder", "sword"],
  all: ALL_ITEMS,
  iron_ore: ["iron_ore"],
  copper_ore: ["copper_ore"],
  coal: ["coal"],
  iron_bar: ["iron_bar"],
  copper_bar: ["copper_bar"],
  steel_bar: ["steel_bar"],
  dagger: ["dagger"],
  armour: ["armour"],
  wand: ["wand"],
  magic_powder: ["magic_powder"],
  sword: ["sword"],
};

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
  knight: [20, 30],
};

export const NPC_PRICE_MULTIPLIER: Record<NpcType, { iron: number; copper: number; steel: number }> = {
  warrior: { iron: 1.5, copper: 0.75, steel: 1.25 },
  mage: { iron: 0.75, copper: 1.5, steel: 0.75 },
  collector: { iron: 1.25, copper: 1.25, steel: 1.25 },
  merchant: { iron: 1.0, copper: 1.0, steel: 1.0 },
  noble: { iron: 1.75, copper: 1.0, steel: 1.5 },
  adventurer: { iron: 1.0, copper: 1.75, steel: 1.0 },
  king: { iron: 4.0, copper: 4.0, steel: 4.0 },
  knight: { iron: 1.25, copper: 0.75, steel: 2.0 },
};

export const KING_SPAWN_CHANCE = 0.02;
export const KING_MIN_TICK = 100;
export const KING_COOLDOWN_TICKS = 50;
export const KING_PRICE_MULTIPLIER = 4.0;
export const KING_PENALTY_DURATION = 30;
export const KING_PENALTY_MULTIPLIER = 0.25;

export interface GameMeta {
  lastTickAt: number;
  totalCurrencyEarned: number;
  totalItemsProduced: number;
}

export interface PrestigeBonuses {
  productionSpeed: number;
  sellPrice: number;
  startingCurrency: number;
  offlineEfficiency: number;
  beltSpeed: number;
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
  autoPlaceMiner: boolean;
  autoPlaceSmelter: boolean;
  autoPlaceForger: boolean;
  autoPlaceShop: boolean;
  autoPlaceBelt: boolean;
  autoPlaceWarehouse: boolean;
  autoPlaceGeologist: boolean;
  autoPlaceJunction: boolean;
  autoPlaceSorter: boolean;
  autoRecipeSwitch: boolean;
  useAdvancedRecipeLogic: boolean;
  buildCompleteChains: boolean;
  useROICalculations: boolean;
  saveForBetterOptions: boolean;
  useHubRouting: boolean;
  priorityOreType: "iron" | "copper" | "balanced";
  reserveCurrency: number;
  enableRestructuring: boolean;
  lastRestructureTick: number;
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
  effect: (level: number) => number;
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

export const OFFLINE_CONFIG = {
  maxOfflineHours: 24,
  baseOfflineEfficiency: 0.5,
};

export const SAVE_VERSION = 4;

export interface PlaceBuildingRequest {
  type: BuildingType;
  position: Position;
}

export interface PlaceBeltRequest {
  from: Position;
  to: Position;
}

export function getBeltEndpoints(belt: Belt): { from: Position; to: Position } {
  const legacyBelt = belt as any;
  if (legacyBelt.from && !belt.path) {
    return { from: legacyBelt.from, to: legacyBelt.to };
  }
  return {
    from: belt.path[0],
    to: belt.path[belt.path.length - 1],
  };
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

export interface OfflineProgress {
  ticksSimulated: number;
  currencyEarned: number;
  itemsProduced: Record<ItemType, number>;
  efficiency: number;
}
