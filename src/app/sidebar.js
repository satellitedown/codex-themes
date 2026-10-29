import { subscribe } from '../engine/loop.js';
import { THEMES } from '../themes/index.js';
import { OFF } from './picker.js';
import { thumbnail } from './thumbs.js';

// The outermost sidebar panel nests further .sidebar-navigation elements.
const NAV = '.sidebar-navigation:not(.sidebar-navigation *) nav';
const HOVER_FPS = 12;
const SUN = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="2.9" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 1.6v1.5M8 12.9v1.5M1.6 8h1.5M12.9 8h1.5M3.5 3.5l1 1M11.5 11.5l1 1M3.5 12.5l1-1M11.5 4.5l1-1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
const MOON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.3 10.2A5.7 5.7 0 0 1 5.8 2.7a5.7 5.7 0 1 0 7.5 7.5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';

/**
 * "Wallpaper" section docked at the bottom of Codex's sidebar: a grid of
 * preview thumbnails (the hovered one animates), an Off switch, and a
 * Day/Night control that sets Codex's own light/dark appearance.
 */
export class SidebarSwitcher {
  constructor({ signal, onSelect, onScheme }) {
    this.current = null;
    this.scheme = null;
    this.renderedKey = '';
    this.renderers = new Map();
    this.stopHover = null;

    this.root = document.createElement('section');
    this.root.className = 'cx-side';
    this.root.setAttribute('aria-label', 'Wallpaper');
    this.root.innerHTML = `<div class="cx-side-head"><span class="cx-side-title">Wallpaper</span><span class="cx-side-current"></span><button class="cx-side-off" type="button">Off</button></div><div class="cx-side-grid"></div><div class="cx-side-mode" role="group" aria-label="Day or night" hidden><button type="button" data-scheme="light">${SUN}Day</button><button type="button" data-scheme="dark">${MOON}Night</button></div>`;
    this.currentLabel = this.root.querySelector('.cx-side-current');
    this.offButton = this.root.querySelector('.cx-side-off');
    this.offButton.title = 'Turn the wallpaper off';
    this.offButton.addEventListener('click', () => onSelect(OFF), { signal });

    this.mode = this.root.querySelector('.cx-side-mode');
    this.modeButtons = [...this.mode.querySelectorAll('button')];
    for (const button of this.modeButtons) {
      button.title = button.dataset.scheme === 'light' ? 'Day: light appearance' : 'Night: dark appearance';
      button.addEventListener('click', () => onScheme(button.dataset.scheme), { signal });
    }

    const grid = this.root.querySelector('.cx-side-grid');
    this.buttons = THEMES.map((theme) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cx-side-thumb';
      button.dataset.id = theme.id;
      button.title = theme.name;
      button.setAttribute('aria-label', `${theme.name} wallpaper`);
      button.append(document.createElement('canvas'));
      button.addEventListener('click', () => onSelect(theme.id), { signal });
      button.addEventListener('mouseenter', () => this.animate(theme.id), { signal });
      button.addEventListener('mouseleave', () => this.animate(null), { signal });
      grid.append(button);
      return button;
    });

    signal.addEventListener('abort', () => {
      this.animate(null);
      this.root.remove();
    }, { once: true });
  }

  /** Shows the Day/Night control once Codex's appearance setting is known to be writable. */
  enableSchemeSwitch() {
    this.mode.hidden = false;
  }

  /** Keeps the section docked in whichever sidebar Codex currently shows; cheap enough to poll. */
  mount() {
    const nav = document.querySelector(NAV);
    if (!nav) {
      this.root.remove();
      return;
    }
    if (this.root.parentElement !== nav) nav.append(this.root);
    const width = Math.round(this.root.getBoundingClientRect().width);
    const key = `${this.scheme}:${width}`;
    if (width > 0 && key !== this.renderedKey) {
      this.renderedKey = key;
      this.renderThumbs();
    }
  }

  update({ current, scheme }) {
    this.current = current;
    this.scheme = scheme;
    const theme = THEMES.find((t) => t.id === current);
    this.currentLabel.textContent = theme ? theme.name : 'Off';
    this.offButton.setAttribute('aria-pressed', String(!theme));
    for (const button of this.buttons) button.setAttribute('aria-pressed', String(button.dataset.id === current));
    for (const button of this.modeButtons) button.setAttribute('aria-pressed', String(button.dataset.scheme === scheme));
    this.mount();
  }

  renderThumbs() {
    this.animate(null);
    THEMES.forEach((theme, k) => this.renderers.set(theme.id, thumbnail(this.buttons[k].firstChild, theme, this.scheme)));
  }

  animate(id) {
    this.stopHover?.();
    this.stopHover = null;
    const renderer = id && this.renderers.get(id);
    if (renderer) this.stopHover = subscribe((dt) => renderer.frame(dt), HOVER_FPS);
  }
}
