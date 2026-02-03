import { Router } from "express";
import {
  getState,
  getMeta,
  getPrestige,
  getUpgrades,
  getAutomation,
  setAutomation,
  createGame,
  loadGame,
  saveGame,
  getCurrentSave,
} from "../game/state.js";
import { placeBuilding, placeBelt, setRecipe, demolishBuilding, resetGame, resetGameCompletely, applySmartDefaults } from "../game/actions.js";
import {
  PlaceBuildingRequest,
  PlaceBeltRequest,
  SetRecipeRequest,
  DemolishBuildingRequest,
  CreateGameRequest,
  LoadGameRequest,
  UpdateAutomationRequest,
} from "../../shared/types.js";
import { getOfflineSeconds } from "../game/persistence.js";
import { calculateOfflineProgress, applyOfflineProgress } from "../game/offline.js";
import { getPrestigeInfo, performPrestige, purchasePrestigeUpgrade } from "../game/prestige.js";
import { purchaseUpgrade, getUpgradeInfo } from "../game/upgrades.js";
import { BuyPrestigeUpgradeRequest, BuyUpgradeRequest } from "../../shared/types.js";

const router = Router();

router.get("/state", (_req, res) => {
  res.json(getState());
});

// Extended state with idle game data
router.get("/full-state", (_req, res) => {
  const save = getCurrentSave();
  if (!save) {
    res.json({
      state: getState(),
      meta: getMeta(),
      prestige: getPrestige(),
      upgrades: getUpgrades(),
      automation: getAutomation(),
    });
    return;
  }
  res.json({
    state: save.state,
    meta: save.meta,
    prestige: save.prestige,
    upgrades: save.upgrades,
    automation: save.automation,
  });
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

router.post("/reset-completely", (_req, res) => {
  const state = resetGameCompletely();
  res.json(state);
});

// === PERSISTENCE ENDPOINTS ===

router.post("/create", (req, res) => {
  const { playerId } = req.body as CreateGameRequest;

  if (!playerId) {
    res.status(400).json({ error: "Missing playerId" });
    return;
  }

  const { save, error } = createGame(playerId);
  if (error) {
    res.status(400).json({ error });
    return;
  }
  res.json({ save, offlineProgress: null });
});

router.post("/load", (req, res) => {
  const { playerId } = req.body as LoadGameRequest;

  if (!playerId) {
    res.status(400).json({ error: "Missing playerId" });
    return;
  }

  const result = loadGame(playerId);
  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }

  if (!result.save) {
    res.status(404).json({ error: "Save not found" });
    return;
  }

  // Calculate offline progress if not a new save
  let offlineProgress = null;
  if (!result.isNew) {
    const offlineSeconds = getOfflineSeconds(result.save);
    if (offlineSeconds > 60) { // Only calculate if away > 1 minute
      offlineProgress = calculateOfflineProgress(
        result.save.state,
        result.save.meta,
        result.save.upgrades,
        result.save.prestige
      );
      if (offlineProgress.ticksSimulated > 0) {
        applyOfflineProgress(result.save.state, offlineProgress);
        saveGame();
      }
    }
  }

  res.json({ save: result.save, offlineProgress, isNew: result.isNew });
});

router.post("/save", (_req, res) => {
  const result = saveGame();
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ success: true });
});

// === AUTOMATION SETTINGS ===

router.get("/automation", (_req, res) => {
  res.json(getAutomation());
});

router.post("/automation", (req, res) => {
  const { settings } = req.body as UpdateAutomationRequest;

  if (!settings) {
    res.status(400).json({ error: "Missing settings" });
    return;
  }

  const current = getAutomation();
  const updated = { ...current, ...settings };
  setAutomation(updated);
  res.json(updated);
});

router.post("/automation/smart-defaults", (_req, res) => {
  const result = applySmartDefaults();
  res.json(result);
});

// === PRESTIGE ENDPOINTS ===

router.get("/prestige", (_req, res) => {
  res.json(getPrestigeInfo());
});

router.post("/prestige", (_req, res) => {
  const result = performPrestige();
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ success: true, prestige: result.prestige });
});

router.post("/prestige/buy", (req, res) => {
  const { upgradeId } = req.body as BuyPrestigeUpgradeRequest;

  if (!upgradeId) {
    res.status(400).json({ error: "Missing upgradeId" });
    return;
  }

  const result = purchasePrestigeUpgrade(upgradeId);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ success: true, prestige: result.prestige });
});

// === UPGRADE ENDPOINTS ===

router.get("/upgrades", (_req, res) => {
  res.json(getUpgradeInfo());
});

router.post("/upgrades/buy", (req, res) => {
  const { upgradeId } = req.body as BuyUpgradeRequest;

  if (!upgradeId) {
    res.status(400).json({ error: "Missing upgradeId" });
    return;
  }

  const result = purchaseUpgrade(upgradeId);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ success: true, upgrades: result.upgrades, state: result.state });
});

export default router;
