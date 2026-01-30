import { Router } from "express";
import { getState } from "../game/state.js";
import { placeBuilding, placeBelt, setRecipe, demolishBuilding, resetGame, toggleAiMode } from "../game/actions.js";
import { PlaceBuildingRequest, PlaceBeltRequest, SetRecipeRequest, DemolishBuildingRequest } from "../../shared/types.js";

const router = Router();

router.get("/state", (_req, res) => {
  res.json(getState());
});

router.post("/place", (req, res) => {
  const { type, position } = req.body as PlaceBuildingRequest;

  if (!type || !position) {
    res.status(400).json({ error: "Missing type or position" });
    return;
  }

  const { state, error } = placeBuilding(type, position);
  if (error) {
    res.status(400).json({ error, state });
    return;
  }
  res.json(state);
});

router.post("/belt", (req, res) => {
  const { from, to } = req.body as PlaceBeltRequest;

  if (!from || !to) {
    res.status(400).json({ error: "Missing from or to position" });
    return;
  }

  const { state, error } = placeBelt(from, to);
  if (error) {
    res.status(400).json({ error, state });
    return;
  }
  res.json(state);
});

router.post("/recipe", (req, res) => {
  const { buildingId, recipe } = req.body as SetRecipeRequest;

  if (!buildingId || !recipe) {
    res.status(400).json({ error: "Missing buildingId or recipe" });
    return;
  }

  const { state, error } = setRecipe(buildingId, recipe);
  if (error) {
    res.status(400).json({ error, state });
    return;
  }
  res.json(state);
});

router.post("/demolish", (req, res) => {
  const { buildingId } = req.body as DemolishBuildingRequest;

  if (!buildingId) {
    res.status(400).json({ error: "Missing buildingId" });
    return;
  }

  const { state, error } = demolishBuilding(buildingId);
  if (error) {
    res.status(400).json({ error, state });
    return;
  }
  res.json(state);
});

router.post("/reset", (_req, res) => {
  const state = resetGame();
  res.json(state);
});

router.post("/ai-mode", (_req, res) => {
  const { state, error } = toggleAiMode();
  if (error) {
    res.status(400).json({ error, state });
    return;
  }
  res.json(state);
});

export default router;
