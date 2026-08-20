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
  await clickCanvas(sessionId, 800, 74);
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
  const touchStartX = await execute(
    sessionId,
    "return window.__PL_TEST__.game.scene.getScene('WorldScene').player.x"
  );
  await pressCanvas(sessionId, 120, 563);
  await waitUntil(
    sessionId,
    "return window.__PL_TEST__.game.scene.getScene('WorldScene').player.x > arguments[0]",
    5_000,
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
  assert.ok(restored.captureOrbs > orbsBefore);
  console.log(
    "✓ 浏览器流程：任务奖励、基地制造、探索挂机、自动战斗/捕获、键盘打断、触控、移动布局、战斗升级、存档恢复与无障碍状态均通过"
  );
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
