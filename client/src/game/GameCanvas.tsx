import { useRef, useEffect, useCallback, useState } from "react";
import { GameState, BuildingType } from "../../../shared/types";
import { render } from "./renderer";
import { canvasToGrid } from "./input";

interface ViewState {
  zoom: number;
  panX: number;
  panY: number;
}

type PlacementMode =
  | { kind: "building"; buildingType: BuildingType }
  | { kind: "belt"; step: "from" | "to"; from?: { x: number; y: number } }
  | { kind: "demolish" }
  | null;

interface Props {
  state: GameState | null;
  placementMode: PlacementMode;
  onPlaceBuilding: (x: number, y: number) => void;
  onPlaceBelt: (from: { x: number; y: number }, to: { x: number; y: number }) => void;
  onBeltFrom: (pos: { x: number; y: number }) => void;
  onClickBuilding: (buildingId: string) => void;
  onDemolish: (buildingId: string) => void;
  onHover: (x: number, y: number) => void;
  ghostPos: { x: number; y: number } | null;
}

export type { PlacementMode };

export default function GameCanvas({
  state,
  placementMode,
  onPlaceBuilding,
  onPlaceBelt,
  onBeltFrom,
  onClickBuilding,
  onDemolish,
  onHover,
  ghostPos,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);
  const isPanningRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  const [view, setView] = useState<ViewState>({ zoom: 1, panX: 0, panY: 0 });

  // Base cell size without zoom
  const getBaseCellSize = useCallback(() => {
    if (!state || !canvasRef.current) return 32;
    const canvas = canvasRef.current;
    return Math.min(canvas.width / state.mapWidth, canvas.height / state.mapHeight);
  }, [state]);

  // Effective cell size with zoom
  const getCellSize = useCallback(() => {
    return getBaseCellSize() * view.zoom;
  }, [getBaseCellSize, view.zoom]);

  // Track tick changes to sync animation
  useEffect(() => {
    if (state) {
      lastTickRef.current = Date.now();
    }
  }, [state?.tick]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !state) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let running = true;

    const animate = () => {
      if (!running) return;

      const cellSize = getCellSize();

      const buildingGhost =
        placementMode?.kind === "building" && ghostPos
          ? { type: placementMode.buildingType, x: ghostPos.x, y: ghostPos.y }
          : null;

      const beltStart =
        placementMode?.kind === "belt" && placementMode.step === "to" && placementMode.from
          ? placementMode.from
          : null;

      const beltGhostEnd =
        beltStart && ghostPos ? ghostPos : null;

      // Calculate animation progress (0-1) within the current tick cycle
      const elapsed = Date.now() - lastTickRef.current;
      const tickDuration = 1000; // 1 second per tick
      const animationProgress = Math.min(elapsed / tickDuration, 1);

      // Clear and apply zoom/pan transformations
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(view.zoom, 0, 0, view.zoom, view.panX, view.panY);

      render(ctx, state, getBaseCellSize(), buildingGhost, beltStart, beltGhostEnd, animationProgress);

      // Reset transform for any UI overlays
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      animRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [state, placementMode, ghostPos, getCellSize, getBaseCellSize, view]);

  // Resize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };

    resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  // Convert screen coordinates to grid position accounting for zoom/pan
  const screenToGrid = useCallback((screenX: number, screenY: number) => {
    const cellSize = getBaseCellSize();
    // Reverse the transform: subtract pan, then divide by zoom
    const worldX = (screenX - view.panX) / view.zoom;
    const worldY = (screenY - view.panY) / view.zoom;
    return canvasToGrid(worldX, worldY, cellSize);
  }, [getBaseCellSize, view]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!state) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Don't process click if we were panning
    if (isPanningRef.current) {
      isPanningRef.current = false;
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const pos = screenToGrid(e.clientX - rect.left, e.clientY - rect.top);

    if (pos.x < 0 || pos.x >= state.mapWidth || pos.y < 0 || pos.y >= state.mapHeight) return;

    if (!placementMode) {
      // Click on a forger to cycle its recipe
      const building = state.buildings.find(
        (b) => b.position.x === pos.x && b.position.y === pos.y && b.type === "forger"
      );
      if (building) {
        onClickBuilding(building.id);
      }
      return;
    }

    if (placementMode.kind === "demolish") {
      const building = state.buildings.find(
        (b) => b.position.x === pos.x && b.position.y === pos.y
      );
      if (building) {
        onDemolish(building.id);
      }
      return;
    }

    if (placementMode.kind === "building") {
      onPlaceBuilding(pos.x, pos.y);
    } else if (placementMode.kind === "belt") {
      if (placementMode.step === "from") {
        onBeltFrom(pos);
      } else if (placementMode.step === "to" && placementMode.from) {
        onPlaceBelt(placementMode.from, pos);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Handle panning with middle mouse or right mouse button
    if (e.buttons === 4 || e.buttons === 2) {
      const dx = mouseX - lastMouseRef.current.x;
      const dy = mouseY - lastMouseRef.current.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        isPanningRef.current = true;
      }
      setView(v => ({
        ...v,
        panX: v.panX + dx,
        panY: v.panY + dy,
      }));
    }

    lastMouseRef.current = { x: mouseX, y: mouseY };

    // Update hover for placement mode
    if (placementMode && state) {
      const pos = screenToGrid(mouseX, mouseY);
      onHover(pos.x, pos.y);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Zoom in/out
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.max(0.5, Math.min(3, view.zoom * zoomFactor));

    // Adjust pan to zoom towards mouse position
    const zoomRatio = newZoom / view.zoom;
    const newPanX = mouseX - (mouseX - view.panX) * zoomRatio;
    const newPanY = mouseY - (mouseY - view.panY) * zoomRatio;

    setView({
      zoom: newZoom,
      panX: newPanX,
      panY: newPanY,
    });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent context menu when right-click panning
  };

  const cursorStyle = placementMode ? "crosshair" : "grab";

  return (
    <canvas
      ref={canvasRef}
      className="game-canvas"
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onWheel={handleWheel}
      onContextMenu={handleContextMenu}
      style={{ cursor: cursorStyle }}
    />
  );
}
