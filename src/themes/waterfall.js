import { solid, tone } from '../engine/color.js';
import { BLOCK, GLYPH, TILE } from '../engine/field.js';
import { bayer, clamp, hash1, hash2, lerp, noise2, rng, smoothstep } from '../engine/math.js';
import { ripples, shade, starfield } from './kit.js';

/** Tile glyphs; the scene picks them explicitly by index (T['|'] etc.). */
const TILES = "%;:*'|-=^/\\,.";
const T = Object.fromEntries([...TILES].map((char, k) => [char, k]));
const LEAFY = [T['%'], T[';'], T['*'], T[':'], T["'"]];
const FOAMY = [T['*'], T['%'], T[':'], T["'"], T['.']];
const RAINBOW = ['rb1', 'rb2', 'rb3', 'rb4', 'rb5', 'rb6'];

/** Water streams in the falls: centre and half-width in units of the falls half-width. */
const STREAMS = [
  { u: -0.2, w: 0.42 },
  { u: 0.62, w: 0.22 },
  { u: -0.86, w: 0.14 },
];

/**
 * Posterizes a light level so large masses sit on flat tones with narrow
 * dithered transitions, instead of a checkerboard everywhere.
 */
function steps(v, n) {
  const x = clamp(v, 0, 1) * (n - 1);
  const k = Math.floor(x);
  return (k + smoothstep(0.3, 0.7, x - k)) / (n - 1);
}

/** Ramp tone for light level v at cell (c, r), posterized. */
function tint(ramp, v, c, r) {
  return shade(ramp, steps(v, ramp.length), c, r);
}

/**
 * Layered pine lit from the upper left: tiers with dark undersides, a lit
 * left flank and a shadowed right flank, trunk underneath.
 */
function pine(f, view, x, base, height, ramp, trunk) {
  const { cw, ch } = view;
  const trunkH = Math.max(ch * 0.9, height * 0.12);
  const crown = height - trunkH;
  const tiers = height > 150 ? 5 : height > 70 ? 4 : 3;
  const trunkW = Math.max(cw * 0.5, height * 0.035);
  f.each(x - height * 0.4, base - height, x + height * 0.4, base, (cx, cy, i) => {
    const up = base - cy;
    const dx = cx - x;
    if (up < trunkH) {
      if (Math.abs(dx) < trunkW) f.put(i, TILE, trunk, 1, T['|']);
      return;
    }
    const p = (up - trunkH) / crown;
    if (p > 1) return;
    const tier = (p * tiers) % 1;
    const half = height * 0.34 * (1 - p) * (0.45 + 0.55 * (1 - tier)) + cw * 0.35;
    if (Math.abs(dx) > half) return;
    const c = Math.floor(cx / cw);
    const r = Math.floor(cy / ch);
    const s = dx / half;
    const v = 0.6 - s * 0.4 + p * 0.15 - (tier < 0.2 ? 0.3 : 0);
    const edge = Math.abs(dx) > half - cw;
    const glyph = p > 0.9 ? T['^'] : edge ? (dx < 0 ? T['/'] : T['\\']) : LEAFY[Math.floor(hash1(c * 7 + r * 131) * LEAFY.length)];
    f.put(i, TILE, tint(ramp, v, c, r), 1, glyph);
  });
}

/** Mountain range as a row of peaks: { x, y (apex), sl, sr (slopes) }. */
function range(rand, w, h, step, apex, slope) {
  const peaks = [];
  for (let x = -w * 0.06; x < w * 1.06; x += rand.range(step[0], step[1]) * w) {
    peaks.push({ x, y: h * rand.range(apex[0], apex[1]), sl: rand.range(slope[0], slope[1]), sr: rand.range(slope[0], slope[1]), k: peaks.length });
  }
  return peaks;
}

/** Highest peak over x (smallest y), with a little ridge noise. */
function ridgeAt(peaks, x, seed) {
  let best = 1e9;
  let owner = peaks[0];
  for (const p of peaks) {
    const y = p.y + Math.abs(x - p.x) * (x < p.x ? p.sl : p.sr);
    if (y < best) {
      best = y;
      owner = p;
    }
  }
  return { y: best + noise2(x / 34, seed) * 7 + noise2(x / 11, seed + 3) * 2, owner };
}

/**
 * A waterfall pouring from a mossy cliff into a pool, pines on the rim and
 * along the valley, distant mountains in haze. Day: blue sky and a rainbow in
 * the spray. Night: moonlight on the water, stars, fireflies over the meadow.
 */
