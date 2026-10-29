import { solid, tone } from '../engine/color.js';
import { BLOCK, GLYPH, TILE } from '../engine/field.js';
import { clamp, hash1, hash2, noise2, rng, smoothstep } from '../engine/math.js';
import { shade, starfield } from './kit.js';

// Tile glyphs are only ever picked explicitly: plain tiles (leaves, lanterns), roof shingles, basket weave, flowers.
const TILE_CHARS = ' =#*';
const T_PLAIN = 0;
const T_ROOF = 1;
const T_WEAVE = 2;
const T_FLOWER = 3;

/** Ink tables share keys across schemes: strings → solid, [color, contrast] → tone, objects as-is. */
function inks(table) {
  const out = {};
  for (const [name, spec] of Object.entries(table)) out[name] = typeof spec === 'string' ? solid(spec) : Array.isArray(spec) ? tone(spec[0], spec[1]) : spec;
  return out;
}
/** Tile in the grass colour with a coloured glyph on it (flowers). */
const bloom = (bg, fg) => ({ bg, fg, halo: fg });

// Land layers, far → near; each is a dark → light ramp.
const RAMPS = [
  ['far0', 'far1', 'far2'],
  ['hillA0', 'hillA1', 'hillA2'],
  ['hillB0', 'hillB1', 'hillB2', 'hillB3'],
  ['hillC0', 'hillC1', 'hillC2', 'hillC3'],
  ['hillD0', 'hillD1', 'hillD2', 'hillD3'],
];

const BALLOON_COLORS = [
  ['red', 'yel'],
  ['blue', 'white'],
  ['teal', 'yel'],
  ['yel', 'red'],
  ['white', 'teal'],
  ['red', 'white'],
  ['blue', 'yel'],
];

// Balloon lanes: u = x fraction, s = scale, behind = land layer that hides it while it rises out of the valley.
const BALLOON_LANES = [
  { u: 0.262, s: 1.35, behind: 4 },
  { u: 0.94, s: 1.1, behind: 4 },
  { u: 0.31, s: 0.6, behind: 2 },
  { u: 0.885, s: 0.55, behind: 2 },
  { u: 0.5, s: 0.8, behind: 3 },
  { u: 0.68, s: 0.5, behind: 2 },
  { u: 0.12, s: 0.85, behind: 3 },
];

