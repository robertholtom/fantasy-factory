import { useEffect, useState, useCallback, useRef } from "react";
import "./App.css";
import {
  GameState,
  BuildingType,
  ForgerRecipe,
  GameMeta,
  PrestigeData,
  UpgradeState,
  AutomationSettings,
  OfflineProgress,
} from "../../shared/types";
import * as api from "./game/api";
import GameCanvas, { PlacementMode } from "./game/GameCanvas";
import HUD from "./game/HUD";

const PLAYER_ID = "default"; // Simple single-player for now

function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [meta, setMeta] = useState<GameMeta | null>(null);
  const [prestige, setPrestige] = useState<PrestigeData | null>(null);
  const [upgrades, setUpgrades] = useState<UpgradeState | null>(null);
  const [automation, setAutomation] = useState<AutomationSettings | null>(null);
  const [offlineProgress, setOfflineProgress] = useState<OfflineProgress | null>(null);
  const [placementMode, setPlacementMode] = useState<PlacementMode>(null);
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const errorTimer = useRef<ReturnType<typeof setTimeout>>();

  const showError = (msg: string) => {
    setError(msg);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setError(null), 3000);
  };

  // Load game on startup
  useEffect(() => {
    const load = async () => {
      try {
        const result = await api.loadGame(PLAYER_ID);
        if (result.save) {
          setState(result.save.state);
          setMeta(result.save.meta);
          setPrestige(result.save.prestige);
          setUpgrades(result.save.upgrades);
          setAutomation(result.save.automation);
          if (result.offlineProgress && result.offlineProgress.ticksSimulated > 0) {
            setOfflineProgress(result.offlineProgress);
          }
        }
        setLoaded(true);
      } catch {
        // Fallback to regular state polling
        setLoaded(true);
      }
    };
    load();
  }, []);

  // Poll game state after initial load
  useEffect(() => {
    if (!loaded) return;

    const poll = async () => {
      try {
        const fullState = await api.getFullState();
        setState(fullState.state);
        setMeta(fullState.meta);
        setPrestige(fullState.prestige);
        setUpgrades(fullState.upgrades);
        setAutomation(fullState.automation);
      } catch {
        // Fallback to basic state
        api.getGameState().then(setState).catch(() => {});
      }
    };

    poll();
    const id = setInterval(poll, 500);
    return () => clearInterval(id);
  }, [loaded]);

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

  const handleResetCompletely = useCallback(async () => {
    await api.resetGameCompletely();
    // Full reload to reset all client state
    window.location.reload();
  }, []);

  const handleCancelPlacement = useCallback(() => {
    setPlacementMode(null);
    setGhostPos(null);
  }, []);

  const handleAutomationChange = useCallback(async () => {
    // Refresh automation settings
    const fullState = await api.getFullState();
    setAutomation(fullState.automation);
  }, []);

  const handleDismissOffline = useCallback(() => {
    setOfflineProgress(null);
  }, []);

  return (
    <div className="app">
      <HUD
        state={state}
        meta={meta}
        prestige={prestige}
        upgrades={upgrades}
        automation={automation}
        offlineProgress={offlineProgress}
        placementMode={placementMode}
        error={error}
        onBuy={handleBuy}
        onStartBelt={handleStartBelt}
        onStartDemolish={handleStartDemolish}
        onReset={handleReset}
        onResetCompletely={handleResetCompletely}
        onCancelPlacement={handleCancelPlacement}
        onDismissOffline={handleDismissOffline}
        onAutomationChange={handleAutomationChange}
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
