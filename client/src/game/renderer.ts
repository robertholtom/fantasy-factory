import { GameState, Belt, Building, OreNode, ItemType, getBeltTravelTime, getBeltEndpoints, GeologistExplorer, findPath, Position } from "./types";

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
  junction: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect x="2" y="2" width="28" height="28" rx="4" fill="#3a3a40"/>
      <rect x="14" y="4" width="4" height="24" fill="#606068"/>
      <rect x="4" y="14" width="24" height="4" fill="#606068"/>
      <circle cx="16" cy="16" r="6" fill="#505058"/>
      <circle cx="16" cy="16" r="4" fill="#707078"/>
      <circle cx="16" cy="6" r="2" fill="#80c080"/>
      <circle cx="16" cy="26" r="2" fill="#80c080"/>
      <circle cx="6" cy="16" r="2" fill="#80c080"/>
      <circle cx="26" cy="16" r="2" fill="#80c080"/>
    </svg>
  `)}`,
  sorter: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect x="2" y="2" width="28" height="28" rx="4" fill="#3a3040"/>
      <path d="M6 8 L26 8 L20 24 L12 24 Z" fill="#504858"/>
      <path d="M8 10 L24 10 L19 22 L13 22 Z" fill="#605868"/>
      <rect x="13" y="22" width="6" height="4" fill="#706878"/>
      <path d="M10 12 L22 12 L18 18 L14 18 Z" fill="#808"/>
      <circle cx="16" cy="14" r="2" fill="#c080c0"/>
      <circle cx="12" cy="10" r="1.5" fill="#ffd700"/>
      <circle cx="20" cy="10" r="1.5" fill="#ffd700"/>
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
  npc_noble: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="#8b4513"/>
      <circle cx="16" cy="18" r="10" fill="#deb887"/>
      <path d="M10 4 L12 8 L16 6 L20 8 L22 4 L20 6 L16 4 L12 6 Z" fill="#ffd700"/>
      <circle cx="12" cy="18" r="2" fill="#222"/>
      <circle cx="20" cy="18" r="2" fill="#222"/>
      <path d="M13 23 L19 23" stroke="#833" fill="none" stroke-width="2"/>
      <circle cx="16" cy="5" r="2" fill="#ff4444"/>
    </svg>
  `)}`,
  npc_adventurer: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="#2e8b57"/>
      <circle cx="16" cy="18" r="10" fill="#98d8a8"/>
      <path d="M10 4 L22 4 L20 10 L12 10 Z" fill="#8b4513"/>
      <circle cx="12" cy="18" r="2" fill="#222"/>
      <circle cx="20" cy="18" r="2" fill="#222"/>
      <path d="M13 23 L19 23" stroke="#833" fill="none" stroke-width="2"/>
      <rect x="22" y="14" width="6" height="2" fill="#a0a0a0"/>
    </svg>
  `)}`,
  npc_king: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="#ffd700"/>
      <circle cx="16" cy="18" r="10" fill="#fff8dc"/>
      <path d="M8 4 L10 8 L13 6 L16 8 L19 6 L22 8 L24 4 L22 6 L19 4 L16 6 L13 4 L10 6 Z" fill="#ffd700"/>
      <circle cx="12" cy="18" r="2" fill="#222"/>
      <circle cx="20" cy="18" r="2" fill="#222"/>
      <path d="M13 23 L19 23" stroke="#833" fill="none" stroke-width="2"/>
      <circle cx="16" cy="5" r="2.5" fill="#ff0000"/>
      <path d="M6 24 L26 24 L24 28 L8 28 Z" fill="#8b0000"/>
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
  junction: "#707078",
  sorter: "#8060a0",
  progressBg: "#333",
  progressFill: "#eee",
  ghost: "rgba(255, 255, 255, 0.3)",
  belt: "#c0a030",
  beltArrow: "#e0c040",
  npc_warrior: "#c04040",
  npc_mage: "#8040c0",
  npc_collector: "#40a0a0",
  npc_merchant: "#a0a040",
  npc_noble: "#8b4513",
  npc_adventurer: "#2e8b57",
  npc_king: "#ffd700",
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
    drawBeltGhost(ctx, beltStart, beltGhostEnd, cellSize, state);
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
  // Handle legacy format
  const { from, to } = getBeltEndpoints(belt);
  const path = belt.path || [from, to];

  if (path.length < 2) return;

  // Draw belt path segments
  ctx.strokeStyle = COLORS.belt;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(path[0].x * cellSize + half, path[0].y * cellSize + half);
  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(path[i].x * cellSize + half, path[i].y * cellSize + half);
  }
  ctx.stroke();

  // Draw internal cells as belt segments
  for (let i = 1; i < path.length - 1; i++) {
    const x = path[i].x * cellSize;
    const y = path[i].y * cellSize;

    // Belt cell background
    ctx.fillStyle = "rgba(192, 160, 48, 0.3)";
    ctx.fillRect(x + 2, y + 2, cellSize - 4, cellSize - 4);

    // Direction indicator (chevron)
    const prev = path[i - 1];
    const next = path[i + 1];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const angle = Math.atan2(dy, dx);

    ctx.save();
    ctx.translate(x + half, y + half);
    ctx.rotate(angle);
    ctx.fillStyle = COLORS.beltArrow;
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-2, -4);
    ctx.lineTo(-2, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Arrowhead at destination
  const last = path[path.length - 1];
  const secondLast = path[path.length - 2];
  drawArrowhead(
    ctx,
    secondLast.x * cellSize + half,
    secondLast.y * cellSize + half,
    last.x * cellSize + half,
    last.y * cellSize + half,
    COLORS.beltArrow
  );
}