// Balloon sprites, large → tiny: X envelope, | rope, # wicker basket.
const BALLOON_SHAPES = [
  ['..XXXX..', '.XXXXXX.', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', '.XXXXXX.', '..XXXX..', '...XX...', '...||...', '...##...'],
  ['.XXXX.', 'XXXXXX', 'XXXXXX', 'XXXXXX', '.XXXX.', '..XX..', '..||..', '..##..'],
  ['.XX.', 'XXXX', 'XXXX', '.XX.', '.||.', '.##.'],
  ['.X.', 'XXX', 'XXX', '.X.', '.#.'],
];

// Pixel-art buildings. s/L = roof shade/lit side, E/W = wall shade/lit, o window, d door, c chimney.
const HOUSES = {
  cottage: ['..sL..', '.ssLL.', 'sssLLL', '.EoWW.', '.EWdo.'],
  long: ['.sLLLc.', 'ssLLLLL', '.EWoWo.', '.EWWdW.'],
  temple: ['..sL..', 'sssLLL', '.EoWW.', 'sssLLL', '.EWoW.', '.EWdW.'],
  barn: ['.sLLL.', 'ssLLLL', '.EWWW.', '.EdWo.'],
};
// Village on the right: off = columns from the right edge, lift = rows above the river bank, slate = roof colour.
const VILLAGE = [
  { type: 'temple', off: 5, lift: 5.4, slate: false },
  { type: 'cottage', off: 12, lift: 3.6, slate: true },
  { type: 'long', off: 0, lift: 2.4, slate: true },
  { type: 'barn', off: 18, lift: 0.6, slate: false },
  { type: 'cottage', off: 8, lift: 0.3, slate: false },
];

/**
 * Rolling hills and terraces around a river village. Day: striped hot-air
 * balloons drifting up out of the valley. Night: paper sky lanterns released
 * from the village float up and fade among the stars.
 */
export default {
  id: 'lantern-valley',
  name: 'Lantern Valley',
  chars: { tile: TILE_CHARS, halo: ".'", extra: '|-~^*+v' },
  shimmer: 1.0,
  palettes: {
    light: {
      bg: {
        stops: [[0, '#79c4f0'], [0.36, '#bfe4f6'], [0.5, '#e9f5f2'], [0.62, '#f4f0e0'], [1, '#f3e6d0']],
        spots: [{ x: 0.9, y: 0.11, r: 0.32, color: 'rgba(255, 246, 214, 0.85)' }],
        vignette: 0,
        texture: { color: '#ffffff', alpha: 0.26, chars: '-.', scale: 0.08, threshold: 0.25, density: 0.35, bottom: 0.38 },
      },
      inks: inks({
        far0: '#a9cbe0', far1: '#b8d6e7', far2: '#cde4ee',
        hillA0: '#94c3bf', hillA1: '#a7d0c5', hillA2: '#bddccb',
        hillB0: '#6fae8b', hillB1: '#84bf91', hillB2: '#9dcf96', hillB3: '#bce0a0',
        hillC0: '#4f9a5a', hillC1: '#66b061', hillC2: '#80c367', hillC3: '#a6d777',
        hillD0: '#327a42', hillD1: '#428f49', hillD2: '#58a64f', hillD3: '#7fc15b',
        meadow0: '#2f773b', meadow1: '#408c43', meadow2: '#5ba64d',
        wheat0: '#d8bb57', wheat1: '#ecd57c',
        crop0: '#8fc453', crop1: '#acd967',
        hedge: tone('#2f7a3f', 0.1),
        tree0: tone('#2b7140', 0.1), tree1: tone('#3c8d47', 0.1), tree2: tone('#62b558', 0.1),
        trunk: '#6b4a32',
        river0: '#5b9cc0', river1: '#86c3e2', river2: '#b9e3f5', bank: '#d6d2a2',
        glint: '#ffffff',
        wallLit: '#fdf4e2', wallShade: '#d9c3a2',
        roofLit: ['#e8794e', 0.16], roofShade: ['#b14d38', 0.16],
        slateLit: ['#7a9cc0', 0.16], slateShade: ['#4f6d92', 0.16],
        window: '#4a6d90', timber: '#7a5236',
        stone: ['#e6dece', 0.18], stoneShade: '#a79b88',
        smoke: '#ffffff',
        moon: '#fffbe8', moonShade: '#fff0c0', star: '#ffffff',
        red0: '#cf463c', red1: '#f5765f',
        yel0: '#e3a632', yel1: '#fdd86a',
        blue0: '#3d73c6', blue1: '#6aa8f2',
        teal0: '#279790', teal1: '#56cfc3',
        white0: '#d3d8e4', white1: '#ffffff',
        basket: ['#8a5a36', 0.3], rope: '#5e4e40', flame: '#ffb347',
        lantern: '#ffa640', lanternCore: '#ffe2a0', lanternDim: '#c8702e',
        flowerPink: bloom('#408c43', '#ff9ccb'), flowerYellow: bloom('#408c43', '#ffe46e'), flowerWhite: bloom('#408c43', '#ffffff'),
      }),
      ui: { base: '#e9f2ec', sidebar: 'rgba(242, 248, 244, 0.68)', composer: 'rgba(253, 254, 252, 0.88)', accent: '#d9714f', bubble: 'rgba(217, 113, 79, 0.13)' },
      lane: 0.55,
    },
    dark: {
      bg: {
        stops: [[0, '#040720'], [0.4, '#0f1846'], [0.54, '#282b64'], [0.7, '#141640'], [1, '#090b24']],
        spots: [
          { x: 0.255, y: 0.13, r: 0.24, color: 'rgba(170, 190, 255, 0.2)' },
          { x: 0.93, y: 0.64, r: 0.32, color: 'rgba(255, 150, 60, 0.14)' },
        ],
        vignette: 0.22,
        texture: null,
      },
      inks: inks({
        far0: '#1e2558', far1: '#232b62', far2: '#303b76',
        hillA0: '#161d4c', hillA1: '#1b2456', hillA2: '#2d3976',
        hillB0: '#10163e', hillB1: '#141b48', hillB2: '#1a2353', hillB3: '#2e3c7c',
        hillC0: '#0b1034', hillC1: '#0f153d', hillC2: '#151d4a', hillC3: '#293771',
        hillD0: '#070a26', hillD1: '#0a0e2e', hillD2: '#0f1538', hillD3: '#212d5e',
        meadow0: '#05081e', meadow1: '#090c28', meadow2: '#161e48',
        wheat0: '#1d1f48', wheat1: '#242652',
        crop0: '#121c42', crop1: '#17234c',
        hedge: tone('#080c28', 0.06),
        tree0: '#060920', tree1: '#0a0f2c', tree2: '#18224f',
        trunk: '#060816',
        river0: '#0c1236', river1: '#1d2860', river2: '#2f3d7e', bank: '#1a2252',
        glint: '#ffb04a',
        wallLit: '#3a3868', wallShade: '#221f4a',
        roofLit: ['#4f5596', 0.1], roofShade: ['#2a2853', 0.1],
        slateLit: ['#3f4d90', 0.1], slateShade: ['#20254f', 0.1],
        window: '#ffc56e', timber: '#120f28',
        stone: ['#30346a', 0.12], stoneShade: '#1a1d42',
        smoke: '#3a4074',
        moon: '#f2f0ff', moonShade: '#c8cdf0', star: '#e6e9ff',
        red0: '#3a2034', red1: '#5a2a3a',
        yel0: '#3e3436', yel1: '#5a4a3a',
        blue0: '#1c2850', blue1: '#28386a',
        teal0: '#16303e', teal1: '#1f4a50',
        white0: '#2a2c4a', white1: '#3a3c5c',
        basket: ['#2a1e18', 0.15], rope: '#2a2a3a', flame: '#ffb347',
        lantern: '#ff9a35', lanternCore: '#ffd47e', lanternDim: '#d06a2a',
        flowerPink: bloom('#0a0e2a', '#8a64b0'), flowerYellow: bloom('#0a0e2a', '#a08cc0'), flowerWhite: bloom('#0a0e2a', '#aab0e0'),
      }),
      ui: { base: '#111a44', sidebar: 'rgba(9, 13, 36, 0.62)', composer: 'rgba(13, 18, 48, 0.86)', accent: '#ffb04a', bubble: 'rgba(255, 176, 74, 0.18)' },
      lane: 0.62,
    },
  },

  scene(view) {
    const rand = rng(0x1a7e);
    const { ink, night } = view;
    // Light comes from the sun on the right by day and the moon on the left by night.
    const sun = night ? -1 : 1;
    const ramps = RAMPS.map((names) => names.map((name) => ink[name]));
    const meadowRamp = [ink.meadow0, ink.meadow1, ink.meadow2];
    const flowers = [ink.flowerPink, ink.flowerYellow, ink.flowerWhite];
    const stars = night ? starfield(view, rand, { count: 120, top: 0, bottom: 0.42, glyphs: '.+*', bright: 0.22 }) : null;
    const slot = { bar: view.glyph('|'), dash: view.glyph('-'), wave: view.glyph('~'), flame: view.glyph('^'), dot: view.glyph('.'), tick: view.glyph("'"), bird: view.glyph('v') };
    const bell = (u, c, s) => Math.exp(-(((u - c) / s) ** 2));

    /** Top edge (px) of land layer k at x. */
    function ridge(k, x) {
      const u = x / view.w;
      const h = view.h;
      switch (k) {
        case 0:
          return h * (0.505 - 0.05 * (0.5 + 0.5 * Math.sin(u * 9 + 0.7)) * (0.6 + 0.4 * Math.sin(u * 4.1 + 2)) - 0.01 * noise2(u * 18, 1.3));
        case 1:
          return h * (0.578 - 0.055 * (0.5 + 0.5 * Math.sin(u * 6.3 + 2.4)) - 0.014 * noise2(u * 7, 4.1));
        case 2:
          return h * (0.648 - 0.08 * (0.5 + 0.5 * Math.sin(u * 9.24 - 0.46)) - 0.012 * noise2(u * 6, 7.7));
        case 3:
          return h * (0.695 - 0.11 * smoothstep(0.76, 1.0, u) - 0.035 * bell(u, 0.27, 0.07) - 0.008 * Math.sin(u * 13 + 1));
        default:
          return h * (0.835 - 0.05 * bell(u, 0.08, 0.12) + 0.025 * smoothstep(0.76, 0.9, u) - 0.012 * Math.sin(u * 11 + 1) - 0.006 * noise2(u * 12, 2.2));
      }
    }
    const riverMid = (x) => {
      const u = x / view.w;
      return view.h * (0.764 + 0.02 * Math.sin(u * 8.5 + 0.6) + 0.007 * Math.sin(u * 21 + 2));
    };
    const riverHalf = (x) => view.ch * (0.55 + 0.6 * smoothstep(0.1, 0.95, x / view.w));
    const meadowTop = (x) => view.h * 0.945 + noise2(x / 70, 7.7) * view.h * 0.018;

    // Per-column geometry, rebuilt when the view size changes.
    let geo = null;
    function geometry() {
      if (geo && geo.w === view.w && geo.h === view.h && geo.cols === view.cols) return geo;
      const cols = view.cols;
      const top = RAMPS.map(() => new Float32Array(cols));
      const slope = RAMPS.map(() => new Float32Array(cols));
      const river = new Float32Array(cols);
      const half = new Float32Array(cols);
      for (let c = 0; c < cols; c++) {
        const x = (c + 0.5) * view.cw;
        for (let k = 0; k < RAMPS.length; k++) {
          top[k][c] = ridge(k, x);
          slope[k][c] = (ridge(k, x + 8) - ridge(k, x - 8)) / 16;
        }
        river[c] = riverMid(x);
        half[c] = riverHalf(x);
      }
      geo = { w: view.w, h: view.h, cols, top, slope, river, half };
      return geo;
    }
    const colOf = (g, x) => clamp(Math.floor(x / view.cw), 0, g.cols - 1);

    /**
     * Ramp position (0 dark … 1 light) of land layer k at a cell. Tone bands follow the ridge contour like
     * a rounded hill turning away from the light: a rim on the crest, then progressively darker bands.
     * Bands run wider on slopes facing the light, so lit flanks stay bright and shaded ones fall off fast.
     */
    function landTone(g, k, c, y) {
      const n = ramps[k].length - 1;
      const d = y - g.top[k][c];
      const lit = smoothstep(-0.06, 0.06, g.slope[k][c] * sun);
      if (d < view.ch) return lit > 0.3 ? 1 : (n - 1) / n;
      if (night) return Math.max(0, n - 2) / n; // night: flat silhouettes, separated by their moonlit rims
      const band = view.ch * (n > 2 ? 2 + 2 * lit : 2.5 + 3 * lit);
      const q = (d - view.ch) / band + (1 - lit) * 0.6;
      const step = Math.floor(q) + smoothstep(0.8, 1, q % 1);
      return clamp((n - 1 - step) / n, 0, 1);
    }

    // Patchwork fields on the valley floor, laid out in perspective towards a vanishing point.
    function plot(x, y) {
      const s = (x - view.w * 0.55) / Math.max(1, y - view.h * 0.5);
      const col = Math.floor(s * 3.1 + 0.25 * noise2(y / 50, 3.3) + 40);
      const row = Math.floor((y - view.h * 0.6) / (view.ch * 2.4) + 0.35 * noise2(x / 120, 9.1));
      return { s, col, row };
    }
    // Fields read by day only; at night the valley floor stays one calm silhouette.
    const inFields = (g, c, x, y, d) => !night && d >= view.ch && x < view.w * 0.79 && Math.abs(y - g.river[c]) > g.half[c] + view.ch * 1.2;
    const isHedge = (x, y) => plot(x + view.cw, y).col !== plot(x, y).col;

    const windows = [];
    const chimneys = [];

    function stampHouse(f, type, x, baseY, slate) {
      const rows = HOUSES[type];
      const width = rows[0].length;
      const y = baseY - rows.length * view.ch;
      const legend = {
        s: [TILE, slate ? ink.slateShade : ink.roofShade, 1, T_ROOF],
        L: [TILE, slate ? ink.slateLit : ink.roofLit, 1, T_ROOF],
        W: [BLOCK, ink.wallLit],
        E: [BLOCK, ink.wallShade],
        o: [BLOCK, ink.window],
        d: [BLOCK, ink.timber],
        c: [BLOCK, ink.stoneShade],
      };
      // Contact shadow on the ground under the house.
      f.sprite(['g'.repeat(width)], { g: [BLOCK, ink.hillC0] }, x, baseY);
      f.sprite(rows, legend, x, y, night);
      rows.forEach((row, r) => {
        for (let k = 0; k < width; k++) {
          const key = row[night ? width - 1 - k : k];
          const px = (Math.floor(x / view.cw) + k + 0.5) * view.cw;
          const py = (Math.floor(y / view.ch) + r + 0.5) * view.ch;
          if (key === 'o') windows.push({ x: px, y: py, phase: hash1(windows.length * 17 + 3) * 10 });
          if (key === 'c') chimneys.push({ x: px, y: py - view.ch * 0.5 });
        }
      });
    }

    /** Round tree: lit side towards the light, cast shadow on the ground. */
    const TREES = [
      ['sML', 'gt.'],
      ['.ML', 'sML', 'gt.'],
      ['.sML.', 'sMMLL', 'ssMML', 'gg.t.'],
    ];
    function stampTree(f, size, x, groundY, groundInk) {
      const rows = TREES[size];
      const legend = {
        s: night ? [BLOCK, ink.tree0] : [TILE, ink.tree0, 1, T_PLAIN],
        M: night ? [BLOCK, ink.tree1] : [TILE, ink.tree1, 1, T_PLAIN],
        L: night ? [BLOCK, ink.tree2] : [TILE, ink.tree2, 1, T_PLAIN],
        t: [BLOCK, ink.trunk],
        g: [BLOCK, groundInk],
      };
      const w = rows[0].length;
      f.sprite(rows, legend, x - (w * view.cw) / 2, groundY - rows.length * view.ch, night);
    }

    function stampBridge(f, cx, deckY) {
      const rows = ['PPPPPPPP', 'SSa..aSS', 'Sa....aS'];
      const legend = { P: [TILE, ink.stone, 1, T_WEAVE], S: [BLOCK, ink.stoneShade], a: [BLOCK, ink.river0] };
      f.sprite(rows, legend, cx - 4 * view.cw, deckY, false);
    }

    // Day: balloons rise from behind the hills. Night: lanterns rise from the village and the hamlet.
    const balloons = night
      ? []
      : BALLOON_LANES.map((lane, k) => {
          const shape = BALLOON_SHAPES[lane.s >= 1.2 ? 0 : lane.s >= 0.75 ? 1 : lane.s >= 0.58 ? 2 : 3];
          const [a, b] = BALLOON_COLORS[k % BALLOON_COLORS.length];
          return {
            lane,
            shape,
            env: shape.filter((row) => row.includes('X')).length,
            inkA: [ink[`${a}0`], ink[`${a}1`]],
            inkB: [ink[`${b}0`], ink[`${b}1`]],
            x: lane.u * view.w,
            y: rand.range(0.08, 0.55) * view.h,
            vy: -(4 + 6 * lane.s) * rand.range(0.85, 1.15),
            phase: rand() * 10,
          };
        });
    const lanterns = night ? Array.from({ length: 36 }, () => ({ x: 0, y: 0, s: 1, vy: 0, vx: 0, phase: rand() * 10 })) : [];
    function launch(l, anywhere) {
      const left = rand() < 0.22;
      l.s = rand.range(0.45, 1.25);
      l.x = left ? rand.range(0.285, 0.315) * view.w : view.w - rand.range(1, 18) * view.cw;
      l.y = anywhere ? rand.range(0.05, 0.62) * view.h : view.h * (left ? 0.66 : 0.6) - rand() * view.ch * 2;
      l.vy = -rand.range(7, 14) * (0.6 + 0.4 * l.s);
      l.vx = left ? rand.range(0, 2.5) : -rand.range(1, 5);
    }
    for (const l of lanterns) launch(l, true);
    const birds = night ? [] : Array.from({ length: 5 }, () => ({ x: rand() * view.w, y: rand.range(0.2, 0.36) * view.h, v: rand.range(14, 22), phase: rand() * 6 }));

    return {
      resize(sx, sy) {
        for (const p of [...balloons, ...lanterns, ...birds]) {
          p.x *= sx;
          p.y *= sy;
        }
      },

      update(dt) {
        const g = geometry();
        for (const b of balloons) {
          b.y += b.vy * dt;
          if (b.y + b.shape.length * view.ch < 0) {
            b.x = (b.lane.u + rand.range(-0.012, 0.012)) * view.w;
            b.y = g.top[b.lane.behind][colOf(g, b.x)] + view.ch;
          }
        }
        for (const l of lanterns) {
          l.y += l.vy * dt;
          l.x += l.vx * dt;
          if (l.y < view.h * 0.03) launch(l, false);
        }
        for (const b of birds) {
          b.x += b.v * dt;
          if (b.x > view.w + 20) b.x = -20;
        }
      },

      back(f) {
        const g = geometry();
        const { cw, ch } = view;
        const cols = f.cols;

        // Crisp round moon on the left at night, sun disc inside the glare on the right by day.
        const disc = { x: Math.round((view.w * (night ? 0.255 : 0.9)) / cw) * cw, y: Math.round((view.h * (night ? 0.13 : 0.11)) / ch) * ch, r: night ? 40 : 36 };
        f.each(disc.x - disc.r - cw, disc.y - disc.r - ch, disc.x + disc.r + cw, disc.y + disc.r + ch, (x, y, i) => {
          const cover = clamp((disc.r - Math.hypot(x - disc.x, (y - disc.y) * 1.05)) / 12 + 0.5, 0, 1);
          f.put(i, BLOCK, ink.moon, cover * cover * (night ? 1 : 0.9));
        });
        if (night) {
          for (const [dx, dy] of [[-18, -8], [6, 8], [-6, 24], [18, -24]]) {
            const i = f.at(disc.x + dx, disc.y + dy);
            if (i >= 0) f.put(i, BLOCK, ink.moonShade, 1);
          }
        }

        // Land layers, far to near.
        for (let k = 0; k < RAMPS.length; k++) {
          const ramp = ramps[k];
          f.each(0, view.h * 0.38, view.w, view.h, (x, y, i) => {
            const c = i % cols;
            const r = (i - c) / cols;
            const t0 = g.top[k][c];
            if (y < t0 || (k < 4 && y >= g.top[k + 1][c])) return;
            const d = y - t0;
            if (k === 3) {
              const rd = y - g.river[c];
              const hw = g.half[c];
              if (Math.abs(rd) < hw) {
                // Far bank mirrored dark at the top, sky mirrored light below.
                const v = 0.2 + 0.8 * smoothstep(-hw, hw * 0.6, rd);
                f.put(i, BLOCK, shade([ink.river0, ink.river1, ink.river2], v, c, r), 1);
                return;
              }
              if (rd < 0 && rd > -hw - ch) {
                f.put(i, BLOCK, ramp[0], 1); // shaded far bank
                return;
              }
              if (rd > 0 && rd < hw + ch) {
                f.put(i, BLOCK, ink.bank, 1); // lit near bank
                return;
              }
            }
            let v = landTone(g, k, c, y);
            if (k === 2 && d >= ch) {
              // Contour terraces on the mid hills: a lit lip every second row, following the hill.
              const u = x / view.w;
              const mask = smoothstep(0.08, 0.14, u) * (1 - smoothstep(0.4, 0.46, u)) + smoothstep(0.66, 0.72, u);
              if (mask > 0.5 && ((d - ch) / (ch * 2)) % 1 < 0.5) v += 1 / 3;
            }
            if (k === 3 && inFields(g, c, x, y, d)) {
              const p = plot(x, y);
              const kind = hash2(p.col, p.row);
              if (kind < 0.26) {
                f.put(i, BLOCK, Math.floor(p.s * 9) % 2 ? ink.wheat0 : ink.wheat1, 1);
                return;
              }
              if (kind < 0.48) {
                f.put(i, BLOCK, Math.floor(p.s * 14) % 2 ? ink.crop0 : ink.crop1, 1);
                return;
              }
              v += kind < 0.74 ? 0.34 : 0;
            }
            f.put(i, BLOCK, shade(ramp, v, c, r), 1);
          });
          // Distant tree lines break up the far crests.
          if (k === 1 || k === 2) {
            for (let c = 0; c < cols; c++) {
              const x = (c + 0.5) * cw;
              if (noise2(x / 90, k * 5.3) < 0.15 || hash2(c, k) < 0.25) continue;
              const top = g.top[k][c];
              const i = f.at(x, top - ch * 0.5);
              if (i >= 0 && (k === 2 || top < g.top[2][c] - ch)) f.put(i, BLOCK, ramp[0], 1);
            }
          }
        }
      },

      front(f) {
        const g = geometry();
        const { cw, ch } = view;
        const cols = f.cols;
        windows.length = 0;
        chimneys.length = 0;

        // Hedgerows between the valley fields and along the near hill.
        f.each(0, view.h * 0.55, view.w, view.h * 0.93, (x, y, i) => {
          const c = i % cols;
          if (y >= g.top[3][c] && y < g.top[4][c] && inFields(g, c, x, y, y - g.top[3][c]) && isHedge(x, y)) f.put(i, TILE, ink.hedge, 1, T_PLAIN);
          const d4 = y - g.top[4][c];
          if (!night && d4 >= ch * 0.9 && d4 < ch * 1.9 && noise2(x / 60, 4.4) > -0.1) f.put(i, TILE, ink.hedge, 1, T_PLAIN);
        });

        // Orchard rows on the near hill, densest where the scene is visible.
        for (let j = 0; j < 2; j++) {
          let x = cw * (2 + j * 2);
          while (x < view.w) {
            const u = x / view.w;
            const visible = u < 0.36 || u > 0.78;
            const c = colOf(g, x);
            const gy = g.top[4][c] + ch * (2.6 + j * 2.8);
            const odds = night ? (visible ? 0.45 : 0.08) : visible ? 0.92 : 0.15;
            if (gy < view.h * 0.93 && hash1(c * 13 + j) < odds) stampTree(f, j === 0 ? 1 : 2, x, gy, ink.hillD0);
            x += cw * (visible ? 5 : 7) + Math.floor(hash1(c + j * 50) * 2) * cw;
          }
        }

        // Trees along the river's far bank.
        for (let c = 2; c < cols - 2; c += 3) {
          const x = (c + 0.5) * cw;
          const bank = g.river[c] - g.half[c] - ch * 0.4;
          if (bank > g.top[4][c] - ch || x > view.w - cw * 22) continue;
          if (hash1(c * 31) < (x / view.w < 0.36 ? 0.5 : 0.2)) stampTree(f, 0, x, bank, ink.hillC0);
        }

        // Hamlet in the left gap: barn, farmhouse and trees on a rise.
        const top3 = (x) => g.top[3][colOf(g, x)];
        const hx = view.w * 0.27;
        stampTree(f, 2, hx - cw * 7, top3(hx - cw * 7) + ch * 2.6, ink.hillC0);
        stampHouse(f, 'barn', hx - cw * 4.5, top3(hx - cw * 2) + ch * 2.4, false);
        stampHouse(f, 'cottage', hx + cw * 2, top3(hx + cw * 5) + ch * 3.2, true);
        stampTree(f, 1, hx + cw * 10, top3(hx + cw * 10) + ch * 3.2, ink.hillC0);

        // Village climbing the hill on the right, above the river and its bridge.
        const bankY = (x) => {
          const c = colOf(g, x);
          return g.river[c] - g.half[c];
        };
        stampTree(f, 1, view.w - cw * 13, bankY(view.w - cw * 13) - ch * 5.4, ink.hillC0);
        for (const house of VILLAGE) {
          const width = HOUSES[house.type][0].length * cw;
          const x = view.w - house.off * cw - width;
          stampHouse(f, house.type, x, bankY(x + width / 2) - house.lift * ch, house.slate);
        }
        stampTree(f, 0, view.w - cw * 1.5, bankY(view.w - cw) - ch * 0.4, ink.hillC0);
        const bx = view.w - cw * 13;
        const bc = colOf(g, bx);
        stampBridge(f, bx, g.river[bc] - g.half[bc] - ch * 0.5);

        // Meadow edge with clumps of wildflowers along the bottom.
        f.each(0, view.h * 0.9, view.w, view.h, (x, y, i) => {
          const top = meadowTop(x);
          if (y < top) return;
          const c = i % cols;
          const r = (i - c) / cols;
          const d = y - top;
          const lean = (meadowTop(x + 8) - meadowTop(x - 8)) / 16;
          const v = d < ch ? (lean * sun > -0.01 ? 1 : 0.5) : 0.5 - 0.5 * smoothstep(ch, ch * 3, d);
          if (d >= ch && noise2(x / 45, 2.7) > 0.25 && hash1(i * 23) < 0.45) f.put(i, TILE, flowers[Math.floor(hash1(Math.floor(x / 90) * 5 + 1) * 3)], 1, T_FLOWER);
          else f.put(i, BLOCK, shade(meadowRamp, v, c, r), 1);
        });
        // Night windows are painted live (they flicker), so leave their cells open here.
        if (night) {
          for (const w of windows) {
            const i = f.at(w.x, w.y);
            if (i >= 0) f.put(i, BLOCK, ink.window, 0.03);
          }
        }
      },

      paint(f, t) {
        const g = geometry();
        const { cw, ch } = view;
        const cols = f.cols;

        // Water glitter: under the sun by day, under the moon by night.
        const glitterU = night ? 0.255 : 0.9;
        for (let c = 0; c < cols; c++) {
          const ry = g.river[c];
          const hw = g.half[c];
          const p = 0.03 + 0.3 * bell(((c + 0.5) * cw) / view.w, glitterU, 0.07);
          for (let r = Math.floor((ry - hw) / ch); r <= Math.floor((ry + hw) / ch); r++) {
            const y = (r + 0.5) * ch;
            if (Math.abs(y - ry) >= hw || y >= g.top[4][c]) continue;
            const i = r * cols + c;
            const roll = hash1(i * 3 + Math.floor(t * 2.2 + hash1(i) * 5) * 977);
            if (roll < p) f.put(i, GLYPH, night ? ink.star : ink.glint, night ? 0.5 : 0.85, roll < p * 0.5 ? slot.dash : slot.wave);
          }
        }

        if (night) {
          stars.paint(f, t, ink.star);
          f.glow(Math.round((view.w * 0.255) / cw) * cw, Math.round((view.h * 0.13) / ch) * ch, 100, '#b8c4ff', 0.3);
          f.glow(view.w - cw * 9, view.h * 0.64, 190, '#ff9a3c', 0.16);
          // Lit windows flicker and spill warm light onto the river.
          for (const w of windows) {
            const flicker = 0.85 + 0.15 * Math.sin(t * 3.1 + w.phase) * Math.sin(t * 1.7 + w.phase * 2);
            f.glow(w.x, w.y, 24, '#ffc06b', 0.4 * flicker);
            const i = f.at(w.x, w.y);
            if (i >= 0) f.put(i, BLOCK, ink.window, flicker);
            const c = colOf(g, w.x);
            if (w.y < g.river[c] && g.river[c] < g.top[4][c]) {
              const j = f.at(w.x, g.river[c] + g.half[c] * 0.3);
              if (j >= 0) f.put(j, GLYPH, ink.glint, 0.45 * flicker, Math.floor(t * 2 + w.phase) % 2 ? slot.wave : slot.dash);
            }
          }
          // Lanterns rise, sway and fade high up; low ones mirror in the river.
          for (const l of lanterns) {
            const x = l.x + Math.sin(t * 0.7 + l.phase) * 8 * l.s;
            const fade = smoothstep(view.h * 0.04, view.h * 0.4, l.y);
            if (fade <= 0.03) continue;
            const flicker = 0.88 + 0.12 * Math.sin(t * 6 + l.phase * 3);
            const a = fade * flicker;
            const tall = l.s > 1.05;
            const gx = (Math.floor(x / cw) + 0.5) * cw;
            const gy = (Math.floor(l.y / ch) + (tall ? 1 : 0.5)) * ch;
            f.glow(gx, gy, (12 + 26 * l.s) * (0.5 + 0.5 * fade), '#ff9a3c', 0.7 * a);
            const i = f.at(x, l.y);
            const body = l.s > 0.9 ? ink.lanternCore : fade > 0.55 ? ink.lantern : ink.lanternDim;
            if (i >= 0) f.put(i, TILE, tall ? ink.lantern : body, a * (0.55 + 0.45 * Math.min(1, l.s)), T_PLAIN);
            if (tall) {
              const j = f.at(x, l.y + ch);
              if (j >= 0) f.put(j, TILE, ink.lanternCore, a, T_PLAIN);
            }
            const c = colOf(g, x);
            if (l.y > view.h * 0.4 && g.river[c] < g.top[4][c]) {
              const j = f.at(x, g.river[c]);
              if (j >= 0) f.put(j, GLYPH, ink.glint, 0.6 * a * smoothstep(view.h * 0.4, view.h * 0.6, l.y), slot.wave);
            }
          }
          return;
        }

        // Chimney smoke curling up from the village.
        for (const s of chimneys) {
          for (let k = 0; k < 4; k++) {
            const age = (t * 0.3 + k / 4 + hash1(s.x | 0)) % 1;
            const i = f.at(s.x + Math.sin(age * 5 + k) * 4 + age * 14, s.y - age * ch * 4);
            if (i >= 0) f.put(i, GLYPH, ink.smoke, 0.85 * (1 - age), age < 0.5 ? slot.dot : slot.tick);
          }
        }
        for (const b of birds) {
          const i = f.at(b.x, b.y + Math.sin(t * 0.8 + b.phase) * 6);
          if (i >= 0) f.put(i, GLYPH, ink.rope, 0.7, Math.floor(t * 3 + b.phase) % 2 ? slot.bird : slot.dash);
        }

        // Balloons: grid-snapped sprites with clean vertical stripes, round shading from the sun side,
        // ropes and a wicker basket; hidden behind the hill they rise from.
        for (const b of balloons) {
          const { shape, env, inkA, inkB } = b;
          const w = shape[0].length;
          const c0 = Math.round((b.x + Math.sin(t * 0.25 + b.phase) * 6) / cw - w / 2);
          const r0 = Math.round(b.y / ch);
          const behind = g.top[b.lane.behind];
          for (let r = 0; r < shape.length; r++) {
            const rr = r0 + r;
            if (rr < 0 || rr >= f.rows) continue;
            const y = (rr + 0.5) * ch;
            for (let k = 0; k < w; k++) {
              const key = shape[r][k];
              const c = c0 + k;
              if (key === '.' || c < 0 || c >= cols || y >= behind[c]) continue;
              const i = rr * cols + c;
              if (key === '|') f.put(i, GLYPH, ink.rope, 0.9, slot.bar);
              else if (key === '#') f.put(i, TILE, ink.basket, 1, T_WEAVE);
              else {
                const nx = (k + 0.5 - w / 2) / (w / 2);
                const ny = (r + 0.5 - env * 0.42) / (env * 0.58);
                f.put(i, BLOCK, (k & 1 ? inkB : inkA)[0.42 + 0.7 * nx - 0.35 * ny > 0.5 ? 1 : 0], 1);
              }
            }
          }
          if ((t + b.phase) % 7 < 0.8) {
            const fx = (c0 + w / 2) * cw;
            const fy = (r0 + env + 0.5) * ch;
            const i = f.at(fx - cw * 0.5, fy);
            if (i >= 0 && fy < behind[i % cols]) {
              f.put(i, GLYPH, ink.flame, 0.95, slot.flame);
              f.glow(fx, fy, 10 + 6 * w, '#ffb347', 0.5);
            }
          }
        }
      },
    };
  },
};
