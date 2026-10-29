const KEY = 'codexThemes:v1';

/**
 * Selected theme id in the app:// origin's localStorage, so it survives
 * restarts and every Codex window shares it. `storage` events fire in the
 * other windows when one of them changes it.
 */
export class Store {
  constructor({ signal, fallback, onExternalChange }) {
    this.fallback = fallback;
    window.addEventListener(
      'storage',
      (event) => {
        if (event.key === KEY) onExternalChange(this.get());
      },
      { signal },
    );
  }

  get() {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? 'null')?.theme ?? this.fallback;
    } catch {
      return this.fallback;
    }
  }

  set(themeId) {
    localStorage.setItem(KEY, JSON.stringify({ theme: themeId }));
  }
}
