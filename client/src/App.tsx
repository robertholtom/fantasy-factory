import { useState, useCallback, useRef } from "react";
import "./App.css";
import {
  BuildingType,
  ForgerRecipe,
  Building,
} from "./game/types";
import { useGameEngine } from "./game/useGameEngine";
import GameCanvas, { PlacementMode } from "./game/GameCanvas";
import HUD from "./game/HUD";

function App() {
  const game = useGameEngine();
  const [placementMode, setPlacementMode] = useState<PlacementMode>(null);
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout>>();

  const showError = (msg: string) => {
    setError(msg);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setError(null), 3000);
  };

  const handleBuy = useCallback((type: BuildingType) => {
    setPlacementMode({ kind: "building", buildingType: type });
    setGhostPos(null);
  }, []);

  const handleStartBelt = useCallback(() => {
    setPlacementMode({ kind: "belt", step: "from" });
    setGhostPos(null);
  }, []);

  const handleBeltFrom = useCallback((pos: { x: number; y: number }) => {
    setPlacementMode({ kind: "belt", step: "to", from: pos });
    setGhostPos(null);
  }, []);

  const handlePlaceBuilding = useCallback(
    (x: number, y: number) => {
      if (placementMode?.kind !== "building") return;
      const result = game.placeBuilding(placementMode.buildingType, { x, y });
      if (result.error) {
        showError(result.error);
      }
      setPlacementMode(null);
      setGhostPos(null);
    },
    [placementMode, game]
  );

  const handlePlaceBelt = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const result = game.placeBelt(from, to);
      if (result.error) {
        showError(result.error);
      }
      setPlacementMode(null);
      setGhostPos(null);
    },
    [game]
  );

  const handleStartDemolish = useCallback(() => {
    setPlacementMode({ kind: "demolish" });
    setGhostPos(null);
  }, []);

  const handleDemolish = useCallback(
    (buildingId: string) => {
      const result = game.demolishBuilding(buildingId);
      if (result.error) {
        showError(result.error);
      }
      setPlacementMode(null);
      setGhostPos(null);
    },
    [game]
  );

  const handleClickBuilding = useCallback(
    (buildingId: string) => {
      if (!game.state) return;
      const building = game.state.buildings.find((b) => b.id === buildingId);
      if (!building) return;

      // If clicking the same building, cycle forger recipe
      if (selectedBuilding?.id === buildingId && building.type === "forger") {
        const recipeOrder: ForgerRecipe[] = ["dagger", "armour", "wand", "magic_powder"];
        const idx = recipeOrder.indexOf(building.recipe);
        const newRecipe = recipeOrder[(idx + 1) % recipeOrder.length];
        const result = game.setRecipe(buildingId, newRecipe);
        if (result.error) {
          showError(result.error);
        }
      } else {
        // Select the building
        setSelectedBuilding(building);
      }
    },
    [game, selectedBuilding]
  );

  const handleUpgradeBuilding = useCallback(() => {
    if (!selectedBuilding) return;
    const result = game.upgradeBuilding(selectedBuilding.id);
    if (result.error) {
      showError(result.error);
    } else if (result.state) {
      // Update selected building from new state
      const updated = result.state.buildings.find(b => b.id === selectedBuilding.id);
      setSelectedBuilding(updated || null);
    }
  }, [selectedBuilding, game]);

  const handleDeselectBuilding = useCallback(() => {
    setSelectedBuilding(null);
  }, []);

  const handleHover = useCallback((x: number, y: number) => {
    setGhostPos({ x, y });
  }, []);

  const handleReset = useCallback(() => {
    game.resetGame();
    setPlacementMode(null);
    setGhostPos(null);
  }, [game]);

  const handleResetCompletely = useCallback(() => {
    game.resetGameCompletely();
  }, [game]);

  const handleCancelPlacement = useCallback(() => {
    setPlacementMode(null);
    setGhostPos(null);
  }, []);

  const handleAutomationChange = useCallback(() => {
    game.forceUpdate();
  }, [game]);

  const handleDismissOffline = useCallback(() => {
    game.dismissOfflineProgress();
  }, [game]);

  const handlePurchaseLand = useCallback((side: "right" | "bottom") => {
    const result = game.purchaseLand(side);
    if (result.error) {
      showError(result.error);
    }
  }, [game]);

  return (
    <div className="app">
      <HUD
        state={game.state}
        meta={game.meta}
        prestige={game.prestige}
        upgrades={game.upgrades}
        automation={game.automation}
        offlineProgress={game.offlineProgress}
        placementMode={placementMode}
        error={error}
        selectedBuilding={selectedBuilding}
        onBuy={handleBuy}
        onStartBelt={handleStartBelt}
        onStartDemolish={handleStartDemolish}
        onReset={handleReset}
        onResetCompletely={handleResetCompletely}
        onCancelPlacement={handleCancelPlacement}
        onDismissOffline={handleDismissOffline}
        onAutomationChange={handleAutomationChange}
        onUpgradeBuilding={handleUpgradeBuilding}
        onDeselectBuilding={handleDeselectBuilding}
        onPurchaseLand={handlePurchaseLand}
        gameEngine={game}
      />
      <div className="canvas-container">
        <GameCanvas
          state={game.state}
          placementMode={placementMode}
          onPlaceBuilding={handlePlaceBuilding}
          onPlaceBelt={handlePlaceBelt}
          onBeltFrom={handleBeltFrom}
          onClickBuilding={handleClickBuilding}
          onDemolish={handleDemolish}
          onHover={handleHover}
          ghostPos={ghostPos}
        />
      </div>
    </div>
  );
}

export default App;
