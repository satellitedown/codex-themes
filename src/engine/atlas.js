import { BLOCK, TILE } from './field.js';

export const FONT_FAMILY = '"SF Mono", ui-monospace, Menlo, Monaco, monospace';

/**
 * Pre-renders every (ink × glyph × kind) combination once per theme/DPR so a
 * frame is just a list of drawImage blits.
 *
 * Row per ink: [tile glyphs][bare glyphs][extra bare glyphs][solid block].
 * Tile and bare glyphs shimmer automatically; extras are only drawn when a
 * scene asks for them explicitly (birds, stars, cursors…).
 */
export class Atlas {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
  }

  build({ inks, chars, cw, ch, dpr }) {
    const tile = [...chars.tile];
    const bare = [...chars.halo, ...(chars.extra ?? '')];
    const W = Math.round(cw * dpr);
    const H = Math.round(ch * dpr);
    const perRow = tile.length + bare.length + 1;
    this.W = W;
    this.H = H;
    this.tileCount = tile.length;
    this.perRow = perRow;
    this.canvas.width = perRow * W;
    this.canvas.height = Math.max(1, inks.length) * H;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.font = `600 ${Math.round(ch * 0.66 * dpr)}px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const inset = Math.max(1, Math.round(0.8 * dpr));
    const radius = 2.2 * dpr;
    const nudge = 0.5 * dpr;

    inks.forEach((ink, row) => {
      const y = row * H;
      tile.forEach((char, j) => {
        const x = j * W;
        ctx.fillStyle = ink.bg;
        ctx.beginPath();
        ctx.roundRect(x + inset, y + inset, W - inset * 2, H - inset * 2, radius);
        ctx.fill();
        ctx.fillStyle = ink.fg;
        ctx.fillText(char, x + W / 2, y + H / 2 + nudge);
      });
      bare.forEach((char, k) => {
        ctx.fillStyle = ink.halo ?? ink.bg;
        ctx.fillText(char, (tile.length + k) * W + W / 2, y + H / 2 + nudge);
      });
      ctx.fillStyle = ink.bg;
      ctx.fillRect((perRow - 1) * W, y, W, H);
    });
  }

  /** Source x for a cell; slot is already resolved within its kind. */
  sx(kind, slot) {
    if (kind === TILE) return slot * this.W;
    if (kind === BLOCK) return (this.perRow - 1) * this.W;
    return (this.tileCount + slot) * this.W;
  }
}
