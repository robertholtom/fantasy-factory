# Fantasy Factory

A factory simulation idle game where you mine ore, smelt bars, and forge items to sell to NPCs. Built with React and TypeScript, runs entirely in the browser.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173

## How to Play

You start with $400 and a grid scattered with ore nodes. There are two resource types — **iron** (orange) and **copper** (teal). Build production chains, sell to NPCs at your shop, and expand your factory.

### Buildings

| Building | Cost | Description |
|----------|------|-------------|
| Miner | $10 | Place on ore node. Produces 1 ore every 3-4 ticks |
| Smelter | $25 | Consumes 3 ore → 1 bar (4-5 ticks) |
| Forger | $50 | Consumes bars → finished goods |
| Shop | $75 | NPCs arrive to buy your goods |
| Warehouse | $100 | Bulk sells excess inventory at 70% price |
| Geologist | $200 | Discovers new ore nodes ($2/tick upkeep) |
| Junction | $15 | Routes items between multiple belts |
| Sorter | $30 | Filters specific item types |

### Production Chain

```
Miner → Smelter → Forger → Shop
 (ore)    (bar)    (item)   (sell)
```

Connect buildings with **Belts** ($5). Belts automatically route the correct items.

### Recipes

| Recipe | Bars | Ticks | Base Price |
|--------|------|-------|------------|
| Dagger | 2 iron | 5 | $35 |
| Armour | 3 iron | 8 | $60 |
| Wand | 2 copper | 6 | $40 |
| Magic Powder | 4 copper | 10 | $65 |

### NPC System

NPCs spawn at your shop wanting specific items. Each NPC type pays different rates:

| NPC | Iron Items | Copper Items | Patience |
|-----|------------|--------------|----------|
| Warrior | 1.5x | 0.75x | 15-25 ticks |
| Mage | 0.75x | 1.5x | 15-25 ticks |
| Collector | 1.25x | 1.25x | 20-30 ticks |
| Merchant | 1.0x | 1.0x | 30-45 ticks |
| Noble | 1.75x iron | 1.0x copper | 25-35 ticks |
| Adventurer | 1.0x iron | 1.75x copper | 20-30 ticks |
| King | 4.0x | 4.0x | 40-60 ticks |

NPCs leave if not served before patience runs out. The King demands multiple items at once.

### Controls

- Click **Buy** button, then click grid to place building
- Click **Belt**, then source building, then destination
- Click **Demolish**, then click building to remove (75% refund)
- Click a **Forger** to cycle recipe (D → A → W → P)
- Mouse wheel to zoom, right-drag to pan

## Progression

- **Upgrades**: Buy permanent speed improvements with currency
- **Prestige**: Reset for Star Essence to unlock multipliers
- **Automation**: Enable AI to auto-build and optimize production
- **Building Upgrades**: Click buildings to upgrade speed (up to 3 levels)

## Idle Features

- **Offline Progress**: Earn resources while away (50% base efficiency)
- **Auto-save**: Game saves to localStorage every 10 ticks

## Deployment

```bash
npm run build
```

Static files output to `client/dist/`. Deploy to any static host (Netlify, Vercel, GitHub Pages).

## Development

```bash
npm run dev      # Development server with hot reload
npm run build    # Production build
npm run preview  # Preview production build locally
npm run test     # Run tests
```

## Tech Stack

- React 18 + TypeScript
- Vite
- Canvas rendering
- localStorage persistence
