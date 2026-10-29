// Margin beyond the transcript column, which already includes its own padding.
const BLEED = 20;

/**
 * Frosted strip behind the conversation column: blurs the scene where people
 * read. A fixed sibling right after the wallpaper canvas (same z-index, later
 * in the DOM) so its backdrop is the scene and Codex's UI paints over it;
 * positioned from the transcript column rather than living inside it, so it
 * doesn't scroll with the messages.
 */
export class ChatGlass {
  constructor({ signal, after }) {
    this.el = document.createElement('div');
    this.el.id = 'cx-glass';
    this.el.setAttribute('aria-hidden', 'true');
    after.after(this.el);
    this.watched = [];
    this.observer = new ResizeObserver(() => this.track());
    signal.addEventListener('abort', () => {
      this.observer.disconnect();
      this.el.remove();
    }, { once: true });
  }

  /** Re-reads the column bounds; ResizeObserver covers sidebar/panel animations, callers poll for the rest. */
  track() {
    const main = document.querySelector('main[class*="_MainContentSurface_"]');
    const column = main?.querySelector('[class*="_transcriptContent_"]');
    this.watch([main, column].filter(Boolean));
    const box = main?.getBoundingClientRect();
    const col = column?.getBoundingClientRect();
    if (!box || !col || col.width === 0) {
      this.el.classList.remove('cx-on');
      return;
    }
    const style = this.el.style;
    style.left = `${Math.round(col.left - BLEED)}px`;
    style.width = `${Math.round(col.width + BLEED * 2)}px`;
    style.top = `${Math.round(box.top)}px`;
    style.height = `${Math.round(box.height)}px`;
    this.el.classList.add('cx-on');
  }

  watch(elements) {
    if (elements.length === this.watched.length && elements.every((el, i) => el === this.watched[i])) return;
    this.observer.disconnect();
    for (const el of elements) this.observer.observe(el);
    this.watched = elements;
  }
}
