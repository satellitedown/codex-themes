import { MAIN, TRANSCRIPT, sidebarBounds } from './layout.js';

// Margin beyond the transcript column, which already includes its own padding.
const CHAT_BLEED = 20;
// The sidebar strip runs this far past the sidebar's edge, where it feathers out (styles.css).
const SIDE_BLEED = 28;

/** The conversation column: transcript width, full height of the main area. */
function chatBounds() {
  const main = document.querySelector(MAIN);
  const column = main?.querySelector(TRANSCRIPT);
  const watch = [main, column].filter(Boolean);
  const box = main?.getBoundingClientRect();
  const col = column?.getBoundingClientRect();
  if (!box || !col || col.width === 0) return { watch, rect: null };
  return { watch, rect: { left: col.left - CHAT_BLEED, right: col.right + CHAT_BLEED, top: box.top, bottom: box.bottom } };
}

/** The sidebar plus the icon rail to its left, from the window edge. */
function sideStripBounds() {
  const { watch, rect } = sidebarBounds();
  return { watch, rect: rect && { left: 0, right: rect.right + SIDE_BLEED, top: rect.top, bottom: rect.bottom } };
}

function strip(className) {
  const el = document.createElement('div');
  el.className = `cx-glass ${className}`;
  el.setAttribute('aria-hidden', 'true');
  return el;
}

const px = (v) => `${Math.round(v)}px`;

/**
 * Frosted strips where people read: one behind the conversation column, one
 * behind the sidebar and icon rail (which have no panel of their own), so
 * both read as content on the scene rather than slabs over it. Fixed siblings
 * right after the wallpaper canvas (same z-index, later in the DOM): their
 * backdrop is the scene and Codex's UI paints over them. Positioned from
 * Codex's layout rather than living inside it, so they don't scroll.
 */
export class ReadingGlass {
  constructor({ signal, after }) {
    this.strips = [
      { el: strip('cx-glass-side'), bounds: sideStripBounds },
      { el: strip('cx-glass-chat'), bounds: chatBounds },
    ];
    after.after(...this.strips.map((s) => s.el));
    this.watched = [];
    this.observer = new ResizeObserver(() => this.track());
    signal.addEventListener('abort', () => {
      this.observer.disconnect();
      for (const s of this.strips) s.el.remove();
    }, { once: true });
  }

  /** Re-reads the bounds; ResizeObserver covers sidebar/panel animations, callers poll for the rest. */
  track() {
    const watch = [];
    for (const { el, bounds } of this.strips) {
      const { rect, watch: elements } = bounds();
      watch.push(...elements);
      el.classList.toggle('cx-on', rect !== null);
      if (!rect) continue;
      el.style.left = px(rect.left);
      el.style.top = px(rect.top);
      el.style.width = px(rect.right - rect.left);
      el.style.height = px(rect.bottom - rect.top);
    }
    this.watch(watch);
  }

  watch(elements) {
    if (elements.length === this.watched.length && elements.every((el, i) => el === this.watched[i])) return;
    this.observer.disconnect();
    for (const el of elements) this.observer.observe(el);
    this.watched = elements;
  }
}
