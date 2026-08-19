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
  HIGHLAND_REGION,
  isWorldRegion,
  STARTING_REGION,
  unlockHighlandRegion,
  type WorldRegion,
} from "../world/regions";
import { canChallengeBoss, getQuestViews, recordQuestEvent } from "../quests/questSystem";
import { bossesById } from "../battle/bosses";

interface WorldSceneData {
  region?: WorldRegion;
  playerX?: number;
  playerY?: number;
  leaderId?: number;
  leaderUid?: string;
  encounterCooldown?: boolean;
  gathered?: number;
  collectedResourceIds?: string[];
}

interface ResourceNode {
  id: string;
  x: number;
  y: number;
  label: string;
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
};

const ZONE_LABELS: Record<WorldZone, string> = {
  "sunlit-meadow": "晴风原野",
  "echo-ruins": "回声遗迹",
  "mist-terrace": "雾瀑台地",
  "storm-ridge": "风暴山脊",
};

const REGION_LABELS: Record<WorldRegion, string> = {
  frontier: "晴风边境",
  "cloudridge-highlands": "云脊高地",
};

const REGION_TILE_ASSETS: Record<WorldRegion, string> = {
  frontier: "/assets/world-tiles-frontier.png",
  "cloudridge-highlands": "/assets/world-tiles-cloudridge-highlands.png",
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
  private encounterLocked = false;
  private encounterCooldownUntil = 0;
  private nextEncounterCheck = 0;
  private touchDirection = { up: false, down: false, left: false, right: false };
  private touchInteractRequested = false;
  private region: WorldRegion = STARTING_REGION;

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
    this.collected = new Set(data.collectedResourceIds ?? []);
    const save = loadGame(localStorage);
    const requestedRegion = isWorldRegion(data.region) ? data.region : STARTING_REGION;
    this.region =
      requestedRegion === HIGHLAND_REGION && !save.progress.unlockedRegions.includes(HIGHLAND_REGION)
        ? STARTING_REGION
        : requestedRegion;
    const leader = this.resolveLeader(data.leaderId, data.leaderUid);
    this.leader = leader.species;
    this.leaderUid = leader.uid;
    this.createTextures();

    const map = this.make.tilemap({
      data: createWorldMap(this.region),
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
    this.createPortal();
    this.createBossAltar();
    this.createHud();
    this.encounterCooldownUntil = this.time.now + (data.encounterCooldown ? 2200 : 800);
  }

  update() {
    const left = this.cursors.left.isDown || this.wasd.left.isDown || this.touchDirection.left;
    const right = this.cursors.right.isDown || this.wasd.right.isDown || this.touchDirection.right;
    const up = this.cursors.up.isDown || this.wasd.up.isDown || this.touchDirection.up;
    const down = this.cursors.down.isDown || this.wasd.down.isDown || this.touchDirection.down;
    const direction = new Phaser.Math.Vector2(Number(right) - Number(left), Number(down) - Number(up));
    if (direction.lengthSq() > 0) direction.normalize().scale(180);
    this.player.setVelocity(direction.x, direction.y);

    const tileX = Math.floor(this.player.x / TILE_SIZE);
    const zone = getZoneAtTile(tileX, this.region);
    const period = getTimePeriod(new Date().getHours());
    this.zoneText.setText(
      `${REGION_LABELS[this.region]} / ${ZONE_LABELS[zone]} · ${period === "day" ? "白昼" : "夜晚"} · 领队 ${this.leader.name.zh}`
    );

    const nearest = this.findNearbyResource();
    const nearPortal = this.isNearPortal();
    const nearBoss = this.isNearBossAltar();
    const interactRequested = Phaser.Input.Keyboard.JustDown(this.interactKey) || this.touchInteractRequested;
    this.promptText.setVisible(Boolean(nearest) || nearPortal || nearBoss);
    if (nearest) {
      this.promptText.setText(`按 E 采集 ${nearest.label}`);
      if (interactRequested) this.gatherResource(nearest);
    } else if (nearPortal) {
      this.promptText.setText(this.getPortalPrompt());
      if (interactRequested) this.usePortal();
    } else if (nearBoss) {
      this.promptText.setText(this.getBossPrompt());
      if (interactRequested) this.challengeBoss();
    }
    this.touchInteractRequested = false;

    if (direction.lengthSq() > 0) this.tryEncounter(zone, period);
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
    this.createTouchControls();
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

  private createBossAltar() {
    if (this.region !== HIGHLAND_REGION) return;
    const x = 36 * TILE_SIZE;
    const y = 14 * TILE_SIZE;
    this.add.circle(x, y, 25, 0x7e57c2, 0.8).setStrokeStyle(4, 0xffd54f, 0.9);
    this.add.circle(x, y, 10, 0xffd54f, 0.85);
    this.add
      .text(x, y + 32, "风暴祭坛", {
        fontFamily: "sans-serif",
        fontSize: "13px",
        color: "#ffffff",
        backgroundColor: "#0b1224",
        padding: { x: 5, y: 2 },
      })
      .setOrigin(0.5, 0);
  }

  private isNearBossAltar(): boolean {
    return (
      this.region === HIGHLAND_REGION &&
      Phaser.Math.Distance.Between(this.player.x, this.player.y, 36 * TILE_SIZE, 14 * TILE_SIZE) < 62
    );
  }

  private getBossPrompt(): string {
    const save = loadGame(localStorage);
    if (save.progress.defeatedBossIds.includes("storm-lord")) return "风暴祭坛已经平息";
    if (canChallengeBoss(save, "storm-lord")) return "按 E 挑战 Lv.12 风暴领主（抗性 55%）";
    const challenge = getQuestViews(save).find((view) => view.definition.id === "storm-lord-challenge");
    return challenge?.status === "complete"
      ? "风暴领主已经败退，请到任务页领取奖励"
      : "风暴祭坛尚未回应 · 先完成云脊踏勘任务";
  }

  private challengeBoss() {
    const save = loadGame(localStorage);
    const boss = bossesById.get("storm-lord");
    if (!boss || !canChallengeBoss(save, boss.id)) return;
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
        data: {
          region: this.region,
          playerX: this.player.x,
          playerY: this.player.y,
          leaderId: this.leader.id,
          leaderUid: this.leaderUid,
          encounterCooldown: true,
          gathered: this.gathered,
          collectedResourceIds: [...this.collected],
        },
      },
    });
  }

  private createPortal() {
    const x = (this.region === STARTING_REGION ? 37 : 3) * TILE_SIZE;
    const y = 14 * TILE_SIZE;
    this.add
      .circle(x, y, 22, this.region === STARTING_REGION ? 0x90caf9 : 0xa5d6a7, 0.78)
      .setStrokeStyle(4, 0xffffff, 0.8);
    this.add
      .text(x, y + 28, this.region === STARTING_REGION ? "高地风门" : "边境风门", {
        fontFamily: "sans-serif",
        fontSize: "13px",
        color: "#ffffff",
        backgroundColor: "#0b1224",
        padding: { x: 5, y: 2 },
      })
      .setOrigin(0.5, 0);
  }

  private isNearPortal(): boolean {
    const x = (this.region === STARTING_REGION ? 37 : 3) * TILE_SIZE;
    return Phaser.Math.Distance.Between(this.player.x, this.player.y, x, 14 * TILE_SIZE) < 58;
  }

  private getPortalPrompt(): string {
    if (this.region === HIGHLAND_REGION) return "按 E 返回晴风边境";
    const status = getHighlandUnlockStatus(loadGame(localStorage));
    if (status.unlocked) return "按 E 进入云脊高地";
    if (status.eligible) return "按 E 消耗木材30、石材20、晶体5，解锁并进入云脊高地";
    return `云脊高地尚未解锁 · ${status.missing.join(" · ")}`;
  }

  private usePortal() {
    if (this.region === STARTING_REGION) {
      const current = loadGame(localStorage);
      const next = unlockHighlandRegion(current);
      if (next !== current && !saveGame(localStorage, next)) return;
      if (!next.progress.unlockedRegions.includes(HIGHLAND_REGION)) return;
      this.changeRegion(HIGHLAND_REGION, 3.8 * TILE_SIZE);
      return;
    }
    this.changeRegion(STARTING_REGION, 36.2 * TILE_SIZE);
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
      returnTo: {
        scene: "WorldScene",
        data: {
          region: this.region,
          playerX: this.player.x,
          playerY: this.player.y,
          leaderId: this.leader.id,
          leaderUid: this.leaderUid,
          encounterCooldown: true,
          gathered: this.gathered,
          collectedResourceIds: [...this.collected],
        },
      },
    });
  }
}
