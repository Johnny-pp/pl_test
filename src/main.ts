const gameRoot = document.querySelector<HTMLElement>("#game");

function showFatalError(reason: unknown): void {
  const message = reason instanceof Error ? reason.message : String(reason);
  if (!gameRoot) return;
  gameRoot.innerHTML = `
    <main class="fatal-error" role="alert">
      <h1>游戏加载失败</h1>
      <p>${escapeHtml(message)}</p>
      <button type="button" onclick="window.location.reload()">重新加载</button>
    </main>`;
}

function escapeHtml(value: string): string {
  const node = document.createElement("span");
  node.textContent = value;
  return node.innerHTML;
}

window.addEventListener("error", (event) => showFatalError(event.error ?? event.message));
window.addEventListener("unhandledrejection", (event) => showFatalError(event.reason));

if (gameRoot) {
  gameRoot.innerHTML = '<p class="game-loading" role="status">正在加载星屿世界…</p>';
}

// 生产环境注册基础离线缓存（网络优先）；e2e 测试模式跳过以避免缓存干扰。
if (
  import.meta.env.PROD &&
  !new URLSearchParams(window.location.search).has("e2e") &&
  "serviceWorker" in navigator
) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Service Worker 不可用时静默降级为普通加载
    });
  });
}

import("./bootstrap").then(({ startGame }) => startGame()).catch(showFatalError);
