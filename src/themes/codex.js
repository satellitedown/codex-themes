import { BLOCK, GLYPH, TILE } from '../engine/field.js';
import { TAU, clamp, hash1, rng, smin } from '../engine/math.js';
import { shade } from './kit.js';

// Tile glyph slots: a blank tile for the blossom body, '+' for highlights, code glyphs for the rim.
const TILE_CHARS = ' +:;$%#t';
const BLANK = 0;
const PLUS = 1;
const RIM_GLYPHS = 6;
const CODE_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789{}[]()<>=+-*/_$#@!?&|"\':;.,~^';
const TOKENS = '{}<>()[];=*+/$#';

// Ghost terminals in the visible margins. Lines wider than a pane are skipped, so
// narrow windows get the short lines and wide ones the long ones too.
const SESSION = [
  '$ codex',
  '> make it alive',
  'reading src/',
  'thinking...',
  'edit codex.js',
  'apply_patch <<EOF',
  '$ npm test',
  'ok 42 passed',
  'ok: 42 passed, 0 failed',
  '$ git add -A',
  '$ git commit',
  'git checkout -b themes',
  '$ git push',
  'git push origin HEAD',
  'done.',
  '',
];
const SOURCE = [
  'fn render() {',
  'fn render(&self) -> Frame {',
  '  draw(tiles);',
  '  glow(0.6);',
  '}',
  '',
  'let t = 0.0;',
  'loop {',
  '  t += dt;',
  '  bloom(t);',
  '}',
  'while (alive) tick(dt);',
  'const vibes = await agent.run();',
  'export default scene;',
  '// TODO: ship it',
  'cargo build --release',
  '',
];
const TYPE_RATE = 16; // chars per second
const RANK_ALPHA = [0.9, 0.7, 0.56, 0.45, 0.36, 0.28, 0.2];
const LINE_GAP = 2; // rows between terminal lines

// Blossom cell types.
const BODY = 0;
const RIM_LIT = 1;
const RIM_DARK = 2;
const RIM = 3;
const CHEVRON = 4;
const UNDERSCORE = 5;
const SPARK = 6;

/**
 * Codex's layout at this window size (rail + sidebar, centred 768px chat column):
 * the right strip beside the column and the gap left of it are where detail shows.
 */
function appLayout(view) {
  const { w, h, cw, ch } = view;
  const colW = Math.min(768, Math.max(0, w - 338));
  const colX = 290 + (w - 290 - colW) / 2;
  const colR = colX + colW;
  // Blossom fills the right strip; it may tuck into the column's feathered edge, never behind text.
  const outer = clamp(Math.min((w - colR + cw - 6) / 2, h * 0.21), 60, 180);
  const cx = Math.round(Math.min(w - outer - 6, Math.max(colR - cw + outer, (colR + w) / 2)) / cw) * cw;
  const cy = Math.round(Math.max(outer + 64, h * 0.3) / ch) * ch;
  const panes = [];
  const pane = (x0, x1, y0, y1, script) => {
    x0 = Math.ceil(x0 / cw) * cw;
    const width = Math.floor((x1 - x0) / cw);
    const bottom = Math.floor(y1 / ch) * ch;
    const cap = Math.min(RANK_ALPHA.length, Math.floor((bottom - y0) / (ch * LINE_GAP)) + 1);
    if (width >= 8 && cap >= 3) panes.push({ x0, width, bottom, cap, y0: bottom - (cap - 1) * ch * LINE_GAP, script });
  };
  // Left pane clears the sidebar's feathered edge when the gap is wide enough.
  pane(296 + clamp(colX - 316 - cw * 14, 0, 56), colX - 20, h * 0.5, h * 0.86, SESSION);
  pane(colR + cw, w - cw, cy + outer + ch * 3, h * 0.9, SOURCE);
  return { cx, cy, outer, R: outer / 1.04, panes };
}

