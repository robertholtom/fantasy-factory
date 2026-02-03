// NPC icons as data URLs
export const NPC_ICONS: Record<string, string> = {
  warrior: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <circle cx="16" cy="10" r="6" fill="#c44"/>
      <path d="M10 16 L22 16 L24 28 L8 28 Z" fill="#8b0000"/>
      <rect x="4" y="12" width="6" height="3" fill="#a0a0a0"/>
      <rect x="22" y="12" width="6" height="3" fill="#a0a0a0"/>
      <circle cx="14" cy="9" r="1" fill="#fff"/>
      <circle cx="18" cy="9" r="1" fill="#fff"/>
    </svg>
  `)}`,
  mage: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <circle cx="16" cy="10" r="6" fill="#66f"/>
      <path d="M10 16 L22 16 L24 28 L8 28 Z" fill="#4040a0"/>
      <path d="M10 4 L16 0 L22 4 L16 8 Z" fill="#8080ff"/>
      <circle cx="14" cy="9" r="1" fill="#fff"/>
      <circle cx="18" cy="9" r="1" fill="#fff"/>
      <circle cx="16" cy="2" r="1.5" fill="#ffff80"/>
    </svg>
  `)}`,
  collector: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <circle cx="16" cy="10" r="6" fill="#4a4"/>
      <path d="M10 16 L22 16 L24 28 L8 28 Z" fill="#2a6a2a"/>
      <rect x="6" y="20" width="8" height="6" fill="#8b4513"/>
      <circle cx="14" cy="9" r="1" fill="#fff"/>
      <circle cx="18" cy="9" r="1" fill="#fff"/>
      <ellipse cx="10" cy="22" rx="3" ry="2" fill="#ffd700"/>
    </svg>
  `)}`,
  merchant: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <circle cx="16" cy="10" r="6" fill="#da4"/>
      <path d="M10 16 L22 16 L24 28 L8 28 Z" fill="#8b6914"/>
      <circle cx="14" cy="9" r="1" fill="#fff"/>
      <circle cx="18" cy="9" r="1" fill="#fff"/>
      <ellipse cx="16" cy="22" rx="4" ry="3" fill="#ffd700"/>
      <text x="16" y="24" font-size="6" fill="#000" text-anchor="middle">$</text>
    </svg>
  `)}`,
  noble: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <circle cx="16" cy="10" r="6" fill="#8b4513"/>
      <path d="M10 16 L22 16 L24 28 L8 28 Z" fill="#4a2a0a"/>
      <path d="M10 4 L12 8 L16 6 L20 8 L22 4 L20 6 L16 4 L12 6 Z" fill="#ffd700"/>
      <circle cx="14" cy="9" r="1" fill="#fff"/>
      <circle cx="18" cy="9" r="1" fill="#fff"/>
      <circle cx="16" cy="5" r="1.5" fill="#ff4444"/>
    </svg>
  `)}`,
  adventurer: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <circle cx="16" cy="10" r="6" fill="#2e8b57"/>
      <path d="M10 16 L22 16 L24 28 L8 28 Z" fill="#1a5a3a"/>
      <path d="M12 2 L20 2 L18 8 L14 8 Z" fill="#8b4513"/>
      <circle cx="14" cy="9" r="1" fill="#fff"/>
      <circle cx="18" cy="9" r="1" fill="#fff"/>
      <rect x="22" y="8" width="6" height="2" fill="#a0a0a0"/>
    </svg>
  `)}`,
  king: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <circle cx="16" cy="12" r="6" fill="#fc0"/>
      <path d="M10 18 L22 18 L24 28 L8 28 Z" fill="#8b0000"/>
      <path d="M8 4 L10 8 L13 6 L16 8 L19 6 L22 8 L24 4 L22 6 L19 4 L16 6 L13 4 L10 6 Z" fill="#ffd700"/>
      <circle cx="14" cy="11" r="1" fill="#fff"/>
      <circle cx="18" cy="11" r="1" fill="#fff"/>
      <circle cx="16" cy="5" r="2" fill="#ff0000"/>
      <path d="M6 18 L8 28 L6 28 Z" fill="#800000"/>
      <path d="M26 18 L24 28 L26 28 Z" fill="#800000"/>
    </svg>
  `)}`,
};

// Item icons as data URLs
export const ITEM_ICONS: Record<string, string> = {
  dagger: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <path d="M6 26 L8 24 L10 26 L8 28 Z" fill="#8b6914"/>
      <rect x="7" y="20" width="2" height="5" fill="#654321"/>
      <path d="M5 20 L11 20 L9 22 L7 22 Z" fill="#a08020"/>
      <path d="M7 6 L9 6 L10 20 L6 20 Z" fill="#a0a0a0"/>
      <path d="M7 6 L9 6 L9 18 L7 18 Z" fill="#d0d0d0"/>
      <path d="M7 4 L9 4 L9 6 L7 6 Z" fill="#e0e0e0"/>
    </svg>
  `)}`,
  armour: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <path d="M8 8 L16 4 L24 8 L24 20 L16 28 L8 20 Z" fill="#707070"/>
      <path d="M8 8 L16 4 L24 8 L24 12 L16 16 L8 12 Z" fill="#909090"/>
      <path d="M10 10 L16 6 L22 10 L22 14 L16 18 L10 14 Z" fill="#a0a0a0"/>
      <path d="M14 8 L18 8 L18 12 L16 14 L14 12 Z" fill="#c0c0c0"/>
      <circle cx="16" cy="10" r="2" fill="#d0d0d0"/>
    </svg>
  `)}`,
  wand: `data:image/svg+xml,${encodeURIComponent(`
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
  magic_powder: `data:image/svg+xml,${encodeURIComponent(`
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
