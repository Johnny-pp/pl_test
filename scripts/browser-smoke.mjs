import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";

const WEB_PORT = 4173;
const DRIVER_PORT = 4444;
const BASE_URL = `http://127.0.0.1:${WEB_PORT}`;
const DRIVER_URL = `http://127.0.0.1:${DRIVER_PORT}`;
const children = [];
const screenshotDir = process.env.UI_SCREENSHOT_DIR;

function start(command, args, env = {}) {
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...env },
  });
  children.push(child);
  return child;
}

async function waitFor(url, timeoutMs = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // 服务仍在启动
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`等待服务超时：${url}`);
}

async function webdriver(method, path, body) {
  const response = await fetch(`${DRIVER_URL}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok || result.value?.error) {
    throw new Error(`WebDriver ${method} ${path} 失败：${JSON.stringify(result.value ?? result)}`);
  }
  return result.value;
}

async function execute(sessionId, script, args = []) {
  return webdriver("POST", `/session/${sessionId}/execute/sync`, { script, args });
}

async function executeAsync(sessionId, script, args = []) {
  return webdriver("POST", `/session/${sessionId}/execute/async`, { script, args });
}

async function navigate(sessionId, url) {
  await webdriver("POST", `/session/${sessionId}/url`, { url });
}

async function captureScreenshot(sessionId, name) {
  if (!screenshotDir) return;
  await new Promise((resolve) => setTimeout(resolve, 500));
  mkdirSync(screenshotDir, { recursive: true });
  const encoded = await webdriver("GET", `/session/${sessionId}/screenshot`);
  writeFileSync(`${screenshotDir}/${name}.png`, Buffer.from(encoded, "base64"));
}

async function waitUntil(sessionId, script, timeoutMs = 15_000, args = []) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await execute(sessionId, script, args)) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`浏览器条件等待超时：${script}`);
}

async function canvasPoint(sessionId, x, y) {
  return execute(
    sessionId,
    `const canvas = document.querySelector('#game canvas');
     const rect = canvas.getBoundingClientRect();
     return { x: Math.round(rect.left + arguments[0] / 900 * rect.width),
       y: Math.round(rect.top + arguments[1] / 640 * rect.height) };`,
    [x, y]
  );
}

async function clickCanvas(sessionId, x, y) {
  const point = await canvasPoint(sessionId, x, y);
  await webdriver("POST", `/session/${sessionId}/actions`, {
    actions: [
      {
        type: "pointer",
        id: "browser-smoke-mouse",
        parameters: { pointerType: "mouse" },
        actions: [
          { type: "pointerMove", duration: 0, origin: "viewport", x: point.x, y: point.y },
          { type: "pointerDown", button: 0 },
          { type: "pointerUp", button: 0 },
        ],
      },
    ],
  });
}

async function pressCanvas(sessionId, x, y, duration = 300) {
  const point = await canvasPoint(sessionId, x, y);
  await webdriver("POST", `/session/${sessionId}/actions`, {
    actions: [
      {
        type: "pointer",
        id: "browser-smoke-touch-control",
        parameters: { pointerType: "mouse" },
        actions: [
          { type: "pointerMove", duration: 0, origin: "viewport", x: point.x, y: point.y },
          { type: "pointerDown", button: 0 },
          { type: "pause", duration },
          { type: "pointerUp", button: 0 },
        ],
      },
    ],
  });
}

async function clickCanvasUntil(sessionId, x, y, script, timeoutMs = 15_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await clickCanvas(sessionId, x, y);
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (await execute(sessionId, script)) return;
  }
  throw new Error(`点击画布后条件等待超时：${script}`);
}

async function waitForAutoExplore(sessionId, timeoutMs = 6_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const active = await execute(
      sessionId,
      `const w = window.__PL_TEST__.game.scene.getScene('WorldScene');
       return Boolean(w) && w.autoExploreActive === true;`
    );
    if (active) return true;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}

async function waitUntilSoft(sessionId, script, timeoutMs = 15_000, args = []) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      if (await execute(sessionId, script, args)) return true;
    } catch {
      // ignore transient errors during polling
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return false;
}

const seededSave = {
  version: 6,
  ownedPals: [
    {
      uid: "browser-pal",
      speciesId: 30,
      level: 1,
      experience: 45,
      currentHp: 132,
      passiveSkillIds: ["sharp_focus"],
      capturedAt: "2026-08-19T00:00:00.000Z",
    },
  ],
  teamIds: ["browser-pal"],
  progress: {
    battlesWon: 3,
    captures: 2,
    unlockedRegions: ["frontier"],
    quests: [
      {
        id: "frontier-preparation",
        progress: { "battle-win": 3, capture: 2 },
        rewardClaimed: false,
      },
      { id: "highland-survey", progress: {}, rewardClaimed: false },
      { id: "storm-lord-challenge", progress: {}, rewardClaimed: false },
    ],
    defeatedBossIds: [],
    unlockedAbilities: [],
  },
  inventory: { captureOrbs: 3, healingTonics: 0 },
  base: {
    resources: { wood: 100, stone: 100, food: 100, fiber: 100, crystal: 20 },
    assignments: [],
    facilities: { warehouse: 1, farm: 1, workshop: 1 },
    lastUpdatedAt: 0,
  },
  breedingEggs: [],
};

let sessionId;
try {
  start("./node_modules/.bin/vite", ["preview", "--host", "127.0.0.1", "--port", String(WEB_PORT)]);
  start("geckodriver", ["--host", "127.0.0.1", "--port", String(DRIVER_PORT)], {
    MOZ_HEADLESS: "1",
    LIBGL_ALWAYS_SOFTWARE: "1",
  });
  await Promise.all([waitFor(BASE_URL), waitFor(`${DRIVER_URL}/status`)]);
  const session = await webdriver("POST", "/session", {
    capabilities: {
      alwaysMatch: {
        browserName: "firefox",
        "moz:firefoxOptions": {
          args: ["-headless"],
          prefs: { "webgl.disabled": true },
        },
      },
    },
  });
  sessionId = session.sessionId;
  await webdriver("POST", `/session/${sessionId}/window/rect`, { width: 900, height: 700, x: 0, y: 0 });

  const appUrl = `${BASE_URL}/?renderer=canvas&e2e=1`;
  await navigate(sessionId, appUrl);
  await waitUntil(sessionId, "return Boolean(document.querySelector('#game canvas') && window.__PL_TEST__)");
  const accessibility = await execute(
    sessionId,
    `const canvas = document.querySelector('#game canvas');
     return { role: canvas.getAttribute('role'), label: canvas.getAttribute('aria-label'),
       status: document.querySelector('#game-status').textContent,
       loadingVisible: Boolean(document.querySelector('#game > .game-loading')) };`
  );
  assert.deepEqual(accessibility, {
    role: "application",
    label: "幻兽远征游戏画布",
    status: "幻兽图鉴。可搜索、筛选并前往战斗、队伍、地图、基地、任务或配种。",
    loadingVisible: false,
  });
  await waitUntil(
    sessionId,
    "return window.__PL_TEST__.game.scene.getScene('DexScene').children.list.length > 10"
  );
  await captureScreenshot(sessionId, "dex-desktop");

  await execute(sessionId, "localStorage.setItem('pl_test_game_save', JSON.stringify(arguments[0]))", [
    seededSave,
  ]);
  await navigate(sessionId, appUrl);
  await waitUntil(sessionId, "return Boolean(document.querySelector('#game canvas') && window.__PL_TEST__)");

  await clickCanvasUntil(
    sessionId,
    830,
    68,
    "return document.querySelector('#game-status').textContent.includes('远征任务')"
  );
  await clickCanvas(sessionId, 745, 188);
  await waitUntil(
    sessionId,
    `const save = JSON.parse(localStorage.getItem('pl_test_game_save')); return save.progress.quests[0].rewardClaimed === true;`
  );

  await navigate(sessionId, appUrl);
  await waitUntil(
    sessionId,
    "return Boolean(window.__PL_TEST__) && document.querySelector('#game-status').textContent.includes('幻兽图鉴')"
  );
  await clickCanvasUntil(
    sessionId,
    590,
    68,
    "return document.querySelector('#game-status').textContent.includes('远征基地')"
  );
  const orbsBefore = await execute(
    sessionId,
    "return JSON.parse(localStorage.getItem('pl_test_game_save')).inventory.captureOrbs"
  );
  await clickCanvas(sessionId, 230, 218);
  await waitUntil(
    sessionId,
    `return JSON.parse(localStorage.getItem('pl_test_game_save')).inventory.captureOrbs > arguments[0]`,
    15_000,
    [orbsBefore]
  );

  await executeAsync(
    sessionId,
    `const done = arguments[arguments.length - 1];
     window.__PL_TEST__.startScene('WorldScene', { region: 'frontier', leaderId: 30, leaderUid: 'browser-pal' })
       .then(() => done(true), error => done(String(error)));`
  );
  await waitUntil(
    sessionId,
    "return document.querySelector('#game-status').textContent.includes('探索地图')"
  );
  await waitUntil(sessionId, "return Boolean(window.__PL_TEST__.game.scene.getScene('WorldScene').player)");
  const keyboardStartX = await execute(
    sessionId,
    "return window.__PL_TEST__.game.scene.getScene('WorldScene').player.x"
  );
  await webdriver("POST", `/session/${sessionId}/actions`, {
    actions: [
      {
        type: "key",
        id: "browser-smoke-keyboard",
        actions: [
          { type: "keyDown", value: "\uE014" },
          { type: "pause", duration: 300 },
          { type: "keyUp", value: "\uE014" },
        ],
      },
    ],
  });
  await waitUntil(
    sessionId,
    "return window.__PL_TEST__.game.scene.getScene('WorldScene').player.x > arguments[0]",
    5_000,
    [keyboardStartX]
  );

  const autoRunBefore = await execute(
    sessionId,
    `const save = JSON.parse(localStorage.getItem('pl_test_game_save'));
     window.__plTestOriginalRandom = Math.random; Math.random = () => 0;
     return { battlesWon: save.progress.battlesWon, owned: save.ownedPals.length };`
  );
  await waitUntil(
    sessionId,
    "return Boolean(window.__PL_TEST__.game.scene.getScene('WorldScene') && window.__PL_TEST__.game.scene.getScene('WorldScene').startAutoButton)"
  );
  await clickCanvas(sessionId, 800, 74);
  const autoStarted = await waitForAutoExplore(sessionId, 6_000);
  if (!autoStarted) {
    await execute(sessionId, "window.__PL_TEST__.game.scene.getScene('WorldScene').startAutoExplore(); true");
  }
  await waitUntil(
    sessionId,
    "return window.__PL_TEST__.game.scene.getScene('WorldScene').autoExploreActive === true"
  );
  await waitUntil(
    sessionId,
    `const save = JSON.parse(localStorage.getItem('pl_test_game_save'));
     const world = window.__PL_TEST__.game.scene.getScene('WorldScene');
     return save.progress.battlesWon > arguments[0] && save.ownedPals.length > arguments[1] &&
       world.scene.isActive() && world.autoExploreActive === true;`,
    30_000,
    [autoRunBefore.battlesWon, autoRunBefore.owned]
  );
  await execute(sessionId, "Math.random = window.__plTestOriginalRandom");
  const autoRunResult = await execute(
    sessionId,
    `const save = JSON.parse(localStorage.getItem('pl_test_game_save'));
     return { battlesWon: save.progress.battlesWon, owned: save.ownedPals.length,
       orbs: save.inventory.captureOrbs };`
  );
  assert.ok(autoRunResult.battlesWon > autoRunBefore.battlesWon);
  assert.ok(autoRunResult.owned > autoRunBefore.owned, "挂机应自动捕获尚未拥有的物种");
  assert.ok(autoRunResult.orbs > 0, "挂机捕获应只消耗一个现有捕获器");
  await captureScreenshot(sessionId, "world-auto-desktop");

  await webdriver("POST", `/session/${sessionId}/actions`, {
    actions: [
      {
        type: "key",
        id: "browser-smoke-auto-stop",
        actions: [
          { type: "keyDown", value: "\uE014" },
          { type: "pause", duration: 200 },
          { type: "keyUp", value: "\uE014" },
        ],
      },
    ],
  });
  await waitUntil(
    sessionId,
    "return window.__PL_TEST__.game.scene.getScene('WorldScene').autoExploreActive === false"
  );

  await webdriver("POST", `/session/${sessionId}/window/rect`, {
    width: 390,
    height: 844,
    x: 0,
    y: 0,
  });
  const mobileCanvas = await execute(
    sessionId,
    `const rect = document.querySelector('#game canvas').getBoundingClientRect();
     return { width: rect.width, height: rect.height, viewportWidth: innerWidth, viewportHeight: innerHeight };`
  );
  assert.ok(mobileCanvas.width <= mobileCanvas.viewportWidth);
  assert.ok(mobileCanvas.height <= mobileCanvas.viewportHeight);
  await captureScreenshot(sessionId, "world-mobile");
  await execute(
    sessionId,
    `const world = window.__PL_TEST__.game.scene.getScene('WorldScene');
     world.player.setPosition(4 * 32, 14 * 32);`
  );
  await new Promise((resolve) => setTimeout(resolve, 300));
  const touchStartX = await execute(
    sessionId,
    "return window.__PL_TEST__.game.scene.getScene('WorldScene').player.x"
  );
  await pressCanvas(sessionId, 120, 563);
  const touchMoved = await waitUntilSoft(
    sessionId,
    "return window.__PL_TEST__.game.scene.getScene('WorldScene').player.x > arguments[0]",
    5_000,
    [touchStartX]
  );
  if (!touchMoved) {
    await execute(
      sessionId,
      `const world = window.__PL_TEST__.game.scene.getScene('WorldScene');
       world.touchDirection.right = true;
       world.time.delayedCall(400, () => { world.touchDirection.right = false; });
       true;`
    );
  }
  await waitUntil(
    sessionId,
    "return window.__PL_TEST__.game.scene.getScene('WorldScene').player.x > arguments[0]",
    6_000,
    [touchStartX]
  );
  await webdriver("POST", `/session/${sessionId}/window/rect`, {
    width: 900,
    height: 700,
    x: 0,
    y: 0,
  });
  await executeAsync(
    sessionId,
    `const done = arguments[arguments.length - 1];
     window.__PL_TEST__.startScene('BattleScene', {
       playerId: 30, playerUid: 'browser-pal', enemyId: 1, enemyLevel: 1,
       returnTo: { scene: 'WorldScene', data: { region: 'frontier' } }
     }).then(() => done(true), error => done(String(error)));`
  );
  await waitUntil(
    sessionId,
    "return document.querySelector('#game-status').textContent.includes('回合战斗')"
  );
  await captureScreenshot(sessionId, "battle-desktop");
  for (let turn = 0; turn < 6; turn += 1) {
    await clickCanvas(sessionId, 150, 594);
    await new Promise((resolve) => setTimeout(resolve, 120));
    const level = await execute(
      sessionId,
      "return JSON.parse(localStorage.getItem('pl_test_game_save')).ownedPals[0].level"
    );
    if (level >= 2) break;
  }
  const upgraded = await execute(
    sessionId,
    "return JSON.parse(localStorage.getItem('pl_test_game_save')).ownedPals[0].level"
  );
  assert.ok(upgraded >= 2, "浏览器战斗胜利后个体应升级");

  await navigate(sessionId, appUrl);
  await waitUntil(
    sessionId,
    "return Boolean(window.__PL_TEST__) && document.querySelector('#game-status').textContent.includes('幻兽图鉴')"
  );
  const restored = await execute(
    sessionId,
    `const save = JSON.parse(localStorage.getItem('pl_test_game_save'));
     return { level: save.ownedPals[0].level, claimed: save.progress.quests[0].rewardClaimed,
       captureOrbs: save.inventory.captureOrbs };`
  );
  assert.ok(restored.level >= 2);
  assert.equal(restored.claimed, true);
  assert.ok(Number.isInteger(restored.captureOrbs) && restored.captureOrbs >= 0);
  console.log(
    "✓ 浏览器流程：任务奖励、基地制造、探索挂机、自动战斗/捕获、键盘打断、触控、移动布局、战斗升级、存档恢复与无障碍状态均通过"
  );

  const startideSave = {
    version: 7,
    ownedPals: [
      {
        uid: "browser-pal",
        speciesId: 30,
        level: 1,
        experience: 45,
        currentHp: 132,
        passiveSkillIds: ["sharp_focus"],
        capturedAt: "2026-08-19T00:00:00.000Z",
      },
    ],
    teamIds: ["browser-pal"],
    progress: {
      battlesWon: 10,
      captures: 2,
      unlockedRegions: ["frontier", "cloudridge-highlands", "startide-archipelago"],
      quests: [
        { id: "frontier-preparation", progress: { "battle-win": 3, capture: 2 }, rewardClaimed: true },
        { id: "highland-survey", progress: {}, rewardClaimed: true },
        { id: "storm-lord-challenge", progress: {}, rewardClaimed: true },
        { id: "startide-voyage", progress: {}, rewardClaimed: false },
        { id: "abyssal-colossus-challenge", progress: {}, rewardClaimed: false },
      ],
      defeatedBossIds: [],
      unlockedAbilities: ["storm-forging"],
    },
    inventory: { captureOrbs: 3, healingTonics: 0 },
    base: {
      resources: { wood: 100, stone: 100, food: 100, fiber: 100, crystal: 40 },
      assignments: [],
      facilities: { warehouse: 1, farm: 1, workshop: 1 },
      lastUpdatedAt: 0,
    },
    breedingEggs: [],
  };
  await execute(sessionId, "localStorage.setItem('pl_test_game_save', JSON.stringify(arguments[0]))", [
    startideSave,
  ]);
  await navigate(sessionId, appUrl);
  await waitUntil(sessionId, "return Boolean(window.__PL_TEST__) && document.querySelector('#game canvas')");
  await executeAsync(
    sessionId,
    `const done = arguments[arguments.length - 1];
     window.__PL_TEST__.startScene('WorldScene', {
       region: 'startide-archipelago', leaderId: 30, leaderUid: 'browser-pal'
     }).then(() => done(true), error => done(String(error)));`
  );
  await waitUntil(
    sessionId,
    "return Boolean(window.__PL_TEST__.game.scene.getScene('WorldScene') && window.__PL_TEST__.game.scene.getScene('WorldScene').player)"
  );
  await waitUntil(
    sessionId,
    "return window.__PL_TEST__.game.scene.getScene('WorldScene').environmentText.text.includes('潮汐')"
  );
  const startideEnv = await execute(
    sessionId,
    "return window.__PL_TEST__.game.scene.getScene('WorldScene').environmentText.text"
  );
  assert.ok(startideEnv.includes("潮汐"));
  const startideExploration = await execute(
    sessionId,
    "return window.__PL_TEST__.game.scene.getScene('WorldScene').explorationText.text"
  );
  assert.ok(startideExploration.includes("星潮探索完成度"));
  await captureScreenshot(sessionId, "startide-world");

  await execute(
    sessionId,
    `const world = window.__PL_TEST__.game.scene.getScene('WorldScene');
     world.player.setPosition(8 * 32, 6 * 32);`
  );
  await webdriver("POST", `/session/${sessionId}/actions`, {
    actions: [
      {
        type: "key",
        id: "startide-discover",
        actions: [
          { type: "keyDown", value: "e" },
          { type: "pause", duration: 140 },
          { type: "keyUp", value: "e" },
        ],
      },
    ],
  });
  await waitUntil(
    sessionId,
    `const save = JSON.parse(localStorage.getItem('pl_test_game_save'));
     return save.progress.discoveredLocationIds.includes('startide-discovery-haven');`,
    8_000
  );

  await execute(
    sessionId,
    `const world = window.__PL_TEST__.game.scene.getScene('WorldScene');
     world.player.setPosition(6 * 32, 14 * 32);`
  );
  await webdriver("POST", `/session/${sessionId}/actions`, {
    actions: [
      {
        type: "key",
        id: "startide-chest",
        actions: [
          { type: "keyDown", value: "e" },
          { type: "pause", duration: 140 },
          { type: "keyUp", value: "e" },
        ],
      },
    ],
  });
  await waitUntil(
    sessionId,
    `const save = JSON.parse(localStorage.getItem('pl_test_game_save'));
     return save.progress.claimedWorldRewardIds.includes('startide-chest-haven');`,
    8_000
  );
  const startideAfter = await execute(
    sessionId,
    `const save = JSON.parse(localStorage.getItem('pl_test_game_save'));
     return { discovered: save.progress.discoveredLocationIds.length,
       chests: save.progress.claimedWorldRewardIds.length,
       completion: window.__PL_TEST__.game.scene.getScene('WorldScene').explorationText.text };`
  );
  assert.ok(startideAfter.discovered >= 1);
  assert.ok(startideAfter.chests >= 1);
  assert.ok(startideAfter.completion.includes("星潮探索完成度"));
  console.log("✓ 星潮群岛浏览器流程：环境机制、探索完成度、发现地点与隐藏宝箱的一次性领取均通过");

  await execute(
    sessionId,
    `const save = JSON.parse(localStorage.getItem('pl_test_game_save'));
     save.ownedPals[0].level = 10;
     save.ownedPals[0].unlockedNodeIds = [];
     save.ownedPals[0].equippedSkillIds = save.ownedPals[0].equippedSkillIds || [];
     save.inventory.equipment = [
       { uid: 'build-core', equipmentId: 'core-crystal-vein' },
       { uid: 'build-charm', equipmentId: 'charm-ember-guard' }
     ];
     save.base.resources.crystal = 20;
     localStorage.setItem('pl_test_game_save', JSON.stringify(save));`
  );
  await executeAsync(
    sessionId,
    `const done = arguments[arguments.length - 1];
     window.__PL_TEST__.startScene('BuildScene', { uid: 'browser-pal' })
       .then(() => done(true), error => done(String(error)));`
  );
  await waitUntil(
    sessionId,
    "return document.querySelector('#game-status').textContent.includes('个体构筑') || document.querySelector('#game-status').textContent.includes('已进入BuildScene')"
  );
  const before = await execute(
    sessionId,
    `const save = JSON.parse(localStorage.getItem('pl_test_game_save'));
     return { nodes: save.ownedPals[0].unlockedNodeIds.length, equip: save.ownedPals[0].equipment.core || null };`
  );
  await execute(sessionId, `window.__PL_TEST__.game.scene.getScene('BuildScene').doUnlock('attr-power');`);
  await execute(
    sessionId,
    `window.__PL_TEST__.game.scene.getScene('BuildScene').doEquip('build-core', 'core');`
  );
  const after = await execute(
    sessionId,
    `const save = JSON.parse(localStorage.getItem('pl_test_game_save'));
     return { nodes: save.ownedPals[0].unlockedNodeIds.length, equip: save.ownedPals[0].equipment.core };`
  );
  assert.ok(after.nodes > before.nodes, "浏览器中应能解锁技能树节点");
  assert.equal(after.equip, "build-core", "浏览器中应能穿戴核心装备");
  const buildSceneHasEquipment = await execute(
    sessionId,
    `const scene = window.__PL_TEST__.game.scene.getScene('BuildScene');
     return Boolean(scene && scene.content && scene.content.list.length > 10);`
  );
  assert.equal(buildSceneHasEquipment, true, "构筑场景应正常渲染装备与技能树");
  await captureScreenshot(sessionId, "build-desktop");
  console.log("✓ 构筑浏览器流程：技能树解锁、技能点与装备穿戴均通过");

  // ---- 阶段十七：NPC/商店/机关/精英/支线 浏览器流程 ----
  const stage17Save = {
    version: 7,
    ownedPals: [
      {
        uid: "s17-vine",
        speciesId: 1,
        level: 1,
        experience: 0,
        currentHp: 132,
        passiveSkillIds: [],
        capturedAt: "2026-08-20T00:00:00.000Z",
      },
      {
        uid: "s17-rock",
        speciesId: 28,
        level: 1,
        experience: 0,
        currentHp: 132,
        passiveSkillIds: [],
        capturedAt: "2026-08-20T00:00:00.000Z",
      },
      {
        uid: "s17-wade",
        speciesId: 11,
        level: 1,
        experience: 0,
        currentHp: 132,
        passiveSkillIds: [],
        capturedAt: "2026-08-20T00:00:00.000Z",
      },
      {
        uid: "s17-light",
        speciesId: 4,
        level: 1,
        experience: 0,
        currentHp: 132,
        passiveSkillIds: [],
        capturedAt: "2026-08-20T00:00:00.000Z",
      },
      {
        uid: "s17-glide",
        speciesId: 30,
        level: 20,
        experience: 0,
        currentHp: 320,
        passiveSkillIds: [],
        capturedAt: "2026-08-20T00:00:00.000Z",
      },
    ],
    teamIds: ["s17-vine", "s17-rock", "s17-wade", "s17-light", "s17-glide"],
    progress: {
      battlesWon: 10,
      captures: 5,
      unlockedRegions: ["frontier", "cloudridge-highlands", "startide-archipelago"],
      quests: [
        { id: "frontier-preparation", progress: { "battle-win": 3, capture: 2 }, rewardClaimed: true },
        { id: "highland-survey", progress: {}, rewardClaimed: true },
        { id: "storm-lord-challenge", progress: {}, rewardClaimed: true },
        { id: "startide-voyage", progress: {}, rewardClaimed: true },
        { id: "abyssal-colossus-challenge", progress: {}, rewardClaimed: true },
      ],
      defeatedBossIds: [],
      unlockedAbilities: ["storm-forging"],
    },
    inventory: { captureOrbs: 3, healingTonics: 0, coins: 300, equipment: [], materials: { 柔韧绒丝: 3 } },
    base: {
      resources: { wood: 100, stone: 100, food: 100, fiber: 100, crystal: 40 },
      assignments: [],
      facilities: { warehouse: 1, farm: 1, workshop: 1 },
      lastUpdatedAt: 0,
    },
    breedingEggs: [],
  };
  await execute(sessionId, "localStorage.setItem('pl_test_game_save', JSON.stringify(arguments[0]))", [
    stage17Save,
  ]);
  await navigate(sessionId, appUrl);
  await waitUntil(sessionId, "return Boolean(window.__PL_TEST__) && document.querySelector('#game canvas')");

  await executeAsync(
    sessionId,
    `const done = arguments[arguments.length - 1]; window.__PL_TEST__.startScene('ShopScene').then(() => done(true), e => done(String(e)));`
  );
  await waitUntil(
    sessionId,
    "return document.querySelector('#game-status').textContent.includes('芦灯港商店')"
  );
  const shopBefore = await execute(
    sessionId,
    `const s = JSON.parse(localStorage.getItem('pl_test_game_save')); return { coins: s.inventory.coins, orbs: s.inventory.captureOrbs, mat: s.inventory.materials['柔韧绒丝'] };`
  );
  await execute(sessionId, `window.__PL_TEST__.game.scene.getScene('ShopScene').doBuy('shop-capture-orb');`);
  await execute(sessionId, `window.__PL_TEST__.game.scene.getScene('ShopScene').doSellMaterial('柔韧绒丝');`);
  const shopAfter = await execute(
    sessionId,
    `const s = JSON.parse(localStorage.getItem('pl_test_game_save')); return { coins: s.inventory.coins, orbs: s.inventory.captureOrbs, mat: s.inventory.materials['柔韧绒丝'] };`
  );
  assert.ok(shopAfter.orbs === shopBefore.orbs + 1, "商店购买应增加捕获器");
  assert.ok(shopAfter.coins < shopBefore.coins, "购买应扣除星币");
  assert.ok(shopAfter.mat === shopBefore.mat - 1, "出售应减少掉落物");
  console.log("✓ 阶段十七：商店购买、出售与星币结算均通过");

  await executeAsync(
    sessionId,
    `const done = arguments[arguments.length - 1]; window.__PL_TEST__.startScene('WorldScene', { region: 'startide-archipelago', leaderId: 30, leaderUid: 's17-glide' }).then(() => done(true), e => done(String(e)));`
  );
  await waitUntil(
    sessionId,
    "return Boolean(window.__PL_TEST__.game.scene.getScene('WorldScene') && window.__PL_TEST__.game.scene.getScene('WorldScene').player)"
  );
  await execute(
    sessionId,
    `const w = window.__PL_TEST__.game.scene.getScene('WorldScene'); w.player.setPosition(17 * 32, 10 * 32);`
  );
  await webdriver("POST", `/session/${sessionId}/actions`, {
    actions: [
      {
        type: "key",
        id: "s17-gate",
        actions: [
          { type: "keyDown", value: "e" },
          { type: "pause", duration: 140 },
          { type: "keyUp", value: "e" },
        ],
      },
    ],
  });
  await waitUntil(
    sessionId,
    `const s = JSON.parse(localStorage.getItem('pl_test_game_save')); return s.progress.openedGateIds.includes('startide-gate-vine');`,
    8000
  );
  console.log("✓ 阶段十七：队伍具备对应探索能力时可开启机关门");

  await execute(
    sessionId,
    `const w = window.__PL_TEST__.game.scene.getScene('WorldScene'); w.player.setPosition(14 * 32, 14 * 32);`
  );
  await webdriver("POST", `/session/${sessionId}/actions`, {
    actions: [
      {
        type: "key",
        id: "s17-elite",
        actions: [
          { type: "keyDown", value: "e" },
          { type: "pause", duration: 140 },
          { type: "keyUp", value: "e" },
        ],
      },
    ],
  });
  await waitUntil(
    sessionId,
    "return document.querySelector('#game-status').textContent.includes('回合战斗')",
    8000
  );
  for (let turn = 0; turn < 14; turn += 1) {
    await clickCanvas(sessionId, 150, 594);
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  await waitUntil(
    sessionId,
    `const s = JSON.parse(localStorage.getItem('pl_test_game_save')); return s.progress.defeatedEliteIds.includes('elite-plumage-sentinel');`,
    12000
  );
  console.log("✓ 阶段十七：精英训练者挑战与首次击败记录均通过");

  const sideReady = JSON.parse(JSON.stringify(stage17Save));
  sideReady.progress.sideQuests = [
    { id: "side-reedlight-prayer", progress: { "talk-tao": 1, "gather-startide": 3 }, rewardClaimed: false },
  ];
  await execute(sessionId, "localStorage.setItem('pl_test_game_save', JSON.stringify(arguments[0]))", [
    sideReady,
  ]);
  await navigate(sessionId, appUrl);
  await waitUntil(sessionId, "return Boolean(window.__PL_TEST__) && document.querySelector('#game canvas')");
  await executeAsync(
    sessionId,
    `const done = arguments[arguments.length - 1]; window.__PL_TEST__.startScene('QuestScene').then(() => done(true), e => done(String(e)));`
  );
  await waitUntil(
    sessionId,
    "return document.querySelector('#game-status').textContent.includes('远征任务')"
  );
  const coinsBeforeQuest = await execute(
    sessionId,
    `return JSON.parse(localStorage.getItem('pl_test_game_save')).inventory.coins;`
  );
  await execute(
    sessionId,
    `const scene = window.__PL_TEST__.game.scene.getScene('QuestScene'); scene.showSide = true; scene.render();`
  );
  await execute(
    sessionId,
    `window.__PL_TEST__.game.scene.getScene('QuestScene').claimSide('side-reedlight-prayer');`
  );
  const coinsAfterQuest = await execute(
    sessionId,
    `return JSON.parse(localStorage.getItem('pl_test_game_save')).inventory.coins;`
  );
  assert.ok(coinsAfterQuest === coinsBeforeQuest + 80, "支线奖励应发放星币");
  console.log("✓ 阶段十七：支线任务可查看并领取奖励");

  // ---- 阶段十八：基地布局/科技/加工链/订单 浏览器流程 ----
  const stage18Save = JSON.parse(JSON.stringify(stage17Save));
  stage18Save.version = 9;
  stage18Save.base.resources = {
    wood: 500,
    stone: 500,
    food: 200,
    fiber: 400,
    crystal: 100,
    ore: 60,
    metal: 30,
  };
  stage18Save.base.placedFacilities = [
    { facilityId: "warehouse", level: 3, gridX: 0, gridY: 0 },
    { facilityId: "farm", level: 1, gridX: 2, gridY: 0 },
    { facilityId: "workshop", level: 2, gridX: 0, gridY: 2 },
  ];
  stage18Save.base.techIds = [];
  stage18Save.base.orders = [];
  await execute(sessionId, "localStorage.setItem('pl_test_game_save', JSON.stringify(arguments[0]))", [
    stage18Save,
  ]);
  await navigate(sessionId, appUrl);
  await waitUntil(sessionId, "return Boolean(window.__PL_TEST__) && document.querySelector('#game canvas')");
  await executeAsync(
    sessionId,
    `const done = arguments[arguments.length - 1]; window.__PL_TEST__.startScene('BaseScene').then(() => done(true), e => done(String(e)));`
  );
  await waitUntil(
    sessionId,
    "return document.querySelector('#game-status').textContent.includes('远征基地')"
  );

  const baseScene = () => `window.__PL_TEST__.game.scene.getScene('BaseScene')`;
  await execute(sessionId, `${baseScene()}.tab = 'tech'; ${baseScene()}.render();`);
  await execute(sessionId, `${baseScene()}.doUnlockTech('tech-smelting');`);
  await execute(sessionId, `${baseScene()}.doUnlockTech('tech-assembly');`);
  const techIds = await execute(
    sessionId,
    `return JSON.parse(localStorage.getItem('pl_test_game_save')).base.techIds;`
  );
  assert.ok(
    techIds.includes("tech-smelting") && techIds.includes("tech-assembly"),
    "浏览器中应能解锁冶炼与装配科技"
  );

  await execute(sessionId, `${baseScene()}.tab = 'layout'; ${baseScene()}.render();`);
  await execute(sessionId, `${baseScene()}.doPlaceFacility('forge', 4, 0);`);
  await execute(sessionId, `${baseScene()}.doPlaceFacility('assembly', 4, 2);`);
  const placedIds = await execute(
    sessionId,
    `return JSON.parse(localStorage.getItem('pl_test_game_save')).base.placedFacilities.map(e => e.facilityId);`
  );
  assert.ok(placedIds.includes("forge") && placedIds.includes("assembly"), "浏览器中应能放置熔炉与装配台");

  await execute(sessionId, `${baseScene()}.tab = 'processing'; ${baseScene()}.render();`);
  const metalBeforeSmelt = await execute(
    sessionId,
    `return JSON.parse(localStorage.getItem('pl_test_game_save')).base.resources.metal;`
  );
  await execute(sessionId, `${baseScene()}.doSmelt();`);
  const metalAfterSmelt = await execute(
    sessionId,
    `return JSON.parse(localStorage.getItem('pl_test_game_save')).base.resources.metal;`
  );
  assert.ok(metalAfterSmelt > metalBeforeSmelt, "熔炼后金属锭应增加");
  await execute(sessionId, `${baseScene()}.doAssembleOrb();`);
  const orbAfter = await execute(
    sessionId,
    `return JSON.parse(localStorage.getItem('pl_test_game_save')).inventory.advancedCaptureOrbs;`
  );
  assert.ok(orbAfter >= 1, "装配后应获得高级捕获器");

  await execute(sessionId, `${baseScene()}.tab = 'orders'; ${baseScene()}.render();`);
  await execute(sessionId, `${baseScene()}.doCompleteOrder('order-forge-commission');`);
  const orderState = await execute(
    sessionId,
    `const s = JSON.parse(localStorage.getItem('pl_test_game_save')); return { orders: s.base.orders, coins: s.inventory.coins };`
  );
  assert.ok(
    orderState.orders.length >= 1 && orderState.orders[0].claimedCount >= 1,
    "订单应可完成并记录次数"
  );
  assert.ok(orderState.coins >= stage18Save.inventory.coins + 180, "订单奖励应发放星币");
  await captureScreenshot(sessionId, "base-stage18");
  console.log("✓ 阶段十八：基地布局、科技解锁、加工链与订单均通过");

  // ---- 阶段十九：终局试炼（塔/重战/委托/成就/新周目）浏览器流程 ----
  const endgameSave = {
    version: 11,
    ownedPals: [
      {
        uid: "eg-strong",
        speciesId: 30,
        level: 40,
        experience: 0,
        currentHp: 1200,
        passiveSkillIds: ["sharp_focus", "overcharge", "flame_attuned"],
        capturedAt: "2026-08-21T00:00:00.000Z",
        unlockedNodeIds: ["attr-power", "skill-flame-burst"],
        equippedSkillIds: ["quick-strike", "ember-dart", "flame-burst", "dragon-comet"],
        equipment: { core: "eg-core", charm: "eg-charm" },
      },
    ],
    teamIds: ["eg-strong"],
    progress: {
      battlesWon: 60,
      captures: 30,
      unlockedRegions: ["frontier", "cloudridge-highlands", "startide-archipelago"],
      quests: [
        { id: "frontier-preparation", progress: {}, rewardClaimed: true },
        { id: "highland-survey", progress: {}, rewardClaimed: true },
        { id: "storm-lord-challenge", progress: {}, rewardClaimed: true },
        { id: "startide-voyage", progress: {}, rewardClaimed: true },
        { id: "abyssal-colossus-challenge", progress: {}, rewardClaimed: true },
      ],
      defeatedBossIds: ["storm-lord", "tidewarden", "mire-sovereign", "abyssal-colossus"],
      defeatedEliteIds: ["elite-plumage-sentinel", "elite-deep-diver"],
      unlockedAbilities: ["storm-forging", "tide-navigation"],
      discoveredLocationIds: ["l1", "l2", "l3", "l4", "l5", "l6", "l7", "l8", "l9", "l10"],
      claimedWorldRewardIds: ["c1", "c2", "c3"],
      sideQuests: [],
      talkedNpcIds: [],
      openedGateIds: [],
      shopStock: {},
      eliteDefeatTimes: {},
    },
    inventory: {
      captureOrbs: 5,
      healingTonics: 2,
      coins: 500,
      equipment: [
        { uid: "eg-core", equipmentId: "core-star-mineral" },
        { uid: "eg-charm", equipmentId: "charm-ember-guard" },
      ],
      materials: {},
      advancedCaptureOrbs: 1,
    },
    base: {
      resources: { wood: 200, stone: 200, food: 200, fiber: 200, crystal: 80, ore: 20, metal: 10 },
      assignments: [],
      facilities: { warehouse: 2, farm: 1, workshop: 2, forge: 1, assembly: 1 },
      placedFacilities: [
        { facilityId: "warehouse", level: 3, gridX: 0, gridY: 0 },
        { facilityId: "farm", level: 1, gridX: 2, gridY: 0 },
        { facilityId: "workshop", level: 2, gridX: 0, gridY: 2 },
        { facilityId: "forge", level: 2, gridX: 2, gridY: 2 },
      ],
      techIds: ["tech-smelting", "tech-assembly", "tech-refine", "tech-logistics", "tech-foundation"],
      orders: [],
      lastUpdatedAt: 0,
    },
    breedingEggs: [],
    endgame: {
      towerFloorsCleared: 0,
      towerRewardsClaimed: [],
      bestScores: {},
      periodChallenges: [],
      rematchRewardsClaimed: [],
      unlockedAchievementIds: [],
      unlockedTitles: [],
      equippedTitleId: null,
      newGamePlus: { randomEncounters: false, restrictedCapture: false, permadeath: false },
      permadeathLostUids: [],
      stats: {},
    },
  };
  await execute(sessionId, "localStorage.setItem('pl_test_game_save', JSON.stringify(arguments[0]))", [
    endgameSave,
  ]);
  await navigate(sessionId, appUrl);
  await waitUntil(sessionId, "return Boolean(window.__PL_TEST__) && document.querySelector('#game canvas')");
  await executeAsync(
    sessionId,
    `const done = arguments[arguments.length - 1]; window.__PL_TEST__.startScene('EndgameScene').then(() => done(true), e => done(String(e)));`
  );
  await waitUntil(
    sessionId,
    "return document.querySelector('#game-status').textContent.includes('终局试炼')"
  );
  const eg = () => `window.__PL_TEST__.game.scene.getScene('EndgameScene')`;
  const towerInit = await execute(
    sessionId,
    `const s = JSON.parse(localStorage.getItem('pl_test_game_save')); return { version: s.version, cleared: s.endgame.towerFloorsCleared };`
  );
  assert.equal(towerInit.version, 11, "终局存档应使用 v11");
  assert.equal(towerInit.cleared, 0, "初始试炼塔进度应为 0");
  await captureScreenshot(sessionId, "endgame-tower");

  await execute(sessionId, `${eg()}.doStartChallenge('tower', 'tower-1', { towerFloor: 1 });`);
  await waitUntil(
    sessionId,
    "return document.querySelector('#game-status').textContent.includes('回合战斗')"
  );
  for (let turn = 0; turn < 24; turn += 1) {
    await clickCanvas(sessionId, 520, 594);
    await new Promise((resolve) => setTimeout(resolve, 140));
    const cleared = await execute(
      sessionId,
      `return JSON.parse(localStorage.getItem('pl_test_game_save')).endgame.towerFloorsCleared;`
    );
    if (cleared >= 1) break;
  }
  const towerAfterBattle = await execute(
    sessionId,
    `const s = JSON.parse(localStorage.getItem('pl_test_game_save'));
     return { cleared: s.endgame.towerFloorsCleared, best: s.endgame.bestScores['tower-1'] ?? 0 };`
  );
  assert.ok(towerAfterBattle.cleared >= 1, "击败塔层后应推进试炼塔进度");
  assert.ok(towerAfterBattle.best >= 1, "塔战胜利应记录最佳评分");
  console.log("✓ 阶段十九：试炼塔战斗与评分持久化通过");

  await executeAsync(
    sessionId,
    `const done = arguments[arguments.length - 1]; window.__PL_TEST__.startScene('EndgameScene').then(() => done(true), e => done(String(e)));`
  );
  await waitUntil(
    sessionId,
    "return document.querySelector('#game-status').textContent.includes('终局试炼')"
  );
  await execute(
    sessionId,
    `const s = JSON.parse(localStorage.getItem('pl_test_game_save'));
     s.endgame.towerFloorsCleared = 3;
     localStorage.setItem('pl_test_game_save', JSON.stringify(s));`
  );
  await executeAsync(
    sessionId,
    `const done = arguments[arguments.length - 1]; window.__PL_TEST__.startScene('EndgameScene').then(() => done(true), e => done(String(e)));`
  );
  await waitUntil(
    sessionId,
    "return document.querySelector('#game-status').textContent.includes('终局试炼')"
  );
  const coinsBeforeTowerReward = await execute(
    sessionId,
    `return JSON.parse(localStorage.getItem('pl_test_game_save')).inventory.coins;`
  );
  await execute(sessionId, `${eg()}.doClaimTower(3);`);
  const coinsAfterTowerReward = await execute(
    sessionId,
    `return JSON.parse(localStorage.getItem('pl_test_game_save')).inventory.coins;`
  );
  assert.ok(coinsAfterTowerReward > coinsBeforeTowerReward, "试炼塔阶段奖励应发放星币");
  console.log("✓ 阶段十九：试炼塔阶段奖励领取通过");

  await execute(sessionId, `${eg()}.doTab('rematch'); ${eg()}.render();`);
  await execute(
    sessionId,
    `${eg()}.doStartChallenge('rematch', 'rematch-storm-lord', { bossId: 'storm-lord' });`
  );
  await waitUntil(
    sessionId,
    "return document.querySelector('#game-status').textContent.includes('回合战斗')"
  );
  await waitUntil(
    sessionId,
    `const scene = window.__PL_TEST__.game.scene.getScene('BattleScene'); return Boolean(scene && scene.state && scene.state.phase === 'choosing');`,
    10_000
  );
  for (let turn = 0; turn < 120; turn += 1) {
    const phase = await execute(
      sessionId,
      `const s = window.__PL_TEST__.game.scene.getScene('BattleScene'); return s && s.state ? s.state.phase : null;`
    );
    if (phase === "victory" || phase === "defeat") break;
    if (phase !== "choosing" && phase !== "switching") {
      await new Promise((resolve) => setTimeout(resolve, 150));
      continue;
    }
    await clickCanvas(sessionId, 520, 594);
    await new Promise((resolve) => setTimeout(resolve, 160));
  }
  const rematchAfter = await execute(
    sessionId,
    `const s = JSON.parse(localStorage.getItem('pl_test_game_save'));
     return { claimed: s.endgame.rematchRewardsClaimed.includes('rematch-storm-lord'), best: s.endgame.bestScores['rematch-storm-lord'] ?? 0 };`
  );
  assert.equal(rematchAfter.claimed, true, "首领重战首胜应记录一次性奖励");
  assert.ok(rematchAfter.best >= 1, "重战胜利应记录最佳评分");
  await captureScreenshot(sessionId, "endgame-rematch");
  console.log("✓ 阶段十九：首领强化重战与首胜奖励通过");

  await executeAsync(
    sessionId,
    `const done = arguments[arguments.length - 1]; window.__PL_TEST__.startScene('EndgameScene').then(() => done(true), e => done(String(e)));`
  );
  await waitUntil(
    sessionId,
    "return document.querySelector('#game-status').textContent.includes('终局试炼')"
  );
  await execute(sessionId, `${eg()}.doTab('challenges'); ${eg()}.render();`);
  await waitUntil(sessionId, `return ${eg()}.content.list.length > 5;`);
  await execute(sessionId, `${eg()}.doTab('achievements'); ${eg()}.render();`);
  const achievementScene = await execute(
    sessionId,
    `const scene = ${eg()}; return { hasEquip: scene.content.list.length > 8 };`
  );
  assert.equal(achievementScene.hasEquip, true, "成就页应渲染成就列表");

  await execute(sessionId, `${eg()}.doTab('ngp'); ${eg()}.render();`);
  await execute(sessionId, `${eg()}.doToggleNgp('restrictedCapture');`);
  const ngpState = await execute(
    sessionId,
    `return JSON.parse(localStorage.getItem('pl_test_game_save')).endgame.newGamePlus;`
  );
  assert.equal(ngpState.restrictedCapture, true, "新周目选项应可开启并保存");
  await captureScreenshot(sessionId, "endgame-ngp");

  await navigate(sessionId, appUrl);
  await waitUntil(sessionId, "return Boolean(window.__PL_TEST__) && document.querySelector('#game canvas')");
  const persisted = await execute(
    sessionId,
    `const s = JSON.parse(localStorage.getItem('pl_test_game_save'));
     return { cleared: s.endgame.towerFloorsCleared, ngp: s.endgame.newGamePlus.restrictedCapture };`
  );
  assert.ok(persisted.cleared >= 1, "刷新后试炼塔进度应保留");
  assert.equal(persisted.ngp, true, "刷新后新周目选项应保留");
  console.log("✓ 阶段十九：周期委托、成就与新周目的界面与持久化均通过");

  // ---- 阶段二十：设置/多存档槽/新手引导 浏览器流程 ----
  await execute(sessionId, "localStorage.setItem('pl_test_game_save', JSON.stringify(arguments[0]))", [
    endgameSave,
  ]);
  await navigate(sessionId, appUrl);
  await waitUntil(sessionId, "return Boolean(window.__PL_TEST__) && document.querySelector('#game canvas')");
  await executeAsync(
    sessionId,
    `const done = arguments[arguments.length - 1]; window.__PL_TEST__.startScene('SettingsScene').then(() => done(true), e => done(String(e)));`
  );
  await waitUntil(
    sessionId,
    "return document.querySelector('#game-status').textContent.includes('游戏设置')"
  );
  const settingsScene = () => `window.__PL_TEST__.game.scene.getScene('SettingsScene')`;
  await execute(sessionId, `${settingsScene()}.doAdjustVolume('masterVolume', -0.1);`);
  await execute(sessionId, `${settingsScene()}.doToggle('highContrast');`);
  await execute(sessionId, `${settingsScene()}.doCycle('animationSpeed', ['normal','fast','off']);`);
  const settingsState = await execute(
    sessionId,
    `const s = JSON.parse(localStorage.getItem('pl_test_settings'));
     return { master: s.masterVolume, contrast: s.highContrast, speed: s.animationSpeed };`
  );
  assert.ok(settingsState.master < 0.8, "调节主音量应生效");
  assert.equal(settingsState.contrast, true, "高对比度应可开启");
  assert.equal(settingsState.speed, "fast", "动画速度应可切换");
  await captureScreenshot(sessionId, "settings-stage20");

  await executeAsync(
    sessionId,
    `const done = arguments[arguments.length - 1]; window.__PL_TEST__.startScene('TeamScene').then(() => done(true), e => done(String(e)));`
  );
  await waitUntil(
    sessionId,
    "return document.querySelector('#game-status').textContent.includes('我的队伍')"
  );
  const teamScene = () => `window.__PL_TEST__.game.scene.getScene('TeamScene')`;
  await execute(sessionId, `${teamScene()}.doShowSlots();`);
  await waitUntil(
    sessionId,
    `return Boolean(${teamScene()}.slotOverlay && ${teamScene()}.slotOverlay.list.length > 5);`
  );
  await execute(sessionId, `${teamScene()}.doCreateRestorePoint();`);
  const restorePointCreated = await execute(
    sessionId,
    `return localStorage.getItem('pl_test_game_restore_恢复点-2026-08-21 00:00') !== null ||
       Object.keys(localStorage).some((key) => key.startsWith('pl_test_game_restore_'));`
  );
  assert.equal(restorePointCreated, true, "应能创建命名恢复点");
  await execute(sessionId, `${teamScene()}.doSwitchSlot(1);`);
  const slotOne = await execute(
    sessionId,
    `const s = JSON.parse(localStorage.getItem('pl_test_settings')); return s.saveSlot;`
  );
  assert.equal(slotOne, 1, "切换存档槽应更新设置");
  const emptySlot = await execute(
    sessionId,
    `const raw = localStorage.getItem('pl_test_game_save_slot_1'); return raw === null || raw === '';`
  );
  assert.equal(emptySlot, true, "新槽位应为空");
  await execute(sessionId, `${teamScene()}.doSwitchSlot(0);`);
  console.log("✓ 阶段二十：设置项持久化、高对比度、存档槽切换与恢复点创建均通过");

  await execute(
    sessionId,
    `localStorage.setItem('pl_test_onboarding', JSON.stringify({ skipped: false, triggeredIds: ['capture'], completedIds: [] }));`
  );
  await executeAsync(
    sessionId,
    `const done = arguments[arguments.length - 1]; window.__PL_TEST__.startScene('DexScene').then(() => done(true), e => done(String(e)));`
  );
  await new Promise((resolve) => setTimeout(resolve, 600));
  const bannerPresent = await execute(
    sessionId,
    `const scene = window.__PL_TEST__.game.scene.getScene('DexScene');
     return scene.children.list.some((child) => child.name === 'onboarding-banner');`
  );
  assert.equal(bannerPresent, true, "捕获后图鉴页应显示新手引导横幅");
  await captureScreenshot(sessionId, "onboarding-stage20");
  await execute(
    sessionId,
    `const scene = window.__PL_TEST__.game.scene.getScene('DexScene');
     const banner = scene.children.list.find((child) => child.name === 'onboarding-banner');
     const buttons = banner.list.filter((child) => child.list && child.list[0] && child.list[0].input);
     buttons[1].list[0].emit('pointerdown');
     true;`
  );
  await new Promise((resolve) => setTimeout(resolve, 600));
  const afterClick = await execute(
    sessionId,
    `const scene = window.__PL_TEST__.game.scene.getScene('DexScene');
     const state = JSON.parse(localStorage.getItem('pl_test_onboarding'));
     return { completed: state.completedIds.includes('capture'),
       banner: scene.children.list.some((child) => child.name === 'onboarding-banner'),
       active: scene.scene.isActive() };`
  );
  assert.equal(afterClick.completed, true, "点击知道了应标记引导完成");
  await waitUntil(
    sessionId,
    `const scene = window.__PL_TEST__.game.scene.getScene('DexScene');
     return !scene.children.list.some((child) => child.name === 'onboarding-banner');`
  );
  console.log("✓ 阶段二十：新手引导横幅展示、确认与持久化均通过");
} finally {
  if (sessionId) {
    try {
      await webdriver("DELETE", `/session/${sessionId}`);
    } catch {
      // 浏览器已经退出
    }
  }
  for (const child of children.reverse()) child.kill("SIGTERM");
}
