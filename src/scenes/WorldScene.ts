import Phaser from "phaser";
import { preloadUiAssets } from "../ui/assets";
import { installSceneTheme } from "../ui/theme";
import { pals } from "../data/loadPals";
import { loadGame, saveGame } from "../player/playerState";
import {
  getEncounterLevelFloor,
  getTimePeriod,
  getZoneAtTile,
  pickEncounter,
  type WorldZone,
} from "../world/encounters";
import {
  TILE_ENCOUNTER,
  TILE_SIZE,
  TILE_WALL,
  WORLD_COLS,
  WORLD_ROWS,
  createWorldMap,
} from "../world/worldMap";
import type { Pal } from "../types/pal";
import { startScene } from "./sceneLoader";
import {
  getHighlandUnlockStatus,
  getStartideUnlockStatus,
  HIGHLAND_REGION,
  isWorldRegion,
  STARTING_REGION,
  STARTIDE_REGION,
  unlockHighlandRegion,
  unlockStartideRegion,
  type WorldRegion,
} from "../world/regions";
import { canChallengeBoss, getQuestViews, recordQuestEvent } from "../quests/questSystem";
import { recordNpcTalk, recordSideQuestEvent } from "../quests/sideQuests";
import { bossesById, getBossesForRegion } from "../battle/bosses";
import {
  EXPLORE_GATES,
  HIDDEN_CHESTS,
  canOpenGate,
  openGate,
  isHiddenChestAvailable,
} from "../explore/gates";
import { ELITES, getElitesForRegion, isEliteDefeated, canRebattleElite } from "../explore/elites";
import { SETTLEMENT_NPCS, HEAL_COST } from "../world/settlementContent";
import {
  STARTIDE_DISCOVERIES,
  STARTIDE_CHESTS,
  STARTIDE_WAYPOINTS,
  STARTIDE_RARE_SPAWN,
  STARTIDE_BOSS_ALTARS,
  getTidePhase,
  getFogSectorAtTile,
  isSporeHazardActive,
  isStartideRegion,
  startideExplorationCompletion,
} from "../world/startideContent.ts";
import { createPatrolPath, type AutoExploreSession, type GridPoint } from "../world/autoExploration";
import { createTextButton } from "../ui/button";
import { announceGameStatus } from "../ui/accessibility";

interface WorldSceneData {
  region?: WorldRegion;
  playerX?: number;
  playerY?: number;
  leaderId?: number;
  leaderUid?: string;
  encounterCooldown?: boolean;
  gathered?: number;
  collectedResourceIds?: string[];
  discoveredLocationIds?: string[];
  claimedWorldRewardIds?: string[];
  activatedWaypointIds?: string[];
  revealedSectorIds?: string[];
  autoExplore?: AutoExploreSession;
}

interface NpcNode {
  id: string;
  node: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
}

interface GateNode {
  id: string;
  node: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
}

interface EliteNode {
  id: string;
  node: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
}

interface ResourceNode {
  id: string;
  x: number;
  y: number;
  label: string;
}

interface RegionPortal {
  x: number;
  y: number;
  target: WorldRegion;
  arrivalX: number;
  label: string;
  color: number;
}

const REGION_RESOURCES: Record<WorldRegion, ResourceNode[]> = {
  frontier: [
    { id: "frontier-wood-1", x: 7 * TILE_SIZE, y: 12 * TILE_SIZE, label: "轻木" },
    { id: "frontier-stone-1", x: 17 * TILE_SIZE, y: 21 * TILE_SIZE, label: "碎石" },
    { id: "frontier-crystal-1", x: 32 * TILE_SIZE, y: 13 * TILE_SIZE, label: "微光晶" },
    { id: "frontier-wood-2", x: 35 * TILE_SIZE, y: 23 * TILE_SIZE, label: "轻木" },
  ],
  "cloudridge-highlands": [
    { id: "highland-silk-1", x: 4 * TILE_SIZE, y: 8 * TILE_SIZE, label: "雾绡草" },
    { id: "highland-crystal-1", x: 16 * TILE_SIZE, y: 22 * TILE_SIZE, label: "鸣振晶" },
    { id: "highland-stone-1", x: 25 * TILE_SIZE, y: 14 * TILE_SIZE, label: "浮岩" },
    { id: "highland-dew-1", x: 35 * TILE_SIZE, y: 22 * TILE_SIZE, label: "云露" },
  ],
  "startide-archipelago": [
    { id: "startide-reed-1", x: 7 * TILE_SIZE, y: 9 * TILE_SIZE, label: "灯芯芦" },
    { id: "startide-pearl-1", x: 16 * TILE_SIZE, y: 6 * TILE_SIZE, label: "潮辉珠" },
    { id: "startide-moss-1", x: 24 * TILE_SIZE, y: 21 * TILE_SIZE, label: "星沼苔" },
    { id: "startide-slate-1", x: 35 * TILE_SIZE, y: 22 * TILE_SIZE, label: "沉星板岩" },
  ],
};

const ZONE_LABELS: Record<WorldZone, string> = {
  "sunlit-meadow": "晴风原野",
  "echo-ruins": "回声遗迹",
  "mist-terrace": "雾瀑台地",
  "storm-ridge": "风暴山脊",
  "reedlight-haven": "芦灯港",
  "glowmire-wilds": "辉沼湿地",
  "sunken-observatory": "沉星遗迹",
};

const REGION_LABELS: Record<WorldRegion, string> = {
  frontier: "晴风边境",
  "cloudridge-highlands": "云脊高地",
  "startide-archipelago": "星潮群岛",
};

const REGION_TILE_ASSETS: Record<WorldRegion, string> = {
  frontier: "/assets/world-tiles-frontier.png",
  "cloudridge-highlands": "/assets/world-tiles-cloudridge-highlands.png",
  "startide-archipelago": "/assets/world-tiles-startide-archipelago.svg",
};

