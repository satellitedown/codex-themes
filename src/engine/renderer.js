import { Atlas, FONT_FAMILY } from './atlas.js';
import { css, parseColor } from './color.js';
import { BLOCK, Field, GLYPH, TILE } from './field.js';
import { fbm2, hash1, smoothstep } from './math.js';

const CROSSFADE_MS = 520;
const LANE_FEATHER = 56;

/**
 * Draws one theme into one canvas. The main wallpaper and every picker
 * thumbnail each own a Renderer; thumbnails draw cells as plain pixels.
 *
 * World units are CSS pixels. Thumbnails use a fixed virtual world so the
 * scene composition matches a typical window, then scale it down.
 *
 * Layers, back to front:
 *   background canvas   gradient, spots, texture, scene.back() cells, vignette   (baked)
 *   glows               queued by scene.paint()
 *   dynamic cells       scene.paint(field, t) every frame
 *   front canvas        scene.front() cells                                      (baked)
 * Baked layers are re-rendered on resize, theme, scheme or reading-lane changes.
 */
export class Renderer {
  constructor(canvas, { thumb = false, cellW = 12, cellH = 16, world = null } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.thumb = thumb;
    this.cw = cellW;
    this.ch = cellH;
    this.world = world;
    this.field = new Field();
    this.layerField = new Field();
    this.atlas = thumb ? null : new Atlas();
    this.bgCanvas = document.createElement('canvas');
    this.frontCanvas = null;
    this.glowCache = new Map();
    this.laneRects = [];
    this.laneKey = '';
    this.lanes = [];
    this.fade = null;
    this.theme = null;
    this.scene = null;
    this.view = null;
    this.w = 0;
    this.h = 0;
    this.dpr = 1;
    this.time = 0;
    this.bakeTimer = 0;
  }

  /** CSS size of the drawing surface plus devicePixelRatio. */
  resize(cssW, cssH, dpr) {
    cssW = Math.max(1, Math.round(cssW));
    cssH = Math.max(1, Math.round(cssH));
    const dprChanged = dpr !== this.dpr;
    const prevW = this.w;
    const prevH = this.h;
    this.dpr = dpr;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.w = this.world ? this.world.w : cssW;
    this.h = this.world ? this.world.h : cssH;
    const cols = Math.ceil(this.w / this.cw) + 1;
    const rows = Math.ceil(this.h / this.ch) + 1;
    this.field.resize(cols, rows, this.cw, this.ch);
    this.layerField.resize(cols, rows, this.cw, this.ch);
    if (this.view) {
      Object.assign(this.view, { w: this.w, h: this.h, cols, rows });
      if (prevW && prevH) this.scene?.resize?.(this.w / prevW, this.h / prevH);
    }
    if (dprChanged && this.theme) this.buildAtlas();
    this.updateLanes();
    this.scheduleBake(prevW === 0);
  }

  setTheme(theme, scheme) {
    if (!this.thumb && this.theme && this.canvas.width > 1) this.snapshotForFade();
    this.theme = theme;
    this.scheme = theme.palettes[scheme] ? scheme : 'dark';
    this.palette = theme.palettes[this.scheme];
    const inkNames = Object.keys(this.palette.inks);
    this.inkList = inkNames.map((name) => this.palette.inks[name]);
    const bare = [...theme.chars.halo, ...(theme.chars.extra ?? '')];
    this.tileCount = [...theme.chars.tile].length;
    this.haloCount = [...theme.chars.halo].length;
    const glyph = (char) => {
      const slot = bare.indexOf(char);
      if (slot < 0) throw new Error(`codex-themes: ${theme.id} uses undeclared glyph ${char}`);
      return slot;
    };
    this.view = {
      w: this.w,
      h: this.h,
      cw: this.cw,
      ch: this.ch,
      cols: this.field.cols,
      rows: this.field.rows,
      scheme: this.scheme,
      night: this.scheme === 'dark',
      palette: this.palette,
      thumb: this.thumb,
      ink: Object.fromEntries(inkNames.map((name, index) => [name, index])),
      /** Explicit bare-glyph slot for a character listed in chars.halo or chars.extra. */
      glyph,
      /** Slots for a string; spaces become -1 (skipped by Field.text). */
      glyphs: (text) => [...text].map((char) => (char === ' ' ? -1 : glyph(char))),
    };
    this.scene = theme.scene(this.view);
    this.time = 0;
    this.glowCache.clear();
    this.buildAtlas();
    this.updateLanes();
    this.bake();
  }

  buildAtlas() {
    if (this.thumb) return;
    this.atlas.build({ inks: this.inkList, chars: this.theme.chars, cw: this.cw, ch: this.ch, dpr: this.dpr });
  }

