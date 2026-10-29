import { solid, tone } from '../engine/color.js';
import { BLOCK, GLYPH, TILE } from '../engine/field.js';
import { clamp, hash1, hash2, rng } from '../engine/math.js';
import { drifters, shade } from './kit.js';

const SHOPS = ['BOOKS', 'BAKERY', 'FLOWERS', 'RECORDS'];
const WALLS = [
  ['fA0', 'fA1', 'fA2'],
  ['fB0', 'fB1', 'fB2'],
  ['fC0', 'fC1', 'fC2'],
  ['fD0', 'fD1', 'fD2'],
];
// The row of buildings across the street, left to right. x0/x1/sign are
// fractions of the view width, top a fraction of the glass height, shop an
// index into SHOPS. BOOKS and RECORDS are pinned to the strips the app leaves
// uncovered; the middle ones sit behind the chat column and stay simple.
const BUILDINGS = [
  { x0: 0.12, x1: 0.335, wall: 0, top: 0.03, shop: 0, awn: 'awnA', sign: 0.272, door: 0.62 },
  { x0: 0.335, x1: 0.455, wall: 1, top: 0.17, shop: 1, awn: 'awnC', door: 0.5, roof: 'chimney' },
  { x0: 0.455, x1: 0.585, wall: 3, top: 0, shop: -1, door: 0.5, roof: 'tank' },
  { x0: 0.585, x1: 0.715, wall: 2, top: 0.1, shop: 2, awn: 'awnA', door: 0.5 },
  { x0: 0.715, x1: 0.84, wall: 0, top: 0.2, shop: -1, door: 0.5, roof: 'chimney' },
  { x0: 0.84, x1: 1.03, wall: 3, top: 0.06, shop: 3, awn: 'awnC', sign: 0.93, door: 0.12 },
];
const CAR_COLORS = ['carRed', 'carBlue', 'carYellow', 'carMint'];

// Sprites face right. Tile slots: 0 = plain tile, 1 = 'o' (wheels, records).
const CAR = ['...bbbb...', '..bwwbwwb.', 'tbbbbbbbbh', 'sbkbbbbkbs'];
const BUS = ['bbbbbbbbbbbbbbb.', 'bwwbwwbwwbwwbwwb', 'cccccccccccccccw', 'tbbbbbbbbbbbbbbh', 'sbkkbbbbbbbbkkbs'];
const BIKE = ['..h.', '.pp.', 'kbbk'];
const WALKER_DAY = ['h', 'p', 'l'];
const WALKER_RAIN = ['uuu', '.h.', '.p.', '.l.'];
const CUP = ['.rffr.', '.cccC)', '.cccC)', 'ssssss'];
const PASTRY = ['.yYYy.', 'yyYyyy', 'pppppp'];
const LAPTOP = ['.LLLLLLL.', '.L.....L.', '.L.....L.', '.L.....L.', '.LLLLLLL.', 'KKKKKKKKK'];
const POT = ['RRRR', 'pppP', '.pP.'];
const LAMP = ['.LSS.', 'LLSSS', 'RRRRR', '..b..'];

/** Same ink names in both palettes; everything is a flat colour except the wheel/record tiles. */
function inks(c) {
  const out = {};
  for (const [name, color] of Object.entries(c)) out[name] = solid(color);
  out.tire = tone(c.tire, 0.55);
  return out;
}

/**
 * Flat tone bands instead of kit `shade`'s ordered dither: smooth interior
 * materials (wood, brick, frames) get clean contour bands around the lamp
 * pools rather than a checkerboard wherever the light changes slowly.
 */
function band(ramp, value) {
  return ramp[Math.round(clamp(value, 0, 1) * (ramp.length - 1))];
}

/**
 * Inside a corner café looking out through a big window: facades across the
 * street, a lamp post, trees, and traffic now and then — cars, a bus, someone
 * on a bike. Coffee steams on the counter next to a laptop running Codex.
 * Day: warm sunny interior. Night: rain on the glass, lit windows, neon OPEN.
 *
 * Composition: the window's narrow side lights (left gap and right strip of
 * the app) carry the detail — BOOKS + neon OPEN + lamp post on the left,
 * RECORDS on the right — and the counter objects sit in those strips too.
 * The centre is calm: big pane, trees, pendant glow.
 */
