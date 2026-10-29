import { THEME_BY_ID } from '../themes/index.js';
import { activeComposer, clearComposer, composerOf, composerRect, slashQuery } from './composer.js';
import { OFF, Picker } from './picker.js';
import { Store } from './store.js';
import { Surfaces } from './surfaces.js';
import { Wallpaper } from './wallpaper.js';

const DEFAULT_THEME = 'codex';
const POLL_MS = 600;

function currentScheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function prefersReducedMotion() {
  const appSetting = document.documentElement.dataset.reducedMotion;
  if (appSetting === 'true') return true;
  if (appSetting === 'false') return false;
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Wires wallpaper, surfaces, picker, persistence and app observers for one Codex window. */
export class CodexThemes {
  constructor({ buildId, version }) {
    this.buildId = buildId;
    this.version = version;
    this.abort = new AbortController();
    const { signal } = this.abort;

    this.surfaces = new Surfaces({ signal });
    this.wallpaper = new Wallpaper({ signal });
    this.store = new Store({ signal, fallback: DEFAULT_THEME, onExternalChange: (id) => this.show(id) });
    this.picker = new Picker({
      signal,
      onPreview: (id) => this.show(id),
      onApply: (id) => this.select(id),
      onClose: (reason) => this.pickerClosed(reason),
    });

    this.scheme = currentScheme();
    this.wallpaper.setReducedMotion(prefersReducedMotion());
    const observer = new MutationObserver(() => {
      this.wallpaper.setReducedMotion(prefersReducedMotion());
      const scheme = currentScheme();
      if (scheme !== this.scheme) {
        this.scheme = scheme;
        this.show(this.current);
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-reduced-motion'] });
    signal.addEventListener('abort', () => observer.disconnect(), { once: true });

    // "/theme" typed into a composer opens the picker; editing it away closes it.
    document.addEventListener('input', (event) => {
      const editor = composerOf(event.target);
      if (editor) this.syncSlash(editor);
    }, { capture: true, signal });

    // ⌘⌥T toggles the picker from anywhere in the window.
    window.addEventListener('keydown', (event) => {
      if (!(event.metaKey && event.altKey && !event.ctrlKey && event.code === 'KeyT')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (this.picker.isOpen) this.picker.close('toggle');
      else this.openPicker({ mode: 'shortcut', editor: activeComposer() });
    }, { capture: true, signal });

    const poll = setInterval(() => {
      this.trackLane();
      if (this.picker.isOpen && this.pickerMode === 'slash' && slashQuery(this.pickerEditor) === null) this.picker.close('typing');
    }, POLL_MS);
    signal.addEventListener('abort', () => clearInterval(poll), { once: true });
    window.addEventListener('resize', () => this.trackLane(), { signal });

    this.show(this.store.get());
    this.trackLane();
  }

  /** Displays a theme without persisting it (previews, other windows' changes). */
  show(id) {
    const theme = THEME_BY_ID.get(id);
    this.current = theme ? id : OFF;
    if (!theme) {
      this.wallpaper.hide();
      this.surfaces.clear();
      return;
    }
    this.wallpaper.show(theme, this.scheme);
    this.surfaces.apply(theme, this.wallpaper.renderer.palette);
  }

  /** Displays and persists a theme; other windows follow via storage events. */
  select(id) {
    this.store.set(id);
    this.show(id);
  }

  syncSlash(editor) {
    const query = slashQuery(editor);
    if (query === null) {
      if (this.picker.isOpen && this.pickerMode === 'slash') this.picker.close('typing');
      return;
    }
    if (!this.picker.isOpen) this.openPicker({ mode: 'slash', editor, query });
    else this.picker.filter(query);
  }

  openPicker({ mode, editor, query = '' }) {
    this.pickerMode = mode;
    this.pickerEditor = editor;
    this.picker.open({ anchor: () => composerRect(editor), applied: this.store.get(), scheme: this.scheme, query });
  }

  pickerClosed(reason) {
    // Anything but an explicit apply drops a keyboard preview back to the saved theme.
    if (reason !== 'apply') this.show(this.store.get());
    if (this.pickerMode === 'slash' && reason !== 'typing') clearComposer(this.pickerEditor);
    this.pickerMode = null;
    this.pickerEditor = null;
  }

  /** Keeps wallpaper tiles faint behind the conversation column. */
  trackLane() {
    const editor = activeComposer();
    const rect = editor ? (editor.closest('[class*="_ComposerLayoutRoot_"]') ?? editor).getBoundingClientRect() : null;
    const main = document.querySelector('main[class*="_MainContentSurface_"]')?.getBoundingClientRect();
    if (rect) {
      this.wallpaper.setLane({ x0: rect.left - 12, x1: rect.right + 12, y0: main ? main.top : 0, y1: rect.bottom + 8 });
    } else if (main && main.width > 0) {
      this.wallpaper.setLane({ x0: main.left + 16, x1: main.right - 16, y0: main.top, y1: main.bottom });
    } else {
      this.wallpaper.setLane(null);
    }
  }

  destroy() {
    this.abort.abort();
    if (window.__codexThemes === this) delete window.__codexThemes;
  }
}
