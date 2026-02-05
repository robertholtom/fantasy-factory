import { GameState, Belt, Building, OreNode, ItemType, getBeltTravelTime, GeologistExplorer, ExplorerCharacter } from "../../../shared/types";

// SVG icons as data URLs
const ICONS: Record<string, string> = {
  miner_iron: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect x="2" y="2" width="28" height="28" rx="4" fill="#4a3728"/>
      <path d="M8 24 L16 8 L18 10 L12 24 Z" fill="#8b8b8b"/>
      <path d="M16 8 L24 12 L22 14 L18 10 Z" fill="#a0a0a0"/>
      <circle cx="24" cy="12" r="3" fill="#e07020"/>
      <circle cx="24" cy="12" r="1.5" fill="#ff9040"/>
    </svg>
  `)}`,
  miner_copper: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect x="2" y="2" width="28" height="28" rx="4" fill="#2a3a3a"/>
      <path d="M8 24 L16 8 L18 10 L12 24 Z" fill="#8b8b8b"/>
      <path d="M16 8 L24 12 L22 14 L18 10 Z" fill="#a0a0a0"/>
      <circle cx="24" cy="12" r="3" fill="#40b0b0"/>
      <circle cx="24" cy="12" r="1.5" fill="#60d0d0"/>
    </svg>
  `)}`,
  smelter: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect x="2" y="2" width="28" height="28" rx="4" fill="#3a2020"/>
      <path d="M6 26 L6 14 L10 10 L22 10 L26 14 L26 26 Z" fill="#5a4040"/>
      <rect x="10" y="14" width="12" height="8" rx="1" fill="#1a0a0a"/>
      <ellipse cx="16" cy="12" rx="4" ry="2" fill="#ff6030"/>
      <ellipse cx="14" cy="10" rx="2" ry="3" fill="#ffaa30"/>
      <ellipse cx="18" cy="9" rx="1.5" ry="2.5" fill="#ffdd60"/>
    </svg>
  `)}`,
  forger: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect x="2" y="2" width="28" height="28" rx="4" fill="#203020"/>
      <path d="M6 26 L6 20 L26 20 L26 26 Z" fill="#4a4a4a"/>
      <path d="M8 20 L12 14 L20 14 L24 20 Z" fill="#6a6a6a"/>
      <rect x="14" y="6" width="4" height="12" fill="#8b7355"/>
      <rect x="10" y="4" width="12" height="4" rx="1" fill="#a0a0a0"/>
      <rect x="10" y="4" width="12" height="2" fill="#c0c0c0"/>
    </svg>
  `)}`,
  shop: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect x="2" y="2" width="28" height="28" rx="4" fill="#3a3020"/>
      <path d="M4 14 L16 6 L28 14 Z" fill="#c04040"/>
      <path d="M6 14 L6 26 L26 26 L26 14 Z" fill="#d4a574"/>
      <rect x="12" y="18" width="8" height="8" fill="#5a3a1a"/>
      <rect x="14" y="20" width="4" height="4" fill="#80d0ff"/>
      <circle cx="10" cy="11" r="2" fill="#ffd700"/>
      <circle cx="22" cy="11" r="2" fill="#ffd700"/>
    </svg>
  `)}`,
  warehouse: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect x="2" y="2" width="28" height="28" rx="4" fill="#2a2a3a"/>
      <path d="M4 12 L16 4 L28 12 Z" fill="#505070"/>
      <path d="M5 12 L5 26 L27 26 L27 12 Z" fill="#404060"/>
      <rect x="7" y="14" width="5" height="6" fill="#303050"/>
      <rect x="13" y="14" width="6" height="12" fill="#252540"/>
      <rect x="20" y="14" width="5" height="6" fill="#303050"/>
      <rect x="7" y="21" width="5" height="5" fill="#303050"/>
      <rect x="20" y="21" width="5" height="5" fill="#303050"/>
      <rect x="8" y="15" width="3" height="2" fill="#606080"/>
      <rect x="21" y="15" width="3" height="2" fill="#606080"/>
      <rect x="8" y="22" width="3" height="2" fill="#606080"/>
      <rect x="21" y="22" width="3" height="2" fill="#606080"/>
    </svg>
  `)}`,
  geologist: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect x="2" y="2" width="28" height="28" rx="4" fill="#2a3a2a"/>
      <path d="M6 24 L6 14 L12 10 L20 10 L26 14 L26 24 Z" fill="#3a4a3a"/>
      <rect x="10" y="14" width="12" height="10" fill="#2a3a2a"/>
      <circle cx="16" cy="8" r="4" fill="#ffdd44"/>
      <path d="M14 8 L18 8 L17 12 L15 12 Z" fill="#ffaa00"/>
      <circle cx="10" cy="20" r="2" fill="#e07020"/>
      <circle cx="16" cy="18" r="2" fill="#40b0b0"/>
      <circle cx="22" cy="20" r="2" fill="#e07020"/>
      <rect x="14" y="22" width="4" height="2" fill="#654321"/>
      <path d="M8 26 L24 26 L22 24 L10 24 Z" fill="#4a5a4a"/>
    </svg>
  `)}`,
  geologist_explorer: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <!-- Body -->
      <ellipse cx="16" cy="24" rx="6" ry="4" fill="#5a4030"/>
      <!-- Torso -->
      <rect x="12" y="14" width="8" height="10" rx="2" fill="#6a8050"/>
      <!-- Head -->
      <circle cx="16" cy="10" r="6" fill="#ffccaa"/>
      <!-- Hat (explorer hat) -->
      <ellipse cx="16" cy="6" rx="8" ry="2" fill="#8b6914"/>
      <ellipse cx="16" cy="5" rx="5" ry="3" fill="#a08020"/>
      <rect x="14" y="3" width="4" height="2" fill="#c0a030"/>
      <!-- Eyes -->
      <circle cx="14" cy="10" r="1" fill="#333"/>
      <circle cx="18" cy="10" r="1" fill="#333"/>
      <!-- Smile -->
      <path d="M14 13 Q16 15 18 13" stroke="#833" fill="none" stroke-width="1"/>
      <!-- Pickaxe on back -->
      <line x1="22" y1="8" x2="26" y2="20" stroke="#654321" stroke-width="2"/>
      <path d="M24 6 L28 10 L26 12 L22 8 Z" fill="#888"/>
      <!-- Boots -->
      <ellipse cx="13" cy="27" rx="3" ry="2" fill="#4a3020"/>
      <ellipse cx="19" cy="27" rx="3" ry="2" fill="#4a3020"/>
    </svg>
  `)}`,
  explorer: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect x="2" y="2" width="28" height="28" rx="4" fill="#1a3a4a"/>
      <path d="M6 24 L6 14 L12 10 L20 10 L26 14 L26 24 Z" fill="#2a4a5a"/>
      <rect x="10" y="14" width="12" height="10" fill="#1a3a4a"/>
      <!-- Compass rose -->
      <circle cx="16" cy="16" r="8" fill="#305060"/>
      <circle cx="16" cy="16" r="6" fill="#406070"/>
      <path d="M16 10 L17 16 L16 14 L15 16 Z" fill="#ff4040"/>
      <path d="M16 22 L17 16 L16 18 L15 16 Z" fill="#ffffff"/>
      <path d="M10 16 L16 17 L14 16 L16 15 Z" fill="#ffffff"/>
      <path d="M22 16 L16 17 L18 16 L16 15 Z" fill="#ffffff"/>
      <circle cx="16" cy="16" r="1.5" fill="#ffd700"/>
      <!-- Map scroll -->
      <rect x="22" y="20" width="6" height="8" rx="1" fill="#d4a574"/>
      <rect x="22" y="20" width="6" height="2" fill="#8b6914"/>
      <rect x="22" y="26" width="6" height="2" fill="#8b6914"/>
    </svg>
  `)}`,
  explorer_character: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <!-- Body -->
      <ellipse cx="16" cy="24" rx="6" ry="4" fill="#3a4a5a"/>
      <!-- Torso -->
      <rect x="12" y="14" width="8" height="10" rx="2" fill="#406080"/>
      <!-- Head -->
      <circle cx="16" cy="10" r="6" fill="#ffccaa"/>
      <!-- Hat (wide brim explorer) -->
      <ellipse cx="16" cy="6" rx="9" ry="2.5" fill="#2a5a6a"/>
      <ellipse cx="16" cy="5" rx="5" ry="3" fill="#3a7a8a"/>
      <rect x="14" y="3" width="4" height="2" fill="#4a9aaa"/>
      <!-- Eyes -->
      <circle cx="14" cy="10" r="1" fill="#333"/>
      <circle cx="18" cy="10" r="1" fill="#333"/>
      <!-- Smile -->
      <path d="M14 13 Q16 15 18 13" stroke="#833" fill="none" stroke-width="1"/>
      <!-- Binoculars -->
      <circle cx="6" cy="14" r="3" fill="#444"/>
      <circle cx="6" cy="14" r="2" fill="#60a0c0"/>
      <rect x="6" y="12" width="6" height="4" fill="#444"/>
      <!-- Map in hand -->
      <rect x="22" y="16" width="6" height="8" rx="1" fill="#d4a574"/>
      <line x1="23" y1="18" x2="27" y2="18" stroke="#8b6914" stroke-width="1"/>
      <line x1="23" y1="20" x2="27" y2="20" stroke="#8b6914" stroke-width="1"/>
      <line x1="23" y1="22" x2="26" y2="22" stroke="#8b6914" stroke-width="1"/>
      <!-- Boots -->
      <ellipse cx="13" cy="27" rx="3" ry="2" fill="#2a3a4a"/>
      <ellipse cx="19" cy="27" rx="3" ry="2" fill="#2a3a4a"/>
    </svg>
  `)}`,
  ore_iron: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect x="1" y="1" width="30" height="30" rx="3" fill="#3d2817"/>
      <ellipse cx="16" cy="20" rx="12" ry="8" fill="#2a1a0a"/>
      <polygon points="10,22 8,16 12,12 18,14 16,20" fill="#c06020"/>
      <polygon points="10,22 8,16 12,12 18,14 16,20" fill="#e07020" transform="translate(1,-1)"/>
      <polygon points="18,18 20,12 26,14 24,20 20,22" fill="#d06820"/>
      <polygon points="18,18 20,12 26,14 24,20 20,22" fill="#f08030" transform="translate(1,-1)"/>
      <polygon points="12,14 14,8 20,10 18,16" fill="#b05818"/>
      <polygon points="12,14 14,8 20,10 18,16" fill="#e07828" transform="translate(1,-1)"/>
      <circle cx="11" cy="15" r="1.5" fill="#ffaa50"/>
      <circle cx="21" cy="13" r="1" fill="#ffcc70"/>
      <circle cx="17" cy="19" r="1.2" fill="#ffbb60"/>
    </svg>
  `)}`,
  ore_copper: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect x="1" y="1" width="30" height="30" rx="3" fill="#1a2a2a"/>
      <ellipse cx="16" cy="20" rx="12" ry="8" fill="#0a1a1a"/>
      <polygon points="10,22 8,16 12,12 18,14 16,20" fill="#208080"/>
      <polygon points="10,22 8,16 12,12 18,14 16,20" fill="#30a0a0" transform="translate(1,-1)"/>
      <polygon points="18,18 20,12 26,14 24,20 20,22" fill="#289090"/>
      <polygon points="18,18 20,12 26,14 24,20 20,22" fill="#40b8b8" transform="translate(1,-1)"/>
      <polygon points="12,14 14,8 20,10 18,16" fill="#187070"/>
      <polygon points="12,14 14,8 20,10 18,16" fill="#38a8a8" transform="translate(1,-1)"/>
      <circle cx="11" cy="15" r="1.5" fill="#60e0e0"/>
      <circle cx="21" cy="13" r="1" fill="#80f0f0"/>
      <circle cx="17" cy="19" r="1.2" fill="#70e8e8"/>
    </svg>
  `)}`,
  // NPC icons
  npc_warrior: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="#8b2020"/>
      <circle cx="16" cy="18" r="10" fill="#ffddbb"/>
      <path d="M6 14 L16 4 L26 14 L24 16 L16 8 L8 16 Z" fill="#606060"/>
      <rect x="14" y="6" width="4" height="4" fill="#808080"/>
      <circle cx="12" cy="18" r="2" fill="#222"/>
      <circle cx="20" cy="18" r="2" fill="#222"/>
      <path d="M12 23 Q16 26 20 23" stroke="#833" fill="none" stroke-width="2"/>
      <rect x="24" y="10" width="3" height="12" fill="#666"/>
      <rect x="23" y="8" width="5" height="3" fill="#888"/>
    </svg>
  `)}`,
  npc_mage: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="#4a208b"/>
      <circle cx="16" cy="20" r="9" fill="#ffddbb"/>
      <path d="M8 18 L16 2 L24 18 Z" fill="#6030a0"/>
      <circle cx="16" cy="10" r="3" fill="#ffdd00"/>
      <circle cx="16" cy="10" r="1.5" fill="#fff"/>
      <circle cx="12" cy="20" r="2" fill="#222"/>
      <circle cx="20" cy="20" r="2" fill="#222"/>
      <ellipse cx="16" cy="25" rx="3" ry="1.5" fill="#833"/>
      <rect x="2" y="20" width="2" height="10" fill="#8b6914"/>
      <circle cx="3" cy="18" r="3" fill="#80f0ff"/>
      <circle cx="3" cy="18" r="1.5" fill="#fff"/>
    </svg>
  `)}`,
  npc_collector: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="#206060"/>
      <circle cx="16" cy="18" r="10" fill="#ffddbb"/>
      <ellipse cx="16" cy="8" rx="8" ry="4" fill="#8b6914"/>
      <rect x="8" y="6" width="16" height="4" fill="#a08020"/>
      <circle cx="12" cy="18" r="2" fill="#222"/>
      <circle cx="20" cy="18" r="2" fill="#222"/>
      <ellipse cx="16" cy="23" rx="4" ry="2" fill="#833"/>
      <circle cx="10" cy="6" r="2" fill="#ffd700"/>
      <circle cx="16" cy="5" r="2" fill="#ffd700"/>
      <circle cx="22" cy="6" r="2" fill="#ffd700"/>
    </svg>
  `)}`,
  npc_merchant: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="#8b8b20"/>
      <circle cx="16" cy="18" r="10" fill="#ffddbb"/>
      <rect x="8" y="6" width="16" height="6" rx="2" fill="#444"/>
      <rect x="10" y="4" width="12" height="4" fill="#333"/>
      <circle cx="12" cy="18" r="2" fill="#222"/>
      <circle cx="20" cy="18" r="2" fill="#222"/>
      <path d="M13 23 L19 23" stroke="#833" fill="none" stroke-width="2"/>
      <circle cx="8" cy="26" r="3" fill="#ffd700"/>
      <text x="8" y="28" font-size="5" fill="#996600" text-anchor="middle">$</text>
      <circle cx="24" cy="26" r="3" fill="#ffd700"/>
      <text x="24" y="28" font-size="5" fill="#996600" text-anchor="middle">$</text>
    </svg>
  `)}`,
  // Item icons
  item_iron_ore: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <ellipse cx="16" cy="16" rx="14" ry="12" fill="#8b4513"/>
      <polygon points="8,18 10,10 16,8 20,12 18,20 10,20" fill="#d06020"/>
      <polygon points="14,14 18,10 24,14 22,20 16,18" fill="#e07830"/>
      <circle cx="12" cy="14" r="2" fill="#ffaa50"/>
      <circle cx="20" cy="12" r="1.5" fill="#ffcc70"/>
      <circle cx="16" cy="18" r="1.5" fill="#ff9040"/>
    </svg>
  `)}`,
  item_copper_ore: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <ellipse cx="16" cy="16" rx="14" ry="12" fill="#1a3a3a"/>
      <polygon points="8,18 10,10 16,8 20,12 18,20 10,20" fill="#208080"/>
      <polygon points="14,14 18,10 24,14 22,20 16,18" fill="#30a8a8"/>
      <circle cx="12" cy="14" r="2" fill="#60e0e0"/>
      <circle cx="20" cy="12" r="1.5" fill="#80f0f0"/>
      <circle cx="16" cy="18" r="1.5" fill="#50d0d0"/>
    </svg>
  `)}`,
  item_iron_bar: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect x="4" y="10" width="24" height="12" rx="2" fill="#606060"/>
      <rect x="4" y="10" width="24" height="4" rx="1" fill="#909090"/>
      <rect x="6" y="12" width="8" height="2" fill="#b0b0b0"/>
      <rect x="18" y="12" width="6" height="2" fill="#b0b0b0"/>
      <rect x="4" y="20" width="24" height="2" rx="1" fill="#404040"/>
    </svg>
  `)}`,
  item_copper_bar: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect x="4" y="10" width="24" height="12" rx="2" fill="#b87333"/>
      <rect x="4" y="10" width="24" height="4" rx="1" fill="#da8a4a"/>
      <rect x="6" y="12" width="8" height="2" fill="#f0a060"/>
      <rect x="18" y="12" width="6" height="2" fill="#f0a060"/>
      <rect x="4" y="20" width="24" height="2" rx="1" fill="#8b5a2b"/>
    </svg>
  `)}`,
  item_dagger: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <path d="M6 26 L8 24 L10 26 L8 28 Z" fill="#8b6914"/>
      <rect x="7" y="20" width="2" height="5" fill="#654321"/>
      <path d="M5 20 L11 20 L9 22 L7 22 Z" fill="#a08020"/>
      <path d="M7 6 L9 6 L10 20 L6 20 Z" fill="#a0a0a0"/>
      <path d="M7 6 L9 6 L9 18 L7 18 Z" fill="#d0d0d0"/>
      <path d="M7 4 L9 4 L9 6 L7 6 Z" fill="#e0e0e0"/>
    </svg>
  `)}`,
  item_armour: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <path d="M8 8 L16 4 L24 8 L24 20 L16 28 L8 20 Z" fill="#707070"/>
      <path d="M8 8 L16 4 L24 8 L24 12 L16 16 L8 12 Z" fill="#909090"/>
      <path d="M10 10 L16 6 L22 10 L22 14 L16 18 L10 14 Z" fill="#a0a0a0"/>
      <path d="M14 8 L18 8 L18 12 L16 14 L14 12 Z" fill="#c0c0c0"/>
      <circle cx="16" cy="10" r="2" fill="#d0d0d0"/>
    </svg>
  `)}`,
  item_wand: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect x="14" y="10" width="4" height="18" rx="1" fill="#654321"/>
      <rect x="14" y="10" width="4" height="2" fill="#8b6914"/>
      <circle cx="16" cy="6" r="4" fill="#9040c0"/>
      <circle cx="16" cy="6" r="2" fill="#c080ff"/>
      <circle cx="16" cy="6" r="1" fill="#ffffff"/>
      <path d="M12 4 L14 6 L12 8" stroke="#ff80ff" fill="none" stroke-width="1"/>
      <path d="M20 4 L18 6 L20 8" stroke="#ff80ff" fill="none" stroke-width="1"/>
      <path d="M16 0 L16 3" stroke="#ffff80" fill="none" stroke-width="1"/>
    </svg>
  `)}`,
  item_magic_powder: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <ellipse cx="16" cy="20" rx="10" ry="6" fill="#4a2080"/>
      <ellipse cx="16" cy="18" rx="10" ry="6" fill="#6030a0"/>
      <ellipse cx="16" cy="16" rx="8" ry="4" fill="#8040c0"/>
      <circle cx="10" cy="16" r="1.5" fill="#ff80ff"/>
      <circle cx="16" cy="14" r="1" fill="#80ffff"/>
      <circle cx="20" cy="16" r="1.2" fill="#ffff80"/>
      <circle cx="14" cy="18" r="0.8" fill="#ffffff"/>
      <circle cx="18" cy="17" r="1" fill="#c0c0ff"/>
      <circle cx="12" cy="14" r="0.6" fill="#ffaaff"/>
      <circle cx="20" cy="14" r="0.7" fill="#aaffff"/>
    </svg>
  `)}`,
};

