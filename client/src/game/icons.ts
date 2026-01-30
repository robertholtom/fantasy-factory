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
