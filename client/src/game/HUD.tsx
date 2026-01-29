import { GameState, BuildingType, BUILDING_COSTS, BELT_COST } from "../../../shared/types";
import { PlacementMode } from "./GameCanvas";

interface Props {
  state: GameState | null;
  placementMode: PlacementMode;
  error: string | null;
  onBuy: (type: BuildingType) => void;
  onStartBelt: () => void;
  onStartDemolish: () => void;
  onReset: () => void;
  onAutoPlay: () => void;
  onToggleAiMode: () => void;
  onCancelPlacement: () => void;
}

export default function HUD({
  state,
  placementMode,
  error,
  onBuy,
  onStartBelt,
  onStartDemolish,
  onReset,
  onAutoPlay,
  onToggleAiMode,
  onCancelPlacement,
}: Props) {
  if (!state) return <div className="hud">Loading...</div>;

  const { currency, inventory } = state;
  const inPlacement = placementMode !== null;

  return (
    <div className="hud">
      <div className="hud-section">
        <h2>Fantasy Factory</h2>
        <div className="currency">Currency: ${currency}</div>
      </div>

      <div className="hud-section">
        <h3>Inventory</h3>
        <div className="inventory">
          <span>Daggers: {inventory.dagger}</span>
          <span>Armour: {inventory.armour}</span>
          <span>Wands: {inventory.wand}</span>
          <span>Magic Powder: {inventory.magic_powder}</span>
        </div>
      </div>

      <div className="hud-section">
        <h3>Buy Buildings</h3>
        <div className="buttons">
          <button
            onClick={() => onBuy("miner")}
            disabled={currency < BUILDING_COSTS.miner || inPlacement}
          >
            Miner ${BUILDING_COSTS.miner}
          </button>
          <button
            onClick={() => onBuy("smelter")}
            disabled={currency < BUILDING_COSTS.smelter || inPlacement}
          >
            Smelter ${BUILDING_COSTS.smelter}
          </button>
          <button
            onClick={() => onBuy("forger")}
            disabled={currency < BUILDING_COSTS.forger || inPlacement}
          >
            Forger ${BUILDING_COSTS.forger}
          </button>
          <button
            onClick={() => onBuy("shop")}
            disabled={currency < BUILDING_COSTS.shop || inPlacement}
          >
            Shop ${BUILDING_COSTS.shop}
          </button>
          <button
            onClick={onStartBelt}
            disabled={currency < BELT_COST || inPlacement}
          >
            Belt ${BELT_COST}
          </button>
          <button
            className="demolish-btn"
            onClick={onStartDemolish}
            disabled={inPlacement || state.buildings.length === 0}
          >
            Demolish (75% refund)
          </button>
        </div>
        {placementMode?.kind === "building" && (
          <div className="placement-info">
            Placing {placementMode.buildingType} — click on grid
            {placementMode.buildingType === "miner" && " (must be on ore node)"}
            <button className="cancel-btn" onClick={onCancelPlacement}>
              Cancel
            </button>
          </div>
        )}
        {placementMode?.kind === "demolish" && (
          <div className="placement-info">
            Click a building to demolish it
            <button className="cancel-btn" onClick={onCancelPlacement}>
              Cancel
            </button>
          </div>
        )}
        {placementMode?.kind === "belt" && (
          <div className="placement-info">
            {placementMode.step === "from"
              ? "Click source building"
              : "Click destination building"}
            <button className="cancel-btn" onClick={onCancelPlacement}>
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="hud-section">
        <h3>How to Play</h3>
        <div className="help-text">
          <p>1. Place miners on ore nodes</p>
          <p>&nbsp;&nbsp;Orange = iron, Teal = copper</p>
          <p>2. Place smelters &amp; forgers</p>
          <p>3. Connect with belts:</p>
          <p>&nbsp;&nbsp;Miner → Smelter → Forger</p>
          <p>4. Click forger to cycle recipe</p>
          <p>&nbsp;&nbsp;D/A = iron, W/P = copper</p>
          <p>5. Place shop &amp; belt forger to it</p>
          <p>6. NPCs arrive to buy goods!</p>
        </div>
        <div className="help-text" style={{ marginTop: "0.5rem", borderTop: "1px solid #333", paddingTop: "0.5rem" }}>
          <p><strong>Controls:</strong></p>
          <p>Scroll: Zoom in/out</p>
          <p>Right-drag: Pan view</p>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <div className="hud-section">
        <button className="autoplay-btn" onClick={onAutoPlay} disabled={inPlacement}>
          Auto-Play (AI Build)
        </button>
        <button
          className={`ai-mode-btn ${state.aiMode ? "active" : ""}`}
          onClick={onToggleAiMode}
        >
          AI Mode: {state.aiMode ? "ON" : "OFF"}
        </button>
        <button className="reset-btn" onClick={onReset}>
          Reset Game
        </button>
      </div>
    </div>
  );
}