export default {
  id: 'corner-cafe',
  name: 'Corner Café',
  chars: { tile: ' o', halo: "'.:", extra: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789>_|/\\-=~()v" },
  shimmer: 0.9,
  palettes: {
    light: {
      bg: {
        stops: [[0, '#8a5a3a'], [0.06, '#8a5a3a'], [0.085, '#c4dcec'], [0.3, '#e2d4c2'], [0.58, '#c0bab2'], [0.62, '#a46e46'], [1, '#7a4a2e']],
        vignette: 0,
      },
      inks: inks({
        skyTop: '#8ccaf0',
        sky: '#acdaf4',
        skyLow: '#d2ecf7',
        cloud: '#ffffff',
        farCity: '#b6cadb',
        farCityLit: '#cbdae6',
        fA0: '#b2614a',
        fA1: '#cf7a5c',
        fA2: '#e8987a',
        fB0: '#d6bb92',
        fB1: '#ecd5ac',
        fB2: '#faebd0',
        fC0: '#8aae8e',
        fC1: '#a6c8a2',
        fC2: '#c4dfbd',
        fD0: '#8a9fbe',
        fD1: '#a7bbd6',
        fD2: '#c6d5e9',
        trim: '#fdf6ea',
        win: '#4f7393',
        winSky: '#a2cdea',
        winLit: '#ffe09a',
        winLit2: '#f4bf6c',
        winTv: '#a8c8ff',
        shopGlass: '#86a9c0',
        shopShade: '#56728a',
        door: '#6a4732',
        awnA: '#de5444',
        awnB: '#fbf3e4',
        awnC: '#2a8d86',
        signBoard: '#2c3a4c',
        signText: '#fff1d0',
        signText2: '#ffd36e',
        pavement: '#dcd2c4',
        pavementJoint: '#cdc2b3',
        pavementShade: '#b3a89a',
        pavementLit: '#ece4d8',
        curb: '#f2ece2',
        gutter: '#7c8089',
        asphalt: '#8e929b',
        asphaltWet: '#9a9ea7',
        laneMark: '#fbf6e8',
        reflWarm: '#ffe6a8',
        reflDim: '#a3a7b0',
        leaf0: '#3c7a44',
        leaf1: '#5a9e50',
        leaf2: '#86c46a',
        trunk: '#6a4a34',
        pole: '#39414e',
        lampHead: '#ece6cc',
        carRed: '#e05a4c',
        carBlue: '#4c84d6',
        carYellow: '#f0bf4a',
        carMint: '#5cc4a8',
        busGreen: '#3d9c72',
        carGlass: '#d2e8f7',
        tire: '#2a2a30',
        headlight: '#fff6c8',
        taillight: '#ff5a4a',
        person1: '#3d5a80',
        person2: '#d9734f',
        skin: '#efc79f',
        umbrella: '#e05a4c',
        umbrella2: '#3d6fb8',
        rain: '#ffffff',
        drop: '#e8f4ff',
        shadow: '#3a3c46',
        ceil0: '#76492e',
        ceil1: '#8c5a3a',
        ceil2: '#a06a44',
        ceil3: '#b88050',
        mortar: '#dcc8b0',
        brick0: '#a2533a',
        brick1: '#bb6448',
        brick2: '#cf785a',
        brick3: '#e4936e',
        frame0: '#24483c',
        frame1: '#336352',
        frame2: '#4f8a72',
        sillTop: '#76b096',
        panel0: '#7e4c2e',
        panel1: '#946040',
        panel2: '#a8724c',
        panel3: '#c08a5e',
        top0: '#93603a',
        top1: '#b07848',
        top2: '#cc9260',
        top3: '#e6b07c',
        edge: '#f4cc98',
        front0: '#56331f',
        front1: '#653c25',
        front2: '#764830',
        front3: '#8c5838',
        cup: '#ffffff',
        cupShade: '#d6d0c8',
        coffee: '#5a321c',
        saucer: '#f2ede6',
        steam: '#ffffff',
        laptop: '#c8cdd6',
        laptopDark: '#9ba2ae',
        screen: '#1c2132',
        prompt: '#a9afff',
        screenText: '#5f6894',
        pot: '#cc714a',
        potDark: '#a4553a',
        plant0: '#2a6232',
        plant1: '#3f8a45',
        plant2: '#6cba5a',
        croissant: '#cf8a38',
        croissantLit: '#f0bc66',
        plate: '#f6f2ec',
        shade: '#b07038',
        shadeLit: '#d69252',
        shadeRim: '#8a5426',
        bulb: '#fff4cc',
        cord: '#3a2a20',
        neon: '#ff5a9a',
        neonTube: '#8fc8e0',
      }),
      ui: { base: '#efe2d0', sidebar: 'rgba(248, 240, 228, 0.7)', composer: 'rgba(255, 252, 247, 0.88)', accent: '#b0663a', bubble: 'rgba(176, 102, 58, 0.13)' },
      lane: 0.55,
    },
    dark: {
      bg: {
        stops: [[0, '#1c110b'], [0.06, '#1c110b'], [0.085, '#0e1430'], [0.4, '#1b1c32'], [0.58, '#121522'], [0.62, '#26160d'], [1, '#120a06']],
        vignette: 0,
      },
      inks: inks({
        skyTop: '#060a1a',
        sky: '#0b1330',
        skyLow: '#1d1b40',
        cloud: '#151a38',
        farCity: '#121a36',
        farCityLit: '#d9a860',
        fA0: '#21172a',
        fA1: '#2d1f35',
        fA2: '#4a3350',
        fB0: '#1f2238',
        fB1: '#292d4a',
        fB2: '#3e4366',
        fC0: '#152630',
        fC1: '#1d323e',
        fC2: '#2c4a58',
        fD0: '#192038',
        fD1: '#222b4a',
        fD2: '#344166',
        trim: '#3c3f5e',
        win: '#0c1224',
        winSky: '#141c36',
        winLit: '#ffd27e',
        winLit2: '#e3a052',
        winTv: '#7aa2ff',
        shopGlass: '#f5c27a',
        shopShade: '#c98f52',
        door: '#20161a',
        awnA: '#8a2c34',
        awnB: '#5a4a58',
        awnC: '#1d5a58',
        signBoard: '#101422',
        signText: '#ffd98a',
        signText2: '#7fe6ff',
        pavement: '#22263a',
        pavementJoint: '#1c2032',
        pavementShade: '#171a28',
        pavementLit: '#5a4636',
        curb: '#3a3f54',
        gutter: '#0a0c14',
        asphalt: '#10131e',
        asphaltWet: '#1e2438',
        laneMark: '#5a5c66',
        reflWarm: '#d99a50',
        reflDim: '#4a3a3c',
        leaf0: '#0b1a1a',
        leaf1: '#12282a',
        leaf2: '#1e3e3a',
        trunk: '#151014',
        pole: '#2c3142',
        lampHead: '#fff0b8',
        carRed: '#a33a34',
        carBlue: '#2f5596',
        carYellow: '#b08a30',
        carMint: '#2c7f6c',
        busGreen: '#246a50',
        carGlass: '#ffd98a',
        tire: '#0c0c12',
        headlight: '#fffbe0',
        taillight: '#ff3b3b',
        person1: '#2a3550',
        person2: '#5a3028',
        skin: '#8a6450',
        umbrella: '#b83a44',
        umbrella2: '#2f4f96',
        rain: '#9cc0e8',
        drop: '#b8d4f4',
        shadow: '#000000',
        ceil0: '#170d08',
        ceil1: '#22140c',
        ceil2: '#3a2212',
        ceil3: '#5e3618',
        mortar: '#170e09',
        brick0: '#2a160e',
        brick1: '#432316',
        brick2: '#68361e',
        brick3: '#9c5628',
        frame0: '#0c1712',
        frame1: '#15281f',
        frame2: '#2a4a3a',
        sillTop: '#3e6a54',
        panel0: '#170d07',
        panel1: '#26160b',
        panel2: '#3e2410',
        panel3: '#6a3e1a',
        top0: '#2a180c',
        top1: '#4a2a14',
        top2: '#7c4a22',
        top3: '#b8723a',
        edge: '#e0a060',
        front0: '#120a06',
        front1: '#1c1009',
        front2: '#2c190d',
        front3: '#4a2a14',
        cup: '#f2e9de',
        cupShade: '#a8988a',
        coffee: '#2a140a',
        saucer: '#d8cabc',
        steam: '#f4e0cc',
        laptop: '#6a707e',
        laptopDark: '#40454f',
        screen: '#0c1022',
        prompt: '#b4baff',
        screenText: '#4f5a98',
        pot: '#9a4e2c',
        potDark: '#5e2c18',
        plant0: '#0e2414',
        plant1: '#1d4a26',
        plant2: '#3c7e3c',
        croissant: '#a8652a',
        croissantLit: '#e8a650',
        plate: '#d6cabe',
        shade: '#6a4020',
        shadeLit: '#a86a30',
        shadeRim: '#ffd080',
        bulb: '#fff4c0',
        cord: '#0c0806',
        neon: '#ff5fa8',
        neonTube: '#5fe0ff',
      }),
      ui: { base: '#1e1510', sidebar: 'rgba(28, 18, 13, 0.64)', composer: 'rgba(36, 24, 18, 0.88)', accent: '#ffb35c', bubble: 'rgba(255, 179, 92, 0.18)' },
      lane: 0.62,
    },
  },

  scene(view) {
    const rand = rng(0xcafe);
    const { ink, night } = view;
    const G = (char) => view.glyph(char);
    const PLAIN = 0;
    const RING = 1;
    const shopText = SHOPS.map((s) => view.glyphs(s));
    const openText = view.glyphs('OPEN');
    const wallRamps = WALLS.map((names) => names.map((n) => ink[n]));
    const ramps = {
      sky: [ink.skyTop, ink.sky, ink.skyLow],
      brick: [ink.brick0, ink.brick1, ink.brick2, ink.brick3],
      ceil: [ink.ceil0, ink.ceil1, ink.ceil2, ink.ceil3],
      frame: [ink.frame0, ink.frame1, ink.frame2],
      sill: [ink.frame1, ink.frame2, ink.sillTop],
      panel: [ink.panel0, ink.panel1, ink.panel2, ink.panel3],
      top: [ink.top0, ink.top1, ink.top2, ink.top3],
      edge: [ink.top2, ink.top3, ink.edge],
      front: [ink.front0, ink.front1, ink.front2, ink.front3],
      leaf: [ink.leaf0, ink.leaf1, ink.leaf2],
      plant: [ink.plant0, ink.plant1, ink.plant2],
      pave: [ink.pavementShade, ink.pavement, ink.pavementLit],
    };
    const SPINES = [ink.carRed, ink.carBlue, ink.carYellow, ink.carMint, ink.trim];
    const BLOOMS = [ink.leaf1, ink.awnA, ink.leaf2, ink.carYellow];
    const STEAM = [G('('), G(')'), G('~'), G("'")];

    // Layout in cells; depends only on the view size.
    let L = null;
    let layoutKey = '';
    const layout = () => {
      const key = `${view.w}x${view.h}`;
      if (key === layoutKey) return L;
      layoutKey = key;
      const { w, h, cw, ch, cols } = view;
      const col = (f) => Math.round((w * f) / cw);
      const row = (f) => Math.round((h * f) / ch);
      const wr0 = Math.max(3, row(0.075)); // first glass row
      const wr1 = Math.max(wr0 + 20, row(0.6)); // first sill row
      const gr = (f) => wr0 + Math.round((wr1 - wr0) * f);
      const c0 = col(0.235);
      const c1 = col(0.975);
      const br = gr(0.66); // facade base = first far-sidewalk row
      const g = {
        c0,
        c1,
        m1: col(0.32),
        m2: col(0.885),
        wr0,
        wr1,
        transom: gr(0.16),
        br,
        curbR: br + 2,
        roadR0: br + 3,
        nearCurb: wr1 - 2,
        counterR: Math.max(wr1 + 7, row(0.78)),
        lamps: [0.27, 0.6, 0.935].map((f) => {
          const c = col(f);
          return { c, x: (c + 0.5) * cw, y: (wr0 + 3.5) * ch };
        }),
        windows: [],
        sources: [],
      };
      g.buildings = BUILDINGS.map((b) => {
        const bc0 = col(b.x0);
        const bc1 = col(b.x1);
        const W = bc1 - bc0;
        const name = b.shop >= 0 ? shopText[b.shop] : null;
        const signC = name ? clamp(Math.round(((b.sign ?? (b.x0 + b.x1) / 2) * w) / cw - name.length / 2), bc0 + 2, bc1 - name.length - 2) : 0;
        const nWin = Math.max(1, Math.floor((W - 1) / 3));
        return { ...b, c0: bc0, c1: bc1, W, tr: gr(b.top), name, signC, doorC: bc0 + 1 + Math.round((W - 4) * b.door), nWin, off: Math.floor((W - (nWin * 3 - 1)) / 2) };
      });
      const books = g.buildings[0];
      g.post = { c: Math.min(books.signC + books.name.length + 2, g.m1 - 1), top: br - 8 };
      g.trees = [0.47, 0.755].map((f) => ({ x: (col(f) + 0.5) * cw, y: (br - 6) * ch, R: clamp(h * 0.06, 44, 72) }));
      g.neon = { c: Math.round((c0 + g.m1) / 2) - 3, r: g.transom + 4 };
      g.cup = col(0.215);
      g.pastry = col(0.268);
      g.laptop = col(0.878);
      g.plant = col(0.965);
      // Upper-floor windows (top-left cell of each 2×2) light up at night.
      for (const b of g.buildings) {
        for (let r = br - 10; r >= b.tr + 2; r -= 4) {
          for (let k = 0; k < b.nWin; k++) {
            const c = b.c0 + b.off + k * 3;
            if (c + 1 >= c0 && c < c1) g.windows.push(r * cols + c);
          }
        }
        if (b.shop >= 0) g.sources.push({ c: (b.c0 + b.c1) / 2, half: b.W * 0.26, k: 0.75 });
      }
      g.sources.push({ c: g.post.c + 0.5, half: 1.1, k: 1 });
      L = g;
      return g;
    };

    const isWin = (b, lc) => lc >= b.off && lc < b.off + b.nWin * 3 - 1 && (lc - b.off) % 3 < 2;

    // Light from the pendant lamps: a cone widening below each bulb.
    const lampLight = (x, y) => {
      let s = 0;
      const fall = 2 * (view.h * 0.55) ** 2;
      for (const l of L.lamps) {
        const dx = x - l.x;
        const dy = y - l.y;
        const sx = 40 + Math.abs(dy) * 0.32;
        s += Math.exp(-(dx * dx) / (2 * sx * sx) - (dy * dy) / fall);
      }
      return s > 1 ? 1 : s;
    };
    // Broad warm pools on the counter and panelling, baked into the tones
    // (cheaper than big per-frame glows).
    const pool = (x, y) => {
      let s = 0;
      const dy = y - (L.counterR + 1) * view.ch;
      const fy = Math.exp(-(dy * dy) / (2 * 150 * 150));
      for (const l of L.lamps) s += Math.exp(-((x - l.x) ** 2) / (2 * 190 * 190));
      return (s > 1 ? 1 : s) * fy;
    };
    const interior = (x, y) => (night ? 0.06 + 0.9 * lampLight(x, y) + 0.22 * pool(x, y) : 0.42 + 0.4 * lampLight(x, y) + 0.08 * pool(x, y));

    // Night windows across the street: a 2×2 lit room (warm, or a blue TV glow).
    const liveWindow = (k) => hash1(k * 7 + 3) < 0.25;
    const litWindow = (f, i, s, a) => {
      if (s < 0.4) return;
      const cols = view.cols;
      const tv = s > 0.9;
      const top = tv ? ink.winTv : ink.winLit;
      const low = tv ? ink.winTv : ink.winLit2;
      f.put(i, BLOCK, top, a);
      f.put(i + 1, BLOCK, top, a);
      f.put(i + cols, BLOCK, low, a);
      f.put(i + cols + 1, BLOCK, s > 0.75 && !tv ? ink.winLit2 : low, a * (s > 0.75 ? 0.7 : 1));
    };

    const rain = drifters(view, rand, {
      count: night ? 46 : 0,
      vy: [420, 620],
      vx: [-40, -20],
      sway: 0,
      glyphs: '|/|',
      alpha: [0.18, 0.42],
      region: () => {
        const g = layout();
        return { x0: g.c0 * view.cw, y0: g.wr0 * view.ch, x1: g.c1 * view.cw, y1: g.wr1 * view.ch };
      },
    });
    // Raindrops clinging to the glass; now and then one runs down.
    const drops = Array.from({ length: night ? 40 : 0 }, () => ({ u: rand(), v: rand(), speed: 0, wait: rand.range(1, 20) }));

    const traffic = [];
    let nextVehicle = 1.5;
    const spawn = () => {
      const g = layout();
      const roll = rand();
      const near = rand() < 0.55;
      const dir = near ? 1 : -1;
      const kind = roll < 0.6 ? 'car' : roll < 0.82 ? 'bike' : 'bus';
      const sprite = kind === 'car' ? CAR : kind === 'bus' ? BUS : BIKE;
      const width = sprite[0].length * view.cw;
      const body = kind === 'bus' ? ink.busGreen : ink[CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)]];
      traffic.push({
        kind,
        sprite,
        dir,
        near,
        x: dir > 0 ? g.c0 * view.cw - width - 10 : g.c1 * view.cw + 10,
        width,
        speed: kind === 'car' ? rand.range(150, 210) : kind === 'bus' ? rand.range(95, 120) : rand.range(55, 75),
        legend: {
          b: kind === 'bike' ? [GLYPH, ink.pole, 1, G('=')] : [BLOCK, body],
          w: [BLOCK, ink.carGlass],
          c: [BLOCK, ink.trim],
          h: kind === 'bike' ? [TILE, ink.skin, 1, PLAIN] : [BLOCK, ink.headlight],
          t: [BLOCK, ink.taillight],
          k: [TILE, ink.tire, 1, RING],
          s: [BLOCK, ink.shadow, night ? 0.45 : 0.3],
          p: [BLOCK, rand() < 0.5 ? ink.person1 : ink.person2],
        },
      });
    };
    const legs = [G('/'), G('|')];
    const walkers = Array.from({ length: 3 }, (_, k) => {
      const shirt = [ink.person1, ink.person2, ink.awnC][k];
      const umb = k % 2 ? ink.umbrella : ink.umbrella2;
      return {
        u: rand(),
        speed: rand.range(18, 28) * (k % 2 ? -1 : 1),
        legends: legs.map((leg) => ({ u: [BLOCK, umb], h: [TILE, ink.skin, 1, PLAIN], p: [BLOCK, shirt], l: [GLYPH, shirt, 1, leg] })),
      };
    });

    return {
      update(dt) {
        const g = layout();
        nextVehicle -= dt;
        if (nextVehicle <= 0) {
          spawn();
          nextVehicle = rand.range(5, 12);
        }
        const x0 = g.c0 * view.cw;
        const x1 = g.c1 * view.cw;
        for (let k = traffic.length - 1; k >= 0; k--) {
          const v = traffic[k];
          v.x += v.dir * v.speed * dt;
          if (v.x > x1 + 20 || v.x + v.width < x0 - 20) traffic.splice(k, 1);
        }
        for (const w of walkers) w.u = (((w.u + (w.speed * dt) / Math.max(1, x1 - x0)) % 1) + 1) % 1;
        for (const d of drops) {
          if (d.speed > 0) {
            d.v += d.speed * dt;
            if (d.v > 1) {
              d.v = rand() * 0.4;
              d.u = rand();
              d.speed = 0;
              d.wait = rand.range(4, 22);
            }
          } else if ((d.wait -= dt) <= 0) d.speed = rand.range(0.12, 0.3);
        }
        rain.update(dt);
      },

      back(f) {
        const g = layout();
        const { cw, ch, cols, rows } = view;
        const put = (c, r, kind, k, a = 1, gl = -1) => {
          if (c >= 0 && r >= 0 && c < cols && r < rows) f.put(r * cols + c, kind, k, a, gl);
        };
        const X = (c) => (c + 0.5) * cw;
        const Y = (r) => (r + 0.5) * ch;
        const postX = X(g.post.c);
        const postY = Y(g.post.top);
        const postLight = (x, y) => (night ? Math.exp(-((x - postX) ** 2 + ((y - postY) * 1.2) ** 2) / (2 * 85 * 85)) : 0);

        // Ceiling planks with a crown moulding, warm pools around the cords.
        for (let r = 0; r <= g.wr0 - 2; r++) {
          for (let c = 0; c < cols; c++) {
            const v = interior(X(c), Y(r));
            if (r === g.wr0 - 2) put(c, r, BLOCK, band(ramps.panel, v + 0.3));
            else put(c, r, BLOCK, band(ramps.ceil, v * 0.85 + (r % 2 ? -0.08 : 0.04) - ((c + r * 5) % 11 === 0 ? 0.3 : 0)));
          }
        }
        // Mortar behind the brick walls (bricks are front tiles).
        for (let r = g.wr0 - 1; r <= g.wr1 + 1; r++) {
          for (let c = 0; c < cols; c++) {
            if (c >= g.c0 - 1 && c <= g.c1) continue;
            if (r >= g.wr1 && c >= g.c0 - 2 && c <= g.c1 + 1) continue;
            put(c, r, BLOCK, ink.mortar);
          }
        }
        // Window frame: header, jambs and the deep sill (mullions + transom are in front).
        for (let c = g.c0 - 1; c <= g.c1; c++) put(c, g.wr0 - 1, BLOCK, band(ramps.frame, interior(X(c), Y(g.wr0 - 1)) + 0.15));
        for (let r = g.wr0; r < g.wr1; r++) {
          put(g.c0 - 1, r, BLOCK, band(ramps.frame, interior(X(g.c0 - 1), Y(r)) + 0.2));
          put(g.c1, r, BLOCK, band(ramps.frame, interior(X(g.c1), Y(r)) - 0.1));
        }
        for (let c = g.c0 - 2; c <= g.c1 + 1; c++) {
          put(c, g.wr1, BLOCK, band(ramps.sill, interior(X(c), Y(g.wr1)) + 0.4));
          put(c, g.wr1 + 1, BLOCK, band(ramps.frame, interior(X(c), Y(g.wr1 + 1)) - 0.1));
        }

        // ---- The street, clipped to the glass.
        f.setClip(g.c0 * cw, g.wr0 * ch, g.c1 * cw, g.wr1 * ch);
        const skyRows = Math.max(1, g.transom + 4 - g.wr0);
        for (let r = g.wr0; r < g.br; r++) {
          for (let c = g.c0; c < g.c1; c++) put(c, r, BLOCK, shade(ramps.sky, (r - g.wr0) / skyRows, c, r));
        }
        if (!night) {
          for (const [fx, dr, half] of [[0.4, 1, 4], [0.66, 2, 3], [0.9, 1, 3]]) {
            const cc = Math.round((view.w * fx) / cw);
            for (let c = cc - half; c <= cc + half; c++) {
              if (Math.abs(c - cc) < half) put(c, g.wr0 + dr, BLOCK, ink.cloud);
              put(c, g.wr0 + dr + 1, BLOCK, Math.abs(c - cc) === half ? ink.skyLow : ink.cloud);
            }
          }
        }
        // Distant skyline: low contrast, close to the sky value.
        const far = rng(0x5c1);
        for (let c = g.c0 - 1; c < g.c1; ) {
          const wdt = 2 + Math.floor(far() * 4);
          const top = g.wr0 + 1 + Math.floor(far() * 4);
          for (let k = 0; k < wdt; k++) {
            for (let r = top; r < g.br; r++) {
              const lit = night && (r - top) % 2 === 1 && (c + k) % 2 === 0 && hash2(c + k, r) < 0.3;
              put(c + k, r, BLOCK, lit ? ink.farCityLit : ink.farCity, lit ? 0.7 : 1);
            }
          }
          c += wdt;
        }

        // Facades.
        for (const b of g.buildings) {
          const ramp = wallRamps[b.wall];
          const wallAt = (lc, c, r, bias = 0) => {
            let v = 0.5 + bias;
            if (lc === 0) v = 0.88;
            else if (lc === b.W - 1) v = 0.1;
            return shade(ramp, v + postLight(X(c), Y(r)) * 0.8, c, r);
          };
          // Roof furniture breaks the flat silhouettes.
          const rc = b.c0 + Math.round(b.W * 0.68);
          if (b.roof === 'chimney') {
            put(rc, b.tr - 2, BLOCK, ink.trim);
            put(rc + 1, b.tr - 2, BLOCK, ink.trim);
            put(rc, b.tr - 1, BLOCK, ramp[1]);
            put(rc + 1, b.tr - 1, BLOCK, ramp[0]);
          } else if (b.roof === 'tank') {
            for (let k = 0; k < 3; k++) {
              put(rc + k, b.tr - 3, BLOCK, k === 2 ? ink.door : ink.trunk);
              put(rc + k, b.tr - 2, BLOCK, k === 2 ? ink.door : ink.trunk);
            }
            put(rc, b.tr - 1, BLOCK, ink.pole);
            put(rc + 2, b.tr - 1, BLOCK, ink.pole);
          }
          for (let r = b.tr; r < g.br; r++) {
            const fromBase = g.br - r;
            for (let c = Math.max(b.c0, g.c0); c < Math.min(b.c1, g.c1); c++) {
              const lc = c - b.c0;
              const inner = lc > 0 && lc < b.W - 1;
              const door = c >= b.doorC && c <= b.doorC + 1;
              let k;
              if (r === b.tr) k = ink.trim;
              else if (r === b.tr + 1) k = wallAt(lc, c, r, -0.4);
              else if (fromBase === 7) k = inner ? ink.trim : wallAt(lc, c, r);
              else if (fromBase <= 6 && b.shop >= 0 && inner) {
                if (fromBase === 6) k = ink.signBoard;
                else if (fromBase >= 4) k = lc % 2 ? ink[b.awn] : ink.awnB;
                else if (door) k = fromBase === 3 ? ink.shopShade : ink.door;
                else if (fromBase === 3) k = ink.shopShade;
                else if (fromBase === 2) k = b.shop === 2 && lc % 3 === 0 ? ink.leaf1 : ink.shopGlass;
                else if (b.shop === 0) k = SPINES[lc % SPINES.length];
                else if (b.shop === 1) k = lc % 2 ? ink.croissantLit : ink.croissant;
                else if (b.shop === 2) k = BLOOMS[lc % BLOOMS.length];
                else if (lc % 2) {
                  put(c, r, TILE, ink.tire, 1, RING);
                  continue;
                } else k = ink.awnC;
              } else if (fromBase <= 6) {
                if (inner && door && fromBase <= 3) k = ink.door;
                else if (inner && (fromBase === 5 || fromBase === 4) && isWin(b, lc)) k = fromBase === 5 ? ink.winSky : ink.win;
                else k = wallAt(lc, c, r);
              } else if (r >= b.tr + 2) {
                const q = (fromBase - 8) % 4;
                if (isWin(b, lc) && q === 0) k = ink.trim;
                else if (isWin(b, lc) && (q === 1 || q === 2)) k = q === 2 ? ink.winSky : ink.win;
                else k = wallAt(lc, c, r, q === 3 ? -0.05 : 0);
              } else k = wallAt(lc, c, r);
              put(c, r, BLOCK, k);
            }
          }
        }
        // Backing board for the neon sign hung inside the glass.
        for (let c = g.neon.c; c < g.neon.c + 6; c++) put(c, g.neon.r, BLOCK, ink.signBoard);
        if (night) for (let k = 0; k < g.windows.length; k++) if (!liveWindow(k)) litWindow(f, g.windows[k], hash1(k * 131 + 7), 1);

        // Far sidewalk, curb, road, near curb.
        const shopLight = (x) => {
          let s = 0;
          for (const src of g.sources) s = Math.max(s, src.k * Math.exp(-((x / cw - src.c) ** 2) / (2 * src.half * src.half)));
          return s;
        };
        const roadRows = Math.max(1, g.nearCurb - g.roadR0);
        for (let r = g.br; r < g.wr1; r++) {
          for (let c = g.c0; c < g.c1; c++) {
            const x = X(c);
            let k;
            if (r === g.curbR || r === g.nearCurb) k = ink.curb;
            else if (r > g.nearCurb) k = (c + 2) % 5 === 0 ? ink.pavementJoint : ink.pavement;
            else if (r >= g.roadR0) {
              // Wet asphalt: a sheen around each light, with rippled warm
              // streaks that narrow toward the near curb.
              const lr = r - g.roadR0;
              const v = night ? shopLight(x) : 0;
              const fade = 1 - (0.6 * lr) / roadRows;
              if (lr === 0 && v < 0.3) k = ink.gutter;
              else if (lr % 2 === 1 && v > 0.55 + 0.06 * lr) k = ink.reflWarm;
              else k = v * fade > 0.42 ? ink.reflDim : v * fade > 0.2 ? ink.asphaltWet : ink.asphalt;
            } else {
              let v = 0.5;
              if (night) v = 0.3 + shopLight(x) * (r === g.br ? 0.55 : 0.4) + postLight(x, Y(r)) * 0.6;
              else for (const t of g.trees) if (Math.abs(x - t.x - t.R * 0.3) < t.R * 1.1) v = 0;
              k = v > 0.4 && v < 0.6 && (c + (r % 2) * 2) % 5 === 0 ? ink.pavementJoint : shade(ramps.pave, v, c, r);
            }
            put(c, r, BLOCK, k);
          }
        }

        // Street trees: lit from the upper left, shadowed lower right.
        for (const t of g.trees) {
          const tc = Math.floor(t.x / cw);
          for (let r = Math.floor((t.y + t.R * 0.3) / ch); r <= g.br + 1; r++) put(tc, r, BLOCK, ink.trunk);
          const blobs = [
            [t.x, t.y, t.R],
            [t.x - t.R * 0.8, t.y + t.R * 0.35, t.R * 0.7],
            [t.x + t.R * 0.85, t.y + t.R * 0.3, t.R * 0.68],
            [t.x + t.R * 0.15, t.y - t.R * 0.6, t.R * 0.62],
          ];
          for (let r = Math.floor((t.y - t.R * 1.4) / ch); r <= Math.ceil((t.y + t.R * 1.1) / ch); r++) {
            for (let c = Math.floor((t.x - t.R * 1.7) / cw); c <= Math.ceil((t.x + t.R * 1.7) / cw); c++) {
              const x = X(c);
              const y = Y(r);
              let best = 1;
              let v = 0;
              for (const [bx, by, br] of blobs) {
                const d = Math.hypot(x - bx, y - by) / br;
                if (d < best) {
                  best = d;
                  v = 0.62 - (0.45 * (x - bx)) / br - (0.5 * (y - by)) / br;
                }
              }
              if (best >= 1) continue;
              if (best > 0.82) v -= 0.15;
              put(c, r, BLOCK, shade(ramps.leaf, night ? v * 0.55 + postLight(x, y) * 0.9 : v, c, r));
            }
          }
        }
        // Lamp post across the street.
        for (let r = g.post.top + 1; r <= g.br + 1; r++) put(g.post.c, r, BLOCK, ink.pole);
        put(g.post.c, g.post.top - 1, BLOCK, ink.pole);
        for (let k = -1; k <= 1; k++) put(g.post.c + k, g.post.top, BLOCK, ink.lampHead);
        f.clearClip();

        // Wood wainscot under the window: rails, grooves, bevels.
        const w0 = g.wr1 + 2;
        const wRows = g.counterR - w0;
        for (let r = w0; r < g.counterR; r++) {
          const lr = r - w0;
          for (let c = 0; c < cols; c++) {
            let v = interior(X(c), Y(r));
            const pc = c % 7;
            if (lr === 0) v -= 0.4;
            else if (lr === 1 || lr === wRows - 1) v += 0.12;
            else if (pc === 0) v -= 0.35;
            else if (pc === 1) v += 0.2;
            put(c, r, BLOCK, band(ramps.panel, v));
          }
        }
        // Counter: top surface, bullnose edge, shadow, planked front.
        for (let r = g.counterR; r < rows; r++) {
          const lr = r - g.counterR;
          for (let c = 0; c < cols; c++) {
            let v = interior(X(c), Y(r));
            let k;
            if (lr <= 1) {
              if (!night && c >= g.c0 && c < g.c1) v += Math.abs(c - g.m1) <= 1 || Math.abs(c - g.m2) <= 1 ? -0.05 : 0.22;
              v += (hash2(Math.floor((c + lr * 3) / 6), lr) - 0.5) * 0.12 + (lr === 0 ? -0.12 : 0.05);
              k = band(ramps.top, v);
            } else if (lr === 2) k = band(ramps.edge, v + 0.35);
            else if (lr === 3) k = ink.front0;
            else {
              const fade = 1 - (0.55 * (lr - 4)) / Math.max(1, rows - g.counterR - 4);
              k = c % 4 === 0 ? ink.front0 : band(ramps.front, v * fade);
            }
            put(c, r, BLOCK, k);
          }
        }
        // Laptop screen (prompt is painted live).
        for (let r = g.counterR - 3; r < g.counterR; r++) for (let c = g.laptop + 2; c < g.laptop + 7; c++) put(c, r, BLOCK, ink.screen);
      },

      paint(f, t) {
        const g = layout();
        const { cw, ch, cols } = view;
        f.setClip(g.c0 * cw, g.wr0 * ch, g.c1 * cw, g.wr1 * ch);

        // Lane dashes.
        const dashR = g.roadR0 + Math.floor((g.nearCurb - g.roadR0) / 2);
        for (let c = g.c0; c < g.c1; c++) if (c % 6 < 2) f.put(dashR * cols + c, GLYPH, ink.laneMark, night ? 0.55 : 0.95, G('='));

        if (night) {
          // A quarter of the rooms across the street switch on and off slowly;
          // the rest are baked in back().
          for (let k = 0; k < g.windows.length; k++) {
            if (!liveWindow(k)) continue;
            const period = 30 + 60 * hash1(k * 3 + 1);
            const s = hash1(k * 131 + Math.floor((t + hash1(k * 5 + 2) * period) / period) * 977);
            litWindow(f, g.windows[k], s, s > 0.9 ? 0.7 + 0.3 * hash1(k + Math.floor(t * 5) * 31) : 1);
          }
          // Shop windows, the street lamp and their wet-road reflections.
          for (const b of g.buildings) if (b.shop >= 0) f.glow(((b.c0 + b.c1) / 2) * cw, (g.br - 2) * ch, b.W * cw * 0.32, '#ffb860', 0.35);
          f.glow((g.post.c + 0.5) * cw, (g.post.top + 0.5) * ch, 90, '#ffd27a', 0.6);
          const span = g.nearCurb - g.roadR0;
          for (let s = 0; s < g.sources.length; s++) {
            const src = g.sources[s];
            for (let k = 0; k < 5; k++) {
              const seed = s * 97 + k * 13 + Math.floor(t * 4 + k * 0.37) * 7919;
              const c = Math.round(src.c + (hash1(seed) - 0.5) * 2 * src.half);
              const r = g.roadR0 + Math.floor(hash1(seed + 5) * span);
              f.put(r * cols + c, GLYPH, ink.reflWarm, 0.6, G(k % 2 ? '-' : '~'));
            }
          }
        }

        // People on the far sidewalk (umbrellas when it rains).
        for (const w of walkers) {
          const x = g.c0 * cw + w.u * (g.c1 - g.c0) * cw;
          const step = Math.floor(t * 4 + w.u * 10) % 2;
          if (night) f.sprite(WALKER_RAIN, w.legends[step], x - cw, (g.br - 2) * ch);
          else f.sprite(WALKER_DAY, w.legends[step], x, (g.br - 1) * ch);
        }

        for (let pass = 0; pass < 2; pass++) {
          for (const v of traffic) {
            if (v.near !== (pass === 1)) continue;
            // Lane rows come from the layout so a resize never strands a vehicle.
            const y = ((v.near ? g.nearCurb - 1 : g.roadR0 + 1) - v.sprite.length + 1) * ch;
            f.sprite(v.sprite, v.legend, v.x, y, v.dir < 0);
            if (night && v.kind !== 'bike') {
              const hy = y + (v.sprite.length - 2) * ch + ch * 0.5;
              const front = v.dir > 0 ? v.x + v.width : v.x;
              f.glow(front, hy, 64, '#fff1b0', 0.5);
              f.glow(front + v.dir * 20, hy + ch * 2, 44, '#fff1b0', 0.18);
              f.glow(v.dir > 0 ? v.x : v.x + v.width, hy, 28, '#ff3b3b', 0.45);
            }
          }
        }

        if (!night) {
          // A couple of birds over the rooftops.
          for (let k = 0; k < 2; k++) {
            const span = (g.c1 - g.c0) * cw + 200;
            const x = g.c0 * cw - 100 + ((t * (22 + k * 7) + k * 517) % span);
            const y = (g.wr0 + 1.5 + k * 1.3) * ch + Math.sin(t * 1.3 + k) * 5;
            const i = f.at(x, y);
            if (i >= 0) f.put(i, GLYPH, ink.pole, 0.75, G(Math.floor(t * 3 + k) % 2 ? 'v' : '-'));
          }
        } else {
          rain.paint(f, t, ink.rain);
          const x0 = g.c0 * cw;
          const y0 = g.wr0 * ch;
          const W = (g.c1 - g.c0) * cw;
          const H = (g.wr1 - g.wr0) * ch;
          for (const d of drops) {
            const x = x0 + d.u * W;
            const y = y0 + d.v * H;
            const i = f.at(x, y);
            if (i < 0) continue;
            f.put(i, GLYPH, ink.drop, 0.85, G('.'));
            if (d.speed > 0) {
              const j = f.at(x, y - ch);
              if (j >= 0) f.put(j, GLYPH, ink.drop, 0.45, G(':'));
              const k = f.at(x, y - ch * 2);
              if (k >= 0) f.put(k, GLYPH, ink.drop, 0.2, G("'"));
            }
          }
        }
        f.clearClip();

        // Neon OPEN sign hanging in the side light.
        const flick = night ? (hash1(Math.floor(t * 9)) < 0.05 ? 0.3 : 1) : 0.95;
        const n = g.neon;
        for (const k of [1, 4]) f.put((n.r - 1) * cols + n.c + k, GLYPH, ink.pole, 0.8, G(':'));
        f.put(n.r * cols + n.c, GLYPH, ink.neonTube, 0.9, G('('));
        f.put(n.r * cols + n.c + 5, GLYPH, ink.neonTube, 0.9, G(')'));
        f.text(openText, (n.c + 1) * cw, n.r * ch, ink.neon, flick);
        if (night) f.glow((n.c + 3) * cw, (n.r + 0.5) * ch, 85, '#ff5fa8', 0.55 * flick);

        // Steam curling up from the cup.
        for (let k = 0; k < 6; k++) {
          const rise = (t * 0.32 + k / 6) % 1;
          const y = (g.counterR - 2.5) * ch - rise * ch * 4.5;
          const x = (g.cup + 3) * cw + Math.sin(rise * 5 + k * 1.7) * 8;
          const i = f.at(x, y);
          if (i >= 0) f.put(i, GLYPH, ink.steam, (night ? 0.75 : 0.9) * (1 - rise) * Math.min(1, rise * 5), STEAM[k % 4]);
        }

        // Laptop: a few dim lines, a prompt being typed, a blinking cursor.
        const lc = g.laptop + 2;
        const lr = g.counterR - 3;
        for (const k of [0, 1, 3]) f.put(lr * cols + lc + k, GLYPH, ink.screenText, 1, G(k === 3 ? '=' : '-'));
        const typed = Math.floor(t * 2.5) % 9;
        f.put((lr + 1) * cols + lc, GLYPH, ink.prompt, 1, G('>'));
        const len = Math.min(typed, 3);
        for (let k = 0; k < len; k++) f.put((lr + 1) * cols + lc + 1 + k, GLYPH, ink.screenText, 1, G('-'));
        if (t % 1.1 < 0.6 && len < 4) f.put((lr + 1) * cols + lc + 1 + len, GLYPH, ink.prompt, 1, G('_'));
        for (const k of [0, 2]) f.put((lr + 2) * cols + lc + k, GLYPH, ink.screenText, 0.8, G('-'));
        f.glow((g.laptop + 4.5) * cw, (g.counterR - 1.5) * ch, night ? 70 : 40, '#8a93f7', night ? 0.4 : 0.12);

        // Pendant lamps: bulb halo and a warm pool on the counter.
        for (const l of g.lamps) {
          f.glow(l.x, l.y + ch * 0.2, night ? 115 : 70, night ? '#ffc070' : '#fff1c8', night ? 0.65 : 0.4);
        }
      },

      front(f) {
        const g = layout();
        const { cw, ch, cols } = view;
        const X = (c) => (c + 0.5) * cw;
        const Y = (r) => (r + 0.5) * ch;

        // Shop signs.
        for (const b of g.buildings) {
          if (b.name) f.text(b.name, b.signC * cw, (g.br - 6) * ch, b.shop === 3 ? ink.signText2 : ink.signText, 1);
        }

        // Brick walls: two-cell bricks in running bond, lit by the lamps.
        for (let r = g.wr0 - 1; r <= g.wr1 + 1; r++) {
          for (let c = 0; c < cols; c++) {
            if (c >= g.c0 - 1 && c <= g.c1) continue;
            if (r >= g.wr1 && c >= g.c0 - 2 && c <= g.c1 + 1) continue;
            const bc = Math.floor((c + (r % 2)) / 2);
            const v = interior(X(c), Y(r)) * (night ? 0.6 : 1) + (hash2(bc, r) - 0.5) * 0.16;
            f.put(r * cols + c, TILE, band(ramps.brick, v), 1, PLAIN);
          }
        }
        // Mullions and transom (above the traffic and rain).
        for (let r = g.wr0; r < g.wr1; r++) {
          for (const m of [g.m1, g.m2]) f.put(r * cols + m, BLOCK, band(ramps.frame, interior(X(m), Y(r)) + 0.1));
        }
        for (let c = g.c0; c < g.c1; c++) f.put(g.transom * cols + c, BLOCK, band(ramps.frame, interior(X(c), Y(g.transom)) + 0.15));

        // Counter objects, all standing on the second counter row.
        const base = g.counterR + 1;
        f.sprite(CUP, { r: [BLOCK, ink.cup], f: [BLOCK, ink.coffee], c: [BLOCK, ink.cup], C: [BLOCK, ink.cupShade], ')': [GLYPH, ink.cup, 1, G(')')], s: [BLOCK, ink.saucer] }, g.cup * cw, (base - 3) * ch);
        f.sprite(PASTRY, { y: [BLOCK, ink.croissant], Y: [BLOCK, ink.croissantLit], p: [BLOCK, ink.plate] }, g.pastry * cw, (base - 2) * ch);
        // Plant on the right end of the counter.
        const pc = g.plant;
        const pcx = (pc + 0.5) * cw;
        const leaves = [
          [pcx, (base - 4.2) * ch, ch * 1.5],
          [pcx - cw * 2.4, (base - 3.2) * ch, ch * 1.2],
          [pcx + cw * 2.5, (base - 3.4) * ch, ch * 1.15],
          [pcx - cw * 1.1, (base - 6.2) * ch, ch * 1.05],
          [pcx + cw * 1.5, (base - 6.4) * ch, ch * 1.0],
        ];
        for (let r = base - 8; r <= base - 2; r++) {
          for (let c = pc - 5; c <= pc + 5; c++) {
            const x = X(c);
            const y = Y(r);
            let best = 1;
            let v = 0;
            for (const [lx, ly, lr] of leaves) {
              const d = Math.hypot((x - lx) * 1.1, y - ly) / lr;
              if (d < best) {
                best = d;
                v = 0.6 - (0.4 * (x - lx)) / lr - (0.45 * (y - ly)) / lr;
              }
            }
            if (best >= 1) continue;
            if (best > 0.8) v -= 0.25;
            const i = f.at(x, y);
            if (i >= 0) f.put(i, BLOCK, band(ramps.plant, night ? v * 0.55 + lampLight(x, y) * 0.45 : v));
          }
        }
        f.sprite(POT, { R: [BLOCK, ink.pot], p: [BLOCK, ink.pot], P: [BLOCK, ink.potDark] }, (pc - 2) * cw, (base - 2) * ch);
        f.sprite(LAPTOP, { L: [BLOCK, ink.laptop], K: [BLOCK, ink.laptopDark] }, g.laptop * cw, (base - 5) * ch);

        // Pendant lamps hanging in front of the window.
        for (const l of g.lamps) {
          for (let r = 0; r < g.wr0; r++) f.put(r * cols + l.c, GLYPH, ink.cord, 1, G('|'));
          f.sprite(LAMP, { L: [BLOCK, ink.shadeLit], S: [BLOCK, ink.shade], R: [BLOCK, ink.shadeRim], b: [TILE, ink.bulb, 1, PLAIN] }, (l.c - 2) * cw, g.wr0 * ch);
        }
      },
    };
  },
};
