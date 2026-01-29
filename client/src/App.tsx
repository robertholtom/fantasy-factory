import { useEffect, useState, useCallback, useRef } from "react";
import "./App.css";
import { GameState, BuildingType, ForgerRecipe } from "../../shared/types";
import * as api from "./game/api";
import GameCanvas, { PlacementMode } from "./game/GameCanvas";
import HUD from "./game/HUD";

function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [placementMode, setPlacementMode] = useState<PlacementMode>(null);
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout>>();

  const showError = (msg: string) => {
    setError(msg);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setError(null), 3000);
  };

  // Poll game state
  useEffect(() => {
    const poll = () => api.getGameState().then(setState).catch(() => {});
    poll();
    const id = setInterval(poll, 500);
    return () => clearInterval(id);
  }, []);

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
    async (x: number, y: number) => {
      if (placementMode?.kind !== "building") return;
      const result = await api.placeBuilding(placementMode.buildingType, { x, y });
      if (result.error) {
        showError(result.error);
      } else if (result.state) {
        setState(result.state);
      }
      setPlacementMode(null);
      setGhostPos(null);
    },
    [placementMode]
  );

  const handlePlaceBelt = useCallback(
    async (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const result = await api.placeBelt(from, to);
      if (result.error) {
        showError(result.error);
      } else if (result.state) {
        setState(result.state);
      }
      setPlacementMode(null);
      setGhostPos(null);
    },
    []
  );

  const handleStartDemolish = useCallback(() => {
    setPlacementMode({ kind: "demolish" });
    setGhostPos(null);
  }, []);

  const handleDemolish = useCallback(
    async (buildingId: string) => {
      const result = await api.demolishBuilding(buildingId);
      if (result.error) {
        showError(result.error);
      } else if (result.state) {
        setState(result.state);
      }
      setPlacementMode(null);
      setGhostPos(null);
    },
    []
  );

  const handleClickBuilding = useCallback(
    async (buildingId: string) => {
      if (!state) return;
      const building = state.buildings.find((b) => b.id === buildingId);
      if (!building || building.type !== "forger") return;
      const recipeOrder: ForgerRecipe[] = ["dagger", "armour", "wand", "magic_powder"];
      const idx = recipeOrder.indexOf(building.recipe);
      const newRecipe = recipeOrder[(idx + 1) % recipeOrder.length];
      const result = await api.setRecipe(buildingId, newRecipe);
      if (result.error) {
        showError(result.error);
      } else if (result.state) {
        setState(result.state);
      }
    },
    [state]
  );

  const handleHover = useCallback((x: number, y: number) => {
    setGhostPos({ x, y });
  }, []);

  const handleReset = useCallback(async () => {
    const newState = await api.resetGame();
    setState(newState);
    setPlacementMode(null);
    setGhostPos(null);
  }, []);

  const handleCancelPlacement = useCallback(() => {
    setPlacementMode(null);
    setGhostPos(null);
  }, []);

  const handleAutoPlay = useCallback(async () => {
    const result = await api.autoPlay();
    if (result.error) {
      showError(result.error);
    } else if (result.state) {
      setState(result.state);
    }
    setPlacementMode(null);
    setGhostPos(null);
  }, []);

  const handleToggleAiMode = useCallback(async () => {
    const newState = await api.toggleAiMode();
    setState(newState);
  }, []);

  return (
    <div className="app">
      <HUD
        state={state}
        placementMode={placementMode}
        error={error}
        onBuy={handleBuy}
        onStartBelt={handleStartBelt}
        onStartDemolish={handleStartDemolish}
        onReset={handleReset}
        onAutoPlay={handleAutoPlay}
        onToggleAiMode={handleToggleAiMode}
        onCancelPlacement={handleCancelPlacement}
      />
      <div className="canvas-container">
        <GameCanvas
          state={state}
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
