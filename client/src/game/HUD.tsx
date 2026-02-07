import { useState, useEffect } from "react";
import {
  GameState,
  BuildingType,
  Building,
  BUILDING_COSTS,
  BELT_COST,
  GEOLOGIST_MAX_COUNT,
  GEOLOGIST_UPKEEP,
  BASE_LAND_COST,
  LAND_COST_MULTIPLIER,
  PrestigeData,
  UpgradeState,
  AutomationSettings,
  GameMeta,
  OfflineProgress,
  PRESTIGE_UPGRADES,
  PrestigeUpgradeId,
  SELL_PRICES,
  UPGRADE_COSTS,
  MAX_UPGRADE_LEVEL,
  UPGRADE_SPEED_BONUS,
  SorterFilter,
} from "./types";
import { ITEM_ICONS } from "./icons";
import { PlacementMode } from "./GameCanvas";
import { GameEngine, PrestigeInfo, UpgradeInfo } from "./useGameEngine";

interface Props {
  state: GameState | null;
  meta: GameMeta | null;
  prestige: PrestigeData | null;
  upgrades: UpgradeState | null;
  automation: AutomationSettings | null;
  offlineProgress: OfflineProgress | null;
  placementMode: PlacementMode;
  error: string | null;
  selectedBuilding: Building | null;
  onBuy: (type: BuildingType) => void;
  onStartBelt: () => void;
  onStartDemolish: () => void;
  onReset: () => void;
  onResetCompletely: () => void;
  onCancelPlacement: () => void;
  onDismissOffline: () => void;
  onAutomationChange: () => void;
  onUpgradeBuilding: () => void;
  onDeselectBuilding: () => void;
  onPurchaseLand: (side: "right" | "bottom") => void;
  gameEngine: GameEngine;
}

type Tab = "main" | "upgrades" | "prestige" | "automation";

