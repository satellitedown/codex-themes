import { subscribe } from '../engine/loop.js';
import { THEMES } from '../themes/index.js';
import { OFF } from './picker.js';
import { thumbnail } from './thumbs.js';

// The outermost sidebar panel nests further .sidebar-navigation elements.
const NAV = '.sidebar-navigation:not(.sidebar-navigation *) nav';
const HOVER_FPS = 12;

/**
 * "Wallpaper" section docked at the bottom of Codex's sidebar: a grid of
 * preview thumbnails (the hovered one animates) plus an Off switch.
 */
export class SidebarSwitcher {
  constructor({ signal, onSelect }) {
    this.current = null;
    this.scheme = null;
    this.renderedKey = '';
    this.renderers = new Map();
    this.stopHover = null;

    this.root = document.createElement('section');
    this.root.className = 'cx-side';
    this.root.setAttribute('aria-label', 'Wallpaper');
    this.root.innerHTML = '<div class="cx-side-head"><span class="cx-side-title">Wallpaper</span><span class="cx-side-current"></span><button class="cx-side-off" type="button">Off</button></div><div class="cx-side-grid"></div>';
    this.currentLabel = this.root.querySelector('.cx-side-current');
    this.offButton = this.root.querySelector('.cx-side-off');
    this.offButton.title = 'Turn the wallpaper off';
    this.offButton.addEventListener('click', () => onSelect(OFF), { signal });

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
