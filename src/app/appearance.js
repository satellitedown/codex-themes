/**
 * Codex's own appearance setting (`appearanceTheme`: system | light | dark).
 * Writing it through Codex's host settings service means Codex persists it,
 * every window follows, and its Settings page shows the change. The service is
 * reached through Codex's already-loaded shared module (import() returns the
 * same instance) and found by shape, since export names are minified per build.
 */
const SETTING = 'appearanceTheme';

let lookup = null;

function findSettings() {
  lookup ??= (async () => {
    const url = [...document.querySelectorAll('script[src], link[rel="modulepreload"][href]')]
      .map((el) => el.src || el.href)
      .find((href) => /\/app-shared-[\w-]+\.js$/.test(href));
    if (!url) return null;
    const mod = await import(url);
    for (const key of Object.keys(mod)) {
      let value;
      try {
        value = mod[key];
      } catch {
        continue; // uninitialised binding
      }
      // Live binding: re-read on each use in case Codex swaps its host services.
      if (typeof value?.settings?.write === 'function') return () => mod[key]?.settings;
    }
    return null;
  })().catch(() => null);
  return lookup;
}

/** Whether this Codex build exposes the settings service. */
export async function canSetAppearance() {
  return (await findSettings()) !== null;
}

/** Sets Codex to light (`day`) or dark (`night`) appearance. */
export async function setAppearance(scheme) {
  const settings = (await findSettings())?.();
  if (!settings) throw new Error('codex-themes: Codex settings service unavailable');
  await settings.write(SETTING, scheme);
}