export default function HUD({
  state,
  meta,
  prestige,
  upgrades,
  automation,
  offlineProgress,
  placementMode,
  error,
  selectedBuilding,
  onBuy,
  onStartBelt,
  onStartDemolish,
  onReset,
  onResetCompletely,
  onCancelPlacement,
  onDismissOffline,
  onAutomationChange,
  onUpgradeBuilding,
  onDeselectBuilding,
  onPurchaseLand,
  gameEngine,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("main");
  const [prestigeInfo, setPrestigeInfo] = useState<PrestigeInfo | null>(null);
  const [upgradeInfo, setUpgradeInfo] = useState<UpgradeInfo | null>(null);
  const [localAutomation, setLocalAutomation] = useState<AutomationSettings | null>(null);
  const [completeResetConfirm, setCompleteResetConfirm] = useState(false);

  useEffect(() => {
    if (activeTab === "prestige") {
      setPrestigeInfo(gameEngine.getPrestigeInfo());
    } else if (activeTab === "upgrades") {
      setUpgradeInfo(gameEngine.getUpgradeInfo());
    }
  }, [activeTab, gameEngine]);

  useEffect(() => {
    if (automation) {
      setLocalAutomation(automation);
    }
  }, [automation]);

  if (!state) return <div className="hud">Loading...</div>;

  const { currency } = state;
  const inPlacement = placementMode !== null;

  // Offline progress modal
  if (offlineProgress && offlineProgress.ticksSimulated > 0) {
    const hours = Math.floor(offlineProgress.ticksSimulated / 3600);
    const minutes = Math.floor((offlineProgress.ticksSimulated % 3600) / 60);

    return (
      <div className="hud">
        <div className="offline-modal">
          <h2>Welcome Back!</h2>
          <p>You were away for {hours > 0 ? `${hours}h ` : ""}{minutes}m</p>
          <p>Efficiency: {Math.round(offlineProgress.efficiency * 100)}%</p>
          <div className="offline-earnings">
            <p>Currency earned: ${offlineProgress.currencyEarned}</p>
            {Object.entries(offlineProgress.itemsProduced)
              .filter(([, count]) => count > 0)
              .map(([item, count]) => (
                <p key={item}>{item}: +{count}</p>
              ))}
          </div>
          <button onClick={onDismissOffline}>Continue</button>
        </div>
      </div>
    );
  }

  const renderTabs = () => (
    <div className="hud-tabs">
      <button
        className={activeTab === "main" ? "active" : ""}
        onClick={() => setActiveTab("main")}
      >
        Main
      </button>
      <button
        className={activeTab === "upgrades" ? "active" : ""}
        onClick={() => setActiveTab("upgrades")}
      >
        Upgrades
      </button>
      <button
        className={activeTab === "prestige" ? "active" : ""}
        onClick={() => setActiveTab("prestige")}
      >
        Prestige
      </button>
      <button
        className={activeTab === "automation" ? "active" : ""}
        onClick={() => setActiveTab("automation")}
      >
        Auto
      </button>
    </div>
  );

  const renderMainTab = () => (
    <>
      <div className="hud-section">
        <h2>Fantasy Factory</h2>
        <div className="currency">Currency: ${currency}</div>
        {meta && (
          <div className="stats">
            <small>Total earned: ${meta.totalCurrencyEarned}</small>
          </div>
        )}
        {prestige && prestige.starEssence > 0 && (
          <div className="star-essence">Star Essence: {prestige.starEssence}</div>
        )}
      </div>

      {selectedBuilding && (
        <div className="hud-section building-upgrade-panel">
          <h3>Selected: {selectedBuilding.type}</h3>
          <div className="upgrade-info">
            <p>Level: {selectedBuilding.upgradeLevel ?? 0} / {MAX_UPGRADE_LEVEL}</p>
            <p>Speed: x{Math.pow(UPGRADE_SPEED_BONUS, selectedBuilding.upgradeLevel ?? 0).toFixed(2)}</p>
            {(selectedBuilding.upgradeLevel ?? 0) < MAX_UPGRADE_LEVEL ? (
              <>
                <p>Next upgrade: ${UPGRADE_COSTS[selectedBuilding.upgradeLevel ?? 0]}</p>
                <button
                  onClick={onUpgradeBuilding}
                  disabled={currency < UPGRADE_COSTS[selectedBuilding.upgradeLevel ?? 0] || selectedBuilding.constructionProgress < 1}
                >
                  Upgrade
                </button>
              </>
            ) : (
              <p className="max-level">MAX LEVEL</p>
            )}
            {selectedBuilding.type === "sorter" && (
              <div className="sorter-filter">
                <label>
                  Filter:
                  <select
                    value={selectedBuilding.sorterFilter ?? "all"}
                    onChange={(e) => {
                      gameEngine.setSorterFilter(selectedBuilding.id, e.target.value as SorterFilter);
                    }}
                  >
                    <optgroup label="Categories">
                      <option value="all">All Items</option>
                      <option value="ore">Ores</option>
                      <option value="bar">Bars</option>
                      <option value="finished">Finished Goods</option>
                    </optgroup>
                    <optgroup label="Specific Items">
                      <option value="iron_ore">Iron Ore</option>
                      <option value="copper_ore">Copper Ore</option>
                      <option value="iron_bar">Iron Bar</option>
                      <option value="copper_bar">Copper Bar</option>
                      <option value="dagger">Dagger</option>
                      <option value="armour">Armour</option>
                      <option value="wand">Wand</option>
                      <option value="magic_powder">Magic Powder</option>
                    </optgroup>
                  </select>
                </label>
              </div>
            )}
            <button className="deselect-btn" onClick={onDeselectBuilding}>Close</button>
          </div>
        </div>
      )}

      <div className="hud-section">
        <h3>Shop Stock</h3>
        <div className="inventory icon-grid">
          {(() => {
            const shops = state.buildings.filter(b => b.type === "shop");
            const stock = { dagger: 0, armour: 0, wand: 0, magic_powder: 0 };
            for (const shop of shops) {
              stock.dagger += shop.storage.dagger;
              stock.armour += shop.storage.armour;
              stock.wand += shop.storage.wand;
              stock.magic_powder += shop.storage.magic_powder;
            }
            const items: Array<{key: string; count: number; label: string}> = [
              { key: "dagger", count: stock.dagger, label: "Dagger" },
              { key: "armour", count: stock.armour, label: "Armour" },
              { key: "wand", count: stock.wand, label: "Wand" },
              { key: "magic_powder", count: stock.magic_powder, label: "Magic Powder" },
            ];
            return items.map(item => (
              <div key={item.key} className="stock-item" title={item.label}>
                <img src={ITEM_ICONS[item.key]} alt={item.label} className="item-icon" />
                <span className="item-count">{item.count}</span>
              </div>
            ));
          })()}
        </div>
      </div>

      {(() => {
        const shops = state.buildings.filter(b => b.type === "shop");
        const allNpcs = shops.flatMap(s => s.npcQueue);
        if (allNpcs.length === 0) return null;
        return (
          <div className="hud-section">
            <h3>Customers ({allNpcs.length})</h3>
            <div className="npc-queue">
              {allNpcs.map(npc => (
                <div key={npc.id} className={`npc-item npc-${npc.npcType}`}>
                  <span className="npc-type">{npc.npcType}</span>
                  <span className="npc-wants">
                    {npc.npcType === "king" && npc.kingDemand ? (
                      npc.kingDemand.items.map(({ item, quantity }) => (
                        <span key={item} className="king-demand-item">
                          {quantity}x<img src={ITEM_ICONS[item]} alt={item} className="item-icon-small" />
                        </span>
                      ))
                    ) : npc.multiItemDemand ? (
                      npc.multiItemDemand.items.map(({ item, quantity }) => (
                        <span key={item} className="multi-demand-item">
                          {quantity}x<img src={ITEM_ICONS[item]} alt={item} className="item-icon-small" />
                        </span>
                      ))
                    ) : (
                      <img src={ITEM_ICONS[npc.wantedItem]} alt={npc.wantedItem} className="item-icon-small" />
                    )}
                  </span>
                  <span className="npc-patience">{npc.patienceLeft}/{npc.maxPatience}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {state.kingPenaltyTicksLeft > 0 && (
        <div className="hud-section penalty-warning">
          <strong>Bad Publicity!</strong>
          <p>{state.kingPenaltyTicksLeft} ticks remaining (25% NPC spawns)</p>
        </div>
      )}

      {(() => {
        const shops = state.buildings.filter(b => b.type === "shop");
        const allNpcs = shops.flatMap(s => s.npcQueue);
        const king = allNpcs.find(n => n.npcType === "king");
        if (!king || !king.kingDemand) return null;
        return (
          <div className="hud-section king-section">
            <h3>The King</h3>
            <div className="king-demand">
              <p><strong>Demands:</strong></p>
              {king.kingDemand.items.map(({ item, quantity }) => (
                <div key={item} className="demand-item">
                  {quantity}x {item.replace("_", " ")}
                </div>
              ))}
              <p className="king-reward">Reward: ${Math.round(king.kingDemand.totalValue)}</p>
              <p className="king-patience">Patience: {king.patienceLeft}/{king.maxPatience}</p>
            </div>
          </div>
        );
      })()}

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
            onClick={() => onBuy("warehouse")}
            disabled={currency < BUILDING_COSTS.warehouse || inPlacement}
          >
            Warehouse ${BUILDING_COSTS.warehouse}
          </button>
          <button
            onClick={() => onBuy("geologist")}
            disabled={
              currency < BUILDING_COSTS.geologist ||
              inPlacement ||
              state.buildings.filter(b => b.type === "geologist").length >= GEOLOGIST_MAX_COUNT
            }
            title={`Finds new ore nodes. Upkeep: $${GEOLOGIST_UPKEEP}/tick`}
          >
            Geologist ${BUILDING_COSTS.geologist}
          </button>
          <button
            onClick={() => onBuy("junction")}
            disabled={currency < BUILDING_COSTS.junction || inPlacement}
            title="Pass-through node for routing items"
          >
            Junction ${BUILDING_COSTS.junction}
          </button>
          <button
            onClick={() => onBuy("sorter")}
            disabled={currency < BUILDING_COSTS.sorter || inPlacement}
            title="Filtered junction - only accepts configured items"
          >
            Sorter ${BUILDING_COSTS.sorter}
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
        <h3>Expand Map</h3>
        <div className="buttons">
          {(() => {
            const landCost = Math.floor(BASE_LAND_COST * Math.pow(LAND_COST_MULTIPLIER, state.tilesPurchased));
            return (
              <>
                <button
                  onClick={() => onPurchaseLand("right")}
                  disabled={currency < landCost || inPlacement}
                >
                  Expand Right ${landCost}
                </button>
                <button
                  onClick={() => onPurchaseLand("bottom")}
                  disabled={currency < landCost || inPlacement}
                >
                  Expand Down ${landCost}
                </button>
              </>
            );
          })()}
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

      {error && <div className="error-msg">{error}</div>}

      <div className="hud-section">
        <button className="reset-btn" onClick={onReset}>
          Reset Game
        </button>
        {!completeResetConfirm ? (
          <button
            className="reset-btn reset-completely-btn"
            onClick={() => setCompleteResetConfirm(true)}
          >
            Reset Completely
          </button>
        ) : (
          <div className="reset-confirm">
            <p>This will erase ALL progress including prestige!</p>
            <button
              className="reset-btn reset-confirm-btn"
              onClick={() => {
                setCompleteResetConfirm(false);
                onResetCompletely();
              }}
            >
              Confirm Full Reset
            </button>
            <button
              className="cancel-btn"
              onClick={() => setCompleteResetConfirm(false)}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </>
  );

  const renderUpgradesTab = () => {
    if (!upgradeInfo) return <div className="hud-section">Loading...</div>;

    return (
      <div className="hud-section upgrades-panel">
        <h3>Upgrades</h3>
        <p className="currency-display">Currency: ${currency}</p>

        {upgradeInfo.available.length === 0 && upgradeInfo.purchased.length === 0 && (
          <p>No upgrades available yet.</p>
        )}

        {upgradeInfo.available.map((id) => {
          const def = upgradeInfo.definitions[id];
          const canAfford = currency >= def.cost;
          return (
            <div key={id} className={`upgrade-item ${canAfford ? "available" : "locked"}`}>
              <div className="upgrade-header">
                <span className="upgrade-name">{def.name}</span>
                <span className="upgrade-cost">${def.cost}</span>
              </div>
              <p className="upgrade-desc">{def.description}</p>
              <button
                disabled={!canAfford}
                onClick={() => {
                  const result = gameEngine.buyUpgrade(id);
                  if (result.success) {
                    setUpgradeInfo(gameEngine.getUpgradeInfo());
                  }
                }}
              >
                Buy
              </button>
            </div>
          );
        })}

        {upgradeInfo.purchased.length > 0 && (
          <>
            <h4>Purchased</h4>
            {upgradeInfo.purchased.map((id) => {
              const def = upgradeInfo.definitions[id];
              return (
                <div key={id} className="upgrade-item purchased">
                  <span className="upgrade-name">{def.name}</span>
                  <span className="checkmark">✓</span>
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  };

  const renderPrestigeTab = () => {
    if (!prestigeInfo) return <div className="hud-section">Loading...</div>;

    const prestigeUpgradeIds: PrestigeUpgradeId[] = [
      "swift_production",
      "merchant_favor",
      "inheritance",
      "tireless_workers",
      "express_belts_prestige",
    ];

    return (
      <div className="hud-section prestige-panel">
        <h3>Prestige</h3>
        <div className="prestige-stats">
          <p>Star Essence: {prestigeInfo.starEssence}</p>
          <p>Times prestiged: {prestigeInfo.prestigeCount}</p>
        </div>

        <div className="prestige-action">
          {prestigeInfo.canPrestige ? (
            <>
              <p>Prestige now for +{prestigeInfo.potentialEssence} Star Essence</p>
              <button
                className="prestige-btn"
                onClick={() => {
                  const result = gameEngine.performPrestige();
                  if (result.success) {
                    setPrestigeInfo(gameEngine.getPrestigeInfo());
                    window.location.reload();
                  }
                }}
              >
                Prestige
              </button>
            </>
          ) : (
            <p>Earn $5000+ total to prestige</p>
          )}
        </div>

        <h4>Prestige Upgrades</h4>
        {prestigeUpgradeIds.map((id) => {
          const upgrade = PRESTIGE_UPGRADES[id];
          const level = prestigeInfo.upgradeLevels[id];
          const maxed = level >= upgrade.maxLevel;
          const canAfford = prestigeInfo.starEssence >= upgrade.costPerLevel;

          return (
            <div key={id} className={`prestige-upgrade ${maxed ? "maxed" : canAfford ? "available" : "locked"}`}>
              <div className="upgrade-header">
                <span className="upgrade-name">{upgrade.name}</span>
                <span className="upgrade-level">{level}/{upgrade.maxLevel}</span>
              </div>
              <p className="upgrade-desc">{upgrade.description}</p>
              {!maxed && (
                <button
                  disabled={!canAfford}
                  onClick={() => {
                    const result = gameEngine.buyPrestigeUpgrade(id);
                    if (result.success) {
                      setPrestigeInfo(gameEngine.getPrestigeInfo());
                    }
                  }}
                >
                  Buy ({upgrade.costPerLevel} SE)
                </button>
              )}
            </div>
          );
        })}

        <h4>Current Bonuses</h4>
        <div className="bonus-list">
          <p>Production: x{prestigeInfo.bonuses.productionSpeed.toFixed(2)}</p>
          <p>Sell Price: x{prestigeInfo.bonuses.sellPrice.toFixed(2)}</p>
          <p>Starting $: +{prestigeInfo.bonuses.startingCurrency}</p>
          <p>Offline: x{prestigeInfo.bonuses.offlineEfficiency.toFixed(2)}</p>
          <p>Belt Speed: x{prestigeInfo.bonuses.beltSpeed.toFixed(2)}</p>
        </div>
      </div>
    );
  };

  const renderAutomationTab = () => {
    if (!localAutomation) return <div className="hud-section">Loading...</div>;

    const hasAutoRecipe = upgrades?.purchased.includes("auto_recipe") ?? false;

    const toggle = (key: keyof AutomationSettings) => {
      const newValue = !localAutomation[key];
      const updated = { ...localAutomation, [key]: newValue };
      setLocalAutomation(updated);
      gameEngine.updateAutomation({ [key]: newValue });
    };

    const setReserve = (value: number) => {
      const updated = { ...localAutomation, reserveCurrency: value };
      setLocalAutomation(updated);
      gameEngine.updateAutomation({ reserveCurrency: value });
    };

    const setPriority = (value: "iron" | "copper" | "balanced") => {
      const updated = { ...localAutomation, priorityOreType: value };
      setLocalAutomation(updated);
      gameEngine.updateAutomation({ priorityOreType: value });
    };

    const handleSmartDefaults = () => {
      const result = gameEngine.applySmartDefaults();
      setLocalAutomation(result);
      onAutomationChange();
    };

    return (
      <div className="hud-section automation-panel">
        <h3>Automation</h3>

        <button
          className="smart-defaults-btn"
          onClick={handleSmartDefaults}
        >
          Smart Defaults
        </button>

        <div className="auto-toggle">
          <label>
            <input
              type="checkbox"
              checked={localAutomation.enabled}
              onChange={() => toggle("enabled")}
            />
            Enable Automation
          </label>
        </div>

        <h4>Buildings</h4>

        <div className="auto-toggle">
          <label>
            <input
              type="checkbox"
              checked={localAutomation.autoPlaceMiner}
              onChange={() => toggle("autoPlaceMiner")}
              disabled={!localAutomation.enabled}
            />
            Auto Miners
          </label>
        </div>

        <div className="auto-toggle">
          <label>
            <input
              type="checkbox"
              checked={localAutomation.autoPlaceSmelter}
              onChange={() => toggle("autoPlaceSmelter")}
              disabled={!localAutomation.enabled}
            />
            Auto Smelters
          </label>
        </div>

        <div className="auto-toggle">
          <label>
            <input
              type="checkbox"
              checked={localAutomation.autoPlaceForger}
              onChange={() => toggle("autoPlaceForger")}
              disabled={!localAutomation.enabled}
            />
            Auto Forgers
          </label>
        </div>

        <div className="auto-toggle">
          <label>
            <input
              type="checkbox"
              checked={localAutomation.autoPlaceShop ?? false}
              onChange={() => toggle("autoPlaceShop")}
              disabled={!localAutomation.enabled}
            />
            Auto Shops
          </label>
        </div>

        <div className="auto-toggle">
          <label>
            <input
              type="checkbox"
              checked={localAutomation.autoPlaceBelt}
              onChange={() => toggle("autoPlaceBelt")}
              disabled={!localAutomation.enabled}
            />
            Auto Belts
          </label>
        </div>

        <div className="auto-toggle">
          <label>
            <input
              type="checkbox"
              checked={localAutomation.autoPlaceWarehouse ?? false}
              onChange={() => toggle("autoPlaceWarehouse")}
              disabled={!localAutomation.enabled}
            />
            Auto Warehouses
          </label>
        </div>

        <div className="auto-toggle">
          <label>
            <input
              type="checkbox"
              checked={localAutomation.autoPlaceGeologist ?? false}
              onChange={() => toggle("autoPlaceGeologist")}
              disabled={!localAutomation.enabled}
            />
            Auto Geologists
          </label>
        </div>

        <div className="auto-toggle">
          <label>
            <input
              type="checkbox"
              checked={localAutomation.autoPlaceJunction ?? false}
              onChange={() => toggle("autoPlaceJunction")}
              disabled={!localAutomation.enabled}
            />
            Auto Junctions
          </label>
        </div>

        <div className="auto-toggle">
          <label>
            <input
              type="checkbox"
              checked={localAutomation.autoPlaceSorter ?? false}
              onChange={() => toggle("autoPlaceSorter")}
              disabled={!localAutomation.enabled}
            />
            Auto Sorters
          </label>
        </div>

        <h4>Strategy</h4>

        <div className="auto-toggle">
          <label>
            <input
              type="checkbox"
              checked={localAutomation.buildCompleteChains ?? false}
              onChange={() => toggle("buildCompleteChains")}
              disabled={!localAutomation.enabled}
            />
            Build Complete Chains
          </label>
        </div>

        <div className="auto-toggle">
          <label>
            <input
              type="checkbox"
              checked={localAutomation.useROICalculations ?? false}
              onChange={() => toggle("useROICalculations")}
              disabled={!localAutomation.enabled}
            />
            Use ROI Calculations
          </label>
        </div>

        <div className="auto-toggle">
          <label>
            <input
              type="checkbox"
              checked={localAutomation.saveForBetterOptions ?? false}
              onChange={() => toggle("saveForBetterOptions")}
              disabled={!localAutomation.enabled}
            />
            Save for Better Options
          </label>
        </div>

        <div className="auto-toggle">
          <label>
            <input
              type="checkbox"
              checked={localAutomation.useHubRouting ?? false}
              onChange={() => toggle("useHubRouting")}
              disabled={!localAutomation.enabled}
            />
            Use Hub Routing
          </label>
        </div>

        <div className="auto-toggle">
          <label>
            <input
              type="checkbox"
              checked={localAutomation.useAdvancedRecipeLogic ?? false}
              onChange={() => toggle("useAdvancedRecipeLogic")}
              disabled={!localAutomation.enabled || !hasAutoRecipe}
            />
            Advanced Recipe Logic {!hasAutoRecipe && "(Unlock)"}
          </label>
        </div>

        <div className="auto-toggle">
          <label>
            <input
              type="checkbox"
              checked={localAutomation.autoRecipeSwitch}
              onChange={() => toggle("autoRecipeSwitch")}
              disabled={!localAutomation.enabled || !hasAutoRecipe}
            />
            Auto Recipe Switch {!hasAutoRecipe && "(Unlock)"}
          </label>
        </div>

        <h4>Settings</h4>

        <div className="auto-setting">
          <label>
            Priority Ore:
            <select
              value={localAutomation.priorityOreType}
              onChange={(e) => setPriority(e.target.value as "iron" | "copper" | "balanced")}
              disabled={!localAutomation.enabled}
            >
              <option value="balanced">Balanced</option>
              <option value="iron">Iron</option>
              <option value="copper">Copper</option>
            </select>
          </label>
        </div>

        <div className="auto-setting">
          <label>
            Reserve Currency:
            <input
              type="number"
              value={localAutomation.reserveCurrency}
              onChange={(e) => setReserve(parseInt(e.target.value) || 0)}
              disabled={!localAutomation.enabled}
              min={0}
              step={50}
            />
          </label>
        </div>
      </div>
    );
  };

  return (
    <div className="hud">
      {renderTabs()}
      {activeTab === "main" && renderMainTab()}
      {activeTab === "upgrades" && renderUpgradesTab()}
      {activeTab === "prestige" && renderPrestigeTab()}
      {activeTab === "automation" && renderAutomationTab()}
    </div>
  );
}
