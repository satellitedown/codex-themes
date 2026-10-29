import { solid, tone } from '../engine/color.js';
import { BLOCK, GLYPH, TILE } from '../engine/field.js';
import { clamp, hash1, noise2, rng, smoothstep } from '../engine/math.js';
import { crisp, drifters } from './kit.js';

// Tile glyphs, all placed explicitly (never shimmering): plain tiles, logs, log ends, window panes.
const TILES = ' =o#';
const TG = { blank: TILES.indexOf(' '), log: TILES.indexOf('='), end: TILES.indexOf('o'), pane: TILES.indexOf('#') };

/*
 * Mountain peaks as fractions of the view: x/top position the summit, wl/wr
 * are the flank half-widths, slant tilts the sunlit/shadow spine. Later
 * entries stand in front of earlier ones.
 */
const FAR = [
  { x: 0.03, top: 0.33, wl: 0.16, wr: 0.15, slant: 0.04, seed: 1.3 },
  { x: 0.4, top: 0.27, wl: 0.22, wr: 0.2, slant: 0.06, seed: 4.1 },
  { x: 0.63, top: 0.33, wl: 0.16, wr: 0.18, slant: 0.05, seed: 5.7 },
  { x: 0.8, top: 0.29, wl: 0.15, wr: 0.15, slant: 0.04, seed: 7.2 },
  { x: 1.02, top: 0.34, wl: 0.16, wr: 0.16, slant: 0.04, seed: 8.8 },
];
const NEAR = [
  { x: 0.56, top: 0.46, wl: 0.24, wr: 0.22, slant: 0.08, seed: 11.4 },
  { x: 0.74, top: 0.4, wl: 0.17, wr: 0.16, slant: 0.06, seed: 12.6 },
  { x: 0.05, top: 0.41, wl: 0.16, wr: 0.14, slant: 0.06, seed: 13.9 },
  { x: 0.91, top: 0.29, wl: 0.19, wr: 0.2, slant: 0.05, seed: 15.3 },
  { x: 0.26, top: 0.2, wl: 0.22, wr: 0.24, slant: 0.06, seed: 17.1 },
];
const MOUNTAIN_BASE = 0.665;
const CRESTS = [0.665, 0.73, 0.82, 0.93];
/** Aurora curtains: hem height (fraction of view), relative height, hem ink, glow colour, strength. */
const AURORA = [
  { y: 0.17, tall: 1, ink: 'aurora1', glow: '#3cffa8', gain: 1 },
  { y: 0.26, tall: 0.85, ink: 'aurora2', glow: '#2ee6d6', gain: 0.85 },
  { y: 0.09, tall: 0.7, ink: 'aurora3', glow: '#a06bff', gain: 0.45 },
];

/*
 * Log cabin in three-quarter view, lit from the left: the sunlit gable end
 * (L) on the left, the long wall (l, d shaded) facing us, and a deep
 * snow-laden roof (S lit, n plain, s the shaded front lip) with E the eave
 * shadow under it. o log ends, W windows, D door, K chimney, A lantern,
 * w woodpile under the window.
 */
const CABIN = [
  '...........SS..',
  '...........KK..',
  '..SSSSSSSSSKKSs',
  '.SLSSSSSSSSSSSs',
  'SLLLSnnnnnnnnns',
  'LLLLLssssssssss',
  'LLLLLoEEEEEEEEE',
  'LWWWLdWWWlAllld',
  'LWWWLoWWWllDDDd',
  'LSSSLdSSSllDDDd',
  'LLLLLowwwllDDDd',
  'SLLLLdwwwllDDDS',
];
const DOOR_COL = 12;
const CHIMNEY_COL = 12;

/**
 * Snow-laden pine built row by row: a cone whose tiers step back at the top
 * of each tier into a sawtooth silhouette. Each tier's top row carries snow
 * (sunlit left, blue right) inside green edges; needles are lit on the left,
 * with a dark underside beneath each tier.
 */