// Preload images
const iconImages: Record<string, HTMLImageElement> = {};
let iconsLoaded = false;

function loadIcons(): void {
  if (iconsLoaded) return;
  for (const [key, src] of Object.entries(ICONS)) {
    const img = new Image();
    img.src = src;
    iconImages[key] = img;
  }
  iconsLoaded = true;
}

const COLORS: Record<string, string> = {
  background: "#1a1a2e",
  grid: "#2a2a4e",
  ore_iron: "#e07020",
  ore_copper: "#40b0b0",
  miner: "#4080d0",
  smelter: "#d04040",
  forger: "#40b040",
  shop: "#d0a030",
  warehouse: "#6060a0",
  geologist: "#40a040",
  explorer: "#3080a0",
  progressBg: "#333",
  progressFill: "#eee",
  ghost: "rgba(255, 255, 255, 0.3)",
  belt: "#c0a030",
  beltArrow: "#e0c040",
  npc_warrior: "#c04040",
  npc_mage: "#8040c0",
  npc_collector: "#40a0a0",
  npc_merchant: "#a0a040",
};

export function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  cellSize: number,
  ghost: { type: string; x: number; y: number } | null,
  beltStart: { x: number; y: number } | null,
  beltGhostEnd: { x: number; y: number } | null,
  animationProgress: number = 0
): void {
  loadIcons();
  const w = state.mapWidth * cellSize;
  const h = state.mapHeight * cellSize;

  // Background
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, w, h);

  // Grid lines
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let x = 0; x <= state.mapWidth; x++) {
    ctx.beginPath();
    ctx.moveTo(x * cellSize, 0);
    ctx.lineTo(x * cellSize, h);
    ctx.stroke();
  }
  for (let y = 0; y <= state.mapHeight; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * cellSize);
    ctx.lineTo(w, y * cellSize);
    ctx.stroke();
  }

  // Belts (draw under buildings)
  for (const belt of state.belts) {
    drawBelt(ctx, belt, cellSize);
  }

  // Belt ghost preview
  if (beltStart && beltGhostEnd) {
    drawBeltGhost(ctx, beltStart, beltGhostEnd, cellSize);
  } else if (beltStart) {
    // Highlight the selected start cell
    ctx.strokeStyle = COLORS.beltArrow;
    ctx.lineWidth = 2;
    ctx.strokeRect(
      beltStart.x * cellSize + 2,
      beltStart.y * cellSize + 2,
      cellSize - 4,
      cellSize - 4
    );
  }

  // Ore nodes
  for (const node of state.oreNodes) {
    drawOreNode(ctx, node, cellSize);
  }

  // Buildings
  for (const building of state.buildings) {
    drawBuilding(ctx, building, cellSize, state.oreNodes);
  }

  // Items moving on belts (draw after buildings so they appear on top)
  for (const belt of state.belts) {
    drawBeltItems(ctx, belt, state, cellSize, animationProgress);
  }

  // Geologist explorer (animated character walking around)
  if (state.geologistExplorer) {
    drawGeologistExplorer(ctx, state.geologistExplorer, cellSize, animationProgress);
  }

  // Explorer character (walks along map edges)
  if (state.explorerCharacter) {
    drawExplorerCharacter(ctx, state.explorerCharacter, cellSize, animationProgress);
  }

  // Ghost preview for building placement
  if (ghost) {
    ctx.fillStyle = COLORS.ghost;
    ctx.fillRect(
      ghost.x * cellSize + 2,
      ghost.y * cellSize + 2,
      cellSize - 4,
      cellSize - 4
    );
  }
}