/** Precomputes the blossom's cells: silhouette, petal shading, rim, prompt and highlights. */
function buildBlossom(view, L) {
  const { cw, ch, cols, rows } = view;
  const { cx, cy, R, outer } = L;
  // Seven round petals around a smaller core: deep enough notches to read at 15 cells across.
  const coreR = R * 0.6;
  const ring = R * 0.71;
  const lobeR = R * 0.31;
  const lobes = Array.from({ length: 7 }, (_, k) => {
    const a = (k * TAU) / 7 - TAU / 4;
    return { x: cx + Math.cos(a) * ring, y: cy + Math.sin(a) * ring, ux: Math.cos(a), uy: Math.sin(a) };
  });
  const sdf = (x, y) => {
    let d = Math.hypot(x - cx, y - cy) - coreR;
    for (const l of lobes) d = smin(d, Math.hypot(x - l.x, y - l.y) - lobeR, R * 0.05);
    return d;
  };

  const c0 = Math.floor((cx - outer) / cw) - 2;
  const r0 = Math.floor((cy - outer) / ch) - 2;
  const gw = Math.ceil((outer * 2) / cw) + 5;
  const gh = Math.ceil((outer * 2) / ch) + 5;
  const raw = new Uint8Array(gw * gh);
  for (let r = 0; r < gh; r++) for (let c = 0; c < gw; c++) raw[r * gw + c] = sdf((c0 + c + 0.5) * cw, (r0 + r + 0.5) * ch) <= 0 ? 1 : 0;
  // Drop lone tip cells (fewer than two filled neighbours) so the silhouette stays clean.
  const at = (c, r) => (c >= 0 && r >= 0 && c < gw && r < gh ? raw[r * gw + c] : 0);
  const inside = raw.map((v, k) => {
    const c = k % gw;
    const r = (k - c) / gw;
    return v && at(c - 1, r) + at(c + 1, r) + at(c, r - 1) + at(c, r + 1) >= 2 ? 1 : 0;
  });
  const isIn = (c, r) => c >= 0 && r >= 0 && c < gw && r < gh && inside[r * gw + c] === 1;

  // The >_ prompt as crisp cell art centred on the core, scaled with the blossom.
  const coreRows = coreR / ch;
  const half = coreRows >= 7 ? 4 : coreRows >= 5.2 ? 3 : 2;
  const thick = half >= 3 ? 2 : 1;
  const gap = half >= 4 ? 2 : 1;
  const len = half + 1;
  const pw = half + thick + gap + len;
  const pc0 = Math.round(cx / cw - pw / 2) - c0;
  const pr0 = Math.round(cy / ch - half - 0.5) - r0;
  const prompt = new Uint8Array(gw * gh);
  for (let k = -half; k <= half; k++) {
    for (let s = 0; s < thick; s++) prompt[(pr0 + half + k) * gw + pc0 + half - Math.abs(k) + s] = CHEVRON;
  }
  for (let s = 0; s < len; s++) prompt[(pr0 + 2 * half) * gw + pc0 + half + thick + gap + s] = UNDERSCORE;

  const cells = [];
  for (let r = 0; r < gh; r++) {
    for (let c = 0; c < gw; c++) {
      if (!inside[r * gw + c]) continue;
      const fc = c0 + c;
      const fr = r0 + r;
      if (fc < 0 || fr < 0 || fc >= cols || fr >= rows) continue;
      const x = (fc + 0.5) * cw;
      const y = (fr + 0.5) * ch;
      const dx = x - cx;
      const dy = y - cy;
      let d1 = Infinity;
      let d2 = Infinity;
      let near = lobes[0];
      for (const l of lobes) {
        const dl = Math.hypot(x - l.x, y - l.y);
        if (dl < d1) {
          d2 = d1;
          d1 = dl;
          near = l;
        } else if (dl < d2) d2 = dl;
      }
      // Petals carry the brand gradient (lavender upper left → indigo lower right), dithered
      // between ramp tones, plus a gentle dome lit from the upper left and a crease at their
      // base; the core is a flat indigo disc so the white prompt pops.
      const brand = clamp(0.5 - (dx * 0.5 + dy * 0.85) / (R * 1.9), 0, 1);
      let v;
      const rc = Math.hypot(dx, dy);
      if (rc > coreR) {
        const nx = clamp((x - near.x) / lobeR, -0.98, 0.98);
        const ny = clamp((y - near.y) / lobeR, -0.98, 0.98);
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        const lambert = clamp(-0.5 * nx - 0.6 * ny + 0.62 * nz, 0, 1);
        v = 0.08 + 0.8 * brand + 0.3 * (lambert - 0.5);
        if (rc < coreR + ch * 0.75) v -= 0.12; // crease where petals meet the core
      } else {
        v = 0.25;
      }

      let type = prompt[r * gw + c] || BODY;
      if (type === BODY && (!isIn(c - 1, r) || !isIn(c + 1, r) || !isIn(c, r - 1) || !isIn(c, r + 1))) {
        const gx = sdf(x + 1, y) - sdf(x - 1, y);
        const gy = sdf(x, y + 1) - sdf(x, y - 1);
        const facing = (-0.6 * gx - 0.8 * gy) / (Math.hypot(gx, gy) || 1);
        type = facing > 0.35 ? RIM_LIT : facing < -0.35 ? RIM_DARK : RIM;
      }
      cells.push({ i: fr * cols + fc, c: fc, r: fr, v, type, along: (dx * 0.6 + dy * 0.8) / (outer * 2) + 0.5 });
    }
  }

  // One highlight tile on each petal that faces the light.
  for (const l of lobes) {
    if (-0.6 * l.ux - 0.8 * l.uy < 0.05) continue;
    const i = Math.floor((l.y - lobeR * 0.3) / ch) * cols + Math.floor((l.x - lobeR * 0.25) / cw);
    const cell = cells.find((e) => e.i === i);
    if (cell && cell.type === BODY) cell.type = SPARK;
  }
  return cells;
}

