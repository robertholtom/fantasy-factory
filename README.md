# Fantasy Factory

A factory simulation game where you mine ore, smelt bars, and forge items to sell for profit. Built with React, Express, and TypeScript.

## How to Play

You start with $150 and a grid scattered with ore nodes. There are two resource types — **iron** (orange) and **copper** (teal). Your goal is to build production chains and sell finished goods.

### Production Chains

```
Iron:   Miner → Smelter → Forger → Sell
         (iron ore)  (iron bar)  (dagger/armour)

Copper: Miner → Smelter → Forger → Sell
         (copper ore) (copper bar) (wand/magic powder)
```

1. **Place a Miner** ($10) on an ore node. It produces ore matching the node type:
   - **Iron node** — 1 iron ore every 3 seconds
   - **Copper node** — 1 copper ore every 4 seconds
2. **Place a Smelter** ($25) anywhere. It consumes 2 ore to produce 1 bar:
   - **Iron ore** — 1 iron bar every 5 seconds
   - **Copper ore** — 1 copper bar every 4 seconds
   - When both ore types are present, iron is smelted first
3. **Place a Forger** ($50) anywhere. It consumes bars to produce goods:
   - **Dagger** — 1 iron bar, 5 seconds, sells for $20
   - **Armour** — 2 iron bars, 8 seconds, sells for $30
   - **Wand** — 1 copper bar, 6 seconds, sells for $25
   - **Magic Powder** — 3 copper bars, 10 seconds, sells for $60
4. **Connect buildings with Belts** ($5). Click source, then destination. Belts automatically move the right items between buildings (ore to smelters, the correct bar type to forgers based on recipe).
5. **Sell finished goods** from your inventory using the sidebar buttons.

### Profit Ratios

| Product | Ore needed | Bottleneck | $/tick | $/ore |
|---------|-----------|------------|--------|-------|
| Dagger | 2 iron | 6t (mining) | $3.33 | $10.00 |
| Armour | 4 iron | 12t (mining) | $2.50 | $7.50 |
| Wand | 2 copper | 8t (mining) | $3.13 | $12.50 |
| Magic Powder | 6 copper | 24t (mining) | $2.50 | $10.00 |

Iron daggers have the best throughput; copper wands have the best per-ore value; magic powder has the highest single-item value ($60) but the slowest throughput.

### Controls

- Click a **Buy** button in the sidebar, then click a grid cell to place the building
- Click **Belt**, then click source building, then destination building
- Click **Demolish**, then click a building to remove it (50% cost refund)
- Click a **Forger** on the grid to cycle its recipe (D → A → W → P)
- Press **Cancel** or buy another item to exit placement mode

### Reading the Grid

| Symbol | Color | Meaning |
|--------|-------|---------|
| Orange square | Orange | Iron ore node |
| Teal square | Teal | Copper ore node |
| **M** | Blue | Miner |
| **S** | Red | Smelter |
| **D** | Green | Forger (dagger recipe) |
| **A** | Green | Forger (armour recipe) |
| **W** | Green | Forger (wand recipe) |
| **P** | Green | Forger (magic powder recipe) |
| Gold line + arrow | Gold | Belt (shows direction) |

Small text above buildings shows current storage (e.g. `3o` = 3 iron ore, `1b` = 1 iron bar, `2co` = 2 copper ore, `1cb` = 1 copper bar). The bar at the bottom of each building shows production progress.

Finished goods from forgers without outgoing belts are automatically collected into your inventory.

## Development

```bash
npm install
npm run dev          # Start client + server in dev mode
npm run test         # Run tests
npm run build        # Production build
```

The client runs on Vite's dev server and proxies `/api` requests to the Express server on port 3001.
