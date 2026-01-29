import { BuildingType, Position } from "../../../shared/types";

export interface PlacementMode {
  active: boolean;
  buildingType: BuildingType | null;
}

export function createPlacementMode(): PlacementMode {
  return { active: false, buildingType: null };
}

export function canvasToGrid(
  canvasX: number,
  canvasY: number,
  cellSize: number
): Position {
  return {
    x: Math.floor(canvasX / cellSize),
    y: Math.floor(canvasY / cellSize),
  };
}