function drawBeltGhost(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  cellSize: number,
  state?: GameState
): void {
  const half = cellSize / 2;

  // Try to find path if state is available
  let path: Position[] | null = null;
  if (state) {
    const posKey = (p: Position) => `${p.x},${p.y}`;
    const obstacles = new Set<string>();
    for (const b of state.buildings) {
      obstacles.add(posKey(b.position));
    }
    for (const belt of state.belts) {
      // Handle legacy format
      if (belt.path) {
        for (let i = 1; i < belt.path.length - 1; i++) {
          obstacles.add(posKey(belt.path[i]));
        }
      }
    }
    path = findPath(from, to, obstacles, state.mapWidth, state.mapHeight);
  }

  if (path && path.length >= 2) {
    // Draw valid path
    ctx.strokeStyle = "rgba(64, 192, 64, 0.5)";
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(path[0].x * cellSize + half, path[0].y * cellSize + half);
    for (let i = 1; i < path.length; i++) {
      ctx.lineTo(path[i].x * cellSize + half, path[i].y * cellSize + half);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw internal cell previews
    for (let i = 1; i < path.length - 1; i++) {
      ctx.fillStyle = "rgba(64, 192, 64, 0.2)";
      ctx.fillRect(
        path[i].x * cellSize + 4,
        path[i].y * cellSize + 4,
        cellSize - 8,
        cellSize - 8
      );
    }

    // Arrowhead
    const last = path[path.length - 1];
    const secondLast = path[path.length - 2];
    drawArrowhead(
      ctx,
      secondLast.x * cellSize + half,
      secondLast.y * cellSize + half,
      last.x * cellSize + half,
      last.y * cellSize + half,
      "rgba(64, 192, 64, 0.6)"
    );
  } else {
    // No valid path - draw red X or direct line
    ctx.strokeStyle = "rgba(224, 64, 64, 0.5)";
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(from.x * cellSize + half, from.y * cellSize + half);
    ctx.lineTo(to.x * cellSize + half, to.y * cellSize + half);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw X at destination
    ctx.strokeStyle = "rgba(224, 64, 64, 0.8)";
    ctx.lineWidth = 2;
    const cx = to.x * cellSize + half;
    const cy = to.y * cellSize + half;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - 8);
    ctx.lineTo(cx + 8, cy + 8);
    ctx.moveTo(cx + 8, cy - 8);
    ctx.lineTo(cx - 8, cy + 8);
    ctx.stroke();
  }
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
  // Handle legacy format
  const { from, to } = getBeltEndpoints(belt);
  const path = belt.path || [from, to];
  const internalCells = getBeltTravelTime(belt);
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
    // Handle legacy progress format
    const legacyItem = item as any;
    const cellIndex = item.cellIndex ?? Math.floor((legacyItem.progress ?? 0) * internalCells);
    // Calculate position along path based on cellIndex + animation progress
    // cellIndex 0 = at first internal cell, cellIndex = internalCells-1 = at last internal cell
    // Add animation progress to smoothly interpolate between cells
    const visualIndex = cellIndex + animationProgress;

    // Map to path position: index 0 maps to path[1], index internalCells-1 maps to path[path.length-2]
    // We interpolate between path points
    const pathProgress = (visualIndex + 1) / path.length;
    const exactPos = pathProgress * (path.length - 1);
    const segmentIndex = Math.min(Math.floor(exactPos), path.length - 2);
    const segmentProgress = exactPos - segmentIndex;

    const fromCell = path[segmentIndex];
    const toCell = path[segmentIndex + 1];

    const itemX = (fromCell.x + (toCell.x - fromCell.x) * segmentProgress) * cellSize + half;
    const itemY = (fromCell.y + (toCell.y - fromCell.y) * segmentProgress) * cellSize + half;

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

  // Upgrade level indicator (colored border/glow)
  const upgradeLevel = building.upgradeLevel ?? 0;
  if (upgradeLevel > 0) {
    const upgradeColors = ["#cd7f32", "#c0c0c0", "#ffd700"]; // bronze, silver, gold
    const color = upgradeColors[upgradeLevel - 1];
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);

    // Star badge in top-left corner
    const starSize = Math.floor(cellSize * 0.25);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + starSize / 2 + 2, y + starSize / 2 + 2, starSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.font = `bold ${Math.floor(starSize * 0.8)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(upgradeLevel), x + starSize / 2 + 2, y + starSize / 2 + 2);
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

  // Filter indicator for sorters (colored dot + label)
  if (building.type === "sorter") {
    const filter = building.sorterFilter ?? "all";
    const filterLabels: Record<string, string> = {
      all: "*", ore: "O", bar: "B", finished: "F",
      iron_ore: "io", copper_ore: "co", iron_bar: "ib", copper_bar: "cb",
      dagger: "D", armour: "A", wand: "W", magic_powder: "P"
    };
    const filterColors: Record<string, string> = {
      all: "#80c080", ore: "#e07020", bar: "#808080", finished: "#c080c0",
      iron_ore: "#e07020", copper_ore: "#40b0b0", iron_bar: "#808080", copper_bar: "#b87333",
      dagger: "#a0a0a0", armour: "#707070", wand: "#9040c0", magic_powder: "#8040c0"
    };
    const label = filterLabels[filter] ?? "?";
    const color = filterColors[filter] ?? "#888";
    const badgeSize = Math.floor(cellSize * 0.35);
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.beginPath();
    ctx.arc(x + size - badgeSize/2, y + badgeSize/2, badgeSize/2 + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + size - badgeSize/2, y + badgeSize/2, badgeSize/2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.floor(cellSize * 0.2)}px monospace`;
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

