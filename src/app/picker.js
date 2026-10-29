import { subscribe } from '../engine/loop.js';
import { Renderer } from '../engine/renderer.js';
import { THEMES } from '../themes/index.js';

export const OFF = 'off';
const THUMB_WORLD = { w: 1280, h: 800 };
const THUMB_FPS = 10;
const CHECK = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.5l2.2 2.2L9.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const OFF_ICON = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5.6 14.4l8.8-8.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';

const el = (tag, className, html) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html != null) node.innerHTML = html;
  return node;
};

/**
 * The /theme panel: a row of live thumbnail cards anchored above the
 * composer. Arrow keys preview in the real wallpaper, Enter applies, Esc
 * reverts; clicking a card applies it immediately.
 */
export class Picker {
  constructor({ signal, onPreview, onApply, onClose }) {
    this.onPreview = onPreview;
    this.onApply = onApply;
    this.onClose = onClose;
    this.items = [...THEMES.map((theme) => ({ id: theme.id, name: theme.name, theme })), { id: OFF, name: 'Off', theme: null }];
    this.isOpen = false;
    this.root = el('div', 'cx-picker');
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', 'Choose a wallpaper theme');
    this.root.hidden = true;

    const head = el('div', 'cx-picker-head');
    head.append(el('span', 'cx-chip', '/theme'), el('span', 'cx-title', 'ASCII wallpapers'));
    this.variant = el('span', 'cx-variant');
    this.variant.title = 'Follows Codex appearance: light shows the day scene, dark the night scene';
    head.append(this.variant, el('span', 'cx-hints', '<kbd>←</kbd><kbd>→</kbd> browse · <kbd>↵</kbd> apply · <kbd>esc</kbd> close'));

    this.list = el('div', 'cx-cards');
    this.list.setAttribute('role', 'listbox');
    this.cards = this.items.map((item, index) => {
      const card = el('button', `cx-card${item.theme ? '' : ' cx-card-off'}`);
      card.type = 'button';
      card.setAttribute('role', 'option');
      card.dataset.id = item.id;
      card.title = item.name;
      const frame = el('span', 'cx-thumb');
      if (item.theme) {
        const canvas = el('canvas');
        frame.append(canvas);
        item.canvas = canvas;
      } else {
        frame.innerHTML = OFF_ICON;
      }
      const label = el('span', 'cx-label');
      label.append(el('span', 'cx-name', item.name), el('span', 'cx-check', CHECK));
      card.append(frame, label);
      card.addEventListener('mouseenter', () => this.hover(index), { signal });
      card.addEventListener('click', () => {
        this.select(index, false);
        this.applied = item.id;
        this.renderState();
        this.onApply(item.id);
      }, { signal });
      this.list.append(card);
      return card;
    });
    this.root.append(head, this.list);
    document.body.append(this.root);

    // Keyboard is captured at the window so Enter never reaches the composer.
    window.addEventListener('keydown', (event) => this.onKey(event), { capture: true, signal });
    window.addEventListener('pointerdown', (event) => {
      if (this.isOpen && !this.root.contains(event.target)) this.close('outside');
    }, { capture: true, signal });
    window.addEventListener('resize', () => this.isOpen && this.position(), { signal });
    signal.addEventListener('abort', () => {
      this.stopThumbs();
      this.root.remove();
    }, { once: true });
  }

  /** anchor() returns the rect to sit above (composer) or null to centre at the bottom. */
  open({ anchor, applied, scheme, query = '' }) {
    this.anchor = anchor;
    this.applied = applied;
    this.scheme = scheme;
    this.isOpen = true;
    this.root.hidden = false;
    this.variant.textContent = scheme === 'light' ? '☀ day' : '☾ night';
    document.documentElement.classList.add('cx-picker-open');
    this.position();
    this.startThumbs();
    this.selected = Math.max(0, this.items.findIndex((item) => item.id === applied));
    this.renderState();
    if (query) this.filter(query);
    requestAnimationFrame(() => this.root.classList.add('cx-in'));
  }

  close(reason) {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.root.classList.remove('cx-in');
    this.root.hidden = true;
    document.documentElement.classList.remove('cx-picker-open');
    this.stopThumbs();
    this.onClose(reason, this.items[this.selected]?.id);
  }

  /** Slash-command argument: a 1-based index, "off", or a name fragment. */
  filter(query) {
    const q = query.trim().toLowerCase();
    if (!q) return;
    let index = /^\d+$/.test(q) ? Number(q) - 1 : this.items.findIndex((item) => item.name.toLowerCase().startsWith(q));
    if (index < 0) index = this.items.findIndex((item) => item.name.toLowerCase().includes(q) || item.id.includes(q));
    if (index >= 0 && index < this.items.length) this.select(index, true);
  }

  position() {
    const rect = this.anchor?.();
    const width = rect ? Math.max(560, rect.width) : Math.min(760, innerWidth - 48);
    const left = rect ? rect.left + (rect.width - width) / 2 : (innerWidth - width) / 2;
    this.root.style.width = `${width}px`;
    this.root.style.left = `${Math.max(12, Math.min(left, innerWidth - width - 12))}px`;
    this.root.style.bottom = `${rect ? innerHeight - rect.top + 10 : 24}px`;
  }

  hover(index) {
    this.cards.forEach((card, k) => card.classList.toggle('cx-hover', k === index));
  }

  select(index, preview) {
    this.selected = (index + this.items.length) % this.items.length;
    this.renderState();
    this.cards[this.selected].scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (preview) this.onPreview(this.items[this.selected].id);
  }

  renderState() {
    this.cards.forEach((card, k) => {
      const id = this.items[k].id;
      card.classList.toggle('cx-selected', k === this.selected);
      card.classList.toggle('cx-applied', id === this.applied);
      card.setAttribute('aria-selected', String(k === this.selected));
    });
  }

  onKey(event) {
    if (!this.isOpen || event.isComposing) return;
    const stop = () => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        stop();
        this.select(this.selected + 1, true);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        stop();
        this.select(this.selected - 1, true);
        break;
      case 'Tab':
        stop();
        this.select(this.selected + (event.shiftKey ? -1 : 1), true);
        break;
      case 'Enter':
        if (event.shiftKey) return;
        stop();
        this.applied = this.items[this.selected].id;
        this.onApply(this.applied);
        this.close('apply');
        break;
      case 'Escape':
        stop();
        this.close('escape');
        break;
      default:
    }
  }

  startThumbs() {
    this.stopThumbs();
    const dpr = devicePixelRatio || 1;
    this.thumbs = [];
    for (const item of this.items) {
      if (!item.theme) continue;
      const { width, height } = item.canvas.getBoundingClientRect();
      const renderer = new Renderer(item.canvas, { thumb: true, cellW: 24, cellH: 32, world: THUMB_WORLD });
      renderer.resize(width, height, dpr);
      renderer.setTheme(item.theme, this.scheme);
      renderer.preroll(4);
      renderer.frame(0);
      this.thumbs.push(renderer);
    }
    this.unsubscribe = subscribe((dt) => {
      for (const r of this.thumbs) r.frame(dt);
    }, THUMB_FPS);
  }

  stopThumbs() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.thumbs = [];
  }
}
