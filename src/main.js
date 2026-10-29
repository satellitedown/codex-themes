import { CodexThemes } from './app/controller.js';

// Utility windows that share index.html (quick ask, hotkey window, desktop pet
// overlay) never get a wallpaper.
const SKIP_ROUTES = ['/spotlight', '/hotkey-window', '/avatar-overlay'];
// Only the main window renders the page-surface app shell.
const SHELL = '#root > [class*="_PageSurfaceLayout_"], #root > [class*="_FullHeightPageSurfaceLayout_"]';
const SHELL_WAIT_MS = 60_000;

// Evaluated by the launcher in every Codex page, both on attach and before
// each document load, so it must be idempotent and able to replace an older
// build that is already running in the page.
(() => {
  if (location.protocol !== 'app:') return;
  const running = window.__codexThemes;
  if (running?.buildId === __BUILD_ID__) return;
  running?.destroy();

  const route = new URLSearchParams(location.search).get('initialRoute') ?? '';
  if (SKIP_ROUTES.some((skip) => route.startsWith(skip))) return;

  let observer = null;
  let timer = 0;
  const stopWaiting = () => {
    observer?.disconnect();
    clearTimeout(timer);
  };
  // Placeholder so a second evaluation in the same document sees this build.
  window.__codexThemes = { buildId: __BUILD_ID__, destroy: stopWaiting };

  const start = () => {
    stopWaiting();
    window.__codexThemes = new CodexThemes({ buildId: __BUILD_ID__, version: __VERSION__ });
  };
  const check = () => {
    if (!document.querySelector(SHELL)) return false;
    start();
    return true;
  };

  const watchForShell = () => {
    if (check()) return;
    observer = new MutationObserver(check);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    timer = setTimeout(stopWaiting, SHELL_WAIT_MS);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchForShell, { once: true });
  else watchForShell();
})();