function pine(f, x, base, height, inks) {
  const { cw, ch } = f;
  const cc = Math.floor(x / cw);
  const rb = Math.floor(base / ch);
  const total = Math.max(3, Math.round(height / ch));
  const trunkRows = Math.max(1, Math.round(total * 0.1));
  const crown = total - trunkRows;
  const per = crown >= 10 ? 3 : 2;
  const maxHalf = Math.max(1, (crown * ch * 0.3) / cw);
  const put = (c, r, ink) => {
    if (c >= 0 && r >= 0 && c < f.cols && r < f.rows) f.put(r * f.cols + c, BLOCK, ink, 1);
  };
  for (let k = 0; k < crown; k++) {
    const r = rb - trunkRows - crown + 1 + k;
    const sub = k % per;
    const h = Math.round(maxHalf * ((k + 1) / crown) * (0.62 + 0.38 * (sub / (per - 1))));
    for (let dc = -h; dc <= h; dc++) {
      const edge = Math.abs(dc) === h;
      if (h >= 3 && edge && hash1((cc + dc) * 31 + r * 7) < 0.35) continue;
      const n = dc / Math.max(1, h);
      if (k === 0 || (sub === 0 && !edge)) put(cc + dc, r, n <= 0 ? inks.snow : inks.snowShade);
      else if (sub === per - 1 && per > 2) put(cc + dc, r, n < -0.6 ? inks.mid : inks.dark);
      else put(cc + dc, r, n < -0.3 ? inks.lit : n > 0.35 ? inks.dark : inks.mid);
    }
  }
  for (let k = 0; k < trunkRows; k++) put(cc, rb - k, inks.trunk);
}

/**
 * A log cabin in a snowy clearing: mountains behind, pines around, smoke
 * curling from the chimney while snow falls. Day: crisp blue sky. Night: the
 * aurora ripples overhead and the windows glow warm.
 */
