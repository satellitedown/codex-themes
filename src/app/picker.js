import { subscribe } from '../engine/loop.js';
import { THEMES } from '../themes/index.js';
import { thumbnail } from './thumbs.js';

export const OFF = 'off';
const THUMB_FPS = 10;
const CHECK = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.5l2.2 2.2L9.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const OFF_ICON = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5.6 14.4l8.8-8.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
const SUN = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="2.9" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 1.6v1.5M8 12.9v1.5M1.6 8h1.5M12.9 8h1.5M3.5 3.5l1 1M11.5 11.5l1 1M3.5 12.5l1-1M11.5 4.5l1-1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
const MOON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.3 10.2A5.7 5.7 0 0 1 5.8 2.7a5.7 5.7 0 1 0 7.5 7.5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';

const el = (tag, className, html) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html != null) node.innerHTML = html;
  return node;
};

/**
 * The /theme panel: a row of live thumbnail cards anchored above the
 * composer. Arrow keys preview in the real wallpaper, Enter applies, Esc
 * reverts; clicking a card applies it immediately. Day / Night in the header
 * switches Codex's appearance, which picks each wallpaper's day or night scene.
 */
export class Picker {
  constructor({ signal, onPreview, onApply, onClose, onScheme }) {
    this.onPreview = onPreview;
    this.onApply = onApply;
    this.onClose = onClose;
    this.onScheme = onScheme;
    this.items = [...THEMES.map((theme) => ({ id: theme.id, name: theme.name, theme })), { id: OFF, name: 'Off', theme: null }];
    this.isOpen = false;
    this.root = el('div', 'cx-picker');
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', 'Choose a wallpaper theme');
    this.root.hidden = true;

    const head = el('div', 'cx-picker-head');
    head.append(el('span', 'cx-chip', '/theme'), el('span', 'cx-title', 'ASCII wallpapers'));
    this.mode = el('div', 'cx-mode');
    this.mode.setAttribute('role', 'group');
    this.mode.setAttribute('aria-label', 'Day or night');
    this.modeButtons = [['light', SUN, 'Day'], ['dark', MOON, 'Night']].map(([scheme, icon, label]) => {
      const button = el('button', null, `${icon}${label}`);
      button.type = 'button';
      button.dataset.scheme = scheme;
      // Keep focus, and with it a typed /theme draft, in the composer.
      button.addEventListener('mousedown', (event) => event.preventDefault(), { signal });
      button.addEventListener('click', () => this.onScheme(scheme), { signal });
      return button;
    });
    this.mode.append(...this.modeButtons);
    this.enableSchemeSwitch(false);
    head.append(this.mode, el('span', 'cx-hints', '<kbd>←</kbd><kbd>→</kbd> browse · <kbd>↵</kbd> apply · <kbd>esc</kbd> close'));

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
    this.isOpen = true;
    this.root.hidden = false;
    document.documentElement.classList.add('cx-picker-open');
    this.position();
    this.setScheme(scheme);
    this.selected = Math.max(0, this.items.findIndex((item) => item.id === applied));
    this.renderState();
    if (query) this.filter(query);
    requestAnimationFrame(() => this.root.classList.add('cx-in'));
  }

  /** Day / Night writes Codex's appearance setting; without access to it the control only shows the current scheme. */
  enableSchemeSwitch(enabled = true) {
    for (const button of this.modeButtons) {
      button.disabled = !enabled;
      button.title = enabled
        ? `Switch Codex to its ${button.dataset.scheme} appearance (${button.dataset.scheme === 'light' ? 'day' : 'night'} scenes)`
        : 'Day and night follow Codex’s appearance (Settings → Appearance)';
    }
  }

  /** Shows which scene the wallpapers use, and redraws the thumbnails when it changes. */
  setScheme(scheme) {
    this.scheme = scheme;
    for (const button of this.modeButtons) button.setAttribute('aria-pressed', String(button.dataset.scheme === scheme));
    if (this.isOpen) this.startThumbs();
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
    this.thumbs = this.items.filter((item) => item.theme).map((item) => thumbnail(item.canvas, item.theme, this.scheme));
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