export default {
  id: 'waterfall',
  name: 'Waterfall',
  chars: { tile: TILES, halo: "'.:;o", extra: "|~-v^*+," },
  shimmer: 1.1,
  palettes: {
    light: {
      bg: {
        stops: [[0, '#56b4ec'], [0.38, '#97d3f5'], [0.6, '#cbeaf7'], [1, '#e2f3ee']],
        spots: [{ x: 0.08, y: 0.06, r: 0.34, color: 'rgba(255, 250, 222, 0.75)' }],
        vignette: 0,
        texture: { color: '#ffffff', alpha: 0.28, chars: '-.', scale: 0.08, threshold: 0.2, density: 0.4, bottom: 0.35 },
      },
      inks: {
        mtnFar0: solid('#9dbfdc'),
        mtnFar1: solid('#b3cfe5'),
        mtnFar2: solid('#cde1ef'),
        mtnNear0: solid('#6a95bb'),
        mtnNear1: solid('#84a9ca'),
        mtnNear2: solid('#a3c1da'),
        mtnNear3: solid('#c6dbe8'),
        snow: solid('#f7fbff'),
        forestFar0: tone('#5f9c86', 0.08),
        forestFar1: tone('#80b898', 0.08),
        pine0: tone('#17513a', 0.16),
        pine1: tone('#2a7646', 0.16),
        pine2: tone('#4f9f50', 0.16),
        trunk: tone('#6b4a33', 0.16),
        grass0: tone('#79b456', 0.14),
        grass1: tone('#98c96a', 0.14),
        grass2: tone('#b9df8c', 0.14),
        flower: tone('#fff4b8', 0.25),
        flower2: tone('#ff9cc0', 0.25),
        rock0: tone('#34324d', 0.2),
        rock1: tone('#585574', 0.14),
        rock2: tone('#867b90', 0.12),
        rock3: tone('#b5a194', 0.12),
        rock4: tone('#e0c8a4', 0.12),
        wet0: tone('#223148', 0.14),
        wet1: tone('#3b5066', 0.14),
        moss0: tone('#2d6634', 0.18),
        moss1: tone('#4a903e', 0.18),
        moss2: tone('#86c452', 0.18),
        water0: tone('#62acd8', 0.12),
        water1: tone('#a2d5ef', 0.12),
        water2: tone('#dcf2fb', 0.12),
        water3: tone('#ffffff', 0.18),
        foam: tone('#ffffff', 0.16),
        pool0: tone('#2a86b4', 0.12),
        pool1: tone('#4ea7d2', 0.12),
        pool2: tone('#82c9e8', 0.12),
        ripple: solid('#effaff'),
        rb1: solid('#ff6b6b'),
        rb2: solid('#ffa94d'),
        rb3: solid('#ffe066'),
        rb4: solid('#69db7c'),
        rb5: solid('#4dabf7'),
        rb6: solid('#9775fa'),
        star: solid('#ffffff'),
        moon: tone('#fff6d8', 0.1),
        fly: tone('#f4ff9a', 0.3),
        bird: solid('#2e4a5c'),
      },
      ui: { base: '#d3eef8', sidebar: 'rgba(236, 248, 250, 0.66)', composer: 'rgba(250, 254, 255, 0.86)', accent: '#258fb3', bubble: 'rgba(37, 143, 179, 0.13)' },
      lane: 0.55,
    },
    dark: {
      bg: {
        stops: [[0, '#040a1a'], [0.35, '#0b1a33'], [0.62, '#112a42'], [1, '#081420']],
        spots: [{ x: 0.46, y: 0.12, r: 0.32, color: 'rgba(210, 225, 255, 0.12)' }],
        vignette: 0.25,
        texture: null,
      },
      inks: {
        mtnFar0: solid('#0f1f38'),
        mtnFar1: solid('#152945'),
        mtnFar2: solid('#1e3656'),
        mtnNear0: solid('#07112a'),
        mtnNear1: solid('#0b1a33'),
        mtnNear2: solid('#122746'),
        mtnNear3: solid('#1e3a5e'),
        snow: solid('#7090c0'),
        forestFar0: tone('#0a1b26', 0.08),
        forestFar1: tone('#11293a', 0.08),
        pine0: tone('#05120f', 0.07),
        pine1: tone('#0a2119', 0.07),
        pine2: tone('#18403a', 0.07),
        trunk: tone('#120e10', 0.12),
        grass0: tone('#08190f', 0.1),
        grass1: tone('#0d2418', 0.1),
        grass2: tone('#153526', 0.1),
        flower: tone('#a9c0e4', 0.25),
        flower2: tone('#7f86cc', 0.25),
        rock0: tone('#060914', 0.16),
        rock1: tone('#111829', 0.14),
        rock2: tone('#20304c', 0.14),
        rock3: tone('#34486b', 0.14),
        rock4: tone('#5876a6', 0.14),
        wet0: tone('#040812', 0.14),
        wet1: tone('#0c192b', 0.14),
        moss0: tone('#06171a', 0.14),
        moss1: tone('#0c2729', 0.14),
        moss2: tone('#1a4447', 0.14),
        water0: tone('#244c70', 0.12),
        water1: tone('#4276a4', 0.12),
        water2: tone('#7eaed8', 0.12),
        water3: tone('#d4e8ff', 0.16),
        foam: tone('#d4e6fb', 0.16),
        pool0: tone('#04101f', 0.12),
        pool1: tone('#0a2036', 0.12),
        pool2: tone('#173d62', 0.12),
        ripple: solid('#9cc6ec'),
        rb1: solid('#ff7070'),
        rb2: solid('#ffad55'),
        rb3: solid('#ffe36e'),
        rb4: solid('#72dc84'),
        rb5: solid('#58b1f6'),
        rb6: solid('#9b7cf8'),
        star: solid('#dfe7ff'),
        moon: tone('#f2eed8', 0.12),
        fly: tone('#eaff8a', 0.3),
        bird: solid('#0e2420'),
      },
      ui: { base: '#0a1a2c', sidebar: 'rgba(6, 16, 28, 0.62)', composer: 'rgba(8, 22, 36, 0.86)', accent: '#7fc8f0', bubble: 'rgba(127, 200, 240, 0.18)' },
      lane: 0.62,
    },
  },

  scene(view) {
    const rand = rng(0xfa11);
    const { ink, night } = view;
    const stars = starfield(view, rand, { count: 90, top: 0, bottom: 0.45, glyphs: '.+*', bright: 0.25 });
    const rings = ripples(view);
    const slot = { bar: view.glyph('|'), colon: view.glyph(':'), tick: view.glyph("'"), dot: view.glyph('.'), wave: view.glyph('~'), dash: view.glyph('-'), o: view.glyph('o'), up: view.glyph('^'), down: view.glyph('v'), comma: view.glyph(',') };
    const ramp = {
      mtnFar: [ink.mtnFar0, ink.mtnFar1, ink.mtnFar2],
      mtnNear: [ink.mtnNear0, ink.mtnNear1, ink.mtnNear2, ink.mtnNear3],
      forestFar: [ink.forestFar0, ink.forestFar1],
      pine: [ink.pine0, ink.pine1, ink.pine2],
      grass: [ink.grass0, ink.grass1, ink.grass2],
      rock: [ink.rock0, ink.rock1, ink.rock2, ink.rock3, ink.rock4],
      wet: [ink.wet0, ink.wet1, ink.rock2],
      moss: [ink.moss0, ink.moss1, ink.moss2],
      water: [ink.water0, ink.water1, ink.water2, ink.water3],
      pool: [ink.pool0, ink.pool1, ink.pool2],
    };

    // Layout, cached per size: everything the back and paint passes share.
    let L = null;
    const layout = () => {
      if (L && L.w === view.w && L.h === view.h && L.cols === view.cols && L.rows === view.rows) return L;
      const { w, h, cw, ch, cols, rows } = view;
      const R = rng(0xc11ff);
      const horizon = h * 0.62;
      const poolRow = Math.round((h * 0.785) / ch);
      const poolY = poolRow * ch;
      const fw = clamp(w * 0.06, 76, 140);
      const fx = w * 0.905;
      const fc0 = Math.round((fx - fw / 2) / cw);
      const fc1 = Math.round((fx + fw / 2) / cw) - 1;
      const topY = h * 0.2;
      const lipRow = Math.round(topY / ch) + 2;

      // Broken top edge, rising to the right, notched where the river spills over.
      const topRow = new Int16Array(cols);
      for (let c = 0; c < cols; c++) {
        const x = (c + 0.5) * cw;
        let y = topY + noise2(c / 5, 3.3) * ch * 1.1 + (hash1(Math.floor(c / 3) * 7 + 1) - 0.5) * ch * 1.6;
        if (x > fx) y -= ((x - fx) / w) * h * 0.4;
        let row = Math.round(y / ch);
        if (c >= fc0 && c <= fc1) row = lipRow;
        else if (c === fc0 - 1 || c === fc1 + 1) row = Math.max(row, lipRow - 1);
        topRow[c] = row;
      }

      // Horizontal strata: bands of 3–6 rows, each stepping in or out.
      const bandOf = new Int16Array(rows).fill(-1);
      const rowL = new Int16Array(rows).fill(cols);
      const bands = [];
      let minTop = rows;
      for (let c = Math.floor(cols * 0.7); c < cols; c++) minTop = Math.min(minTop, topRow[c]);
      let depth = 1;
      for (let r = minTop; r < poolRow; ) {
        const bot = Math.min(poolRow - 1, r + 2 + Math.floor(R() * 4));
        const p = clamp(((r + bot + 1) * 0.5 * ch - topY) / (poolY - topY), 0, 1);
        let left = Math.round((w * (0.8 - 0.05 * p)) / cw) - depth;
        if (bot >= poolRow - 3) left -= 2;
        const chamfer = R() < 0.55;
        const k = bands.length;
        bands.push({ top: r, bot, depth, left });
        for (let rr = r; rr <= bot; rr++) {
          bandOf[rr] = k;
          rowL[rr] = left + (chamfer && rr === bot ? 1 : 0) + (rr === r && R() < 0.3 ? 1 : 0);
        }
        depth = clamp(depth + (R() < 0.5 ? -1 : 1), 0, 3);
        r = bot + 1;
      }

      const opening = (c, r) => c >= fc0 && c <= fc1 && r > lipRow;
      const isRock = (c, r) => {
        if (r < 0 || r >= poolRow || bandOf[r] < 0) return false;
        if (c >= cols) return r >= topRow[cols - 1];
        return c >= rowL[r] && r >= topRow[c] && !opening(c, r);
      };

      // Vertical joints per band, some jogging sideways, some running on into the next band.
      const crack = new Uint8Array(cols * rows);
      let carry = [];
      for (const b of bands) {
        const next = [];
        const starts = carry.filter(() => R() < 0.3);
        for (let c = b.left + 3 + Math.floor(R() * 4); c < cols; c += 4 + Math.floor(R() * 7)) if (R() < 0.6) starts.push(c);
        for (const c0 of starts) {
          if (c0 >= fc0 - 1 && c0 <= fc1 + 1) continue;
          const jogRow = b.top + 1 + Math.floor(R() * (b.bot - b.top));
          const jog = R() < 0.35 ? (R() < 0.5 ? -1 : 1) : 0;
          let c = c0;
          for (let r = b.top; r <= b.bot; r++) {
            if (jog && r === jogRow) c += jog;
            if (c >= 0 && c < cols) crack[r * cols + c] = 1;
          }
          if (c > b.left + 2) next.push(c);
        }
        carry = next;
      }

      // Left framing: a rocky, pine-covered slope.
      const slopeY = (x) => lerp(h * 0.43, horizon + h * 0.07, smoothstep(0, w * 0.38, x)) + noise2(x / 70, 4.2) * ch * 1.1;
      const boulders = [];
      for (let k = 0; k < 7; k++) {
        const x = R.range(0, w * 0.2);
        const r = R.range(16, 34);
        boulders.push({ x, y: slopeY(x) + r * R.range(0.8, 3), r });
      }
      for (const [u, s, dy] of [[0.225, 46, 0.4], [0.29, 38, 0.2], [0.33, 28, 0.5], [0.255, 30, 4]]) {
        const x = w * u;
        boulders.push({ x, y: slopeY(x) + s * dy, r: s });
      }

      const shoreX = (y) => w * 0.42 - (y - poolY) * 0.9 + noise2(y / 30, 8.1) * 14;

      L = { w, h, cw, ch, cols, rows, horizon, poolRow, poolY, fw, fx, fc0, fc1, lipRow, topRow, bandOf, rowL, bands, crack, opening, isRock, slopeY, boulders, shoreX };
      return L;
    };

    /** Water coverage of the falls at offset u (falls half-widths from centre), fall progress p, time t. */
    const coverage = (u, p, t) => {
      let cov = 0;
      const spread = 1 + p * 0.55;
      for (let k = 0; k < STREAMS.length; k++) {
        const s = STREAMS[k];
        const d = Math.abs(u - s.u * (1 + p * 0.12) - noise2(p * 5 - t * 0.5, k * 3.7) * 0.12 * (0.3 + p));
        const half = s.w * spread;
        const a = 1 - smoothstep(half * 0.5, half, d);
        if (a > cov) cov = a;
      }
      return cov;
    };

    /** Round boulder lit from the upper left, optional moss cap, cut off below `cut` (waterline). */
    const boulder = (f, b, rockRamp, mossy, cut = 1e9) => {
      f.each(b.x - b.r, b.y - b.r, b.x + b.r, Math.min(b.y + b.r, cut), (x, y, i) => {
        const nx = (x - b.x) / b.r;
        const ny = (y - b.y) / (b.r * 0.8);
        const q = nx * nx + ny * ny;
        if (q > 1) return;
        const nz = Math.sqrt(1 - q);
        const lam = clamp(-0.55 * nx - 0.6 * ny + 0.58 * nz, 0, 1);
        const c = Math.floor(x / f.cw);
        const r = Math.floor(y / f.ch);
        if (mossy && ny < -0.5 && noise2(x / 22, b.r) > -0.3) {
          f.put(i, TILE, tint(ramp.moss, 0.3 + lam * 0.8, c, r), 1, LEAFY[Math.floor(hash1(i) * LEAFY.length)]);
          return;
        }
        f.put(i, BLOCK, tint(rockRamp, lam * 1.05 - (ny > 0.55 ? 0.15 : 0), c, r), 1);
      });
    };

    const birds = night ? [] : Array.from({ length: 6 }, (_, k) => ({ x: rand() * view.w, y: rand.range(0.05, 0.3) * view.h, vx: rand.range(14, 24), phase: k * 1.7 }));
    const flies = night ? Array.from({ length: 16 }, (_, k) => ({ u: rand(), v: rand(), right: k % 4 === 0, seed: rand() * 40, period: rand.range(2.5, 5) })) : [];
    const mist = Array.from({ length: 30 }, () => ({ u: rand.range(-1, 1), phase: rand(), rate: rand.range(0.18, 0.35), sway: rand() * 6 }));
    const glints = Array.from({ length: 46 }, () => ({ u: rand(), v: rand(), phase: rand() * 6, rate: rand.range(0.8, 1.8) }));
    let nextRing = 0;

    return {
      update(dt) {
        const { fx, fw, poolY, ch } = layout();
        for (const b of birds) {
          b.x += b.vx * dt;
          if (b.x > view.w + 30) b.x = -30;
        }
        rings.update(dt);
        nextRing -= dt;
        if (nextRing <= 0) {
          nextRing = rand.range(0.45, 1);
          rings.spawn(fx + rand.range(-0.6, 0.6) * fw, poolY + ch * rand.range(1.5, 3), rand.range(50, 110), rand.range(1.8, 2.8), 0.32);
        }
      },

      back(f) {
        const G = layout();
        const { w, h, cw, ch, cols, horizon, poolRow, poolY, fw, fx, fc0, fc1, lipRow, topRow, bandOf, rowL, bands, crack, isRock, opening, slopeY, shoreX } = G;

        // Two mountain ranges: lit west faces, shadowed east faces, snow, haze towards the valley.
        const R = rng(0x3a77);
        const ranges = [
          { peaks: range(R, w, h, [0.1, 0.17], [0.29, 0.4], [0.55, 0.85]), ramp: ramp.mtnFar, snow: h * 0.04, seed: 1.1 },
          { peaks: range(R, w, h, [0.15, 0.24], [0.41, 0.5], [0.45, 0.7]), ramp: ramp.mtnNear, snow: h * 0.018, seed: 4.4 },
        ];
        for (const m of ranges) {
          const top = m.ramp.length - 1;
          f.each(0, h * 0.25, w, horizon + ch, (x, y, i) => {
            const { y: ridge, owner } = ridgeAt(m.peaks, x, m.seed);
            if (y < ridge) return;
            const c = Math.floor(x / cw);
            const r = Math.floor(y / ch);
            const depth = clamp((y - owner.y) / (horizon - owner.y), 0, 1);
            const spine = owner.x + (y - owner.y) * (owner.sr - owner.sl) * 0.6 + noise2(y / 40, owner.k * 3.1) * cw * 1.6;
            const lit = x < spine;
            if (y < owner.y + m.snow * (1 + noise2(x / 18, owner.k) * 0.6) && owner.y < h * 0.46) {
              f.put(i, BLOCK, lit ? ink.snow : m.ramp[top], 1);
              return;
            }
            let v = lit ? 1 : 0;
            if (lit && noise2(x / 26, y / 70 + owner.k) > 0.3) v = 1 - 1 / top;
            if (!lit && noise2(x / 22, y / 60 + owner.k) > 0.4) v = 1 / top;
            v += smoothstep(0.5, 1, depth) * 0.45;
            f.put(i, BLOCK, tint(m.ramp, v, c, r), 1);
          });
        }

        // Meadow: lighter and hazier towards the horizon, richer in front; flowers where visible.
        f.each(0, horizon - ch, w, h, (x, y, i) => {
          if (y < horizon + noise2(x / 90, 6.6) * 6) return;
          const c = Math.floor(x / cw);
          const r = Math.floor(y / ch);
          const d = (y - horizon) / (h - horizon);
          const v = 0.95 - d * 1.1 + noise2(x / 150, y / 55) * 0.18;
          const visible = x < w * 0.36 || x > w * 0.78;
          const roll = hash2(c * 3 + 1, r * 7 + 2);
          if (visible && d > 0.12 && roll < 0.05) f.put(i, TILE, roll < 0.03 ? ink.flower : ink.flower2, 1, T['*']);
          else f.put(i, BLOCK, tint(ramp.grass, roll < 0.06 ? v + 0.3 : v, c, r), 1);
        });

        // Valley pines: a hazy far row along the horizon, a nearer sparse row.
        const P = rng(0x9e1e);
        for (let x = w * 0.2; x < w * 0.86; x += P.range(14, 26)) pine(f, view, x, horizon + ch * 0.6, P.range(26, 46), ramp.forestFar, ink.forestFar0);
        for (let x = w * 0.36; x < w * 0.74; x += P.range(70, 150)) pine(f, view, x, horizon + ch * P.range(1.6, 2.6), P.range(48, 70), ramp.pine, ink.trunk);

        // Pool: lighter far water, darker near water, cliff and falls reflected, moon path at night.
        const reflDepth = (poolY - topRow[Math.min(cols - 1, fc1 + 2)] * ch) * 0.45;
        const mx = w * 0.46;
        f.each(0, poolY, w, h, (x, y, i) => {
          const sx = shoreX(y);
          if (x < sx) return;
          const c = Math.floor(x / cw);
          const r = Math.floor(y / ch);
          const dy = y - poolY;
          const d = dy / (h - poolY);
          let v = 0.85 - d * 0.75 + noise2(x / 120, y / 9) * 0.06;
          if (noise2(x / 55, r * 1.7) > 0.45) v += 0.22;
          const wob = noise2(r * 0.9, 2.2) * cw * 1.4;
          if (x + wob > (rowL[poolRow - 1] + 1) * cw && dy < reflDepth) v -= 0.5 * (1 - dy / reflDepth) + 0.15;
          if (Math.abs(x + wob - fx) < fw * 0.4) v += 0.6 * (1 - d);
          if (night && Math.abs(x + wob - mx) < 30 + dy * 0.35) v += 0.35;
          if (x - sx < cw) f.put(i, TILE, x - sx < cw * 0.5 ? ink.rock3 : ink.pool2, 1, x - sx < cw * 0.5 ? T['.'] : T['-']);
          else f.put(i, BLOCK, tint(ramp.pool, v, c, r), 1);
        });
        // Reeds and grass tufts along the far shore.
        for (let c = Math.floor(shoreX(poolY) / cw); c < rowL[poolRow - 1]; c++) {
          const roll = hash1(c * 17 + 3);
          if (roll < 0.55) f.put((poolRow - 1) * cols + c, BLOCK, roll < 0.25 ? ink.moss0 : ink.moss1, 1);
        }

        // Left framing slope: deep green with a lit crest, boulders, tall pines.
        f.each(0, h * 0.35, w * 0.42, h, (x, y, i) => {
          const top = slopeY(x);
          if (y < top || x > shoreX(Math.max(y, poolY)) - cw) return;
          const c = Math.floor(x / cw);
          const r = Math.floor(y / ch);
          const v = 0.78 - ((y - top) / h) * 1.2 + noise2(x / 90, y / 45) * 0.25;
          if (y - top < ch) f.put(i, TILE, ink.grass2, 1, T[',']);
          else f.put(i, BLOCK, tint(ramp.moss, hash2(c, r * 5) < 0.05 ? v + 0.3 : v, c, r), 1);
        });
        for (const b of G.boulders) boulder(f, b, ramp.rock, true);
        for (const [u, s] of [[0.035, 0.36], [0.12, 0.3], [0.2, 0.44], [0.262, 0.28], [0.31, 0.34]]) {
          const x = w * u;
          pine(f, view, x, slopeY(x) + ch * 0.6, h * s, ramp.pine, ink.trunk);
        }

        // The cliff: strata of jointed blocks lit from the upper left, lit ledges with moss,
        // shadowed undersides of overhangs, darker wet rock beside the falls.
        let c0 = cols;
        for (let r = 0; r < poolRow; r++) c0 = Math.min(c0, rowL[r]);
        const mossLedge = (c, r) => {
          const k = bandOf[r];
          if (k < 0 || !isRock(c, r)) return false;
          if (!isRock(c, r - 1)) return true;
          const b = bands[k];
          return r === b.top && k > 0 && b.depth > bands[k - 1].depth && noise2(c / 3.5, k * 5.3) > -0.15;
        };
        for (let r = 0; r < poolRow; r++) {
          const k = bandOf[r];
          if (k < 0) continue;
          const b = bands[k];
          const prev = bands[k - 1];
          const rb = r - b.top;
          let block = 0;
          for (let c = c0; c < cols; c++) {
            const i = r * cols + c;
            if (crack[i]) block++;
            if (!isRock(c, r)) continue;
            const x = (c + 0.5) * cw;
            const nearFalls = Math.abs(x - fx) - fw / 2;
            let wet = r > lipRow ? 1 - smoothstep(cw * 0.5, cw * 4.5, nearFalls) : 0;
            if (r >= poolRow - 2 && nearFalls < fw * 1.5) wet = Math.max(wet, 0.6);
            const top = !isRock(c, r - 1);

            if (top) {
              // Grassy rim and exposed tops.
              f.put(i, TILE, tint(ramp.moss, 0.95, c, r), 1, hash1(i) < 0.4 ? T[','] : LEAFY[Math.floor(hash1(i * 3) * LEAFY.length)]);
              continue;
            }
            if (mossLedge(c, r)) {
              f.put(i, TILE, tint(ramp.moss, 0.75, c, r), 1, LEAFY[Math.floor(hash1(i * 3) * LEAFY.length)]);
              continue;
            }
            // Moss hanging just under rims and mossy ledges; spray moss by the falls.
            const drip = (r > 0 && mossLedge(c, r - 1) ? 0.45 : 0) + (r > 1 && !isRock(c, r - 2) && isRock(c, r - 1) ? 0.2 : 0);
            if (hash2(c, r) < drip || (wet > 0.5 && noise2(c / 2.2, r / 2.6) > 0.62)) {
              f.put(i, TILE, tint(ramp.moss, 0.2 + drip * 0.6, c, r), 1, LEAFY[Math.floor(hash1(i * 5) * LEAFY.length)]);
              continue;
            }
            if (crack[i]) {
              f.put(i, BLOCK, wet > 0.5 ? ink.wet0 : hash1(k * 37 + c) < 0.35 ? ink.rock1 : ink.rock0, 1);
              continue;
            }
            const ledge = rb === 0 && prev && b.depth > prev.depth;
            const overhang = rb <= 1 && prev && b.depth < prev.depth;
            const flank = !isRock(c - 1, r) && !opening(c - 1, r);
            let v = (night ? 0.54 : 0.44) + hash1(k * 977 + block * 131) * 0.2 + ((fx - x) / w) * 0.9 + noise2(c / 6, r / 4) * 0.06;
            if (ledge) v += 0.38;
            else if (overhang) v -= rb === 0 ? 0.5 : 0.24;
            else if (rb === 0) v += 0.2;
            if (r === b.bot) v -= 0.22;
            if (flank) v += 0.34;
            else if (!isRock(c - 2, r)) v += 0.12;
            if (crack[i - 1]) v += 0.16;
            if (crack[i + 1]) v -= 0.18;
            f.put(i, BLOCK, tint(bayer(c, r) < wet ? ramp.wet : ramp.rock, v, c, r), 1);
          }
        }

        // Dark wet recess behind the falls, deepest under the lip.
        for (let r = lipRow + 1; r < poolRow; r++) {
          for (let c = fc0; c <= fc1; c++) {
            const v = r <= lipRow + 2 ? 0 : 0.2 + noise2(c * 1.3, r / 6) * 0.4;
            f.put(r * cols + c, BLOCK, tint(ramp.wet, v, c, r), 1);
          }
        }

        // Ferns on ledges, vines hanging from overhangs and the rim.
        for (let r = 1; r < poolRow; r++) {
          for (let c = c0; c < cols; c++) {
            if (!isRock(c, r) || (c >= fc0 - 2 && c <= fc1 + 2)) continue;
            const roll = hash2(c * 11, r * 13);
            if (!isRock(c, r - 1) && r > topRow[c] && roll < 0.22) {
              f.put((r - 1) * cols + c, TILE, ink.moss2, 1, T['|']);
              if (c > 0) f.put((r - 1) * cols + c - 1, TILE, ink.moss1, 1, T['\\']);
              if (c + 1 < cols) f.put((r - 1) * cols + c + 1, TILE, ink.moss1, 1, T['/']);
            }
            const k = bandOf[r];
            const b = bands[k];
            const next = bands[k + 1];
            const overhangBelow = r === b.bot && next && next.depth < b.depth;
            if ((overhangBelow && roll > 0.9) || (r === topRow[c] && roll > 0.93)) {
              const len = 2 + Math.floor(hash1(c * 5 + r) * 5);
              for (let d = 1; d <= len && r + d < poolRow; d++) {
                f.put((r + d) * cols + c, TILE, d === len ? ink.moss2 : d % 2 ? ink.moss1 : ink.moss0, 1, d === len ? T[','] : d % 2 ? T[';'] : T['|']);
              }
            }
          }
        }

        // Grass tufts on the rim.
        for (let c = c0; c < cols; c++) {
          const r = topRow[c] - 1;
          if (r < 0 || !isRock(c, r + 1) || hash1(c * 29) > 0.45) continue;
          f.put(r * cols + c, GLYPH, ink.moss1, 0.9, hash1(c * 31) < 0.5 ? slot.comma : slot.tick);
        }

        // Pines on the rim.
        for (const u of [-2.5, -1.8, -1.1, 0.95, 1.6, 2.4]) {
          const x = fx + u * fw;
          const c = clamp(Math.floor(x / cw), 0, cols - 1);
          if (x > w + 10 || !isRock(c, topRow[c])) continue;
          const height = h * (0.09 + hash1(Math.round(u * 10) + 5) * 0.08);
          pine(f, view, x, topRow[c] * ch + ch * 0.6, height, ramp.pine, ink.trunk);
        }

        // Wet boulders at the foot of the falls and one big mossy one on the right.
        const rocks = [
          { x: fx - fw * 0.95, y: poolY + ch * 1.3, r: 20 },
          { x: fx + fw * 0.8, y: poolY + ch * 1.0, r: 24 },
          { x: fx - fw * 1.9, y: poolY + ch * 2.6, r: 22 },
          { x: w - cw * 2.5, y: poolY + ch * 3.4, r: 40 },
        ];
        for (const b of rocks) boulder(f, b, b.r > 30 ? ramp.rock : ramp.wet, b.r > 30, b.y + b.r * 0.35);
      },

      paint(f, t) {
        const G = layout();
        const { w, h, cw, ch, cols, poolRow, poolY, fw, fx, fc0, fc1, lipRow } = G;

        if (night) {
          stars.paint(f, t, ink.star);
          const mx = w * 0.46;
          const my = h * 0.13;
          f.glow(mx, my, 150, '#cfdcff', 0.25);
          f.each(mx - 50, my - 50, mx + 50, my + 50, (x, y, i) => f.shape(i, Math.hypot(x - mx, y - my) - 34 + (Math.hypot(x - mx - 12, y - my + 8) < 8 ? 3 : 0), ink.moon, 1, ink.moon, 0.4));
          // Moon path glittering on the pool.
          for (let k = 0; k < glints.length; k++) {
            const g = glints[k];
            const y = poolY + ch * 0.5 + g.v * (h - poolY);
            const x = mx + (g.u - 0.5) * (60 + (y - poolY) * 0.7);
            const a = Math.sin(t * g.rate + g.phase);
            const i = f.at(x, y);
            if (i >= 0 && a > 0.2) f.put(i, GLYPH, ink.ripple, a * 0.85, a > 0.7 ? slot.wave : slot.dash);
          }
        } else {
          for (const b of birds) {
            const i = f.at(b.x, b.y + Math.sin(t + b.phase) * 5);
            if (i >= 0) f.put(i, GLYPH, ink.bird, 0.8, Math.floor(t * 3 + b.phase) % 2 ? slot.up : slot.down);
          }
          // Sun glints drifting on the pool.
          for (let k = 0; k < glints.length; k++) {
            const g = glints[k];
            const y = poolY + ch * 1.5 + g.v * (h - poolY);
            const x = w * (0.3 + g.u * 0.7) + Math.sin(t * 0.3 + g.phase) * 10;
            const a = Math.sin(t * g.rate + g.phase);
            const i = f.at(x, y);
            if (i >= 0 && a > 0.3) f.put(i, GLYPH, ink.ripple, a * 0.75, slot.dash);
          }
        }

        // Mist glow, and the rainbow in the spray (the falls are drawn over it).
        f.glow(fx, poolY - ch, fw * 2.6, night ? '#9fc2ff' : '#ffffff', night ? 0.24 : 0.7);
        if (!night) {
          const cx = fx - fw * 0.35;
          const cy = poolY + ch * 2;
          const rad = fw * 1.45;
          const shimmer = 0.8 + 0.2 * Math.sin(t * 0.6);
          f.each(cx - rad - cw, cy - rad - ch, cx + rad + cw, poolY + ch, (x, y, i) => {
            const band = Math.floor((rad - Math.hypot(x - cx, y - cy)) / cw);
            if (band < 0 || band >= RAINBOW.length) return;
            const fade = smoothstep(poolY + ch * 2, poolY - ch, y);
            f.put(i, BLOCK, ink[RAINBOW[band]], 0.8 * fade * shimmer);
          });
        }

        // The falls: several streams with bright cores, streaks racing down, spray at the edges.
        const lipY = lipRow * ch;
        const span = poolY - lipY;
        const half = fw / 2;
        const speed = span * 0.9;
        for (let r = lipRow; r < poolRow; r++) {
          const y = (r + 0.5) * ch;
          const p = (y - lipY) / span;
          for (let c = fc0 - 1; c <= fc1 + 1; c++) {
            const x = (c + 0.5) * cw;
            const u = (x - fx) / half;
            const cov = coverage(u, p, t);
            const i = r * cols + c;
            const n = noise2(c * 1.9 + 7.3, (y - t * speed) / (ch * 5));
            if (cov < 0.3) {
              if (cov > 0.03 && hash1(i * 7 + Math.floor(t * 9 + hash1(i) * 9)) < cov * 2) f.put(i, GLYPH, ink.foam, 0.45 + cov, n > 0 ? slot.colon : slot.tick);
              continue;
            }
            if (r === lipRow) {
              f.put(i, TILE, ink.foam, 1, FOAMY[Math.floor(hash1(i + Math.floor(t * 7)) * FOAMY.length)]);
              continue;
            }
            let v = 0.1 + cov * 0.45 + n * 0.5 + smoothstep(0.75, 1, p) * 0.35 + (p < 0.1 ? 0.25 : 0);
            if (night) v -= u * 0.12;
            if (cov < 0.6) v -= 0.25;
            f.put(i, BLOCK, shade(ramp.water, v, c, r), 1);
          }
        }

        // Droplets glinting on the wet rock beside the falls.
        for (let k = 0; k < 14; k++) {
          const c = k % 2 ? fc1 + 2 + Math.floor(hash1(k * 3) * 3) : fc0 - 2 - Math.floor(hash1(k * 3) * 3);
          const r = lipRow + 2 + Math.floor(hash1(k * 5 + Math.floor(t * 0.7 + hash1(k) * 3)) * (poolRow - lipRow - 3));
          const a = Math.sin(t * 2.3 + k * 1.7);
          if (a > 0.4 && c >= 0 && c < cols) f.put(r * cols + c, GLYPH, ink.water3, a, slot.dot);
        }

        // Churning foam where the water hits the pool.
        for (let r = poolRow - 2; r <= poolRow + 2; r++) {
          const y = (r + 0.5) * ch;
          const reach = fw * (0.6 + (r - poolRow + 2) * 0.18);
          for (let c = Math.floor((fx - reach) / cw); c <= Math.floor((fx + reach) / cw); c++) {
            if (c < 0 || c >= cols) continue;
            const x = (c + 0.5) * cw;
            const edge = 1 - Math.abs(x - fx) / reach;
            const churn = noise2(x / 16 + t * 1.6, y / 9 - t * 1.1) * 0.5 + edge;
            if (churn < 0.25) continue;
            const i = r * cols + c;
            const g = FOAMY[Math.floor(hash1(i * 3 + Math.floor(t * 8 + hash1(i) * 4)) * FOAMY.length)];
            if (churn > 0.7) f.put(i, TILE, ink.foam, 1, g);
            else f.put(i, GLYPH, ink.foam, churn + 0.2, hash1(i + Math.floor(t * 5)) < 0.25 ? slot.o : churn > 0.5 ? slot.tick : slot.dot);
          }
        }

        // Mist rising off the plunge.
        for (const m of mist) {
          const age = (t * m.rate + m.phase) % 1;
          const x = fx + m.u * fw * (0.7 + age * 1.1) + Math.sin(t * 0.8 + m.sway) * 8;
          const y = poolY - age * h * 0.24;
          const i = f.at(x, y);
          if (i < 0 || f.kind[i] === BLOCK || f.kind[i] === TILE) continue;
          f.put(i, GLYPH, ink.foam, Math.sin(Math.PI * age) * 0.7, age < 0.15 ? slot.o : age < 0.6 ? slot.dot : slot.tick);
        }

        rings.paint(f, ink.ripple);

        for (const fl of flies) {
          const p = ((t + fl.seed) % fl.period) / fl.period;
          const b = smoothstep(0, 0.15, p) * (1 - smoothstep(0.35, 0.6, p));
          if (b < 0.05) continue;
          const x = (fl.right ? lerp(fx + fw, w, fl.u) : w * (0.01 + fl.u * 0.36)) + noise2(fl.seed, t * 0.2) * 24;
          const y = (fl.right ? h * (0.6 + fl.v * 0.16) : h * (0.6 + fl.v * 0.36)) + noise2(t * 0.2, fl.seed) * 20;
          f.glow(x, y, 30, '#e6ff8a', 0.45 * b);
          const i = f.at(x, y);
          if (i >= 0) f.put(i, TILE, ink.fly, b);
        }
      },

      front(f) {
        // Fern clumps framing the bottom corners: dark cores, lit fronds.
        const clumps = [
          [view.w * 0.335, view.h + 10, clamp(view.h * 0.15, 80, 140)],
          [view.w * 0.995, view.h + 6, clamp(view.h * 0.16, 90, 150)],
        ];
        for (const [cx, cy, R] of clumps) {
          f.each(cx - R * 1.4, cy - R * 1.3, cx + R * 1.4, cy, (x, y, i) => {
            let d = 1e9;
            for (let k = 0; k < 7; k++) {
              const a = Math.PI * (0.12 + (k / 6) * 0.76);
              const len = R * (0.75 + hash1(k + Math.round(cx)) * 0.4);
              const dx = -Math.cos(a) * len;
              const dy = -Math.sin(a) * len;
              const s = clamp(((x - cx) * dx + (y - cy) * dy) / (dx * dx + dy * dy), 0, 1);
              d = Math.min(d, Math.hypot(x - cx - dx * s, y - cy - dy * s) - (1 - s) * 14 - 3);
            }
            const c = Math.floor(x / view.cw);
            const r = Math.floor(y / view.ch);
            if (d < 0) f.put(i, TILE, tint(ramp.pine, 1 + d / 14 + ((cy - y) / R) * 0.3, c, r), 1, LEAFY[Math.floor(hash1(i) * LEAFY.length)]);
            else if (d < view.cw && hash1(i) < 0.3) f.put(i, GLYPH, ink.moss2, 0.6, slot.comma);
          });
        }
      },
    };
  },
};