export default {
  id: 'snow-cabin',
  name: 'Snow Cabin',
  chars: { tile: TILES, halo: ".'*+", extra: 'o|' },
  shimmer: 0.9,
  palettes: {
    light: {
      bg: {
        stops: [[0, '#4a9fe2'], [0.3, '#86c4f0'], [0.55, '#c9e6f8'], [0.7, '#e4f2fb'], [1, '#eef6fc']],
        spots: [
          { x: 0.11, y: 0.09, r: 0.34, color: 'rgba(255, 249, 226, 0.55)' },
          { x: 0.11, y: 0.09, r: 0.05, color: 'rgba(255, 253, 240, 0.95)' },
        ],
        vignette: 0,
        texture: null,
      },
      inks: {
        farLit: solid('#f6faff'),
        farMid: solid('#d9e7f7'),
        farShade: solid('#b2cbec'),
        farRock: solid('#8ea6cc'),
        nearBright: solid('#ffffff'),
        nearLit: solid('#eef3fb'),
        nearMid: solid('#c3d7f1'),
        nearShade: solid('#93b2de'),
        nearDeep: solid('#6f8fc6'),
        rockLit: solid('#7b7286'),
        rockDark: solid('#45557d'),
        pineFar: tone('#3f7176', 0.16),
        pineFarDark: tone('#2b5560', 0.16),
        pineFarSnow: solid('#9cc0c6'),
        snowBright: solid('#ffffff'),
        snow: solid('#eef4fc'),
        snowShade: solid('#cadcf2'),
        snowDeep: solid('#9fbbe3'),
        sparkle: solid('#5ea8ff'),
        pineDark: tone('#123a2b', 0.18),
        pine: tone('#1d5539', 0.2),
        pineLit: tone('#2f7448', 0.22),
        pineSnow: solid('#f8fbff'),
        trunk: tone('#5b3a26', 0.18),
        logLit: tone('#c9864e', 0.2),
        log: tone('#a3632f', 0.2),
        logDark: tone('#6f3e1c', 0.2),
        logEnd: tone('#e7c18c', 0.3),
        eave: tone('#3b2414', 0.1),
        window: tone('#ffcf73', 0.4),
        door: tone('#5e3820', 0.15),
        stone: tone('#8b8c9e', 0.22),
        lamp: tone('#ffc552', 0.3),
        post: tone('#6b4a32', 0.18),
        smoke: solid('#c4cfdc'),
        flake: solid('#ffffff'),
        aurora1: solid('#5dffb0'),
        aurora2: solid('#38e0d0'),
        aurora3: solid('#b47bff'),
      },
      ui: { base: '#e3f2fb', sidebar: 'rgba(240, 248, 253, 0.68)', composer: 'rgba(252, 254, 255, 0.88)', accent: '#3a7cc0', bubble: 'rgba(58, 124, 192, 0.13)' },
      lane: 0.55,
    },
    dark: {
      bg: {
        stops: [[0, '#01040c'], [0.32, '#04112a'], [0.6, '#0a2142'], [1, '#0d2546']],
        spots: [
          // Static aurora wash (baked, free) under the animated curtains.
          { x: 0.5, y: 0.14, r: 0.6, color: 'rgba(60, 255, 170, 0.08)' },
          { x: 0.28, y: 0.19, r: 0.3, color: 'rgba(60, 255, 170, 0.08)' },
          { x: 0.8, y: 0.24, r: 0.28, color: 'rgba(46, 230, 214, 0.07)' },
          { x: 0.55, y: 0.05, r: 0.34, color: 'rgba(160, 107, 255, 0.07)' },
          { x: 0.13, y: 0.1, r: 0.16, color: 'rgba(200, 220, 255, 0.12)' },
          { x: 0.13, y: 0.1, r: 0.02, color: 'rgba(236, 242, 255, 0.95)' },
        ],
        vignette: 0.2,
        texture: null,
      },
      inks: {
        farLit: solid('#4a6593'),
        farMid: solid('#334c78'),
        farShade: solid('#213760'),
        farRock: solid('#182746'),
        nearBright: solid('#b2caf0'),
        nearLit: solid('#7f9dd0'),
        nearMid: solid('#5272a6'),
        nearShade: solid('#2c4676'),
        nearDeep: solid('#1b2d55'),
        rockLit: solid('#454a6c'),
        rockDark: solid('#0e1730'),
        pineFar: tone('#12283a', 0.12),
        pineFarDark: tone('#091725', 0.12),
        pineFarSnow: solid('#36557f'),
        snowBright: solid('#9ab5e2'),
        snow: solid('#6684b9'),
        snowShade: solid('#425e94'),
        snowDeep: solid('#2b4372'),
        sparkle: solid('#eaf3ff'),
        pineDark: tone('#030b0b', 0.14),
        pine: tone('#0a1d1a', 0.16),
        pineLit: tone('#14352c', 0.18),
        pineSnow: solid('#8eaad8'),
        trunk: tone('#140d08', 0.12),
        logLit: tone('#5c3a25', 0.18),
        logDark: tone('#2a170d', 0.16),
        log: tone('#45291a', 0.18),
        logEnd: tone('#80593a', 0.22),
        eave: tone('#0a0605', 0.1),
        window: tone('#ffc457', 0.45),
        door: tone('#1e110a', 0.12),
        stone: tone('#3b4054', 0.18),
        lamp: tone('#ffd27a', 0.3),
        post: tone('#2a1d13', 0.15),
        smoke: solid('#6e7f9a'),
        flake: solid('#d6e6ff'),
        aurora1: solid('#5dffb0'),
        aurora2: solid('#38e0d0'),
        aurora3: solid('#b47bff'),
      },
      ui: { base: '#061428', sidebar: 'rgba(4, 12, 26, 0.62)', composer: 'rgba(6, 18, 36, 0.86)', accent: '#5dffb0', bubble: 'rgba(93, 255, 176, 0.16)' },
      lane: 0.62,
    },
  },

  scene(view) {
    const rand = rng(0x5e0e);
    const { ink, night } = view;
    const near = drifters(view, rand, { count: Math.round(view.w / 26), vy: [26, 46], vx: [-14, -4], sway: 10, glyphs: '*+*', alpha: [0.55, 0.9] });
    const far = drifters(view, rand, { count: Math.round(view.w / 14), vy: [12, 22], vx: [-8, -2], sway: 6, glyphs: '..', alpha: [0.3, 0.6] });
    const slot = { o: view.glyph('o'), dot: view.glyph('.'), bar: view.glyph('|'), tick: view.glyph("'"), plus: view.glyph('+'), star: view.glyph('*') };
    const stars = Array.from({ length: 90 }, () => ({ x: rand(), y: rand() * 0.44, slot: rand() < 0.22 ? (rand() < 0.5 ? slot.plus : slot.star) : slot.dot, speed: rand.range(0.6, 2.2), phase: rand() * 6.28, base: rand.range(0.35, 0.9) }));
    const glints = Array.from({ length: 140 }, () => ({ u: rand(), v: rand(), speed: rand.range(0.7, 1.8), phase: rand() * 6.28 }));

    const snowRamp = [ink.snowDeep, ink.snowShade, ink.snow, ink.snowBright];
    const nearRamp = [ink.nearDeep, ink.nearShade, ink.nearMid, ink.nearLit, ink.nearBright];
    const farRamp = [ink.farShade, ink.farMid, ink.farLit];
    const pineInks = { dark: ink.pineDark, mid: ink.pine, lit: ink.pineLit, snow: ink.pineSnow, snowShade: ink.snowShade, trunk: ink.trunk };
    const forestTips = (cols) => {
      const tips = new Float32Array(cols);
      const side = new Int8Array(cols);
      const fr = rng(0x917e);
      for (let c = -3; c < cols + 3; c += fr.range(1.6, 3.1)) {
        const h = fr.range(1.4, 3.7);
        const cc = Math.round(c);
        for (let dc = -3; dc <= 3; dc++) {
          const j = cc + dc;
          const v = h - Math.abs(dc) * 0.95;
          if (j < 0 || j >= cols || v <= tips[j]) continue;
          tips[j] = v;
          side[j] = Math.sign(dc);
        }
      }
      return { tips, side };
    };

    // Geometry shared by back() and paint(), rebuilt when the view size changes.
    let geo = null;
    const layout = () => {
      if (geo && geo.w === view.w && geo.h === view.h) return geo;
      const W = view.w;
      const H = view.h;
      const { cw, ch } = view;
      const cols = view.cols;
      const G = H * MOUNTAIN_BASE;
      const peaks = [...FAR.map((p) => ({ ...p, far: true })), ...NEAR.map((p) => ({ ...p, far: false }))];
      const skyline = new Float32Array(cols).fill(H);
      for (const p of peaks) {
        p.ridge = new Float32Array(cols);
        const px = p.x * W;
        const top = p.top * H;
        for (let c = 0; c < cols; c++) {
          const x = (c + 0.5) * cw;
          const dx = x - px;
          const s = Math.abs(dx) / ((dx < 0 ? p.wl : p.wr) * W);
          if (s >= 1) {
            p.ridge[c] = H * 2;
            continue;
          }
          const jag = (noise2(x / 22, p.seed) * 6 + noise2(x / 64, p.seed + 5) * 13) * (p.far ? 0.6 : 1);
          const shoulder = Math.sin(s * 5.2 + p.seed) * ch * 0.5;
          p.ridge[c] = top + (G - top) * s ** 0.78 + (jag + shoulder) * Math.min(1, s * 5);
          skyline[c] = Math.min(skyline[c], p.ridge[c]);
        }
      }
      const crest = CRESTS.map((fy, k) => {
        const line = new Float32Array(cols);
        for (let c = 0; c < cols; c++) {
          const x = (c + 0.5) * cw;
          line[c] = fy * H + Math.sin(x / (260 + k * 90) + k * 1.9) * (6 + k * 9) + noise2(x / 170, k * 3.1) * (4 + k * 5);
        }
        return line;
      });
      // Cabin centred in the right strip the chat column leaves visible: the
      // app's column (768px + margins) is centred right of a 290px sidebar.
      const rb = Math.round((H * 0.8) / ch);
      const r0 = rb - CABIN.length;
      const strip = Math.max(W * 0.82, W / 2 + 549);
      const c0 = clamp(Math.round((strip + W) / 2 / cw - CABIN[0].length / 2), 0, cols - CABIN[0].length);
      geo = { w: W, h: H, cols, G, peaks, skyline, crest, r0, c0, rb };
      return geo;
    };

    // Smoke puffs: a fixed pool so update() never allocates.
    const puffs = Array.from({ length: 28 }, () => ({ live: false, age: 0, life: 1, drift: 0, seed: 0 }));
    let nextPuff = 0;

    return {
      update(dt) {
        near.update(dt);
        far.update(dt);
        nextPuff -= dt;
        if (nextPuff <= 0) {
          nextPuff = 0.28;
          const p = puffs.find((q) => !q.live);
          if (p) {
            p.live = true;
            p.age = 0;
            p.life = rand.range(5, 7);
            p.drift = rand.range(3, 7);
            p.seed = rand() * 10;
          }
        }
        for (const p of puffs) {
          if (!p.live) continue;
          p.age += dt;
          if (p.age > p.life) p.live = false;
        }
      },

      back(f) {
        const { cw, ch } = f;
        const { w: W, h: H, G, peaks, crest, r0, c0, rb } = layout();

        // Mountains: per cell, the front-most peak owns it. A wavy spine splits
        // each peak into a sunlit (left) and a shadow (right) face; radiating
        // spurs add facets, with rock where snow can't hold on the spur crests.
        f.each(0, 0, W, G + ch * 2, (x, y, i) => {
          const c = Math.floor(x / cw);
          const r = Math.floor(y / ch);
          let p = null;
          for (let k = peaks.length - 1; k >= 0; k--) {
            if (y >= peaks[k].ridge[c]) {
              p = peaks[k];
              break;
            }
          }
          if (!p) return;
          const top = p.top * H;
          const d = y - top;
          const depth = clamp(d / (G - top), 0, 1);
          const spine = p.x * W + d * p.slant + noise2(y / 55, p.seed) * cw * 1.6 * depth;
          const lit = x < spine;
          const theta = Math.atan2(x - p.x * W, d + 40);
          const phi = theta * (p.far ? 3.5 : 4.5) + noise2(x / 70, y / 70 + p.seed) * 0.8;
          const facet = phi - Math.floor(phi);
          const fromRidge = y - p.ridge[c];
          // Ramp positions: far 0 shade · 0.5 mid · 1 lit; near 0 deep · 0.25
          // shade · 0.5 mid · 0.75 lit · 1 bright.
          let v;
          if (p.far) v = fromRidge < ch ? (lit ? 1 : 0.5) : lit ? (facet < 0.35 ? 0.5 : 1) : 0;
          else if (fromRidge < ch) v = lit ? 1 : 0.5;
          else v = lit ? (facet < 0.35 ? 0.5 : facet > 0.72 ? 1 : 0.75) : facet < 0.35 ? 0 : 0.25;
          const farGully = p.far && !lit && facet < 0.3 && d > ch * 2;
          const crestRock = !p.far && (facet < 0.07 || facet > 0.96) && d > ch * 3 && noise2(x / 34 + p.seed, y / 40) > 0.25;
          const cliff = !p.far && !lit && depth < 0.55 && fromRidge > ch && noise2(x / 30, y / 20 + p.seed) > 0.32;
          const alpha = p.far ? 1 - 0.55 * smoothstep(0.4, 1, depth) : 1;
          if (farGully) f.put(i, BLOCK, ink.farRock, alpha);
          else if (crestRock || cliff) f.put(i, BLOCK, lit ? ink.rockLit : ink.rockDark, alpha);
          else f.put(i, BLOCK, crisp(p.far ? farRamp : nearRamp, v, c, r), alpha);
        });

        // Snowfield: drift bands with a bright lip under each crest, falling
        // into blue shadow where the next drift rises in front.
        const n = crest.length;
        f.each(0, CRESTS[0] * H - ch * 3, W, H, (x, y, i) => {
          const c = Math.floor(x / cw);
          const r = Math.floor(y / ch);
          if (y < crest[0][c]) return;
          let k = 0;
          while (k + 1 < n && y >= crest[k + 1][c]) k++;
          const y0 = crest[k][c];
          const y1 = k + 1 < n ? crest[k + 1][c] : H + ch * 3;
          const u = (y - y0) / (y1 - y0);
          const cl = Math.max(0, c - 2);
          const cr = Math.min(crest[k].length - 1, c + 2);
          const slope = (crest[k][cl] - crest[k][cr]) / ((cr - cl) * cw || 1);
          let v;
          if (k === 0) v = 0.67 - 0.3 * smoothstep(0.6, 1, u);
          else if (y - y0 < ch) v = slope > -0.03 ? 1 : 0.67;
          else if (u < 0.3 && slope > 0.05) v = 1;
          else v = u < 0.68 - slope * 2 ? 0.67 : 0.33;
          f.put(i, BLOCK, crisp(snowRamp, v, c, r), 1);
        });

        // Forest band along the foot of the mountains: overlapping pointed
        // crowns, lit on the left with snow on the sunlit tips.
        const { tips, side } = forestTips(crest[0].length);
        for (let c = 0; c < tips.length; c++) {
          const foot = crest[0][c] + ch * 0.5;
          for (let r = Math.floor((foot - (tips[c] + 1) * ch) / ch); r <= Math.floor(foot / ch); r++) {
            const above = (foot - (r + 0.5) * ch) / ch;
            if (above > tips[c] || r < 0) continue;
            const i = r * f.cols + c;
            if (above > tips[c] - 1 && side[c] <= 0 && tips[c] > 1.2) f.put(i, BLOCK, ink.pineFarSnow, 1);
            else f.put(i, BLOCK, side[c] > 0 || above < 0.6 ? ink.pineFarDark : ink.pineFar, 1);
          }
        }
        // Mid-distance pines across the clearing.
        for (const [fx, fh] of [[0.36, 0.13], [0.405, 0.09], [0.47, 0.07], [0.6, 0.1], [0.66, 0.14], [0.71, 0.08]]) {
          pine(f, fx * W, H * 0.74, H * fh, pineInks);
        }

        // Trodden path from the cabin door, footprints in two tracks.
        const doorX = (c0 + DOOR_COL + 0.5) * cw;
        const base = rb * ch;
        f.each(doorX - W * 0.2, base, doorX + cw * 6, H, (x, y, i) => {
          const q = (y - base) / (H - base);
          const mid = doorX - (y - base) * 0.38 + Math.sin(q * 4) * cw * 0.6;
          const hw = cw * (0.8 + 1.6 * q);
          const dx = x - mid;
          if (Math.abs(dx) < hw) {
            const r = Math.floor(y / ch);
            const step = (r & 1) === (dx < 0 ? 0 : 1) && Math.abs(Math.abs(dx) - hw * 0.45) < cw * 0.6;
            if (step) f.put(i, BLOCK, ink.snowDeep, 1);
            else f.put(i, BLOCK, crisp(snowRamp, 0.3 + 0.1 * (dx / hw), Math.floor(x / cw), r), 1);
          } else if (Math.abs(dx) < hw + cw) {
            f.put(i, BLOCK, ink.snowBright, 1);
          }
        });
        // A hare's tracks across the drifts on the left.
        for (let k = 0; k < 26; k++) {
          const q = k / 25;
          const x = W * (0.03 + 0.3 * q) + Math.sin(q * 9) * cw * 2;
          const y = H * (0.99 - 0.24 * q);
          const i = f.at(x, y);
          if (i >= 0 && k % 3 !== 2) f.put(i, BLOCK, ink.snowShade, 1);
        }

        // Foreground pines in the left gap and strip.
        for (const [fx, fy, fh] of [[0.125, 0.755, 0.25], [0.035, 0.785, 0.34], [0.297, 0.755, 0.27], [0.215, 0.78, 0.39], [0.258, 0.8, 0.16]]) {
          pine(f, fx * W, H * fy, H * fh, pineInks);
        }

        // Split-rail fence in front of the left pines: posts every third cell
        // with a rail to the next post, and a short blue shadow cast to the right.
        const fenceCols = Math.floor((W * 0.34) / cw);
        const rp = Math.floor((H * 0.81) / ch);
        const at = (cc, rr) => (cc >= 0 && rr >= 0 && cc < f.cols && rr < f.rows ? rr * f.cols + cc : -1);
        for (let c = 1; c < fenceCols; c += 3) {
          for (const [cc, rr, kind, ik, g] of [
            [c, rp, TILE, ink.post, TG.log],
            [c, rp - 1, TILE, ink.post, TG.log],
            [c, rp - 2, BLOCK, ink.snowBright, -1],
            [c + 1, rp - 1, TILE, ink.post, TG.log],
            [c + 2, rp - 1, TILE, ink.post, TG.log],
            [c + 1, rp, BLOCK, ink.snowShade, -1],
          ]) {
            const i = at(cc, rr);
            if (i >= 0) f.put(i, kind, ik, 1, g);
          }
        }

        // A dark stand of pines behind the cabin so the snowy roof reads
        // against it, then the cabin itself.
        const cabinL = c0 * cw;
        for (let x = cabinL - cw * 3, k = 0; x > W * 0.79 && k < 3; x -= cw * 5, k++) pine(f, x, base - ch * 0.2, H * (0.2 + 0.05 * (k % 2)), pineInks);
        for (let x = cabinL + cw * (CABIN[0].length + 3), k = 0; x < W + cw * 2; x += cw * 5, k++) pine(f, x, base - ch * 0.4, H * (0.26 - 0.04 * (k % 2)), pineInks);
        const eaveY = (r0 + 6) * ch;
        for (const [dc, fh] of [[-0.5, 0.2], [3.5, 0.27], [8.5, 0.31], [13.5, 0.24], [6, 0.17], [11, 0.18], [1.5, 0.15]]) {
          pine(f, (c0 + dc) * cw, eaveY, H * fh, pineInks);
        }
        const legend = {
          S: [BLOCK, ink.snowBright],
          s: [BLOCK, ink.snowShade],
          E: [TILE, ink.eave, 1, TG.blank],
          L: [TILE, ink.logLit, 1, TG.log],
          l: [TILE, ink.log, 1, TG.log],
          d: [TILE, ink.logDark, 1, TG.log],
          o: [TILE, ink.logEnd, 1, TG.end],
          W: [TILE, ink.window, 1, TG.pane],
          D: [TILE, ink.door, 1, TG.blank],
          K: [TILE, ink.stone, 1, TG.log],
          A: [TILE, ink.lamp, 1, TG.blank],
          n: [BLOCK, ink.snow],
          w: [TILE, ink.logEnd, 1, TG.end],
        };
        f.sprite(CABIN, legend, cabinL, r0 * ch);
        // Drift banked against the front wall, shadowed on the right.
        for (let c = c0 - 1; c < c0 + CABIN[0].length; c++) {
          const i = f.at((c + 0.5) * cw, (rb + 0.5) * ch);
          if (i >= 0) f.put(i, BLOCK, c - c0 >= DOOR_COL - 1 && c - c0 <= DOOR_COL + 1 ? ink.snowShade : c - c0 > 5 ? ink.snow : ink.snowBright, 1);
        }
      },

      paint(f, t) {
        const { cw, ch } = f;
        const { h: H, skyline, r0, c0, rb, crest } = layout();
        const cols = skyline.length;

        if (night) {
          for (const s of stars) {
            const x = s.x * view.w;
            const y = s.y * H;
            const c = Math.floor(x / cw);
            if (c >= cols || y > skyline[c] - ch) continue;
            const i = f.at(x, y);
            if (i >= 0) f.put(i, GLYPH, ink.flake, s.base * (0.55 + 0.45 * Math.sin(t * s.speed + s.phase)), s.slot);
          }
          // Aurora: three folded curtains. A bright hem of tiles along the
          // bottom edge, sparse vertical rays fading upward (every other
          // column), and a few broad glows per ribbon over the baked wash in
          // bg.spots; glows are fill-rate bound, so three per ribbon at most.
          const glowStep = Math.ceil(cols / 3);
          for (let k = 0; k < 3; k++) {
            const band = AURORA[k];
            const hemInk = ink[band.ink];
            for (let c = 0; c < cols; c++) {
              const x = (c + 0.5) * cw;
              const presence = clamp((noise2(x / 300 + k * 7.3, t * 0.045 + k) + 0.3) * 1.6, 0, 1) * band.gain;
              if (presence < 0.06) continue;
              const hem = H * band.y + Math.sin(x * 0.0032 + t * 0.11 + k * 2.1) * H * 0.05 + Math.sin(x * 0.011 - t * 0.19 + k) * H * 0.016;
              const height = H * (0.06 + 0.1 * presence) * band.tall;
              const fold = 0.5 + 0.5 * Math.sin(x * 0.06 + t * 0.55 + k * 1.7 + Math.sin(x * 0.012 - t * 0.23) * 2.2);
              const ray = 0.35 + 0.65 * fold;
              const limit = skyline[c] - ch * 0.5;
              if (k < 2 && c % glowStep === glowStep >> 1 && hem < limit) f.glow(x, hem - height * 0.35, 90 + 30 * presence, band.glow, 0.24 * presence * ray);
              const ra = Math.max(0, Math.floor((hem - height) / ch));
              const rz = Math.floor(hem / ch);
              for (let r = ra; r <= rz; r++) {
                const y = (r + 0.5) * ch;
                if (y > limit) break;
                const frac = clamp((hem - y) / height, 0, 1);
                const i = r * f.cols + c;
                if (c >= f.cols || r >= f.rows) break;
                const body = frac < 0.3 && k < 2 ? presence * ray * 0.36 * (1 - frac / 0.3) : 0;
                if (r === rz && k < 2) {
                  f.put(i, TILE, hemInk, presence * (0.5 + 0.45 * fold), TG.blank);
                } else if (body > 0.12) {
                  f.put(i, TILE, hemInk, body, TG.blank);
                } else {
                  if (((c + k) & 1) === 1 || (fold < 0.3 && frac > 0.45)) continue;
                  const a = presence * ray * (1 - frac) ** 1.4 * 0.85;
                  if (a > 0.07) f.put(i, GLYPH, frac < 0.55 ? hemInk : ink.aurora3, a, frac < 0.75 ? slot.bar : slot.tick);
                }
              }
            }
          }
          // Warm light from the windows, the lantern and the open snow by the door.
          const flick = 0.42 + 0.05 * Math.sin(t * 7.3) + 0.03 * Math.sin(t * 13.1);
          f.glow((c0 + 2.5) * cw, (r0 + 8) * ch, 60, '#ffc457', flick);
          f.glow((c0 + 7.5) * cw, (r0 + 8) * ch, 66, '#ffc457', flick);
          f.glow((c0 + 10.5) * cw, (r0 + 7.5) * ch, 44, '#ffd27a', 0.5 + 0.04 * Math.sin(t * 9.1));
          f.glow((c0 + 9.5) * cw, (rb + 1.5) * ch, 80, '#ffb347', 0.24);
        }

        // Snow glints twinkling on the drifts.
        for (const g of glints) {
          const tw = Math.sin(t * g.speed + g.phase);
          if (tw < 0.55) continue;
          const x = g.u * view.w;
          const c = Math.floor(x / cw);
          if (c >= cols) continue;
          const y = crest[1][c] + ch + g.v * (H - crest[1][c]);
          if (c >= c0 - 1 && c <= c0 + CABIN[0].length && y < (rb + 1) * ch) continue;
          const i = f.at(x, y);
          if (i >= 0) f.put(i, GLYPH, ink.sparkle, (tw - 0.55) / 0.45, tw > 0.85 ? slot.plus : slot.dot);
        }

        // Chimney smoke: puffs that swell, drift and thin out as they rise.
        const chx = (c0 + CHIMNEY_COL) * cw;
        const chy = r0 * ch;
        for (const p of puffs) {
          if (!p.live) continue;
          const q = p.age / p.life;
          const x = chx - p.drift * p.age - p.age * p.age * 0.9 + Math.sin(p.age * 1.1 + p.seed) * 7;
          const y = chy - p.age * 26;
          const rad = 0.5 + 1.3 * q;
          const fade = 0.8 * (1 - q) ** 1.1;
          for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
              const dist = Math.hypot(ox, oy * 1.3);
              if (dist > rad) continue;
              const i = f.at(x + ox * cw, y + oy * ch);
              if (i < 0) continue;
              const core = dist < 0.5;
              if (core && q < 0.6) f.put(i, TILE, ink.smoke, fade, TG.blank);
              else f.put(i, GLYPH, ink.smoke, fade * (core ? 1 : 0.7), q < 0.6 ? slot.o : slot.dot);
            }
          }
        }

        far.paint(f, t, ink.flake, 0.8);
        near.paint(f, t, ink.flake);
      },
    };
  },
};
