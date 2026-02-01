# Fantasy Factory

A factory simulation idle game where you mine ore, smelt bars, and forge items to sell to NPCs. Built with React, Express, and TypeScript.

## How to Play

You start with $400 and a grid scattered with ore nodes. There are two resource types — **iron** (orange) and **copper** (teal). Build production chains, sell to NPCs at your shop, and expand your factory.

### Buildings

| Building | Cost | Description |
|----------|------|-------------|
| Miner | $10 | Place on ore node. Produces 1 ore every 3-4 ticks |
| Smelter | $25 | Consumes 2 ore → 1 bar (4-5 ticks) |
| Forger | $50 | Consumes bars → finished goods |
| Shop | $75 | NPCs arrive to buy your goods |
| Warehouse | $100 | Bulk sells excess inventory at 70% price |
| Geologist | $200 | Discovers new ore nodes ($2/tick upkeep) |

### Production Chain

```
Miner → Smelter → Forger → Shop
 (ore)    (bar)    (item)   (sell)
```

Connect buildings with **Belts** ($5). Belts automatically route the correct items.

### Recipes

| Recipe | Bars | Ticks | Price | Revenue/tick |
|--------|------|-------|-------|--------------|
| Dagger | 1 iron | 5 | $20 | $4.00 |
| Armour | 2 iron | 8 | $40 | $5.00 |
| Wand | 1 copper | 6 | $25 | $4.17 |
| Magic Powder | 3 copper | 10 | $45 | $4.50 |

### NPC System

NPCs spawn at your shop wanting specific items. Each NPC type pays different rates:

| NPC | Iron Items | Copper Items | Patience |
|-----|------------|--------------|----------|
| Warrior | 1.5x | 0.75x | 15-25 ticks |
| Mage | 0.75x | 1.5x | 15-25 ticks |
| Collector | 1.25x | 1.25x | 20-30 ticks |
| Merchant | 1.0x | 1.0x | 30-45 ticks |

NPCs leave if not served before patience runs out.

### Automation

Open the **Automation** tab to configure automatic building placement and recipe switching. Click **Smart Defaults** to enable optimal settings. Requires upgrades for belt and recipe automation.

### Controls

- Click **Buy** button, then click grid to place building
- Click **Belt**, then source building, then destination
- Click **Demolish**, then click building to remove (75% refund)
- Click a **Forger** to cycle recipe (D → A → W → P)

### Grid Legend

| Symbol | Meaning |
|--------|---------|
| Orange square | Iron ore node |
| Teal square | Copper ore node |
| **M** | Miner |
| **S** | Smelter |
| **D/A/W/P** | Forger (recipe) |
| **$** | Shop |
| **W** | Warehouse |
| **G** | Geologist |

Small text shows storage (e.g. `3o` = 3 ore, `1b` = 1 bar). Bottom bar shows production progress.

## Idle Features

- **Upgrades**: Buy permanent improvements with currency
- **Prestige**: Reset for Star Essence to buy powerful bonuses
- **Offline Progress**: Earn resources while away (50% base efficiency)
- **Auto-save**: Game saves every 10 ticks

## Development

```bash
npm install
npm run dev          # Start client + server
npm run test         # Run tests
npm run build        # Production build
```

Client runs on Vite dev server, proxies `/api` to Express on port 3001.
