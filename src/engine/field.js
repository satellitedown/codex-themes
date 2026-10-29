import { hash1 } from './math.js';

/** Cell kinds. */
export const GLYPH = 1; // bare character, no tile
export const TILE = 2; // rounded tile with a character on it
export const BLOCK = 3; // solid cell without character (shadows, water bands)

/**
 * One frame worth of ASCII art: a grid of cells, each optionally holding a
 * kind, an ink (palette index), an opacity and an optional fixed glyph.
 * Scenes paint into it; the renderer turns it into pixels.
 */
export class Field {
  constructor() {
    this.resize(1, 1, 12, 16);
    this.time = 0;
  }

  resize(cols, rows, cw, ch) {
    this.cols = cols;
    this.rows = rows;
    this.cw = cw;
    this.ch = ch;
    const n = cols * rows;
    this.kind = new Uint8Array(n);
    this.ink = new Uint8Array(n);
    this.alpha = new Float32Array(n);
    this.glyph = new Int16Array(n);
    this.list = new Int32Array(n);
    this.count = 0;
    this.glows = [];
    this.clip = null;
  }

  clear() {
    for (let k = 0; k < this.count; k++) this.kind[this.list[k]] = 0;
    this.count = 0;
    this.glows.length = 0;
    this.clip = null;
  }

  /** Restricts later writes to cells whose centres fall inside the world-space box; clearClip() lifts it. */
  setClip(x0, y0, x1, y1) {
    this.clip = [Math.round(x0 / this.cw), Math.round(y0 / this.ch), Math.round(x1 / this.cw) - 1, Math.round(y1 / this.ch) - 1];
  }

  clearClip() {
    this.clip = null;
  }

  /** Writes a cell; later writes win (painter's order). glyph -1 = shimmering auto glyph. */
  put(i, kind, ink, alpha = 1, glyph = -1) {
    if (alpha <= 0.02) return;
    const clip = this.clip;
    if (clip) {
      const c = i % this.cols;
      const r = (i - c) / this.cols;
      if (c < clip[0] || r < clip[1] || c > clip[2] || r > clip[3]) return;
    }
    if (this.kind[i] === 0) this.list[this.count++] = i;
    this.kind[i] = kind;
    this.ink[i] = ink;
    this.alpha[i] = alpha > 1 ? 1 : alpha;
    this.glyph[i] = glyph;
  }

  /** Cell index under world point (x, y), or -1 when off-grid. */
  at(x, y) {
    const c = Math.floor(x / this.cw);
    const r = Math.floor(y / this.ch);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1;
    return r * this.cols + c;
  }

  /** Calls fn(x, y, i) for every cell whose center lies inside the world-space box. */
  each(x0, y0, x1, y1, fn) {
    const { cw, ch, cols, rows } = this;
    const c0 = Math.max(0, Math.floor(x0 / cw));
    const c1 = Math.min(cols - 1, Math.ceil(x1 / cw));
    const r0 = Math.max(0, Math.floor(y0 / ch));
    const r1 = Math.min(rows - 1, Math.ceil(y1 / ch));
    for (let r = r0; r <= r1; r++) {
      const y = (r + 0.5) * ch;
      const row = r * cols;
      for (let c = c0; c <= c1; c++) fn((c + 0.5) * cw, y, row + c);
    }
  }

  /**
   * Standard "ASCII mosaic" shading for a signed distance d (px, negative inside):
   * tiles inside, a sparse flickering halo of bare glyphs just outside the edge.
   */
  shape(i, d, ink, alpha = 1, haloInk = ink, halo = 0.55, haloWidth = this.cw * 1.1) {
    if (d <= 0) {
      this.put(i, TILE, ink, alpha);
    } else if (d < haloWidth && halo > 0) {
      const slot = Math.floor(this.time * 2.5 + hash1(i) * 4);
      if (hash1(i * 7 + slot * 131) < halo * (1 - d / haloWidth)) this.put(i, GLYPH, haloInk, alpha * 0.75);
    }
  }

  /** Queues a soft radial glow drawn beneath the cells. */
  glow(x, y, radius, color, alpha = 1) {
    this.glows.push({ x, y, radius, color, alpha });
  }

  /**
   * Stamps pixel art. rows: strings of legend keys; legend[key] = [kind, ink, alpha?, glyph?].
   * (x, y) is the top-left corner in world px; flip mirrors horizontally.
   */
  sprite(rows, legend, x, y, flip = false, alpha = 1) {
    const c0 = Math.floor(x / this.cw);
    const r0 = Math.floor(y / this.ch);
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const rr = r0 + r;
      if (rr < 0 || rr >= this.rows) continue;
      for (let c = 0; c < row.length; c++) {
        const def = legend[row[flip ? row.length - 1 - c : c]];
        const cc = c0 + c;
        if (!def || cc < 0 || cc >= this.cols) continue;
        this.put(rr * this.cols + cc, def[0], def[1], (def[2] ?? 1) * alpha, def[3] ?? -1);
      }
    }
  }

  /** Writes explicit glyph slots (from view.glyphs) left to right from world (x, y); -1 skips a cell. */
  text(slots, x, y, ink, alpha = 1, kind = GLYPH) {
    const c0 = Math.floor(x / this.cw);
    const r = Math.floor(y / this.ch);
    if (r < 0 || r >= this.rows) return;
    for (let k = 0; k < slots.length; k++) {
      const c = c0 + k;
      if (slots[k] < 0 || c < 0 || c >= this.cols) continue;
      this.put(r * this.cols + c, kind, ink, alpha, slots[k]);
    }
  }
}
