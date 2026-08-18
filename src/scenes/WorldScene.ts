import Phaser from "phaser";
import { pals } from "../data/loadPals";
import { loadGame } from "../player/playerState";
import { getTimePeriod, getZoneAtTile, pickEncounter, type WorldZone } from "../world/encounters";
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

interface WorldSceneData {
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

const RESOURCES: ResourceNode[] = [
  { id: "wood-1", x: 7 * TILE_SIZE, y: 12 * TILE_SIZE, label: "轻木" },
  { id: "stone-1", x: 17 * TILE_SIZE, y: 21 * TILE_SIZE, label: "碎石" },
  { id: "crystal-1", x: 32 * TILE_SIZE, y: 13 * TILE_SIZE, label: "微光晶" },
  { id: "wood-2", x: 35 * TILE_SIZE, y: 23 * TILE_SIZE, label: "轻木" },
];

const ZONE_LABELS: Record<WorldZone, string> = {
  "sunlit-meadow": "晴风原野",
  "echo-ruins": "回声遗迹",
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

  constructor() {
    super("WorldScene");
  }

  create(data: WorldSceneData = {}) {
    this.encounterLocked = false;
    this.gathered = data.gathered ?? 0;
    this.collected = new Set(data.collectedResourceIds ?? []);
    const leader = this.resolveLeader(data.leaderId, data.leaderUid);
    this.leader = leader.species;
    this.leaderUid = leader.uid;
    this.createTextures();

    const map = this.make.tilemap({
      data: createWorldMap(),
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const tileset = map.addTilesetImage("world-tiles", "world-tiles", TILE_SIZE, TILE_SIZE, 0, 0, 0);
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
    const zone = getZoneAtTile(tileX);
    const period = getTimePeriod(new Date().getHours());
    this.zoneText.setText(
      `${ZONE_LABELS[zone]} · ${period === "day" ? "白昼" : "夜晚"} · 领队 ${this.leader.name.zh}`
    );

    const nearest = this.findNearbyResource();
    this.promptText.setVisible(Boolean(nearest));
    if (nearest) this.promptText.setText(`按 E 采集 ${nearest.label}`);
    if (nearest && (Phaser.Input.Keyboard.JustDown(this.interactKey) || this.touchInteractRequested))
      this.gatherResource(nearest);
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
    if (!this.textures.exists("world-tiles")) {
      const graphics = this.make.graphics({ x: 0, y: 0 });
      [0x315d3c, 0x263447, 0x477c4d, 0x8a795e].forEach((color, index) => {
        graphics.fillStyle(color);
        graphics.fillRect(index * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE);
        graphics.lineStyle(1, 0x1f2a37, 0.25);
        graphics.strokeRect(index * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE);
      });
      graphics.generateTexture("world-tiles", TILE_SIZE * 4, TILE_SIZE);
      graphics.destroy();
    }
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
      .text(826, 558, "E\n采集", {
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
    for (const resource of RESOURCES) {
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
    return RESOURCES.find((resource) => {
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
    this.updateResourceText();
  }

  private updateResourceText() {
    this.resourceText?.setText(`采集物 ${this.gathered}`);
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
    this.encounterLocked = true;
    this.player.setVelocity(0, 0);
    void startScene(this, "BattleScene", {
      playerId: this.leader.id,
      playerUid: this.leaderUid,
      enemyId,
      returnTo: {
        scene: "WorldScene",
        data: {
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