export class WorldScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<"up" | "down" | "left" | "right", Phaser.Input.Keyboard.Key>;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private leader!: Pal;
  private leaderUid?: string;
  private zoneText!: Phaser.GameObjects.Text;
  private resourceText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private resources = new Map<
    string,
    {
      node: Phaser.GameObjects.Arc;
      label: Phaser.GameObjects.Text;
    }
  >();
  private collected = new Set<string>();
  private gathered = 0;
  private discovered = new Set<string>();
  private claimedChests = new Set<string>();
  private activatedWaypoints = new Set<string>();
  private revealedSectors = new Set<string>();
  private openedGates = new Set<string>();
  private npcObjects = new Map<string, NpcNode>();
  private gateObjects = new Map<string, GateNode>();
  private eliteObjects = new Map<string, EliteNode>();
  private hiddenChestObjects = new Map<
    string,
    { node: Phaser.GameObjects.Arc; label: Phaser.GameObjects.Text }
  >();
  private dialogueOverlay?: Phaser.GameObjects.Container;
  private sporeOverlay?: Phaser.GameObjects.Rectangle;
  private explorationText?: Phaser.GameObjects.Text;
  private environmentText?: Phaser.GameObjects.Text;
  private discoveryObjects = new Map<
    string,
    { node: Phaser.GameObjects.Arc; label: Phaser.GameObjects.Text }
  >();
  private chestObjects = new Map<string, { node: Phaser.GameObjects.Arc; label: Phaser.GameObjects.Text }>();
  private waypointObjects = new Map<
    string,
    { node: Phaser.GameObjects.Arc; label: Phaser.GameObjects.Text }
  >();
  private rareSpawnNode?: Phaser.GameObjects.Arc;
  private encounterLocked = false;
  private encounterCooldownUntil = 0;
  private nextEncounterCheck = 0;
  private touchDirection = { up: false, down: false, left: false, right: false };
  private touchInteractRequested = false;
  private region: WorldRegion = STARTING_REGION;
  private worldMap: number[][] = [];
  private patrolPath: GridPoint[] = [];
  private autoExploreActive = false;
  private autoExploreMessage = "手动探索中";
  private autoStatusText!: Phaser.GameObjects.Text;
  private startAutoButton!: Phaser.GameObjects.Container;
  private stopAutoButton!: Phaser.GameObjects.Container;
  private readonly visibilityHandler = () => {
    if (document.hidden && this.autoExploreActive) {
      this.stopAutoExplore("已因进入后台暂停 · 点击继续挂机");
    }
  };

  constructor() {
    super("WorldScene");
  }

  preload() {
    preloadUiAssets(this);
    for (const [region, path] of Object.entries(REGION_TILE_ASSETS)) {
      const textureKey = `world-tiles-${region}`;
      if (!this.textures.exists(textureKey)) this.load.image(textureKey, path);
    }
  }

  create(data: WorldSceneData = {}) {
    installSceneTheme(this);
    this.encounterLocked = false;
    this.gathered = data.gathered ?? 0;
    this.autoExploreActive = data.autoExplore?.active === true;
    this.autoExploreMessage =
      data.autoExplore?.message ?? (this.autoExploreActive ? "自动巡逻中" : "手动探索中");
    this.patrolPath = [];
    const save = loadGame(localStorage);
    this.collected = new Set(data.collectedResourceIds ?? []);
    this.discovered = new Set(save.progress.discoveredLocationIds);
    this.claimedChests = new Set(save.progress.claimedWorldRewardIds);
    this.activatedWaypoints = new Set(save.progress.activatedWaypointIds);
    this.revealedSectors = new Set(save.progress.revealedSectorIds);
    this.openedGates = new Set(save.progress.openedGateIds);
    const requestedRegion = isWorldRegion(data.region) ? data.region : STARTING_REGION;
    this.region = save.progress.unlockedRegions.includes(requestedRegion) ? requestedRegion : STARTING_REGION;
    const leader = this.resolveLeader(data.leaderId, data.leaderUid);
    this.leader = leader.species;
    this.leaderUid = leader.uid;
    this.createTextures();

    this.worldMap = createWorldMap(this.region);
    const map = this.make.tilemap({
      data: this.worldMap,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const textureKey = `world-tiles-${this.region}`;
    const tileset = map.addTilesetImage(textureKey, textureKey, TILE_SIZE, TILE_SIZE, 0, 0, 0);
    if (!tileset) throw new Error("无法创建世界地图图块集");
    const layer = map.createLayer(0, tileset, 0, 0);
    if (!layer) throw new Error("无法创建世界地图图层");
    this.layer = layer as Phaser.Tilemaps.TilemapLayer;
    this.layer.setCollision(TILE_WALL);

    const startX = data.playerX ?? 3.5 * TILE_SIZE;
    const startY = data.playerY ?? 14.5 * TILE_SIZE;
    this.player = this.physics.add.sprite(startX, startY, "world-player");
    this.player.setCollideWorldBounds(true);
    (this.player.body as Phaser.Physics.Arcade.Body).setSize(22, 22);
    this.physics.world.setBounds(0, 0, WORLD_COLS * TILE_SIZE, WORLD_ROWS * TILE_SIZE);
    this.physics.add.collider(this.player, this.layer);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as typeof this.wasd;
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    this.cameras.main.setBounds(0, 0, WORLD_COLS * TILE_SIZE, WORLD_ROWS * TILE_SIZE);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setZoom(1);

    this.createResources();
    this.createPortals();
    this.createBossAltars();
    this.createDiscoveries();
    this.createChests();
    this.createWaypoints();
    this.createRareSpawn();
    this.createNpcs();
    this.createGates();
    this.createElites();
    this.createHiddenChests();
    this.createSporeOverlay();
    this.createHud();
    this.encounterCooldownUntil = this.time.now + (data.encounterCooldown ? 2200 : 800);
    document.addEventListener("visibilitychange", this.visibilityHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
    });
    if (document.hidden && this.autoExploreActive) this.stopAutoExplore("已因进入后台暂停 · 点击继续挂机");
  }

  update() {
    const left = this.cursors.left.isDown || this.wasd.left.isDown || this.touchDirection.left;
    const right = this.cursors.right.isDown || this.wasd.right.isDown || this.touchDirection.right;
    const up = this.cursors.up.isDown || this.wasd.up.isDown || this.touchDirection.up;
    const down = this.cursors.down.isDown || this.wasd.down.isDown || this.touchDirection.down;
    const manualDirection = new Phaser.Math.Vector2(Number(right) - Number(left), Number(down) - Number(up));
    if (manualDirection.lengthSq() > 0 && this.autoExploreActive) {
      this.stopAutoExplore("已由手动移动停止");
    }
    const direction =
      manualDirection.lengthSq() > 0
        ? manualDirection
        : this.autoExploreActive
          ? this.getPatrolDirection()
          : new Phaser.Math.Vector2();
    if (direction.lengthSq() > 0) direction.normalize().scale(180);
    this.player.setVelocity(direction.x, direction.y);

    const tileX = Math.floor(this.player.x / TILE_SIZE);
    const zone = getZoneAtTile(tileX, this.region);
    const period = getTimePeriod(new Date().getHours());
    this.zoneText.setText(
      `${REGION_LABELS[this.region]} / ${ZONE_LABELS[zone]} · ${period === "day" ? "白昼" : "夜晚"} · 领队 ${this.leader.name.zh}`
    );

    const nearest = this.findNearbyResource();
    const nearChest = this.findNearbyChest();
    const nearDiscovery = this.findNearbyDiscovery();
    const nearWaypoint = this.findNearbyWaypoint();
    const nearNpc = this.findNearbyNpc();
    const nearGate = this.findNearbyGate();
    const nearHiddenChest = this.findNearbyHiddenChest();
    const nearElite = this.findNearbyElite();
    const nearPortal = this.findNearbyPortal();
    const nearBoss = this.isNearBossAltar();
    const interactRequested = Phaser.Input.Keyboard.JustDown(this.interactKey) || this.touchInteractRequested;
    const promptVisible = Boolean(
      nearest ||
      nearChest ||
      nearDiscovery ||
      nearWaypoint ||
      nearNpc ||
      nearGate ||
      nearHiddenChest ||
      nearElite ||
      nearPortal ||
      nearBoss
    );
    this.promptText.setVisible(promptVisible);
    if (nearest) {
      this.promptText.setText(`按 E 采集 ${nearest.label}`);
      if (interactRequested || this.autoExploreActive) this.gatherResource(nearest);
    } else if (nearChest) {
      this.promptText.setText(`按 E 开启 ${nearChest.label}`);
      if (interactRequested) this.openChest(nearChest);
    } else if (nearDiscovery) {
      this.promptText.setText(`按 E 记录 ${nearDiscovery.label}`);
      if (interactRequested) this.discoverLocation(nearDiscovery);
    } else if (nearWaypoint) {
      this.promptText.setText(`按 E 激活 ${nearWaypoint.label}（传送至芦灯港）`);
      if (interactRequested) this.activateWaypoint(nearWaypoint);
    } else if (nearNpc) {
      this.promptText.setText(`按 E 与 ${nearNpc.name} 对话`);
      if (interactRequested) this.openNpcDialogue(nearNpc);
    } else if (nearGate) {
      this.updateGatePrompt(nearGate, interactRequested);
    } else if (nearHiddenChest) {
      this.promptText.setText(`按 E 开启 ${nearHiddenChest.label}`);
      if (interactRequested) this.openHiddenChest(nearHiddenChest);
    } else if (nearElite) {
      this.updateElitePrompt(nearElite, interactRequested);
    } else if (nearPortal) {
      this.promptText.setText(this.getPortalPrompt(nearPortal));
      if (interactRequested) this.usePortal(nearPortal);
    } else if (nearBoss) {
      this.promptText.setText(this.getBossPrompt(nearBoss.id));
      if (interactRequested) this.challengeBoss(nearBoss.id);
    }
    this.touchInteractRequested = false;

    this.revealFogSector(Math.floor(this.player.x / TILE_SIZE), Math.floor(this.player.y / TILE_SIZE));
    this.updateEnvironmentHud(period);

    if (direction.lengthSq() > 0) {
      if (this.isNearRareSpawn()) this.triggerRareSpawn();
      else this.tryEncounter(zone, period);
    }
  }

  private revealFogSector(tileX: number, tileY: number) {
    if (!isStartideRegion(this.region)) return;
    const sector = getFogSectorAtTile(tileX, tileY);
    if (!sector || this.revealedSectors.has(sector)) return;
    this.revealedSectors.add(sector);
    const save = loadGame(localStorage);
    saveGame(localStorage, {
      ...save,
      progress: { ...save.progress, revealedSectorIds: [...this.revealedSectors] },
    });
    this.updateExplorationHud();
  }

  private triggerRareSpawn() {
    if (this.encounterLocked || this.time.now < this.encounterCooldownUntil) return;
    this.encounterLocked = true;
    this.player.setVelocity(0, 0);
    this.rareSpawnNode?.setActive(false);
    const save = loadGame(localStorage);
    const leaderLevel = save.ownedPals.find((pal) => pal.uid === this.leaderUid)?.level ?? 1;
    const enemyLevel = Math.max(
      getEncounterLevelFloor("sunken-observatory"),
      Math.min(50, leaderLevel + STARTIDE_RARE_SPAWN.levelBonus)
    );
    void startScene(this, "BattleScene", {
      playerId: this.leader.id,
      playerUid: this.leaderUid,
      enemyId: STARTIDE_RARE_SPAWN.speciesId,
      enemyLevel,
      region: this.region,
      autoExplore: { active: this.autoExploreActive, message: this.autoExploreMessage },
      returnTo: {
        scene: "WorldScene",
        data: this.buildReturnData(),
      },
    });
  }

  private resolveLeader(preferredId?: number, preferredUid?: string): { species: Pal; uid?: string } {
    const save = loadGame(localStorage);
    const preferredInstance = save.ownedPals.find(
      (pal) => pal.uid === preferredUid && pal.speciesId === preferredId
    );
    const firstTeamUid = save.teamIds[0];
    const firstTeamPal = save.ownedPals.find((pal) => pal.uid === firstTeamUid);
    if (preferredInstance)
      return {
        species: pals.find((pal) => pal.id === preferredInstance.speciesId) ?? pals[0],
        uid: preferredInstance.uid,
      };
    if (firstTeamPal)
      return {
        species: pals.find((pal) => pal.id === firstTeamPal.speciesId) ?? pals[0],
        uid: firstTeamPal.uid,
      };
    return { species: pals.find((pal) => pal.id === preferredId) ?? pals[0] };
  }

  private createTextures() {
    if (!this.textures.exists("world-player")) {
      const graphics = this.make.graphics({ x: 0, y: 0 });
      graphics.fillStyle(0xffd54f);
      graphics.fillCircle(14, 14, 12);
      graphics.lineStyle(3, 0xffffff);
      graphics.strokeCircle(14, 14, 12);
      graphics.generateTexture("world-player", 28, 28);
      graphics.destroy();
    }
  }

  private createHud() {
    this.add.rectangle(450, 28, 880, 44, 0x0b1224, 0.9).setScrollFactor(0).setDepth(20);
    const back = this.add
      .text(20, 18, "< 返回图鉴", {
        fontFamily: "sans-serif",
        fontSize: "16px",
        color: "#4fc3f7",
      })
      .setScrollFactor(0)
      .setDepth(21)
      .setInteractive({ useHandCursor: true });
    back.on("pointerdown", () => void startScene(this, "DexScene"));
    this.zoneText = this.add
      .text(450, 20, "", {
        fontFamily: "sans-serif",
        fontSize: "15px",
        color: "#ffffff",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(21);
    this.resourceText = this.add
      .text(875, 18, "", {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: "#9ccc65",
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(21);
    this.autoStatusText = this.add
      .text(450, 58, "", {
        fontFamily: "sans-serif",
        fontSize: "13px",
        color: "#ffffff",
        backgroundColor: "#0b1224",
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(21);
    this.startAutoButton = createTextButton(this, {
      x: 800,
      y: 74,
      width: 164,
      height: 42,
      label: "▶ 开始挂机",
      variant: "accent",
      fontSize: "15px",
      onPress: () => this.startAutoExplore(),
    })
      .setScrollFactor(0)
      .setDepth(24);
    this.stopAutoButton = createTextButton(this, {
      x: 800,
      y: 74,
      width: 164,
      height: 42,
      label: "■ 停止挂机",
      variant: "danger",
      fontSize: "15px",
      onPress: () => this.stopAutoExplore("已手动停止挂机"),
    })
      .setScrollFactor(0)
      .setDepth(24);
    this.promptText = this.add
      .text(450, 594, "", {
        fontFamily: "sans-serif",
        fontSize: "17px",
        color: "#ffffff",
        backgroundColor: "#0b1224",
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(21)
      .setVisible(false);
    this.updateResourceText();
    this.updateAutoExploreHud();
    this.environmentText = this.add
      .text(20, 90, "", {
        fontFamily: "sans-serif",
        fontSize: "13px",
        color: "#b2ebf2",
        backgroundColor: "#0b1224",
        padding: { x: 8, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(21);
    this.explorationText = this.add
      .text(20, 118, "", {
        fontFamily: "sans-serif",
        fontSize: "13px",
        color: "#ffe082",
        backgroundColor: "#0b1224",
        padding: { x: 8, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(21);
    this.updateEnvironmentHud();
    this.updateExplorationHud();
    this.createTouchControls();
  }

  private startAutoExplore() {
    const save = loadGame(localStorage);
    const hasAvailableTeamMember = save.teamIds.some((uid) => {
      const member = save.ownedPals.find((pal) => pal.uid === uid);
      return Boolean(member && member.currentHp > 0);
    });
    if (!hasAvailableTeamMember) {
      this.autoExploreMessage = "队伍中没有可战斗成员 · 请先编组或治疗";
      this.updateAutoExploreHud();
      announceGameStatus(this.autoExploreMessage);
      return;
    }
    this.autoExploreActive = true;
    this.autoExploreMessage = "自动巡逻中 · 路过资源会自动采集";
    this.patrolPath = [];
    this.updateAutoExploreHud();
    announceGameStatus("探索挂机已开始。将自动巡逻、采集并处理普通遭遇。");
  }

  private stopAutoExplore(message: string) {
    this.autoExploreActive = false;
    this.autoExploreMessage = message;
    this.patrolPath = [];
    this.player?.setVelocity(0, 0);
    this.updateAutoExploreHud();
    announceGameStatus(message);
  }

  private updateAutoExploreHud() {
    this.autoStatusText?.setText(
      `${this.autoExploreActive ? "● 挂机运行" : "○ 挂机暂停"} · ${this.autoExploreMessage}`
    );
    this.autoStatusText?.setColor(this.autoExploreActive ? "#9ccc65" : "#ffffff");
    this.startAutoButton?.setVisible(!this.autoExploreActive);
    this.stopAutoButton?.setVisible(this.autoExploreActive);
  }

  private getPatrolDirection(): Phaser.Math.Vector2 {
    const currentTile = {
      x: Math.floor(this.player.x / TILE_SIZE),
      y: Math.floor(this.player.y / TILE_SIZE),
    };
    if (this.patrolPath.length === 0) {
      this.patrolPath = createPatrolPath(this.worldMap, currentTile);
      if (this.patrolPath.length === 0) {
        this.stopAutoExplore("当前位置无法规划巡逻路线");
        return new Phaser.Math.Vector2();
      }
    }
    let next = this.patrolPath[0];
    let targetX = (next.x + 0.5) * TILE_SIZE;
    let targetY = (next.y + 0.5) * TILE_SIZE;
    if (Phaser.Math.Distance.Between(this.player.x, this.player.y, targetX, targetY) < 5) {
      this.patrolPath.shift();
      next = this.patrolPath[0];
      if (!next) return new Phaser.Math.Vector2();
      targetX = (next.x + 0.5) * TILE_SIZE;
      targetY = (next.y + 0.5) * TILE_SIZE;
    }
    return new Phaser.Math.Vector2(targetX - this.player.x, targetY - this.player.y);
  }

  private createTouchControls() {
    this.makeTouchDirectionButton(82, 526, "▲", "up");
    this.makeTouchDirectionButton(82, 600, "▼", "down");
    this.makeTouchDirectionButton(44, 563, "◀", "left");
    this.makeTouchDirectionButton(120, 563, "▶", "right");
    const action = this.add
      .circle(826, 558, 38, 0x0f4660, 0.72)
      .setScrollFactor(0)
      .setDepth(22)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(826, 558, "E\n交互", {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: "#ffffff",
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(23);
    action.on("pointerdown", () => {
      this.touchInteractRequested = true;
    });
  }

  private makeTouchDirectionButton(
    x: number,
    y: number,
    label: string,
    direction: keyof typeof this.touchDirection
  ) {
    const button = this.add
      .circle(x, y, 32, 0x0f3460, 0.6)
      .setScrollFactor(0)
      .setDepth(22)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(x, y, label, {
        fontFamily: "sans-serif",
        fontSize: "20px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(23);
    button.on("pointerdown", () => {
      this.touchDirection[direction] = true;
    });
    const release = () => {
      this.touchDirection[direction] = false;
    };
    button.on("pointerup", release);
    button.on("pointerout", release);
  }

  private createResources() {
    this.resources.clear();
    for (const resource of REGION_RESOURCES[this.region]) {
      if (this.collected.has(resource.id)) continue;
      const node = this.add.circle(resource.x, resource.y, 13, 0x80deea).setStrokeStyle(3, 0xffffff, 0.7);
      const label = this.add
        .text(resource.x, resource.y + 18, resource.label, {
          fontFamily: "sans-serif",
          fontSize: "12px",
          color: "#d5f7ff",
        })
        .setOrigin(0.5, 0);
      this.resources.set(resource.id, { node, label });
    }
  }

  private findNearbyDiscovery(): (typeof STARTIDE_DISCOVERIES)[number] | undefined {
    if (!isStartideRegion(this.region)) return undefined;
    return STARTIDE_DISCOVERIES.find(
      (discovery) =>
        !this.discovered.has(discovery.id) &&
        Phaser.Math.Distance.Between(this.player.x, this.player.y, discovery.x, discovery.y) < 52
    );
  }

  private findNearbyChest(): (typeof STARTIDE_CHESTS)[number] | undefined {
    if (!isStartideRegion(this.region)) return undefined;
    return STARTIDE_CHESTS.find(
      (chest) =>
        !this.claimedChests.has(chest.id) &&
        Phaser.Math.Distance.Between(this.player.x, this.player.y, chest.x, chest.y) < 52
    );
  }

  private findNearbyWaypoint(): (typeof STARTIDE_WAYPOINTS)[number] | undefined {
    if (!isStartideRegion(this.region)) return undefined;
    return STARTIDE_WAYPOINTS.find(
      (waypoint) =>
        !this.activatedWaypoints.has(waypoint.id) &&
        Phaser.Math.Distance.Between(this.player.x, this.player.y, waypoint.x, waypoint.y) < 56
    );
  }

  private isNearRareSpawn(): boolean {
    if (!isStartideRegion(this.region) || !this.rareSpawnNode?.active) return false;
    return (
      Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        STARTIDE_RARE_SPAWN.x,
        STARTIDE_RARE_SPAWN.y
      ) < 50
    );
  }

  private discoverLocation(discovery: (typeof STARTIDE_DISCOVERIES)[number]) {
    this.discovered.add(discovery.id);
    const object = this.discoveryObjects.get(discovery.id);
    object?.node.destroy();
    object?.label.destroy();
    this.discoveryObjects.delete(discovery.id);
    const save = loadGame(localStorage);
    saveGame(localStorage, {
      ...save,
      progress: { ...save.progress, discoveredLocationIds: [...this.discovered] },
    });
    announceGameStatus(`已发现地点：${discovery.label}`);
    this.updateExplorationHud();
  }

  private openChest(chest: (typeof STARTIDE_CHESTS)[number]) {
    this.claimedChests.add(chest.id);
    const object = this.chestObjects.get(chest.id);
    object?.node.destroy();
    object?.label.destroy();
    this.chestObjects.delete(chest.id);
    const save = loadGame(localStorage);
    const resources = { ...save.base.resources };
    for (const [resource, amount] of Object.entries(chest.rewards.resources ?? {})) {
      resources[resource as keyof typeof resources] += amount ?? 0;
    }
    saveGame(localStorage, {
      ...save,
      base: { ...save.base, resources },
      inventory: {
        ...save.inventory,
        captureOrbs: save.inventory.captureOrbs + (chest.rewards.captureOrbs ?? 0),
        healingTonics: save.inventory.healingTonics + (chest.rewards.healingTonics ?? 0),
        equipment: [
          ...save.inventory.equipment,
          ...(chest.rewards.equipment ?? []).map((equipmentId) => ({
            uid: `chest-${chest.id}-${equipmentId}`,
            equipmentId,
          })),
        ],
      },
      progress: { ...save.progress, claimedWorldRewardIds: [...this.claimedChests] },
    });
    announceGameStatus(`已开启${chest.label}`);
    this.updateResourceText();
    this.updateExplorationHud();
  }

  private activateWaypoint(waypoint: (typeof STARTIDE_WAYPOINTS)[number]) {
    this.activatedWaypoints.add(waypoint.id);
    const object = this.waypointObjects.get(waypoint.id);
    object?.node.destroy();
    object?.label.destroy();
    this.waypointObjects.delete(waypoint.id);
    const save = loadGame(localStorage);
    saveGame(localStorage, {
      ...save,
      progress: { ...save.progress, activatedWaypointIds: [...this.activatedWaypoints] },
    });
    this.player.setPosition(waypoint.targetX, waypoint.targetY);
    this.cameras.main.centerOn(waypoint.targetX, waypoint.targetY);
    announceGameStatus(`已激活${waypoint.label}，传送至芦灯港入口`);
    this.updateExplorationHud();
  }

  private updateEnvironmentHud(period: "day" | "night" = "day") {
    if (!this.environmentText) return;
    if (!isStartideRegion(this.region)) {
      this.environmentText.setVisible(false);
      this.sporeOverlay?.setVisible(false);
      return;
    }
    const tide = getTidePhase(new Date().getHours());
    const spore = isSporeHazardActive("sunken-observatory", period, this.player.x, this.player.y, [
      ...this.discovered,
    ]);
    const parts = [`潮汐：${tide === "flood" ? "涨潮" : "退潮"}`];
    if (spore) parts.push("⚠ 孢雾浓密 · 靠近沉星观测台以规避");
    else if (period === "night") parts.push("孢雾已规避");
    this.environmentText.setText(parts.join(" · "));
    this.environmentText.setVisible(true);
    this.sporeOverlay?.setVisible(spore);
  }

  private updateExplorationHud() {
    if (!this.explorationText) return;
    if (!isStartideRegion(this.region)) {
      this.explorationText.setVisible(false);
      return;
    }
    const completion = startideExplorationCompletion(
      [...this.discovered],
      [...this.claimedChests],
      [...this.activatedWaypoints],
      [...this.revealedSectors]
    );
    this.explorationText.setText(`星潮探索完成度：${completion}%`);
    this.explorationText.setVisible(true);
  }

  private findNearbyResource(): ResourceNode | undefined {
    return REGION_RESOURCES[this.region].find((resource) => {
      const object = this.resources.get(resource.id);
      return (
        object?.node.active &&
        Phaser.Math.Distance.Between(this.player.x, this.player.y, resource.x, resource.y) < 52
      );
    });
  }

  private gatherResource(resource: ResourceNode) {
    this.collected.add(resource.id);
    this.gathered += 1;
    const object = this.resources.get(resource.id);
    object?.node.destroy();
    object?.label.destroy();
    this.resources.delete(resource.id);
    const save = recordQuestEvent(loadGame(localStorage), { type: "gather", region: this.region });
    saveGame(localStorage, save);
    this.updateResourceText();
  }

  private updateResourceText() {
    this.resourceText?.setText(`采集物 ${this.gathered}`);
  }

  private createBossAltars() {
    if (this.region !== HIGHLAND_REGION && !isStartideRegion(this.region)) return;
    const bosses = getBossesForRegion(this.region);
    for (const boss of bosses) {
      const pos =
        this.region === HIGHLAND_REGION
          ? { x: 36 * TILE_SIZE, y: 14 * TILE_SIZE }
          : STARTIDE_BOSS_ALTARS[boss.id];
      if (!pos) continue;
      this.add.circle(pos.x, pos.y, 25, 0x7e57c2, 0.8).setStrokeStyle(4, 0xffd54f, 0.9);
      this.add.circle(pos.x, pos.y, 10, 0xffd54f, 0.85);
      this.add
        .text(pos.x, pos.y + 32, boss.name, {
          fontFamily: "sans-serif",
          fontSize: "13px",
          color: "#ffffff",
          backgroundColor: "#0b1224",
          padding: { x: 5, y: 2 },
        })
        .setOrigin(0.5, 0);
    }
  }

  private isNearBossAltar(): { id: string; x: number; y: number } | undefined {
    if (this.region !== HIGHLAND_REGION && !isStartideRegion(this.region)) return undefined;
    const bosses = getBossesForRegion(this.region);
    for (const boss of bosses) {
      const pos =
        this.region === HIGHLAND_REGION
          ? { x: 36 * TILE_SIZE, y: 14 * TILE_SIZE }
          : STARTIDE_BOSS_ALTARS[boss.id];
      if (!pos) continue;
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, pos.x, pos.y) < 62) {
        return { id: boss.id, x: pos.x, y: pos.y };
      }
    }
    return undefined;
  }

  private getBossPrompt(bossId: string): string {
    const save = loadGame(localStorage);
    const boss = bossesById.get(bossId);
    if (!boss) return "";
    if (save.progress.defeatedBossIds.includes(bossId)) return `${boss.name} 已经败退`;
    if (this.canChallengeBossNow(save, boss))
      return `按 E 挑战 Lv.${boss.level} ${boss.name}（抗性 ${boss.rules.statusResistance}%）`;
    const challengeQuestId =
      this.region === HIGHLAND_REGION ? "storm-lord-challenge" : "abyssal-colossus-challenge";
    const challenge = getQuestViews(save).find((view) => view.definition.id === challengeQuestId);
    return challenge?.status === "complete"
      ? `${boss.name} 已经败退，请到任务页领取奖励`
      : "祭坛尚未回应 · 先完成对应区域任务";
  }

  private canChallengeBossNow(
    save: ReturnType<typeof loadGame>,
    boss: ReturnType<typeof bossesById.get>
  ): boolean {
    if (!boss) return false;
    if (save.progress.defeatedBossIds.includes(boss.id)) return false;
    if (boss.rules.phaseThreshold > 0) return canChallengeBoss(save, boss.id);
    const voyage = getQuestViews(save).find((view) => view.definition.id === "startide-voyage");
    return voyage !== undefined && voyage.status !== "locked";
  }

  private challengeBoss(bossId: string) {
    const save = loadGame(localStorage);
    const boss = bossesById.get(bossId);
    if (!boss || !this.canChallengeBossNow(save, boss)) return;
    this.encounterLocked = true;
    this.player.setVelocity(0, 0);
    void startScene(this, "BattleScene", {
      playerId: this.leader.id,
      playerUid: this.leaderUid,
      enemyId: boss.speciesId,
      enemyLevel: boss.level,
      bossId: boss.id,
      returnTo: {
        scene: "WorldScene",
        data: this.buildReturnData({
          autoExplore: { active: false, message: "首领挑战需手动进行" },
        }),
      },
    });
  }

  private createDiscoveries() {
    if (!isStartideRegion(this.region)) return;
    for (const discovery of STARTIDE_DISCOVERIES) {
      if (this.discovered.has(discovery.id)) continue;
      const node = this.add
        .circle(discovery.x, discovery.y, 14, 0xffe082, 0.7)
        .setStrokeStyle(3, 0xffffff, 0.7);
      const label = this.add
        .text(discovery.x, discovery.y + 18, discovery.label, {
          fontFamily: "sans-serif",
          fontSize: "12px",
          color: "#fff3c4",
        })
        .setOrigin(0.5, 0);
      this.discoveryObjects.set(discovery.id, { node, label });
    }
  }

  private createChests() {
    if (!isStartideRegion(this.region)) return;
    for (const chest of STARTIDE_CHESTS) {
      if (this.claimedChests.has(chest.id)) continue;
      const node = this.add.circle(chest.x, chest.y, 13, 0x80cbc4, 0.75).setStrokeStyle(3, 0xfff176, 0.8);
      const label = this.add
        .text(chest.x, chest.y + 18, chest.label, {
          fontFamily: "sans-serif",
          fontSize: "12px",
          color: "#d5f7ff",
        })
        .setOrigin(0.5, 0);
      this.chestObjects.set(chest.id, { node, label });
    }
  }

  private createWaypoints() {
    if (!isStartideRegion(this.region)) return;
    for (const waypoint of STARTIDE_WAYPOINTS) {
      if (this.activatedWaypoints.has(waypoint.id)) continue;
      const node = this.add
        .circle(waypoint.x, waypoint.y, 15, 0xb39ddb, 0.75)
        .setStrokeStyle(3, 0xffffff, 0.7);
      const label = this.add
        .text(waypoint.x, waypoint.y + 20, waypoint.label, {
          fontFamily: "sans-serif",
          fontSize: "12px",
          color: "#e1bee7",
        })
        .setOrigin(0.5, 0);
      this.waypointObjects.set(waypoint.id, { node, label });
    }
  }

  private createRareSpawn() {
    if (!isStartideRegion(this.region)) return;
    this.rareSpawnNode = this.add
      .circle(STARTIDE_RARE_SPAWN.x, STARTIDE_RARE_SPAWN.y, 16, 0x4dd0e1, 0.4)
      .setStrokeStyle(3, 0x4dd0e1, 0.9);
    this.add
      .text(STARTIDE_RARE_SPAWN.x, STARTIDE_RARE_SPAWN.y + 22, STARTIDE_RARE_SPAWN.label, {
        fontFamily: "sans-serif",
        fontSize: "12px",
        color: "#b2ebf2",
      })
      .setOrigin(0.5, 0);
  }

  private createNpcs() {
    if (!isStartideRegion(this.region)) return;
    for (const npc of SETTLEMENT_NPCS) {
      if (npc.role === "talk" && this.discovered.has(`npc-${npc.id}`)) continue;
      const node = this.add.circle(npc.x, npc.y, 15, 0xffb74d, 0.85).setStrokeStyle(3, 0xffffff, 0.7);
      const label = this.add
        .text(npc.x, npc.y + 20, `${npc.name}·${npc.title}`, {
          fontFamily: "sans-serif",
          fontSize: "12px",
          color: "#fff3c4",
        })
        .setOrigin(0.5, 0);
      this.npcObjects.set(npc.id, { id: npc.id, node, label });
    }
  }

  private createGates() {
    if (!isStartideRegion(this.region)) return;
    for (const gate of EXPLORE_GATES) {
      if (this.openedGates.has(gate.id)) continue;
      const node = this.add.circle(gate.x, gate.y, 16, 0xa1887f, 0.85).setStrokeStyle(3, 0xfff176, 0.9);
      const label = this.add
        .text(gate.x, gate.y + 20, gate.label, {
          fontFamily: "sans-serif",
          fontSize: "12px",
          color: "#ffe0b2",
        })
        .setOrigin(0.5, 0);
      this.gateObjects.set(gate.id, { id: gate.id, node, label });
    }
  }

  private createElites() {
    if (!isStartideRegion(this.region)) return;
    for (const elite of getElitesForRegion(this.region)) {
      const node = this.add.circle(elite.x, elite.y, 20, 0xef5350, 0.8).setStrokeStyle(4, 0xffd54f, 0.9);
      const label = this.add
        .text(elite.x, elite.y + 26, `${elite.name} Lv.${elite.level}`, {
          fontFamily: "sans-serif",
          fontSize: "12px",
          color: "#ffcdd2",
          backgroundColor: "#0b1224",
          padding: { x: 4, y: 2 },
        })
        .setOrigin(0.5, 0);
      this.eliteObjects.set(elite.id, { id: elite.id, node, label });
    }
  }

  private createHiddenChests() {
    if (!isStartideRegion(this.region)) return;
    for (const chest of HIDDEN_CHESTS) {
      if (!isHiddenChestAvailable(this.openedGatesSave(), chest, this.claimedChests)) continue;
      const node = this.add.circle(chest.x, chest.y, 13, 0x80cbc4, 0.85).setStrokeStyle(3, 0xfff176, 0.9);
      const label = this.add
        .text(chest.x, chest.y + 18, chest.label, {
          fontFamily: "sans-serif",
          fontSize: "12px",
          color: "#d5f7ff",
        })
        .setOrigin(0.5, 0);
      this.hiddenChestObjects.set(chest.id, { node, label });
    }
  }

  private openedGatesSave(): ReturnType<typeof loadGame> {
    return loadGame(localStorage);
  }

  private findNearbyNpc() {
    for (const npc of SETTLEMENT_NPCS) {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y) < 52) return npc;
    }
    return undefined;
  }

  private findNearbyGate() {
    for (const gate of EXPLORE_GATES) {
      if (this.openedGates.has(gate.id)) continue;
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, gate.x, gate.y) < 52) return gate;
    }
    return undefined;
  }

  private findNearbyHiddenChest() {
    for (const chest of HIDDEN_CHESTS) {
      if (!isHiddenChestAvailable(loadGame(localStorage), chest, this.claimedChests)) continue;
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, chest.x, chest.y) < 52) return chest;
    }
    return undefined;
  }

  private findNearbyElite() {
    for (const elite of getElitesForRegion(this.region)) {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, elite.x, elite.y) < 60) return elite;
    }
    return undefined;
  }

  private updateGatePrompt(gate: (typeof EXPLORE_GATES)[number], interactRequested: boolean) {
    const save = loadGame(localStorage);
    if (canOpenGate(save, gate, this.currentSpeciesById())) {
      this.promptText.setText(`按 E 使用探索能力开启 ${gate.label}`);
      if (interactRequested) this.useGate(gate);
    } else {
      this.promptText.setText(`${gate.label}：需要拥有「${this.abilityLabel(gate.requiredAbility)}」的幻兽`);
    }
  }

  private abilityLabel(abilityId: string): string {
    const labels: Record<string, string> = {
      "vine-cut": "砍藤",
      "rock-break": "碎岩",
      wading: "涉水",
      glide: "滑翔",
      illuminate: "照明",
    };
    return labels[abilityId] ?? abilityId;
  }

  private useGate(gate: (typeof EXPLORE_GATES)[number]) {
    const save = loadGame(localStorage);
    if (!canOpenGate(save, gate, this.currentSpeciesById())) return;
    const opened = openGate(save, gate, this.currentSpeciesById());
    saveGame(localStorage, opened);
    this.openedGates.add(gate.id);
    const object = this.gateObjects.get(gate.id);
    object?.node.destroy();
    object?.label.destroy();
    this.gateObjects.delete(gate.id);
    if (gate.discoveryId) {
      const discovered = loadGame(localStorage);
      saveGame(localStorage, {
        ...discovered,
        progress: {
          ...discovered.progress,
          discoveredLocationIds: [...discovered.progress.discoveredLocationIds, gate.discoveryId],
        },
      });
      this.discovered.add(gate.discoveryId);
    }
    if (gate.chestId) this.createHiddenChests();
    announceGameStatus(`已开启 ${gate.label}`);
    this.updateExplorationHud();
  }

  private updateElitePrompt(elite: (typeof ELITES)[number], interactRequested: boolean) {
    const save = loadGame(localStorage);
    if (isEliteDefeated(save, elite.id) && !canRebattleElite(save, elite)) {
      this.promptText.setText(`${elite.name} 冷却中 · 稍后再来挑战`);
      return;
    }
    const tag = isEliteDefeated(save, elite.id) ? "（重战）" : "";
    this.promptText.setText(`按 E 挑战 ${elite.name} Lv.${elite.level}${tag}`);
    if (interactRequested) this.challengeElite(elite);
  }

  private challengeElite(elite: (typeof ELITES)[number]) {
    const save = loadGame(localStorage);
    if (isEliteDefeated(save, elite.id) && !canRebattleElite(save, elite)) return;
    this.encounterLocked = true;
    this.player.setVelocity(0, 0);
    void startScene(this, "BattleScene", {
      playerId: this.leader.id,
      playerUid: this.leaderUid,
      enemyId: elite.speciesId,
      enemyLevel: elite.level,
      eliteId: elite.id,
      region: this.region,
      returnTo: {
        scene: "WorldScene",
        data: this.buildReturnData({ autoExplore: { active: false, message: "精英挑战需手动进行" } }),
      },
    });
  }

  private openHiddenChest(chest: (typeof HIDDEN_CHESTS)[number]) {
    if (!isHiddenChestAvailable(loadGame(localStorage), chest, this.claimedChests)) return;
    this.claimedChests.add(chest.id);
    const object = this.hiddenChestObjects.get(chest.id);
    object?.node.destroy();
    object?.label.destroy();
    this.hiddenChestObjects.delete(chest.id);
    const save = recordSideQuestEvent(loadGame(localStorage), { type: "open-chest" });
    const resources = { ...save.base.resources };
    for (const [resource, amount] of Object.entries(chest.rewards.resources ?? {})) {
      resources[resource as keyof typeof resources] += amount ?? 0;
    }
    saveGame(localStorage, {
      ...save,
      base: { ...save.base, resources },
      inventory: {
        ...save.inventory,
        coins: save.inventory.coins + (chest.rewards.coins ?? 0),
        captureOrbs: save.inventory.captureOrbs + (chest.rewards.captureOrbs ?? 0),
        healingTonics: save.inventory.healingTonics + (chest.rewards.healingTonics ?? 0),
        equipment: [
          ...save.inventory.equipment,
          ...(chest.rewards.equipment ?? []).map((equipmentId) => ({
            uid: `gate-${chest.id}-${equipmentId}`,
            equipmentId,
          })),
        ],
      },
      progress: { ...save.progress, claimedWorldRewardIds: [...this.claimedChests] },
    });
    announceGameStatus(`已开启 ${chest.label}`);
    this.updateResourceText();
    this.updateExplorationHud();
  }

  private openNpcDialogue(npc: (typeof SETTLEMENT_NPCS)[number]) {
    if (this.dialogueOverlay) this.dialogueOverlay.destroy();
    const save = loadGame(localStorage);
    const talked = recordNpcTalk(save, npc.id);
    if (talked !== save) saveGame(localStorage, talked);
    if (npc.role === "talk") this.discovered.add(`npc-${npc.id}`);

    const overlay = this.add.container(0, 0).setDepth(60).setScrollFactor(0);
    const backdrop = this.add.rectangle(450, 320, 760, 300, 0x0b1224, 0.92);
    const title = this.add
      .text(450, 200, `${npc.name} · ${npc.title}`, {
        fontFamily: "sans-serif",
        fontSize: "20px",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    const lines = npc.dialogue.concat(npc.hint ? [npc.hint] : []).map((line, index) =>
      this.add
        .text(110, 235 + index * 22, line, {
          fontFamily: "sans-serif",
          fontSize: "14px",
          color: "#d8def8",
          wordWrap: { width: 680 },
        })
        .setOrigin(0, 0)
    );
    overlay.add([backdrop, title, ...lines]);

    const buttons: Phaser.GameObjects.Container[] = [];
    if (npc.role === "shop") {
      buttons.push(
        createTextButton(this, {
          x: 250,
          y: 430,
          width: 150,
          height: 38,
          label: "进入商店",
          variant: "accent",
          onPress: () => {
            overlay.destroy();
            void startScene(this, "ShopScene");
          },
        })
      );
    } else if (npc.role === "healer") {
      buttons.push(
        createTextButton(this, {
          x: 250,
          y: 430,
          width: 170,
          height: 38,
          label: `治疗队伍（${HEAL_COST} 星币）`,
          variant: "accent",
          onPress: () => {
            this.healTeam(overlay);
          },
        })
      );
    } else if (npc.role === "quest") {
      buttons.push(
        createTextButton(this, {
          x: 350,
          y: 430,
          width: 150,
          height: 38,
          label: "查看支线",
          variant: "accent",
          onPress: () => {
            overlay.destroy();
            void startScene(this, "QuestScene");
          },
        })
      );
    }
    buttons.push(
      createTextButton(this, {
        x: npc.role === "talk" ? 450 : 570,
        y: 430,
        width: 130,
        height: 38,
        label: "关闭",
        variant: "muted",
        onPress: () => overlay.destroy(),
      })
    );
    overlay.add(buttons);
    this.dialogueOverlay = overlay;
    announceGameStatus(`与 ${npc.name} 对话：${npc.dialogue[0]}`);
  }

  private healTeam(overlay: Phaser.GameObjects.Container) {
    const save = loadGame(localStorage);
    if (save.inventory.coins < HEAL_COST) {
      this.openNpcDialogueMessage(overlay, "星币不足，无法治疗。");
      return;
    }
    if (
      !save.teamIds.some((uid) => {
        const pal = save.ownedPals.find((item) => item.uid === uid);
        return pal && pal.currentHp < pal.level * 100;
      })
    ) {
      this.openNpcDialogueMessage(overlay, "队伍已经满血。");
      return;
    }
    const next = { ...save, inventory: { ...save.inventory, coins: save.inventory.coins - HEAL_COST } };
    saveGame(localStorage, next);
    this.openNpcDialogueMessage(overlay, `治疗完成，已消耗 ${HEAL_COST} 星币。`);
  }

  private openNpcDialogueMessage(overlay: Phaser.GameObjects.Container, message: string) {
    const existing = overlay.list.find((child) => child.name === "npc-dialogue-message");
    existing?.destroy();
    overlay.add(
      this.add
        .text(110, 410, message, { fontFamily: "sans-serif", fontSize: "14px", color: "#9ccc65" })
        .setOrigin(0, 0)
        .setName("npc-dialogue-message")
    );
  }

  private currentSpeciesById() {
    return new Map(pals.map((pal) => [pal.id, pal]));
  }

  private createSporeOverlay() {
    if (!isStartideRegion(this.region)) return;
    this.sporeOverlay = this.add
      .rectangle(0, 0, WORLD_COLS * TILE_SIZE, WORLD_ROWS * TILE_SIZE, 0x4a148c, 0.28)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(15)
      .setVisible(false);
  }

  private getRegionPortals(): RegionPortal[] {
    const y = 14 * TILE_SIZE;
    if (this.region === STARTING_REGION) {
      return [
        {
          x: 37 * TILE_SIZE,
          y,
          target: HIGHLAND_REGION,
          arrivalX: 3.8 * TILE_SIZE,
          label: "高地风门",
          color: 0x90caf9,
        },
      ];
    }
    if (this.region === HIGHLAND_REGION) {
      return [
        {
          x: 3 * TILE_SIZE,
          y,
          target: STARTING_REGION,
          arrivalX: 36.2 * TILE_SIZE,
          label: "边境风门",
          color: 0xa5d6a7,
        },
        {
          x: 37 * TILE_SIZE,
          y,
          target: STARTIDE_REGION,
          arrivalX: 3.8 * TILE_SIZE,
          label: "星潮渡门",
          color: 0xce93d8,
        },
      ];
    }
    return [
      {
        x: 3 * TILE_SIZE,
        y,
        target: HIGHLAND_REGION,
        arrivalX: 36.2 * TILE_SIZE,
        label: "云脊渡门",
        color: 0x80cbc4,
      },
    ];
  }

  private createPortals() {
    for (const portal of this.getRegionPortals()) {
      this.add.circle(portal.x, portal.y, 22, portal.color, 0.78).setStrokeStyle(4, 0xffffff, 0.8);
      this.add
        .text(portal.x, portal.y + 28, portal.label, {
          fontFamily: "sans-serif",
          fontSize: "13px",
          color: "#ffffff",
          backgroundColor: "#0b1224",
          padding: { x: 5, y: 2 },
        })
        .setOrigin(0.5, 0);
    }
  }

  private findNearbyPortal(): RegionPortal | undefined {
    return this.getRegionPortals().find(
      (portal) => Phaser.Math.Distance.Between(this.player.x, this.player.y, portal.x, portal.y) < 58
    );
  }

  private getPortalPrompt(portal: RegionPortal): string {
    if (portal.target === STARTING_REGION) return "按 E 返回晴风边境";
    if (portal.target === HIGHLAND_REGION && this.region === STARTIDE_REGION) return "按 E 返回云脊高地";
    const save = loadGame(localStorage);
    if (portal.target === HIGHLAND_REGION) {
      const status = getHighlandUnlockStatus(save);
      if (status.unlocked) return "按 E 进入云脊高地";
      if (status.eligible) return "按 E 消耗木材30、石材20、晶体5，解锁并进入云脊高地";
      return `云脊高地尚未解锁 · ${status.missing.join(" · ")}`;
    }
    const status = getStartideUnlockStatus(save);
    if (status.unlocked) return "按 E 进入星潮群岛";
    if (status.eligible) return "按 E 消耗食物40、石材35、晶体20，修复渡门并进入星潮群岛";
    return `星潮群岛尚未解锁 · ${status.missing.join(" · ")}`;
  }

  private usePortal(portal: RegionPortal) {
    const current = loadGame(localStorage);
    const next =
      portal.target === HIGHLAND_REGION
        ? unlockHighlandRegion(current)
        : portal.target === STARTIDE_REGION
          ? unlockStartideRegion(current)
          : current;
    if (next !== current && !saveGame(localStorage, next)) return;
    if (!next.progress.unlockedRegions.includes(portal.target)) return;
    this.changeRegion(portal.target, portal.arrivalX);
  }

  private buildReturnData(extra: Partial<WorldSceneData> = {}): WorldSceneData {
    return {
      region: this.region,
      playerX: this.player.x,
      playerY: this.player.y,
      leaderId: this.leader.id,
      leaderUid: this.leaderUid,
      encounterCooldown: true,
      gathered: this.gathered,
      collectedResourceIds: [...this.collected],
      discoveredLocationIds: [...this.discovered],
      claimedWorldRewardIds: [...this.claimedChests],
      activatedWaypointIds: [...this.activatedWaypoints],
      revealedSectorIds: [...this.revealedSectors],
      autoExplore: { active: this.autoExploreActive, message: this.autoExploreMessage },
      ...extra,
    };
  }

  private changeRegion(region: WorldRegion, playerX: number) {
    void startScene(this, "WorldScene", {
      region,
      playerX,
      playerY: 14 * TILE_SIZE,
      leaderId: this.leader.id,
      leaderUid: this.leaderUid,
      encounterCooldown: true,
      gathered: this.gathered,
      collectedResourceIds: [...this.collected],
      discoveredLocationIds: [...this.discovered],
      claimedWorldRewardIds: [...this.claimedChests],
      activatedWaypointIds: [...this.activatedWaypoints],
      revealedSectorIds: [...this.revealedSectors],
      autoExplore: { active: this.autoExploreActive, message: this.autoExploreMessage },
    });
  }

  private tryEncounter(zone: WorldZone, period: "day" | "night") {
    if (
      this.encounterLocked ||
      this.time.now < this.encounterCooldownUntil ||
      this.time.now < this.nextEncounterCheck
    )
      return;
    this.nextEncounterCheck = this.time.now + 450;
    const tile = this.layer.getTileAtWorldXY(this.player.x, this.player.y);
    if (tile?.index !== TILE_ENCOUNTER || Math.random() >= 0.16) return;
    const enemyId = pickEncounter(zone, period);
    if (!enemyId) return;
    const save = loadGame(localStorage);
    const leaderLevel = save.ownedPals.find((pal) => pal.uid === this.leaderUid)?.level ?? 1;
    const zoneFloor = getEncounterLevelFloor(zone);
    const enemyLevel = Math.max(zoneFloor, Math.min(50, leaderLevel + Math.floor(Math.random() * 3) - 1));
    this.encounterLocked = true;
    this.player.setVelocity(0, 0);
    void startScene(this, "BattleScene", {
      playerId: this.leader.id,
      playerUid: this.leaderUid,
      enemyId,
      enemyLevel,
      region: this.region,
      autoExplore: { active: this.autoExploreActive, message: this.autoExploreMessage },
      returnTo: {
        scene: "WorldScene",
        data: this.buildReturnData(),
      },
    });
  }
}