function drawBelt(
  ctx: CanvasRenderingContext2D,
  belt: Belt,
  cellSize: number
): void {
  const half = cellSize / 2;
  const fromX = belt.from.x * cellSize + half;
  const fromY = belt.from.y * cellSize + half;
  const toX = belt.to.x * cellSize + half;
  const toY = belt.to.y * cellSize + half;

  // Line
  ctx.strokeStyle = COLORS.belt;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  // Arrowhead
  drawArrowhead(ctx, fromX, fromY, toX, toY, COLORS.beltArrow);
}

function drawBeltGhost(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  cellSize: number
): void {
  const half = cellSize / 2;
  const fromX = from.x * cellSize + half;
  const fromY = from.y * cellSize + half;
  const toX = to.x * cellSize + half;
  const toY = to.y * cellSize + half;

  ctx.strokeStyle = "rgba(224, 192, 64, 0.4)";
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();
  ctx.setLineDash([]);

  drawArrowhead(ctx, fromX, fromY, toX, toY, "rgba(224, 192, 64, 0.4)");
}

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: string
): void {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const size = 8;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - size * Math.cos(angle - Math.PI / 6),
    toY - size * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    toX - size * Math.cos(angle + Math.PI / 6),
    toY - size * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
}

function drawBeltItems(
  ctx: CanvasRenderingContext2D,
  belt: Belt,
  _state: GameState,
  cellSize: number,
  animationProgress: number
): void {
  // Skip if no items in transit
  if (!belt.itemsInTransit || belt.itemsInTransit.length === 0) return;

  const half = cellSize / 2;
  const fromX = belt.from.x * cellSize + half;
  const fromY = belt.from.y * cellSize + half;
  const toX = belt.to.x * cellSize + half;
  const toY = belt.to.y * cellSize + half;

  const travelTime = getBeltTravelTime(belt.from, belt.to);
  const progressPerTick = 1 / travelTime;
  const itemSize = Math.floor(cellSize * 0.4);

  const itemColors: Record<string, string> = {
    iron_ore: "#e07020",
    copper_ore: "#40b0b0",
    iron_bar: "#808080",
    copper_bar: "#b87333",
    dagger: "#a0a0a0",
    armour: "#707070",
    wand: "#9040c0",
    magic_powder: "#8040c0",
  };

  for (const item of belt.itemsInTransit) {
    // Calculate visual progress: base progress + animated portion of current tick
    const visualProgress = Math.min(1, item.progress + progressPerTick * animationProgress);

    const itemX = fromX + (toX - fromX) * visualProgress;
    const itemY = fromY + (toY - fromY) * visualProgress;

    // Draw item icon
    const iconKey = `item_${item.itemType}`;
    const img = iconImages[iconKey];

    if (img && img.complete) {
      ctx.drawImage(
        img,
        itemX - itemSize / 2,
        itemY - itemSize / 2,
        itemSize,
        itemSize
      );
    } else {
      // Fallback: draw a small colored circle
      ctx.fillStyle = itemColors[item.itemType] || "#888";
      ctx.beginPath();
      ctx.arc(itemX, itemY, itemSize / 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawOreNode(
  ctx: CanvasRenderingContext2D,
  node: OreNode,
  cellSize: number
): void {
  const pad = 2;
  const x = node.position.x * cellSize + pad;
  const y = node.position.y * cellSize + pad;
  const size = cellSize - pad * 2;

  const iconKey = node.type === "copper" ? "ore_copper" : "ore_iron";
  const img = iconImages[iconKey];

  if (img && img.complete) {
    ctx.drawImage(img, x, y, size, size);
  } else {
    // Fallback to colored square
    ctx.fillStyle = node.type === "copper" ? COLORS.ore_copper : COLORS.ore_iron;
    ctx.fillRect(x, y, size, size);
  }
}

function drawBuilding(
  ctx: CanvasRenderingContext2D,
  building: Building,
  cellSize: number,
  oreNodes: OreNode[]
): void {
  const pad = 2;
  const x = building.position.x * cellSize + pad;
  const y = building.position.y * cellSize + pad;
  const size = cellSize - pad * 2;

  // Determine which icon to use
  let iconKey: string;
  if (building.type === "miner") {
    const oreNode = oreNodes.find(
      (n) => n.position.x === building.position.x && n.position.y === building.position.y
    );
    iconKey = oreNode?.type === "copper" ? "miner_copper" : "miner_iron";
  } else {
    iconKey = building.type;
  }

  // Check if under construction
  const underConstruction = (building.constructionProgress ?? 1) < 1;

  // Draw icon (dimmed if under construction)
  const img = iconImages[iconKey];
  if (img && img.complete) {
    if (underConstruction) {
      ctx.globalAlpha = 0.4;
    }
    ctx.drawImage(img, x, y, size, size);
    ctx.globalAlpha = 1;
  } else {
    // Fallback to colored square if image not loaded
    ctx.fillStyle = COLORS[building.type];
    if (underConstruction) {
      ctx.globalAlpha = 0.4;
    }
    ctx.fillRect(x, y, size, size);
    ctx.globalAlpha = 1;
  }

  // Construction scaffolding effect
  if (underConstruction) {
    // Draw scaffold lines
    ctx.strokeStyle = "#f0a030";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
    ctx.setLineDash([]);

    // Construction progress bar (yellow/orange)
    const barHeight = 6;
    const barY = y + size / 2 - barHeight / 2;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(x + 4, barY - 1, size - 8, barHeight + 2);
    ctx.fillStyle = "#f0a030";
    ctx.fillRect(x + 5, barY, (size - 10) * (building.constructionProgress ?? 0), barHeight);

    // "Building..." text
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.floor(cellSize * 0.2)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Building", x + size / 2, y + size / 2 + barHeight);
    return; // Skip other overlays while under construction
  }

  // Recipe indicator for forgers (small badge in corner)
  if (building.type === "forger") {
    const recipeLabels: Record<string, string> = { dagger: "D", armour: "A", wand: "W", magic_powder: "P" };
    const label = recipeLabels[building.recipe] ?? "?";
    const badgeSize = Math.floor(cellSize * 0.3);
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.beginPath();
    ctx.arc(x + size - badgeSize/2, y + badgeSize/2, badgeSize/2 + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.floor(cellSize * 0.25)}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + size - badgeSize/2, y + badgeSize/2);
  }

  // Progress bar (not used for shops)
  if (building.type !== "shop") {
    const barHeight = 4;
    const barY = y + size - barHeight - 1;
    ctx.fillStyle = COLORS.progressBg;
    ctx.fillRect(x + 2, barY, size - 4, barHeight);
    ctx.fillStyle = COLORS.progressFill;
    ctx.fillRect(x + 2, barY, (size - 4) * Math.min(building.progress, 1), barHeight);
  }

  // Storage indicator (icons with counts above building)
  const storageItems = Object.entries(building.storage).filter(([, v]) => v > 0);
  if (storageItems.length > 0) {
    const iconSize = Math.floor(cellSize * 0.35);
    const spacing = iconSize + 2;
    const totalWidth = storageItems.length * spacing - 2;
    const startX = x + size / 2 - totalWidth / 2;
    const iconY = y - iconSize - 4;

    for (let i = 0; i < storageItems.length; i++) {
      const [itemType, count] = storageItems[i];
      const iconX = startX + i * spacing;
      const iconKey = `item_${itemType}`;
      const img = iconImages[iconKey];

      if (img && img.complete) {
        ctx.drawImage(img, iconX, iconY, iconSize, iconSize);
      } else {
        // Fallback colored circle
        const colors: Record<string, string> = {
          iron_ore: "#e07020", copper_ore: "#40b0b0",
          iron_bar: "#808080", copper_bar: "#b87333",
          dagger: "#a0a0a0", armour: "#707070",
          wand: "#9040c0", magic_powder: "#8040c0",
        };
        ctx.fillStyle = colors[itemType] || "#888";
        ctx.beginPath();
        ctx.arc(iconX + iconSize / 2, iconY + iconSize / 2, iconSize / 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Count badge
      ctx.fillStyle = "rgba(0,0,0,0.8)";
      const badgeSize = Math.floor(iconSize * 0.7);
      ctx.beginPath();
      ctx.arc(iconX + iconSize - badgeSize / 2, iconY + iconSize - badgeSize / 2, badgeSize / 2 + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.floor(iconSize * 0.6)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(count), iconX + iconSize - badgeSize / 2, iconY + iconSize - badgeSize / 2);
    }
  }

  // NPC queue for shops (icons with patience arcs)
  if (building.type === "shop" && building.npcQueue.length > 0) {
    const iconSize = Math.floor(cellSize * 0.35);
    const spacing = iconSize + 2;
    const startX = x + size / 2 - ((building.npcQueue.length - 1) * spacing) / 2;
    const npcY = y + size + 2;

    for (let i = 0; i < building.npcQueue.length; i++) {
      const npc = building.npcQueue[i];
      const npcX = startX + i * spacing - iconSize / 2;

      // Draw NPC icon
      const iconKey = `npc_${npc.npcType}`;
      const img = iconImages[iconKey];
      if (img && img.complete) {
        ctx.drawImage(img, npcX, npcY, iconSize, iconSize);
      } else {
        // Fallback to colored circle
        ctx.fillStyle = COLORS[iconKey];
        ctx.beginPath();
        ctx.arc(npcX + iconSize / 2, npcY + iconSize / 2, iconSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Patience bar below icon
      const barWidth = iconSize;
      const barHeight = 3;
      const barY = npcY + iconSize + 1;
      const patienceRatio = npc.patienceLeft / npc.maxPatience;

      // Background
      ctx.fillStyle = "#333";
      ctx.fillRect(npcX, barY, barWidth, barHeight);

      // Remaining patience (color based on ratio)
      const barColor = patienceRatio > 0.5 ? "#4a4" : patienceRatio > 0.25 ? "#aa4" : "#a44";
      ctx.fillStyle = barColor;
      ctx.fillRect(npcX, barY, barWidth * patienceRatio, barHeight);
    }
  }
}

function drawGeologistExplorer(
  ctx: CanvasRenderingContext2D,
  explorer: GeologistExplorer,
  cellSize: number,
  animationProgress: number
): void {
  const size = cellSize * 0.8;

  // Add a slight bobbing animation while walking
  const dx = explorer.targetPosition.x - explorer.position.x;
  const dy = explorer.targetPosition.y - explorer.position.y;
  const isMoving = Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1;
  const bobOffset = isMoving ? Math.sin(animationProgress * Math.PI * 4) * 2 : 0;

  // Calculate position (center of cell)
  const x = explorer.position.x * cellSize + cellSize / 2 - size / 2;
  const y = explorer.position.y * cellSize + cellSize / 2 - size / 2 + bobOffset;

  // Draw shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.beginPath();
  ctx.ellipse(x + size / 2, y + size + 2, size / 3, size / 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Draw explorer icon
  const img = iconImages["geologist_explorer"];
  if (img && img.complete) {
    // Flip icon based on movement direction
    ctx.save();
    if (dx < -0.1) {
      ctx.translate(x + size, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, size, size);
    } else {
      ctx.drawImage(img, x, y, size, size);
    }
    ctx.restore();
  } else {
    // Fallback: simple circle
    ctx.fillStyle = "#6a8050";
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffccaa";
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 3, size / 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw search indicator (magnifying glass effect when close to finding)
  if (explorer.searchProgress > 0.5) {
    const pulseSize = 4 + (explorer.searchProgress - 0.5) * 8;
    const alpha = 0.3 + (explorer.searchProgress - 0.5) * 0.6;
    ctx.strokeStyle = `rgba(255, 215, 0, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2 + pulseSize, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Draw line to target position (faint dotted line)
  if (isMoving) {
    const targetX = explorer.targetPosition.x * cellSize + cellSize / 2;
    const targetY = explorer.targetPosition.y * cellSize + cellSize / 2;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(x + size / 2, y + size / 2);
    ctx.lineTo(targetX, targetY);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawExplorerCharacter(
  ctx: CanvasRenderingContext2D,
  explorer: ExplorerCharacter,
  cellSize: number,
  animationProgress: number
): void {
  const size = cellSize * 0.8;

  // Add a slight bobbing animation while walking
  const dx = explorer.targetPosition.x - explorer.position.x;
  const dy = explorer.targetPosition.y - explorer.position.y;
  const isMoving = Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1;
  const bobOffset = isMoving ? Math.sin(animationProgress * Math.PI * 4) * 2 : 0;

  // Calculate position (center of cell)
  const x = explorer.position.x * cellSize + cellSize / 2 - size / 2;
  const y = explorer.position.y * cellSize + cellSize / 2 - size / 2 + bobOffset;

  // Draw shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.beginPath();
  ctx.ellipse(x + size / 2, y + size + 2, size / 3, size / 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Draw explorer character icon
  const img = iconImages["explorer_character"];
  if (img && img.complete) {
    // Flip icon based on movement direction
    ctx.save();
    if (dx < -0.1) {
      ctx.translate(x + size, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, size, size);
    } else {
      ctx.drawImage(img, x, y, size, size);
    }
    ctx.restore();
  } else {
    // Fallback: simple circle (teal color for explorer)
    ctx.fillStyle = "#406080";
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffccaa";
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 3, size / 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw expansion indicator (compass/map glow when close to expanding)
  if (explorer.expansionProgress > 0.5) {
    const pulseSize = 4 + (explorer.expansionProgress - 0.5) * 8;
    const alpha = 0.3 + (explorer.expansionProgress - 0.5) * 0.6;
    ctx.strokeStyle = `rgba(64, 160, 200, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2 + pulseSize, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Draw line to target position (faint dotted line)
  if (isMoving) {
    const targetX = explorer.targetPosition.x * cellSize + cellSize / 2;
    const targetY = explorer.targetPosition.y * cellSize + cellSize / 2;
    ctx.strokeStyle = "rgba(64, 160, 200, 0.2)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(x + size / 2, y + size / 2);
    ctx.lineTo(targetX, targetY);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