  /** Regions (CSS px) where reading happens, e.g. the chat column and sidebar; tiles there are drawn faint. */
  setLanes(rects) {
    const key = rects.map((r) => `${r.x0},${r.x1},${r.y0},${r.y1}`).join('|');
    if (key === this.laneKey) return;
    this.laneKey = key;
    this.laneRects = rects;
    this.updateLanes();
    this.scheduleBake(false);
  }

  /** Per lane, separable column/row weights: 1 inside, feathered to 0 outside. */
  updateLanes() {
    const { cols, rows, cw, ch } = this.field;
    const f = LANE_FEATHER;
    const ramp = (lo, hi, v) => smoothstep(lo - f, lo + f * 0.25, v) * (1 - smoothstep(hi - f * 0.25, hi + f, v));
    this.lanes = this.thumb
      ? []
      : this.laneRects.map((lane) => {
          const colWeights = new Float32Array(cols);
          const rowWeights = new Float32Array(rows);
          for (let c = 0; c < cols; c++) colWeights[c] = ramp(lane.x0, lane.x1, (c + 0.5) * cw);
          for (let r = 0; r < rows; r++) rowWeights[r] = ramp(lane.y0, lane.y1, (r + 0.5) * ch);
          return { cols: colWeights, rows: rowWeights };
        });
  }

  scheduleBake(immediate) {
    if (!this.theme) return;
    clearTimeout(this.bakeTimer);
    if (immediate) this.bake();
    else this.bakeTimer = setTimeout(() => this.bake(), 90);
  }

