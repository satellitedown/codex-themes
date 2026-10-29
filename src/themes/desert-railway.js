import { solid, tone } from '../engine/color.js';
import { BLOCK, GLYPH, TILE } from '../engine/field.js';
import { clamp, fbm2, hash1, noise2, rng, sdCircle, smoothstep } from '../engine/math.js';
import { crisp, starfield } from './kit.js';

const CHARS = { tile: ':.=|-o#/\\+', halo: "'.:;o", extra: "=|-_+*~v^,`" };
const TILE_CHARS = [...CHARS.tile];
/** Explicit tile glyph slot (index into chars.tile). */
const tg = (char) => TILE_CHARS.indexOf(char);
const SPOKES = [tg('|'), tg('/'), tg('-'), tg('\\')];

// Facing right: cab at the back, boiler with brass domes, stack over the
// smokebox, lamp on the nose, cowcatcher below it.
const LOCO = [
  '...............SSS..',
  '.RRRRRR.........S...',
  '.CWWCCC...DD.D..S...',
  '.CWWCCCBBBuBBBBuBBXL',
  '.CCCCCCbbbubbbbubbX.',
  'FFFFFFFFFFFFFFFFFFFP',
  '..oo...OO.OO.OO.oo.P',
];
const TENDER = ['.KKKKKK.', 'TTTTTTTT', 'TttttttT', 'FFFFFFFF', '.oo..oo.'];
const COACH = ['..rrrrrrrrr..', '.RRRRRRRRRRR.', '.dWWbWWWbWWd.', '.bbbbbbbbbbb.', '.FFFFFFFFFFF.', '...oo...oo...'];
const LW = LOCO[0].length;
const TW = TENDER[0].length;
const CW = COACH[0].length;
const STACK_COL = 16;

// Rock formations. x/w are fractions of the width, h/lift/rise of the height.
// layer 0 = far hazy range, 1 = calm mid mesas (centre), 2 = detailed near
// buttes in the visible side strips. rise lifts a tier onto the one below it.
const FORMS = [
  { layer: 0, x: 0.06, w: 0.1, h: 0.05, talus: 0.5, seed: 1 },
  { layer: 0, x: 0.3, w: 0.16, h: 0.06, talus: 0.5, seed: 2, notches: 1 },
  { layer: 0, x: 0.49, w: 0.1, h: 0.045, talus: 0.5, seed: 3 },
  { layer: 0, x: 0.7, w: 0.14, h: 0.07, talus: 0.5, seed: 4, notches: 1 },
  { layer: 0, x: 0.89, w: 0.12, h: 0.055, talus: 0.5, seed: 5 },
  { layer: 1, x: 0.2, w: 0.08, h: 0.075, talus: 0.4, seed: 11, lift: 0.004 },
  { layer: 1, x: 0.42, w: 0.04, h: 0.1, talus: 0.4, seed: 12, lift: 0.004 },
  { layer: 1, x: 0.61, w: 0.18, h: 0.1, talus: 0.38, seed: 13, lift: 0.004, notches: 2 },
  { layer: 1, x: 0.55, w: 0.055, h: 0.06, talus: 0.3, seed: 14, lift: 0.004, rise: 0.1 },
  { layer: 1, x: 0.78, w: 0.05, h: 0.12, talus: 0.4, seed: 15, lift: 0.004 },
  { layer: 2, x: 0.12, w: 0.2, h: 0.13, talus: 0.3, seed: 21, lift: 0.025, notches: 1 },
  { layer: 2, x: 0.085, w: 0.075, h: 0.1, talus: 0.12, seed: 22, lift: 0.025, rise: 0.13 },
  { layer: 2, x: 0.29, w: 0.028, h: 0.2, talus: 0.26, seed: 23, lift: 0.035 },
  { layer: 2, x: 0.99, w: 0.15, h: 0.12, talus: 0.3, seed: 31, lift: 0.025 },
  { layer: 2, x: 0.975, w: 0.075, h: 0.13, talus: 0.12, seed: 32, lift: 0.025, rise: 0.12, notches: 1 },
  { layer: 2, x: 0.885, w: 0.024, h: 0.155, talus: 0.26, seed: 33, lift: 0.035 },
];

// Sun (day) and moon (night) share a spot so the light direction is the same.
const SUN = { x: 0.915, y: 0.13 };

/**
 * Red mesas over a desert floor, telegraph poles along a single track, and a
 * steam train that rolls through every so often. Day: hard blue sky and heat
 * shimmer. Night: the Milky Way, a headlight raking the rails, lit coaches.
 */