/** The Codex blossom drawn in tiles, a blinking >_ prompt, and ghost code typing itself in the margins. */
export default {
  id: 'codex',
  name: 'Codex',
  chars: { tile: TILE_CHARS, halo: "'.:;o", extra: CODE_CHARS },
  shimmer: 1.5,
  palettes: {
    dark: {
      bg: {
        stops: [[0, '#0b0c1b'], [0.55, '#0e1024'], [1, '#14163a']],
        spots: [
          { x: 0.92, y: 0.3, r: 0.32, color: 'rgba(98, 96, 255, 0.22)' },
          { x: 0.02, y: 1.0, r: 0.5, color: 'rgba(140, 100, 250, 0.12)' },
          { x: 0.5, y: -0.1, r: 0.5, color: 'rgba(70, 80, 210, 0.08)' },
        ],
        vignette: 0.28,
      },
      inks: {
        b0: { bg: '#2b27c0', fg: '#5551e8', halo: '#3d3ae0' },
        b1: { bg: '#4045e0', fg: '#6c73f2', halo: '#5258e8' },
        b2: { bg: '#5e6cef', fg: '#8c96f8', halo: '#6c78ef' },
        b3: { bg: '#8a96f7', fg: '#626ee0', halo: '#8f99f5' },
        b4: { bg: '#c0b6fb', fg: '#9789ee', halo: '#b3a8f8' },
        rim: { bg: '#d8d0ff', fg: '#b5a9fa', halo: '#d6cfff' },
        spark: { bg: '#ffffff', fg: '#9d93f5', halo: '#ffffff' },
        prompt: { bg: '#f8f7ff', fg: '#f8f7ff', halo: '#ffffff' },
        code: { bg: '#a3abff', fg: '#1c1f45', halo: '#a9b0ff' },
        dot: { bg: '#5a62d0', fg: '#5a62d0', halo: '#5a62d0' },
        mote: { bg: '#7f88f0', fg: '#7f88f0', halo: '#7f88f0' },
      },
      ui: { base: '#0e0f20', sidebar: 'rgba(14, 15, 34, 0.66)', composer: 'rgba(22, 24, 52, 0.86)', accent: '#8f97ff', bubble: 'rgba(110, 118, 240, 0.24)' },
      lane: 0.62,
    },
    light: {
      bg: {
        stops: [[0, '#f8f7ff'], [1, '#e9e8fa']],
        spots: [
          { x: 0.92, y: 0.3, r: 0.32, color: 'rgba(124, 118, 250, 0.16)' },
          { x: 0.02, y: 1.0, r: 0.5, color: 'rgba(176, 146, 250, 0.14)' },
        ],
        vignette: 0,
      },
      inks: {
        b0: { bg: '#2a25c2', fg: '#524ee6', halo: '#3d3ae0' },
        b1: { bg: '#3d43dc', fg: '#6a71f0', halo: '#5258e8' },
        b2: { bg: '#5865ec', fg: '#8792f6', halo: '#6c78ef' },
        b3: { bg: '#7d88f2', fg: '#5a66dc', halo: '#8f99f5' },
        b4: { bg: '#a597f6', fg: '#8273e6', halo: '#a99ef6' },
        rim: { bg: '#b0a4f8', fg: '#8e81ec', halo: '#c4baf9' },
        spark: { bg: '#ffffff', fg: '#9d93f5', halo: '#ffffff' },
        prompt: { bg: '#ffffff', fg: '#ffffff', halo: '#ffffff' },
        code: { bg: '#4f57d4', fg: '#ffffff', halo: '#4a52c8' },
        dot: { bg: '#a3a8e6', fg: '#a3a8e6', halo: '#a3a8e6' },
        mote: { bg: '#8a90e0', fg: '#8a90e0', halo: '#8a90e0' },
      },
      ui: { base: '#f0effb', sidebar: 'rgba(242, 241, 252, 0.7)', composer: 'rgba(255, 255, 255, 0.86)', accent: '#4b55d0', bubble: 'rgba(75, 85, 208, 0.12)' },
      lane: 0.55,
    },
  },

  scene(view) {
    const rand = rng(0xc0de);
    const { ink } = view;
    const ramp = [ink.b0, ink.b1, ink.b2, ink.b3, ink.b4];
    const tokenSlots = [...TOKENS].map((ch) => view.glyph(ch));
    const dotSlot = view.glyph('.');
    const plusSlot = view.glyph('+');
    const encode = (lines) => lines.map((s) => view.glyphs(s));
    const scripts = new Map([[SESSION, encode(SESSION)], [SOURCE, encode(SOURCE)]]);
    const glowColor = view.night ? '#5f5cff' : '#a69cff';

    // Depth particles: far ones small, dim and slow; near ones are code tokens.
    const spawnMote = (anywhere) => {
      const z = rand();
      return {
        x: rand() * view.w,
        y: anywhere ? rand() * view.h : view.h + 10,
        vy: -(3 + z * 9),
        slot: z > 0.55 ? tokenSlots[Math.floor(rand() * tokenSlots.length)] : dotSlot,
        alpha: 0.12 + z * 0.3,
        phase: rand() * TAU,
      };
    };
    const motes = Array.from({ length: Math.round((view.w * view.h) / 30000) }, () => spawnMote(true));

    let laidW = 0;
    let laidH = 0;
    let L = null;
    let blossom = null;
    let terms = [];
    let turn = 0;
    let nextLine = 1;
    let rimGlyphs = false;

    /** (Re)builds layout, blossom cells and terminals when the view size changes. */
    const ensure = () => {
      if (view.w === laidW && view.h === laidH) return;
      laidW = view.w;
      laidH = view.h;
      L = appLayout(view);
      blossom = buildBlossom(view, L);
      rimGlyphs = L.outer >= 140;
      // Each pane opens with a few lines of history so the margins never start empty.
      terms = L.panes.map((p, n) => {
        const term = { ...p, lines: [], step: n * 5 };
        for (let k2 = 0; k2 < p.cap - 2; k2++) pushLine(term, -100);
        return term;
      });
    };

    /** Inside a ghost terminal (plus a cell of margin): kept clear of dots and motes. */
    const inPane = (x, y) => {
      const { cw, ch } = view;
      for (const p of terms) if (x > p.x0 - cw && x < p.x0 + (p.width + 1) * cw && y > p.y0 - ch && y < p.bottom + ch * 2) return true;
      return false;
    };

    const pushLine = (term, t) => {
      const { script } = term;
      const encoded = scripts.get(script);
      for (let tries = 0; tries < script.length; tries++) {
        const k = term.step++ % script.length;
        if (script[k].length > term.width) continue;
        term.lines.push({ slots: encoded[k], born: t });
        if (term.lines.length > term.cap) term.lines.shift();
        return;
      }
    };

    return {
      resize(sx, sy) {
        for (const p of motes) {
          p.x *= sx;
          p.y *= sy;
        }
      },

      back(f) {
        ensure();
        const { cols, rows, cw, ch } = view;
        const reach = L.outer * 3.2;
        for (let r = 1; r < rows; r += 2) {
          for (let c = 1; c < cols; c += 3) {
            const major = c % 12 === 1 && r % 8 === 1;
            if (view.thumb && !major) continue;
            const x = (c + 0.5) * cw;
            const y = (r + 0.5) * ch;
            if (inPane(x, y)) continue;
            const q = Math.hypot(x - L.cx, y - L.cy) / reach;
            const lit = Math.exp(-q * q);
            f.put(r * cols + c, GLYPH, ink.dot, (major ? 0.32 : 0.17) + 0.32 * lit, major ? plusSlot : dotSlot);
          }
        }
      },

      update(dt, t) {
        ensure();
        for (const p of motes) {
          p.y += p.vy * dt;
          if (p.y < -10) Object.assign(p, spawnMote(false));
        }
        nextLine -= dt;
        if (nextLine <= 0 && terms.length) {
          nextLine = rand.range(2.2, 4);
          pushLine(terms[turn++ % terms.length], t);
        }
      },

      paint(f, t) {
        ensure();
        const { cw, ch } = view;

        for (const p of motes) {
          if (inPane(p.x, p.y)) continue;
          const i = f.at(p.x, p.y);
          if (i >= 0) f.put(i, GLYPH, ink.mote, p.alpha * (0.7 + 0.3 * Math.sin(t * 1.1 + p.phase)), p.slot);
        }

        // Ghost terminals: newest line at the bottom types itself, history fades upward.
        for (const term of terms) {
          const n = term.lines.length;
          for (let j = 0; j < n; j++) {
            const line = term.lines[j];
            const rank = n - 1 - j;
            const y = term.bottom - rank * ch * LINE_GAP + 1;
            const age = t - line.born;
            const typed = Math.min(line.slots.length, Math.floor(age * TYPE_RATE));
            const alpha = RANK_ALPHA[rank] * Math.min(1, age * 4 + 0.4);
            for (let k = 0; k < typed; k++) {
              if (line.slots[k] < 0) continue;
              const i = f.at(term.x0 + k * cw + 1, y);
              if (i >= 0) f.put(i, GLYPH, ink.code, alpha, line.slots[k]);
            }
            if (rank === 0 && (typed < line.slots.length || t % 1.1 < 0.62)) {
              const i = f.at(term.x0 + typed * cw + 1, y);
              if (i >= 0) f.put(i, BLOCK, ink.code, 0.75);
            }
          }
        }

        // The blossom: soft glow, dithered petal shading, a lit rim and the >_ prompt.
        const { cx, cy, outer } = L;
        f.glow(cx, cy, outer * 2.6, glowColor, 0.5 + 0.06 * Math.sin(t * 0.8));
        const sweep = ((t * 0.07) % 2.4) - 0.5;
        const cursorOn = t % 1.1 < 0.62;
        const cells = blossom;
        for (let j = 0; j < cells.length; j++) {
          const e = cells[j];
          const g = (e.along - sweep) / 0.08;
          const v = g > -3 && g < 3 ? e.v + 0.3 * Math.exp(-g * g) : e.v;
          switch (e.type) {
            case CHEVRON:
              f.put(e.i, TILE, ink.prompt, 1, BLANK);
              break;
            case UNDERSCORE:
              f.put(e.i, TILE, cursorOn ? ink.prompt : shade(ramp, v, e.c, e.r), 1, BLANK);
              break;
            case SPARK:
              f.put(e.i, TILE, ink.spark, 0.9 + 0.1 * Math.sin(t * 1.6 + j), PLUS);
              break;
            case BODY:
              f.put(e.i, TILE, shade(ramp, v, e.c, e.r), 1, BLANK);
              break;
            case RIM_LIT: {
              // Code glyphs along the lit rim once the blossom is big enough to carry them.
              const glyph = rimGlyphs ? 2 + (Math.floor(hash1(e.i) * RIM_GLYPHS + t * 0.35 + hash1(e.i * 3)) % RIM_GLYPHS) : BLANK;
              f.put(e.i, TILE, ink.rim, 1, glyph);
              break;
            }
            default:
              f.put(e.i, TILE, shade(ramp, e.type === RIM_DARK ? v - 0.08 : v, e.c, e.r), 1, BLANK);
          }
        }
      },
    };
  },
};