  /** Renders the baked layers: background (with scene.back) and front. */
  bake() {
    if (!this.theme) return;
    const { bg } = this.palette;
    const canvas = this.bgCanvas;
    canvas.width = this.canvas.width;
    canvas.height = this.canvas.height;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(canvas.width / this.w, 0, 0, canvas.height / this.h, 0, 0);
    const { w, h } = this;

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    for (const [stop, color] of bg.stops) grad.addColorStop(stop, color);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    for (const spot of bg.spots ?? []) {
      const r = spot.r * Math.max(w, h);
      const rg = ctx.createRadialGradient(spot.x * w, spot.y * h, 0, spot.x * w, spot.y * h, r);
      rg.addColorStop(0, spot.color);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
    }

    const tex = bg.texture;
    if (tex && !this.thumb) {
      ctx.font = `500 ${Math.round(this.ch * 0.62)}px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = tex.color;
      const { cols, rows, cw, ch } = this.field;
      const top = (tex.top ?? 0) * h;
      const bottom = (tex.bottom ?? 1) * h;
      for (let r = 0; r < rows; r++) {
        const y = (r + 0.5) * ch;
        if (y < top || y > bottom) continue;
        for (let c = 0; c < cols; c++) {
          const n = fbm2(c * tex.scale, r * tex.scale * 1.4, 2);
          if (n < tex.threshold) continue;
          const i = r * cols + c;
          if (hash1(i * 13 + 5) > (tex.density ?? 0.6)) continue;
          ctx.globalAlpha = tex.alpha * smoothstep(tex.threshold, tex.threshold + 0.25, n);
          ctx.fillText(tex.chars[Math.floor(hash1(i * 3 + 1) * tex.chars.length)], (c + 0.5) * cw, y);
        }
      }
      ctx.globalAlpha = 1;
    }

    const layer = this.layerField;
    if (this.scene.back) {
      layer.clear();
      layer.time = 0;
      this.scene.back(layer);
      this.drawField(ctx, layer, 0);
    }

    if (bg.vignette) {
      const vg = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.35, w / 2, h * 0.5, Math.max(w, h) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, `rgba(0,0,0,${bg.vignette})`);
      ctx.globalAlpha = 1;
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
    }

    if (this.scene.front) {
      this.frontCanvas ??= document.createElement('canvas');
      const front = this.frontCanvas;
      front.width = this.canvas.width;
      front.height = this.canvas.height;
      const fctx = front.getContext('2d');
      fctx.setTransform(front.width / this.w, 0, 0, front.height / this.h, 0, 0);
      layer.clear();
      layer.time = 0;
      this.scene.front(layer);
      this.drawField(fctx, layer, 0);
    } else {
      this.frontCanvas = null;
    }
  }

  /** Soft radial falloff sprite for a hex color, cached per theme. */
  glowSprite(color) {
    let sprite = this.glowCache.get(color);
    if (!sprite) {
      const c = parseColor(color);
      sprite = document.createElement('canvas');
      sprite.width = sprite.height = 128;
      const g = sprite.getContext('2d');
      const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      for (const [stop, a] of [[0, 1], [0.25, 0.55], [0.55, 0.18], [1, 0]]) rg.addColorStop(stop, css({ ...c, a: c.a * a }));
      g.fillStyle = rg;
      g.fillRect(0, 0, 128, 128);
      this.glowCache.set(color, sprite);
    }
    return sprite;
  }

  snapshotForFade() {
    const snap = document.createElement('canvas');
    snap.width = this.canvas.width;
    snap.height = this.canvas.height;
    snap.getContext('2d').drawImage(this.canvas, 0, 0);
    this.fade = { canvas: snap, start: performance.now() };
  }

  /** Simulates `seconds` of scene time without drawing, so thumbnails open mid-scene. */
  preroll(seconds, step = 0.1) {
    if (!this.scene?.update) return;
    for (let s = 0; s < seconds; s += step) {
      this.time += step;
      this.scene.update(step, this.time);
    }
  }

  /** Advances the scene by dt seconds and paints a frame. */
  frame(dt) {
    if (!this.scene || this.canvas.width <= 1) return;
    this.time += dt;
    const field = this.field;
    field.time = this.time;
    field.clear();
    this.scene.update?.(dt, this.time);
    this.scene.paint?.(field, this.time);

    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.bgCanvas, 0, 0, W, H);
    ctx.setTransform(W / this.w, 0, 0, H / this.h, 0, 0);

    if (field.glows.length) {
      ctx.globalCompositeOperation = this.view.night ? 'lighter' : 'source-over';
      for (const g of field.glows) {
        ctx.globalAlpha = g.alpha;
        ctx.drawImage(this.glowSprite(g.color), g.x - g.radius, g.y - g.radius, g.radius * 2, g.radius * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    this.drawField(ctx, field, this.time);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.frontCanvas) {
      ctx.globalAlpha = 1;
      ctx.drawImage(this.frontCanvas, 0, 0, W, H);
    }
    if (this.fade) {
      const p = (performance.now() - this.fade.start) / CROSSFADE_MS;
      if (p >= 1) {
        this.fade = null;
      } else {
        ctx.globalAlpha = 1 - p * p * (3 - 2 * p);
        ctx.drawImage(this.fade.canvas, 0, 0, W, H);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Draws a field's cells into ctx (already transformed to world units), applying the reading lane. */
  drawField(ctx, field, t) {
    const { list, count, kind, ink, alpha, glyph, cols, cw, ch } = field;
    const laneAlpha = this.palette.lane ?? 0.6;
    const { lanes } = this;
    if (this.thumb) {
      for (let k = 0; k < count; k++) {
        const i = list[k];
        const c = i % cols;
        const r = (i - c) / cols;
        const def = this.inkList[ink[i]];
        const kd = kind[i];
        if (kd === GLYPH) {
          ctx.globalAlpha = alpha[i] * 0.55;
          ctx.fillStyle = def.halo ?? def.bg;
          ctx.fillRect(c * cw + cw * 0.3, r * ch + ch * 0.3, cw * 0.4, ch * 0.4);
        } else {
          ctx.globalAlpha = alpha[i];
          ctx.fillStyle = def.bg;
          if (kd === BLOCK) ctx.fillRect(c * cw, r * ch, cw, ch);
          else ctx.fillRect(c * cw + 1, r * ch + 1, cw - 2, ch - 2);
        }
      }
      ctx.globalAlpha = 1;
      return;
    }
    const atlas = this.atlas;
    const src = atlas.canvas;
    const AW = atlas.W;
    const AH = atlas.H;
    const shimmer = this.theme.shimmer ?? 1.4;
    const { tileCount, haloCount } = this;
    for (let k = 0; k < count; k++) {
      const i = list[k];
      const c = i % cols;
      const r = (i - c) / cols;
      let lane = 0;
      for (let k2 = 0; k2 < lanes.length; k2++) {
        const weight = lanes[k2].cols[c] * lanes[k2].rows[r];
        if (weight > lane) lane = weight;
      }
      const a = alpha[i] * (1 - (1 - laneAlpha) * lane);
      if (a < 0.03) continue;
      let g = glyph[i];
      if (g < 0) {
        const roll = hash1(i * 31 + Math.floor(t * shimmer + hash1(i * 3) * 10) * 7919);
        g = Math.floor(roll * (kind[i] === TILE ? tileCount : haloCount));
      }
      ctx.globalAlpha = a;
      ctx.drawImage(src, atlas.sx(kind[i], g), ink[i] * AH, AW, AH, c * cw, r * ch, cw, ch);
    }
    ctx.globalAlpha = 1;
  }
}