export default {
  id: 'desert-railway',
  name: 'Desert Railway',
  chars: CHARS,
  shimmer: 1.0,
  palettes: {
    light: {
      bg: {
        stops: [[0, '#2a84db'], [0.3, '#5cade9'], [0.52, '#acd8f3'], [0.6, '#f4dfc6'], [1, '#efd2a6']],
        spots: [
          { x: SUN.x, y: SUN.y, r: 0.24, color: 'rgba(255, 247, 216, 0.8)' },
          { x: 0.5, y: 0.6, r: 0.5, color: 'rgba(255, 240, 220, 0.3)' },
        ],
        vignette: 0,
        texture: { color: '#ffffff', alpha: 0.18, chars: '-.', scale: 0.08, threshold: 0.2, density: 0.4, bottom: 0.4 },
      },
      inks: {
        sun: tone('#fff6d2', 0.06),
        heat: solid('#e6f3fb'),
        hawk: solid('#4a3a30'),
        star: solid('#ffffff'),
        dust: solid('#ffffff'),
        dist0: solid('#c27f6f'),
        dist1: solid('#d39580'),
        dist2: solid('#e1ad98'),
        dist3: solid('#efc6b0'),
        rock0: solid('#6b2c2a'),
        rock1: solid('#8e3b2b'),
        rock2: solid('#b2512f'),
        rock3: solid('#d06d3b'),
        rock4: solid('#ec9556'),
        pale0: solid('#e0a476'),
        pale1: solid('#f6cf9b'),
        rim: tone('#ffe0ad', 0.14),
        talus0: solid('#a9583c'),
        talus1: solid('#c8744b'),
        stone: tone('#8c5a43', 0.25),
        sand0: solid('#cf9b66'),
        sand1: solid('#e2b37d'),
        sand2: solid('#efc894'),
        sand3: solid('#f8dcae'),
        haze: solid('#f7e3c6'),
        ballast: tone('#9a8571', 0.22),
        tie: solid('#5e4130'),
        rail: solid('#2f2a2c'),
        pole: tone('#6a4a33', 0.2),
        wire: solid('#4d4038'),
        cactus0: tone('#2c6440', 0.22),
        cactus1: tone('#3e8a4c', 0.22),
        cactus2: tone('#74b862', 0.2),
        shrub: tone('#8d9850', 0.22),
        loco: tone('#3a4a63', 0.16),
        locoDark: tone('#232b3b', 0.14),
        trim: tone('#d9a13a', 0.22),
        coach: tone('#b63c2e', 0.16),
        roof: tone('#5b2f2c', 0.16),
        window: tone('#2b4256', 0.3),
        frame: solid('#1c1a1d'),
        wheel: tone('#9c3328', 0.4),
        headlight: tone('#fff3c2', 0.12),
        smoke: solid('#ffffff'),
        beam: solid('#fff1b0'),
      },
      ui: { base: '#f3e3cb', sidebar: 'rgba(249, 242, 232, 0.68)', composer: 'rgba(255, 253, 249, 0.88)', accent: '#c9673f', bubble: 'rgba(201, 103, 63, 0.13)' },
      lane: 0.55,
    },
    dark: {
      bg: {
        stops: [[0, '#03040f'], [0.25, '#080d2a'], [0.45, '#191d54'], [0.6, '#2e2f6e'], [1, '#0e0c22']],
        spots: [
          { x: SUN.x, y: SUN.y, r: 0.16, color: 'rgba(190, 205, 255, 0.16)' },
          { x: 0.5, y: 0.6, r: 0.45, color: 'rgba(110, 80, 170, 0.2)' },
          // Milky Way: a soft band from the low core up to the top right, with a dark rift.
          { x: 0.18, y: 0.41, r: 0.09, color: 'rgba(205, 180, 220, 0.14)' },
          { x: 0.26, y: 0.34, r: 0.1, color: 'rgba(200, 182, 228, 0.15)' },
          { x: 0.35, y: 0.27, r: 0.09, color: 'rgba(160, 170, 236, 0.12)' },
          { x: 0.45, y: 0.18, r: 0.09, color: 'rgba(140, 160, 236, 0.1)' },
          { x: 0.55, y: 0.1, r: 0.08, color: 'rgba(130, 150, 232, 0.08)' },
          { x: 0.65, y: 0.02, r: 0.08, color: 'rgba(130, 150, 232, 0.06)' },
          { x: 0.3, y: 0.315, r: 0.035, color: 'rgba(4, 6, 20, 0.32)' },
          { x: 0.39, y: 0.245, r: 0.03, color: 'rgba(4, 6, 20, 0.26)' },
        ],
        vignette: 0.2,
        texture: null,
      },
      inks: {
        sun: tone('#f4f0dc', 0.06),
        heat: solid('#c3c9e6'),
        hawk: solid('#1a1a2a'),
        star: solid('#eef0ff'),
        dust: solid('#c4c8ff'),
        dist0: solid('#0f1234'),
        dist1: solid('#151943'),
        dist2: solid('#1b1f4e'),
        dist3: solid('#272c63'),
        rock0: solid('#04041a'),
        rock1: solid('#0a0b26'),
        rock2: solid('#101233'),
        rock3: solid('#272c60'),
        rock4: solid('#4a56a0'),
        pale0: solid('#1a1d46'),
        pale1: solid('#2e3568'),
        rim: tone('#93a2ea', 0.18),
        talus0: solid('#0f1030'),
        talus1: solid('#1c1f4a'),
        stone: tone('#20223e', 0.3),
        sand0: solid('#121230'),
        sand1: solid('#1a1a40'),
        sand2: solid('#23244f'),
        sand3: solid('#2e3062'),
        haze: solid('#33366e'),
        ballast: tone('#1c1c32', 0.18),
        tie: solid('#0c0b18'),
        rail: solid('#6c74aa'),
        pole: tone('#14132a', 0.25),
        wire: solid('#3c4170'),
        cactus0: tone('#08121a', 0.15),
        cactus1: tone('#0f1e2a', 0.15),
        cactus2: tone('#3c5c86', 0.2),
        shrub: tone('#182234', 0.18),
        loco: tone('#2a3150', 0.14),
        locoDark: tone('#151a2c', 0.12),
        trim: tone('#7a5c34', 0.2),
        coach: tone('#45202c', 0.14),
        roof: tone('#3c4678', 0.16),
        window: tone('#ffcf6b', 0.3),
        frame: solid('#05050b'),
        wheel: tone('#1a1a26', 0.4),
        headlight: tone('#fff6d0', 0.1),
        smoke: solid('#6a72a0'),
        beam: solid('#fff1b0'),
      },
      ui: { base: '#0a1030', sidebar: 'rgba(6, 9, 30, 0.62)', composer: 'rgba(10, 14, 40, 0.86)', accent: '#ffcf6b', bubble: 'rgba(255, 207, 107, 0.16)' },
      lane: 0.62,
    },
  },

  scene(view) {
    const rand = rng(0xde5e);
    const { ink, night } = view;
    // Twinkling stars stay above the tallest buttes (paint draws over baked scenery).
    const stars = starfield(view, rand, { count: 120, top: 0, bottom: 0.34, glyphs: '.+*', bright: 0.22 });
    const g = view.glyph;
    const slot = { rail: g('='), dash: g('-'), low: g('_'), dot: g('.'), tick: g("'"), colon: g(':'), o: g('o'), wave: g('~'), up: g('^'), down: g('v'), star: g('*') };

    const ramps = {
      far: [ink.dist2, ink.dist3],
      mid: [ink.dist0, ink.dist1, ink.dist2],
      rock: [ink.rock0, ink.rock1, ink.rock2, ink.rock3, ink.rock4],
      pale: [ink.rock1, ink.rock2, ink.pale0, ink.pale1, ink.rim],
      talus: [ink.rock1, ink.talus0, ink.talus1, ink.sand1],
      sand: [ink.sand0, ink.sand1, ink.sand2, ink.sand3],
      cactus: [ink.cactus0, ink.cactus1, ink.cactus2],
    };

    const locoLegend = {
      S: [TILE, ink.frame, 1, tg('#')],
      R: [TILE, ink.frame, 1, tg('-')],
      C: [TILE, ink.coach, 1, tg('|')],
      W: [TILE, ink.window, 1, tg('#')],
      D: [TILE, ink.trim, 1, tg('o')],
      B: [TILE, ink.loco, 1, tg('-')],
      b: [TILE, ink.locoDark, 1, tg('=')],
      X: [TILE, ink.frame, 1, tg('.')],
      L: [TILE, ink.headlight, 1, tg('o')],
      F: [TILE, ink.frame, 1, tg('=')],
      P: [TILE, ink.trim, 1, tg('#')],
      o: [TILE, ink.wheel, 1, tg('o')],
      O: [TILE, ink.wheel, 1, SPOKES[0]],
      K: [TILE, ink.frame, 1, tg(':')],
      T: [TILE, ink.locoDark, 1, tg('-')],
      t: [TILE, ink.trim, 1, tg('-')],
      u: [TILE, ink.trim, 1, tg('|')],
    };
    const coachLegend = {
      r: [TILE, ink.roof, 1, tg('-')],
      R: [TILE, ink.roof, 1, tg('=')],
      d: [TILE, ink.coach, 1, tg('|')],
      W: [TILE, ink.window, 1, tg('#')],
      b: [TILE, ink.coach, 1, tg('-')],
      F: [TILE, ink.frame, 1, tg('=')],
      o: [TILE, ink.wheel, 1, tg('o')],
    };

    const geo = () => {
      const horizonRow = Math.round((view.h * 0.6) / view.ch);
      const trackRow = Math.round((view.h * 0.8) / view.ch);
      return { horizonRow, horizon: horizonRow * view.ch, trackRow, track: trackRow * view.ch };
    };
    /** Which way light falls on something at x: +1 = from the right (sun/moon side). */
    const lightAt = (x) => {
      const l = clamp((SUN.x * view.w - x) / (view.w * 0.2), -1, 1);
      return Math.abs(l) < 0.45 ? (l < 0 ? -0.45 : 0.45) : l;
    };
    const cell = (c, r) => (c >= 0 && r >= 0 && c < view.cols && r < view.rows ? r * view.cols + c : -1);

    /** One butte/mesa: cap rock, stepped cliffs with fluting and strata, talus apron. */
    const formation = (f, m, horizon) => {
      const { w: W, h: H, cw, ch, cols } = view;
      const near = m.layer === 2;
      const cx = m.x * W;
      const hw = Math.max(cw * 1.5, (m.w * W) / 2);
      const height = m.h * H;
      const baseY = horizon + (m.lift ?? 0) * H - (m.rise ?? 0) * H;
      const topY = baseY - height;
      const talusH = height * m.talus;
      const cliffBot = baseY - talusH;
      const talusW = Math.max(talusH * 1.25, cw * 1.5);
      const Ls = lightAt(cx);
      const sd = m.seed * 13.7;
      // Sheer walls; near ones step out a cell at a ledge or two, with a slight jog row to row.
      const halfAt = (y, side) => {
        const p = clamp((y - topY) / Math.max(ch, cliffBot - topY), 0, 1);
        return hw + (near ? Math.floor(p * 2.2) * cw * 0.7 : 0) + noise2(y / (ch * 2.3), sd + side * 4.3) * cw * (m.layer === 0 ? 0.3 : 0.55);
      };
      const notches = [];
      for (let k = 0; k < (m.notches ?? 0); k++) {
        notches.push([cx + (hash1(m.seed * 31 + k) * 1.3 - 0.65) * hw, ch * (0.9 + hash1(m.seed * 7 + k) * 1.3), cw * (1.3 + hash1(m.seed * 11 + k) * 1.6)]);
      }
      const capAt = (x) => {
        let y = topY + noise2(x / (cw * 7), sd) * ch * 0.25;
        for (const [nx, nd, nw] of notches) y += nd * Math.max(0, 1 - Math.abs(x - nx) / nw);
        return y;
      };
      const hbL = halfAt(cliffBot, -1);
      const hbR = halfAt(cliffBot, 1);
      const reach = Math.max(hbL, hbR) + talusW + cw;
      const cliffRows = (cliffBot - topY) / ch;
      const paleBand = (b) => b >= 0 && hash1(m.seed * 97 + b * 7) < 0.22;

      f.each(cx - reach, topY - ch * 1.5, cx + reach, baseY - 1, (x, y, i) => {
        const d = x - cx;
        const side = d < 0 ? -1 : 1;
        const ad = Math.abs(d);
        const c = i % cols;
        const r = (i - c) / cols;
        const lit = side * Ls > 0 ? 1 : -1;
        const tu = (ad - (side < 0 ? hbL : hbR)) / talusW;
        const talusTop = tu <= 0 ? cliffBot + noise2(x / (cw * 2.5), sd + 9) * ch * 0.5 : tu < 1 ? baseY - talusH * (1 - tu) ** 1.5 : Infinity;
        const hwy = halfAt(y, side);
        const cap = capAt(x);
        if (y >= talusTop) {
          // Scree apron: sandier than the walls, lit flank vs shadow flank, a light crest.
          let v = (tu > 0 ? (lit > 0 ? 0.67 : 0.33) : 0.4) + 0.12 * noise2(x / (cw * 1.4), sd + y / (ch * 2));
          if (y - talusTop < ch) v += 0.3;
          if (near) f.put(i, BLOCK, crisp(ramps.talus, v + 0.25 * smoothstep(baseY - ch * 2, baseY, y), c, r));
          else f.put(i, BLOCK, crisp(m.layer === 1 ? ramps.mid : ramps.far, v + 0.15, c, r));
          return;
        }
        if (ad > hwy || y < cap) return;
        const down = (y - cap) / ch;
        // Three planes: two flanks split from the front by jittered arêtes.
        const edgeU = (near ? 0.55 : 0.5) + 0.15 * noise2(y / (ch * 3), sd + side * 2.7);
        const flank = ad / hwy > edgeU;
        if (m.layer === 0) {
          f.put(i, BLOCK, down < 1 || (flank && lit > 0) ? ink.dist3 : ink.dist2);
          return;
        }
        if (m.layer === 1) {
          let v = flank ? (lit > 0 ? 1 : 0) : 0.5;
          if (down < 1) v += 0.5;
          else if (!flank && noise2(x / (cw * 2), sd + 7) > 0.5) v -= 0.5;
          f.put(i, BLOCK, crisp(ramps.mid, v, c, r));
          return;
        }
        if (down < 1) {
          // Cap-rock rim catches the sun (day) or the moon (night).
          f.put(i, BLOCK, flank && lit < 0 ? ink.pale0 : ink.rim);
          return;
        }
        let v = flank ? (lit > 0 ? 0.75 : 0.25) : 0.5;
        // Vertical gullies on the front, with a lit lip beside each.
        const gully = noise2(x / (cw * 2.2), sd + 7 + y / (ch * 40));
        if (!flank && gully > 0.42) v -= 0.25;
        else if (!flank && gully > 0.28 && (noise2((x + cw) / (cw * 2.2), sd + 7 + y / (ch * 40)) > gully) === Ls > 0) v += 0.25;
        // Strata: thin pale cap rock, a shadow line under its overhang, then wavy bands
        // below, some pale, each with a lit lip and a contact shadow under pale ones.
        const capRock = down < 1.8;
        const s = (y - topY) / ch + noise2(x / (cw * 12), sd + 3) * 0.6 - 2.8;
        const band = Math.floor(s / 2.6);
        const inBand = s - band * 2.6;
        const pale = capRock || paleBand(band);
        if (!capRock && down < 2.8) v -= 0.25;
        else if (inBand < 1 && pale && !capRock) v += 0.25;
        else if (inBand < 1 && paleBand(band - 1)) v -= 0.25;
        // Desert varnish streaks hanging from the rim.
        if (hash1(c * 7 + m.seed * 101) < 0.22 && down < 2 + hash1(c * 3 + m.seed) * cliffRows * 0.7) v -= 0.25;
        if (ad > hwy - cw) v = lit > 0 ? 1 : v - 0.25;
        f.put(i, BLOCK, crisp(pale ? ramps.pale : ramps.rock, v, c, r));
      });
    };

    /** Saguaro in cell space: shaded trunk (shadow → lit columns), elbowed arms, rounded tips. */
    const saguaro = (f, col, baseRow, hRows, tw, arms) => {
      const lc = lightAt((col + 0.5) * view.cw) > 0 ? 1 : -1;
      const vertical = (c0, w, r0, r1) => {
        for (let r = r0; r <= r1; r++) {
          for (let k = 0; k < w; k++) {
            if (r === r0 && w >= 3 && k !== 1) continue;
            const i = cell(c0 + k, r);
            if (i < 0) continue;
            const pos = w === 1 ? 0.5 : k / (w - 1);
            let step = Math.round((lc > 0 ? pos : 1 - pos) * 2);
            if (r === r0) step = Math.min(2, step + 1);
            f.put(i, TILE, ramps.cactus[step], 1, tg('|'));
          }
        }
      };
      const c0 = col - Math.floor(tw / 2);
      for (const a of arms) {
        const er = baseRow - Math.round(a.at * hRows);
        const ac0 = a.side > 0 ? c0 + tw + a.gap : c0 - a.gap - a.w;
        const h0 = a.side > 0 ? c0 + tw : ac0;
        const h1 = a.side > 0 ? ac0 + a.w - 1 : c0 - 1;
        for (let c = h0; c <= h1; c++) {
          const i = cell(c, er);
          if (i >= 0) f.put(i, TILE, ramps.cactus[1], 1, tg('-'));
        }
        vertical(ac0, a.w, er - a.len, er);
      }
      vertical(c0, tw, baseRow - hRows, baseRow);
    };

    let train = null;
    let nextTrain = 1;
    let first = true;
    const puffs = [];

    return {
      update(dt) {
        const { trackRow } = geo();
        if (!train) {
          nextTrain -= dt;
          if (nextTrain <= 0) {
            const dir = rand() < 0.5 || first ? 1 : -1;
            first = false;
            const coaches = 3 + Math.floor(rand() * 3);
            const length = (LW + TW + coaches * (CW + 1)) * view.cw;
            train = { dir, coaches, length, speed: rand.range(95, 130), x: dir > 0 ? -LW * view.cw : view.w, nextPuff: 0 };
          }
        } else {
          train.x += train.dir * train.speed * dt;
          const tail = train.dir > 0 ? train.x - (train.length - LW * view.cw) : train.x + train.length;
          if (train.dir > 0 ? tail > view.w : tail < 0) {
            train = null;
            nextTrain = rand.range(14, 26);
          } else {
            train.nextPuff -= dt;
            if (train.nextPuff <= 0) {
              train.nextPuff = 0.2;
              const col = train.dir > 0 ? STACK_COL : LW - 1 - STACK_COL;
              puffs.push({ x: train.x + (col + 0.5) * view.cw, y: (trackRow - 7.5) * view.ch, age: 0, vx: -train.dir * rand.range(14, 30), life: rand.range(1.6, 2.4) });
            }
          }
        }
        for (let k = puffs.length - 1; k >= 0; k--) {
          const p = puffs[k];
          p.age += dt;
          p.x += p.vx * dt;
          p.y -= (78 - 50 * (p.age / p.life)) * dt;
          if (p.age > p.life) puffs.splice(k, 1);
        }
      },

      back(f) {
        const { horizon, horizonRow, trackRow } = geo();
        const { w: W, h: H, cw, ch, cols } = view;
        const lay = rng(0x5eed);

        if (night) {
          // Milky Way dust: dense along the band axis, clumpy, split by a dark rift.
          const ax = 0.04 * W;
          const ay = 0.52 * H;
          const dx = 0.68 * W;
          const dy = -0.56 * H;
          const len = Math.hypot(dx, dy);
          const wB = 0.07 * W;
          f.each(0, 0, W, horizon, (x, y, i) => {
            const s = ((x - ax) * dx + (y - ay) * dy) / (len * len);
            if (s < -0.1 || s > 1.15) return;
            const dd = ((x - ax) * -dy + (y - ay) * dx) / len;
            const core = Math.exp(-((dd / wB) ** 2));
            const rift = 1 - 0.85 * Math.exp(-(((dd - wB * 0.18 * Math.sin(s * 7)) / (wB * 0.22)) ** 2)) * smoothstep(0.1, 0.35, s) * (1 - smoothstep(0.7, 0.95, s));
            const dens = core * rift * (0.55 + 0.55 * fbm2(x / 55, y / 55, 2)) * (1 - 0.45 * clamp(s, 0, 1));
            if (hash1(i * 7 + 3) < dens * 0.7) f.put(i, GLYPH, ink.dust, 0.16 + 0.5 * dens, hash1(i) < 0.75 ? slot.dot : dens > 0.5 ? slot.colon : slot.tick);
          });
          // Static faint stars lower down; the mesas bake over them.
          f.each(0, H * 0.3, W, horizon, (x, y, i) => {
            if (hash1(i * 11 + 5) < 0.014) f.put(i, GLYPH, ink.star, 0.3 + hash1(i * 3) * 0.4, slot.dot);
          });
          // Full moon with a few darker maria.
          const mx = SUN.x * W;
          const my = SUN.y * H;
          f.each(mx - 50, my - 50, mx + 50, my + 50, (x, y, i) => {
            const d = sdCircle(x, y, mx, my, 30);
            if (d <= 0) f.put(i, TILE, noise2(x / 13 + 4, y / 13) > 0.25 ? ink.heat : ink.sun, 1, tg('.'));
            else f.shape(i, d, ink.sun, 1, ink.sun, 0.3);
          });
        } else {
          const sx = SUN.x * W;
          const sy = SUN.y * H;
          f.each(sx - 64, sy - 64, sx + 64, sy + 64, (x, y, i) => {
            const d = sdCircle(x, y, sx, sy, 36);
            if (d <= 0) f.put(i, TILE, ink.sun, 1, tg('.'));
            else f.shape(i, d, ink.sun, 1, ink.sun, 0.4);
          });
        }

        // Desert floor: hazy horizon row, dune slopes lit/shadowed, wind ripples nearer.
        f.each(0, horizon, W, H, (x, y, i) => {
          const c = i % cols;
          const r = (i - c) / cols;
          if (r === horizonRow) {
            f.put(i, BLOCK, ink.haze);
            return;
          }
          const p = clamp((y - horizon) / (H - horizon), 0, 1);
          const lg = clamp((SUN.x * W - x) / (W * 0.15), -1, 1);
          const sx = 110 + 300 * p;
          const sy = 30 + 60 * p;
          const slope = (fbm2((x - cw) / sx + 3.1, y / sy, 2) - fbm2((x + cw) / sx + 3.1, y / sy, 2)) * lg * 3;
          // Pale, flat far floor; nearer, dune faces split into lit and shadowed planes.
          let v = 1 - 0.333 * smoothstep(0.02, 0.3, p);
          const relief = smoothstep(0.05, 0.3, p);
          if (slope > 0.15) v += 0.333 * relief;
          else if (slope < -0.4) v -= 0.667 * relief;
          else if (slope < -0.12) v -= 0.333 * relief;
          // Wind ripples in patches on the windward faces.
          if (p > 0.12 && slope > -0.12 && noise2(x / 170 + 5, y / 70) > 0) {
            const rp = (((y + 9 * noise2(x / 60, y / 45) + 4 * Math.sin(x / 33)) / (ch * (2.2 + 2.6 * p))) % 1 + 1) % 1;
            if (rp < 0.22) v -= 0.333;
          }
          f.put(i, BLOCK, crisp(ramps.sand, v, c, r));
        });

        for (const layer of [0, 1, 2]) for (const m of FORMS) if (m.layer === layer) formation(f, m, horizon);

        // Mid-ground: scattered creosote, a couple of distant saguaros.
        const pickX = () => {
          const q = lay();
          return (q < 0.42 ? lay() * 0.34 : q < 0.84 ? 0.8 + lay() * 0.2 : 0.34 + lay() * 0.46) * W;
        };
        for (let k = Math.round(W / 70); k > 0; k--) {
          const c = Math.floor(pickX() / cw);
          const r = horizonRow + 2 + Math.floor(lay() * (trackRow - horizonRow - 3));
          const lc = lightAt((c + 0.5) * cw) > 0 ? 1 : -1;
          const i = cell(c, r);
          if (i < 0) continue;
          f.put(i, TILE, ink.shrub, 0.9, tg('+'));
          const s = cell(c - lc, r);
          if (s >= 0) f.put(s, BLOCK, ink.sand0, 0.7);
        }
        for (const [fx, hr] of [[0.215, 5], [0.835, 4]]) {
          const c = Math.floor((fx * W) / cw);
          const base = trackRow - 3;
          saguaro(f, c, base, hr, 1, [{ side: 1, at: 0.5, len: 2, gap: 1, w: 1 }, { side: -1, at: 0.35, len: 1, gap: 1, w: 1 }]);
          const s = cell(c - (lightAt(fx * W) > 0 ? 1 : -1), base);
          if (s >= 0) f.put(s, BLOCK, ink.sand0, 0.8);
        }

        // Telegraph poles (behind the track) with two sagging wires each span.
        const spacing = clamp(W * 0.15, 170, 260);
        const topRow = trackRow - 9;
        const wire = (x0, y0, sag) => {
          for (let s = cw; s < spacing - cw * 0.5; s += cw) {
            const t = s / spacing;
            const yy = (y0 + 4 * t * (1 - t) * sag) / ch;
            let r = Math.floor(yy);
            const fr = yy - r;
            const c = Math.floor((x0 + s) / cw);
            let glyph = slot.dash;
            if (fr < 0.25) {
              r -= 1;
              glyph = slot.low;
            } else if (fr >= 0.68) glyph = slot.low;
            const i = cell(c, r);
            if (i >= 0) f.put(i, GLYPH, ink.wire, 0.9, glyph);
          }
        };
        for (let x = spacing * 0.42; x < W + spacing; x += spacing) {
          const c = Math.floor(x / cw);
          const px = (c + 0.5) * cw;
          for (let r = topRow + 1; r <= trackRow - 1; r++) {
            const i = cell(c, r);
            if (i >= 0) f.put(i, TILE, ink.pole, 1, tg('|'));
          }
          for (let k = -1; k <= 1; k++) {
            const i = cell(c + k, topRow);
            if (i >= 0) f.put(i, TILE, ink.pole, 1, tg('-'));
          }
          wire(px, (topRow + 0.5) * ch, ch * 1.3);
          wire(px, (topRow + 2.5) * ch, ch * 1.0);
        }

        // Track bed: tie ends under the rail (rails are painted), gravel ballast, shadowed toe.
        for (let c = 0; c < cols; c++) {
          const t0 = cell(c, trackRow);
          if (t0 >= 0) f.put(t0, BLOCK, c % 2 === 0 ? ink.tie : ink.ballast);
          const t1 = cell(c, trackRow + 1);
          if (t1 >= 0) f.put(t1, TILE, ink.ballast, 1, tg(':'));
          const t2 = cell(c, trackRow + 2);
          if (t2 >= 0) f.put(t2, BLOCK, ink.sand0);
        }
      },

      paint(f, t) {
        const { horizonRow, trackRow } = geo();
        const { w: W, h: H, cw, ch, cols } = view;
        if (night) {
          stars.paint(f, t, ink.star);
          f.glow(SUN.x * W, SUN.y * H, 120, '#e8ecff', 0.22);
          // An occasional shooting star.
          const k = Math.floor(t / 11);
          const ph = (t - k * 11) / 0.9;
          if (ph < 1) {
            const sx = (0.08 + hash1(k * 3 + 1) * 0.8) * W + ph * 220;
            const sy = (0.03 + hash1(k * 5 + 2) * 0.2) * H + ph * 80;
            for (let j = 0; j < 6; j++) {
              const i = f.at(sx - j * cw, sy - j * cw * 0.36);
              if (i >= 0) f.put(i, GLYPH, ink.star, (1 - j / 6) * (1 - ph * 0.7), j === 0 ? slot.star : slot.dot);
            }
          }
        } else {
          // Heat shimmer streaks over the far floor and mirage pools on the open horizon.
          for (let r = horizonRow; r <= horizonRow + 2; r++) {
            for (let c = 0; c < cols; c++) {
              const i = cell(c, r);
              if (i < 0) continue;
              const x = (c + 0.5) * cw;
              if (r === horizonRow && x > W * 0.36 && x < W * 0.8) {
                const m = Math.sin(x / 71 + t * 0.25) + Math.sin(x / 167 - t * 0.17 + 2);
                if (m > 1.1) {
                  f.put(i, BLOCK, ink.heat, 0.25 + (m - 1.1) * 0.35);
                  continue;
                }
              }
              const s = Math.sin(x / 37 + t * 2.3 + r * 1.9) * Math.sin(x / 113 - t * 0.6 + r);
              if (s > 0.6) f.put(i, GLYPH, ink.heat, 0.25 + (s - 0.6) * 1.1, slot.wave);
            }
          }
          // Hawks circling over the left gap.
          for (let k = 0; k < 2; k++) {
            const a = t * (0.35 + k * 0.12) + k * 2.4;
            const i = f.at(W * (0.27 + k * 0.03) + Math.cos(a) * (80 - k * 30), H * (0.2 + k * 0.06) + Math.sin(a) * (28 - k * 8));
            if (i >= 0) f.put(i, GLYPH, ink.hawk, 0.85 - k * 0.25, Math.floor(t * 3 + k) % 3 === 0 ? slot.up : slot.down);
          }
        }

        // Rails, lit by the headlight where the beam falls.
        let beamFrom = -1;
        let beamTo = -1;
        const reachCols = Math.round((W * 0.3) / cw);
        if (train && night) {
          const noseCol = Math.floor((train.dir > 0 ? train.x + LW * cw : train.x) / cw);
          beamFrom = train.dir > 0 ? noseCol : noseCol - reachCols;
          beamTo = train.dir > 0 ? noseCol + reachCols : noseCol;
        }
        for (let c = 0; c < cols; c++) {
          const i = cell(c, trackRow);
          if (i < 0) break;
          if (c >= beamFrom && c <= beamTo) {
            const q = Math.abs(c - (train.dir > 0 ? beamFrom : beamTo)) / reachCols;
            f.put(i, GLYPH, ink.beam, Math.max(0.35, 1 - q * 0.8), slot.rail);
          } else f.put(i, GLYPH, ink.rail, 1, slot.rail);
        }

        if (train) {
          const flip = train.dir < 0;
          const y0 = (trackRow - 7) * ch;
          locoLegend.O[3] = SPOKES[Math.floor(Math.abs(train.x) / (cw * 0.5)) & 3];
          // Shadow on the ballast under the whole consist.
          const x0 = Math.floor((train.dir > 0 ? train.x - (train.length - LW * cw) : train.x) / cw);
          for (let c = Math.max(0, x0); c < Math.min(cols, x0 + train.length / cw); c++) {
            const i = cell(c, trackRow + 1);
            if (i >= 0) f.put(i, BLOCK, ink.frame, night ? 0.3 : 0.22);
          }
          f.sprite(LOCO, locoLegend, train.x, y0, flip);
          const tx = train.dir > 0 ? train.x - TW * cw : train.x + LW * cw;
          f.sprite(TENDER, locoLegend, tx, y0 + ch * 2, flip);
          let cursor = LW + TW;
          for (let k = 0; k < train.coaches; k++) {
            const x = train.dir > 0 ? train.x - (cursor + 1 + CW - LW) * cw : train.x + (cursor + 1) * cw;
            const gap = f.at(train.dir > 0 ? x + CW * cw + cw * 0.5 : x - cw * 0.5, y0 + ch * 5.5);
            if (gap >= 0) f.put(gap, GLYPH, ink.frame, 1, slot.dash);
            f.sprite(COACH, coachLegend, x, y0 + ch, flip);
            if (night) f.glow(x + (CW * cw) / 2, y0 + ch * 3.5, 56, '#ffcf6b', 0.28);
            cursor += CW + 1;
          }
          const nose = train.dir > 0 ? train.x + LW * cw : train.x;
          const lampY = y0 + ch * 3.5;
          if (night) {
            f.glow(train.dir > 0 ? train.x + 3 * cw : train.x + (LW - 3) * cw, y0 + ch * 3, 34, '#ff9a4a', 0.35);
            f.glow(nose, lampY, 70, '#fff1b0', 0.6);
            f.glow(nose + train.dir * W * 0.08, (lampY + trackRow * ch) / 2, 90, '#fff1b0', 0.18);
            // Translucent cone spreading down from the lamp to the rails.
            for (let d = 1; d <= reachCols; d++) {
              const q = d / reachCols;
              const c = Math.floor(nose / cw) + train.dir * d - (train.dir > 0 ? 1 : 0);
              const top = Math.floor(lampY / ch - d * 0.1);
              for (let r = top; r < trackRow; r++) {
                const i = cell(c, r);
                if (i >= 0) f.put(i, BLOCK, ink.beam, 0.16 * (1 - q) ** 1.3);
              }
            }
          } else f.glow(nose, lampY, 30, '#fff3c2', 0.5);
        }

        // Steam: dense tile core when fresh, thinning into rings and dots as it rises.
        for (const p of puffs) {
          const q = p.age / p.life;
          const rad = (0.8 + q * 2.6) * cw;
          const a0 = (night ? 0.6 : 0.95) * (1 - q) ** 0.8;
          const c0 = Math.floor((p.x - rad) / cw);
          const c1 = Math.floor((p.x + rad) / cw);
          const r0 = Math.floor((p.y - rad) / ch);
          const r1 = Math.floor((p.y + rad) / ch);
          for (let r = r0; r <= r1; r++) {
            for (let c = c0; c <= c1; c++) {
              const i = cell(c, r);
              if (i < 0) continue;
              const d = Math.hypot((c + 0.5) * cw - p.x, ((r + 0.5) * ch - p.y) * 0.8) / rad;
              if (d > 1) continue;
              if (d < 0.75 - q * 0.45) f.put(i, TILE, ink.smoke, a0 * (1 - d * 0.4), tg('.'));
              else f.put(i, GLYPH, ink.smoke, a0 * (1 - d * 0.5), q < 0.6 ? slot.o : slot.dot);
            }
          }
        }
      },

      front(f) {
        const { trackRow } = geo();
        const { w: W, h: H, cw, ch, rows } = view;
        const lay = rng(0xfa11);
        const pickX = () => {
          const q = lay();
          return (q < 0.42 ? lay() * 0.34 : q < 0.84 ? 0.8 + lay() * 0.2 : 0.34 + lay() * 0.46) * W;
        };
        const row0 = trackRow + 3;
        const span = Math.max(1, rows - 1 - row0);
        // Sandstone boulders: lit top, shadow flank, cast shadow on the sand.
        for (let k = Math.round(W / 110); k > 0; k--) {
          const c = Math.floor(pickX() / cw);
          const r = row0 + Math.floor(lay() * span);
          const lc = lightAt((c + 0.5) * cw) > 0 ? 1 : -1;
          const big = lay() < 0.45;
          const lit = cell(c + (lc > 0 ? 1 : 0), r);
          const dark = cell(c + (lc > 0 ? 0 : 1), r);
          const shadow = cell(lc > 0 ? c - 1 : c + 2, r);
          if (shadow >= 0) f.put(shadow, BLOCK, ink.sand0, 0.85);
          if (dark >= 0) f.put(dark, TILE, ink.rock1, 1);
          if (lit >= 0) f.put(lit, TILE, ink.rock3, 1);
          if (big) {
            const top = cell(c + (lc > 0 ? 1 : 0), r - 1);
            if (top >= 0) f.put(top, TILE, ink.rock4, 1);
          }
        }
        // Creosote / brittlebush clumps.
        for (let k = Math.round(W / 80); k > 0; k--) {
          const c = Math.floor(pickX() / cw);
          const r = row0 + Math.floor(lay() * span);
          const lc = lightAt((c + 0.5) * cw) > 0 ? 1 : -1;
          const shadow = cell(c - 2 * lc, r);
          if (shadow >= 0) f.put(shadow, BLOCK, ink.sand0, 0.8);
          for (let j = -1; j <= 1; j++) {
            const i = cell(c + j, r);
            if (i >= 0) f.put(i, TILE, j === lc ? ink.cactus2 : ink.shrub, 1, tg('+'));
          }
          const top = cell(c, r - 1);
          if (top >= 0) f.put(top, TILE, ink.shrub, 1, tg('+'));
        }
        // Barrel cacti.
        for (let k = Math.round(W / 260); k > 0; k--) {
          const c = Math.floor(pickX() / cw);
          const r = row0 + 1 + Math.floor(lay() * (span - 1));
          const lc = lightAt((c + 0.5) * cw) > 0 ? 1 : -1;
          const a = cell(c, r);
          const b = cell(c + lc, r);
          if (a >= 0) f.put(a, TILE, ink.cactus0, 1, tg('|'));
          if (b >= 0) f.put(b, TILE, ink.cactus2, 1, tg('|'));
          const top = cell(c + (lc > 0 ? 1 : 0), r - 1);
          if (top >= 0) f.put(top, TILE, ink.trim, 1, tg('o'));
        }
        // Big saguaros framing the visible strips; the train passes behind them.
        const big = (fx, hFrac, tw, arms) => saguaro(f, Math.floor((fx * W) / cw), rows - 1, Math.round((hFrac * H) / ch), tw, arms);
        big(0.235, 0.25, 3, [
          { side: -1, at: 0.42, len: 5, gap: 1, w: 2 },
          { side: 1, at: 0.6, len: 3, gap: 1, w: 2 },
        ]);
        big(0.935, 0.36, 3, [
          { side: 1, at: 0.4, len: 7, gap: 1, w: 2 },
          { side: -1, at: 0.55, len: 5, gap: 1, w: 2 },
        ]);
        big(0.06, 0.17, 2, [{ side: 1, at: 0.45, len: 3, gap: 1, w: 1 }]);
        big(0.845, 0.14, 2, [{ side: -1, at: 0.5, len: 2, gap: 1, w: 1 }]);
      },
    };
  },
};
