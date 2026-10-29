import { solid, tone } from '../engine/color.js';
import { BLOCK, GLYPH, TILE } from '../engine/field.js';
import { clamp, fbm2, hash1, hash2, noise2, rng, sdCircle, sdSegment, smin, smoothstep } from '../engine/math.js';
import { crisp, starfield } from './kit.js';

// Tile glyphs, addressed by index: plain pane, grass blades, strata line, crack.
const TILE_CHARS = ' "-|';
const PLAIN = 0;
const BLADES = 1;
const STRATA = 2;
const SIGNS = { hero: 'CODEX', side: 'HOTEL', roof: 'BAR', big: 'RAMEN', ticker: ' 24/7 * NEO BAY * RAMEN * HOTEL *' };
const MARKS = "|-=~^v'\",*+.o";
const EXTRA = [...new Set([...Object.values(SIGNS).join('').replace(/ /g, ''), ...MARKS])].join('');

/**
 * A grassy cliff (right) with a lone tree and someone sitting at the edge,
 * overlooking a mega city across the bay. Day: blue sky, green cliff, glassy
 * towers with rooftop gardens. Night: cyberpunk — neon windows and strips,
 * billboards, flying cars, searchlights and reflections in the water.
 *
 * Three tower layers (far haze, mid, near) each sit in their own value band.
 * Near towers are lit from the left (sun top-left by day, city glow by
 * night): lit face, shadow face, roof rims, setbacks and crowns. Detail and
 * signage cluster in the strip between the sidebar and the chat column and
 * on the cliff in the right strip; the centre keeps big calm masses.
 */
export default {
  id: 'overlook',
  name: 'Overlook',
  chars: { tile: TILE_CHARS, halo: ".'", extra: EXTRA },
  shimmer: 1.2,
  palettes: {
    light: {
      bg: {
        stops: [[0, '#3a92dd'], [0.3, '#5eaee9'], [0.55, '#a6d7f4'], [0.635, '#d4eefa'], [0.645, '#aedbf1'], [0.8, '#74b9e3'], [1, '#3f8fcb']],
        spots: [{ x: 0.08, y: 0.05, r: 0.42, color: 'rgba(255, 249, 225, 0.85)' }],
        vignette: 0,
        texture: { color: '#ffffff', alpha: 0.2, chars: '-.', scale: 0.08, threshold: 0.25, density: 0.3, bottom: 0.4 },
      },
      inks: {
        star: solid('#ffffff'),
        cloud: solid('#ffffff'),
        cloudShade: solid('#d2e7f6'),
        bird: solid('#2b4866'),
        beam: solid('#ffffff'),
        ridge: solid('#c6e1f4'),
        farLit: solid('#bddcf2'),
        farShade: solid('#a9cfec'),
        midLit: solid('#acd3ef'),
        midShade: solid('#8bbbe3'),
        glassHi: solid('#d9f0fd'),
        glassLit: solid('#8fc8ef'),
        glassShade: solid('#4a8bca'),
        glassDeep: solid('#346fae'),
        stoneLit: solid('#f7f4ee'),
        stoneShade: solid('#a9bdd3'),
        frame: solid('#264f7c'),
        rim: solid('#ffffff'),
        winDark: solid('#5a8ec2'),
        lit1: solid('#ffffff'),
        lit2: solid('#fff3c9'),
        lit3: solid('#ffd9ea'),
        neonA: solid('#2bb5e0'),
        neonB: solid('#e8558a'),
        garden: solid('#66bd4e'),
        gardenDark: solid('#3d8f3c'),
        beacon: solid('#e6463f'),
        board: solid('#ffffff'),
        signText: solid('#1f5a96'),
        signText2: solid('#d9453a'),
        car: solid('#f6f8fb'),
        trail1: solid('#ffffff'),
        trail2: solid('#ffffff'),
        quay: solid('#5f88b0'),
        waterFar: solid('#d2ecf8'),
        reflLit: solid('#c3e3f5'),
        reflShade: solid('#5e9fd2'),
        glint: solid('#ffffff'),
        rock1: solid('#7b5d6c'),
        rock2: solid('#ad8470'),
        rock3: solid('#d5a679'),
        rock4: solid('#efcd98'),
        rockRim: tone('#f4e1bb', 0.22),
        grassDark: tone('#2f7d3b', 0.2),
        grass: solid('#4ea845'),
        grassLight: tone('#8ad35d', 0.24),
        flower: solid('#fff3a6'),
        leaf1: solid('#1d5a35'),
        leaf2: solid('#2e7f41'),
        leaf3: solid('#4ea54a'),
        leaf4: solid('#8ccf5e'),
        trunk: solid('#56392f'),
        trunkLit: solid('#93694d'),
        person: solid('#e2533c'),
        skin: solid('#f3c49a'),
        pants: solid('#2c3d63'),
        screen: solid('#dcedff'),
      },
      ui: { base: '#cdebf9', sidebar: 'rgba(234, 246, 253, 0.66)', composer: 'rgba(250, 253, 255, 0.86)', accent: '#2a82c4', bubble: 'rgba(42, 130, 196, 0.13)' },
      lane: 0.55,
    },
    dark: {
      bg: {
        stops: [[0, '#04051a'], [0.3, '#0b0a31'], [0.52, '#1f0f4a'], [0.635, '#45166a'], [0.645, '#2a0f4c'], [0.8, '#110a30'], [1, '#05041a']],
        spots: [
          { x: 0.5, y: 0.63, r: 0.45, color: 'rgba(255, 60, 200, 0.2)' },
          { x: 0.2, y: 0.6, r: 0.3, color: 'rgba(40, 200, 255, 0.14)' },
        ],
        vignette: 0.2,
        texture: { color: '#9f8cff', alpha: 0.05, chars: '.', scale: 0.1, threshold: 0.1, density: 0.3, bottom: 0.5 },
      },
      inks: {
        star: solid('#d4dcff'),
        cloud: solid('#1a1342'),
        cloudShade: solid('#5a2280'),
        bird: solid('#2a1250'),
        beam: solid('#a9bcff'),
        ridge: solid('#2b1653'),
        farLit: solid('#2c1d5e'),
        farShade: solid('#21154c'),
        midLit: solid('#20174f'),
        midShade: solid('#150e38'),
        glassHi: solid('#4b46b8'),
        glassLit: solid('#211a58'),
        glassShade: solid('#110b30'),
        glassDeep: solid('#0b0724'),
        stoneLit: solid('#271d55'),
        stoneShade: solid('#120c30'),
        frame: solid('#2a2366'),
        rim: solid('#5a4fd0'),
        winDark: solid('#1d1650'),
        lit1: solid('#ffc35e'),
        lit2: solid('#bfe4ff'),
        lit3: solid('#ff7ad9'),
        neonA: solid('#2fe6ff'),
        neonB: solid('#ff3fc8'),
        garden: solid('#123a44'),
        gardenDark: solid('#0b2230'),
        beacon: solid('#ff3b4e'),
        board: solid('#0a0618'),
        signText: solid('#7dfcff'),
        signText2: solid('#ff7ae6'),
        car: solid('#e6eeff'),
        trail1: solid('#2fd9ff'),
        trail2: solid('#ff3fb8'),
        quay: solid('#0d0922'),
        waterFar: solid('#3a145e'),
        reflLit: solid('#1a1244'),
        reflShade: solid('#0c0828'),
        glint: solid('#8f8cff'),
        rock1: solid('#07050e'),
        rock2: solid('#110c22'),
        rock3: solid('#1d1536'),
        rock4: solid('#30255a'),
        rockRim: tone('#8a3fc0', 0.2),
        grassDark: tone('#08141f', 0.15),
        grass: solid('#10263a'),
        grassLight: tone('#2b5c74', 0.22),
        flower: solid('#7ff6ff'),
        leaf1: solid('#05040d'),
        leaf2: solid('#0d0b25'),
        leaf3: solid('#1b1642'),
        leaf4: solid('#3b307e'),
        trunk: solid('#06040c'),
        trunkLit: solid('#231a46'),
        person: solid('#0a0716'),
        skin: solid('#6fb4d8'),
        pants: solid('#05030c'),
        screen: solid('#8cf6ff'),
      },
      ui: { base: '#13051f', sidebar: 'rgba(17, 6, 32, 0.62)', composer: 'rgba(22, 9, 42, 0.86)', accent: '#ff4fd8', bubble: 'rgba(255, 79, 216, 0.2)' },
      lane: 0.62,
    },
  },

  scene(view) {
    const rand = rng(0x0e71);
    const { ink, night, cw, ch } = view;
    const hex = (name) => view.palette.inks[name].bg;
    const stars = starfield(view, rand, { count: 80, top: 0, bottom: 0.42, glyphs: '.+*', bright: 0.22 });
    const G = {
      dash: view.glyph('-'),
      eq: view.glyph('='),
      pipe: view.glyph('|'),
      tilde: view.glyph('~'),
      up: view.glyph('^'),
      down: view.glyph('v'),
      dot: view.glyph('.'),
      star: view.glyph('*'),
      tufts: [view.glyph("'"), view.glyph('"'), view.glyph(','), view.glyph('v')],
    };
    const signSlots = {};
    for (const [key, text] of Object.entries(SIGNS)) signSlots[key] = view.glyphs(text);

    const rockRamp = [ink.rock1, ink.rock2, ink.rock3, ink.rock4];
    const leafRamp = [ink.leaf1, ink.leaf2, ink.leaf3, ink.leaf4];
    const NEON_HEX = { [ink.neonA]: hex('neonA'), [ink.neonB]: hex('neonB'), [ink.signText]: hex('signText'), [ink.signText2]: hex('signText2'), [ink.lit1]: hex('lit1'), [ink.lit2]: hex('lit2'), [ink.lit3]: hex('lit3') };

    // Layout, rebuilt on resize. The cliff lip sits just right of Codex's chat
    // column so the figure and the tree stay in the visible right strip.
    const L = { towers: [], beacons: [], glows: [], streaks: [], boards: [], flicker: [], sheen: [], beams: [], bands: [], occ: new Uint8Array(1) };
    const top = (x) => L.lip - ((x - L.edge) / Math.max(1, view.w - L.edge)) * view.h * 0.045 + noise2(x / 55, 1.3) * 5;
    const calmAt = (x) => smoothstep(L.colX + 20, L.colX + 140, x) * (1 - smoothstep(L.colEnd - 140, L.colEnd - 20, x));

    const tierAt = (T, rr) => {
      for (const tier of T.tiers) if (tier.top <= rr) return tier;
      return T.tiers[T.tiers.length - 1];
    };
    const faceLit = (T, k, rr) => {
      const tier = tierAt(T, rr);
      return k - tier.a < Math.max(1, Math.round((tier.b - tier.a + 1) * 0.38));
    };
    const isWindow = (T, k, rr) => {
      const tier = tierAt(T, rr);
      const kk = k - tier.a;
      const tw = tier.b - tier.a + 1;
      const fromTop = rr - T.tops[k];
      if (fromTop < 1) return false;
      if (T.style === 'curtain') return true;
      if (T.style === 'bands') return fromTop % 2 === 1;
      if (T.style === 'cols') return kk % 2 === 1 && kk < tw - 1 && fromTop > 1;
      return fromTop % 2 === 1 && kk > 0 && kk < tw - 1;
    };
    // Night: offices lit in runs along a floor, some floors fully lit.
    const windowOn = (T, k, rr) => {
      const floor = T.seed * 131 + rr * 17;
      if (hash1(floor) < 0.07) return true;
      return hash2(floor, Math.floor((k + (rr & 1)) / T.run)) < T.litRatio * (1 - 0.5 * calmAt((T.c0 + k + 0.5) * cw));
    };
    const windowInk = (T, k, rr) => (hash2(T.seed * 131 + rr * 17, Math.floor(k / T.run) + 99) < 0.14 ? T.altInk : T.winInk);

    const build = () => {
      const { w, h, cols, rows } = view;
      const hr = Math.round((h * 0.64) / ch);
      const colW = Math.min(768, w - 338);
      const colX = 290 + (w - 290 - colW) / 2;
      const colEnd = colX + colW;
      const edge = Math.round(clamp(colEnd + 18, w * 0.6, w - 150) / cw) * cw;
      Object.assign(L, { hr, qr: hr - 1, horizon: hr * ch, colX, colEnd, edge, lip: h * 0.55 });
      L.heroX = clamp((290 + colX) / 2, w * 0.17, w * 0.33);
      L.occ = new Uint8Array(cols * rows);
      L.towers = [];
      L.beacons = [];
      L.glows = [];
      L.streaks = [];
      L.boards = [];
      L.flicker = [];
      L.sheen = [];
      L.beams = [];

      // Cliff strata: bands of rock with their own tone and ledge offset.
      const rb = rng(0xc11f);
      L.bands = [];
      let off = cw * 0.9;
      for (let y = L.lip + ch * 1.5; y < h + ch * 6; ) {
        const hp = ch * (2 + Math.floor(rb() * 3));
        const cracks = [];
        for (let k = 0; k < 2; k++) if (rb() < 0.55) cracks.push(Math.floor(rb() * ((w - edge) / cw)) * cw + cw / 2);
        L.bands.push({ y0: y, y1: y + hp, off, tone: (rb() - 0.5) * 0.24, cracks });
        y += hp;
        off = clamp(off + (rb() - 0.5) * cw * 2.4, -cw * 1.2, cw * 1.6);
      }

      // Tree and figure.
      L.tx = Math.round((edge + Math.max((w - edge) * 0.58, cw * 6)) / cw) * cw;
      L.R = clamp(h * 0.072, 44, 70);
      L.pc = Math.round(edge / cw) + 1;
      L.rs = Math.ceil(top((L.pc + 0.5) * cw) / ch - 0.5);

      // City.
      const r = rng(0x5c17);
      const gauss = (x, c, s) => Math.exp(-(((x - c) / s) ** 2));
      // Skyline envelope: a peak at the hero in the visible gap, a calm
      // second cluster mid-screen, and only low-rise by the cliff so the lip,
      // the figure and the tree stand against open sky.
      const fall = (x) => 1 - 0.82 * smoothstep(edge - w * 0.2, edge - w * 0.02, x);
      const env = (x) => (0.13 + 0.3 * gauss(x, L.heroX, w * 0.09) + 0.25 * gauss(x, w * 0.56, w * 0.12) + 0.12 * gauss(x, w * 0.04, w * 0.06)) * fall(x);
      const qr = L.qr;

      const makeTower = (layer, c0, wc, hRows, opt = {}) => {
        const tTop = qr - hRows;
        const T = {
          layer,
          c0,
          wc,
          hRows,
          tiers: [{ a: 0, b: wc - 1, top: tTop }],
          tops: new Int16Array(wc).fill(tTop),
          seed: Math.floor(r() * 1e6),
          extras: [],
          mat: r() < 0.6 ? 'glass' : 'stone',
          winInk: r() < 0.5 ? ink.lit1 : r() < 0.84 ? ink.lit2 : ink.lit3,
          altInk: r() < 0.5 ? ink.lit2 : ink.lit1,
          litRatio: r.range(0.22, 0.42),
          run: 2 + Math.floor(r() * 3),
          neon: -1,
          neonSide: r() < 0.5 ? 'a' : 'b',
          roofNeon: false,
          garden: false,
          crown: 'flat',
          ...opt,
        };
        T.style ??= T.mat === 'glass' ? (r() < 0.55 ? 'curtain' : 'bands') : r() < 0.5 ? 'grid' : 'cols';
        // Setbacks: narrower tiers stacked on wider ones.
        const sets = opt.sets ?? (layer > 0 && hRows > 10 && wc >= 4 ? (r() < 0.55 ? 1 + (r() < 0.4 && wc >= 6 ? 1 : 0) : 0) : 0);
        if (sets) {
          const fr = sets === 1 ? [r.range(0.3, 0.5)] : [0.58, 0.3];
          let a = 0;
          let b = wc - 1;
          T.tiers = [];
          for (let s = 0; s <= sets; s++) {
            T.tiers.push({ a, b, top: s < sets ? tTop + Math.round(hRows * fr[s]) : tTop });
            const mode = Math.floor(r() * 3);
            if (b - a >= 2) {
              if (mode !== 2) a += 1;
              if (mode !== 1) b -= 1;
            }
          }
          T.tops.fill(qr);
          for (const tier of T.tiers) for (let k = tier.a; k <= tier.b; k++) T.tops[k] = Math.min(T.tops[k], tier.top);
        }
        const crownTier = T.tiers[T.tiers.length - 1];
        const mid = Math.floor((crownTier.a + crownTier.b) / 2);
        if (!opt.crown) {
          const roll = r();
          T.crown = hRows > 14 && roll < 0.22 ? 'spire' : roll < 0.45 ? 'antenna' : roll < 0.6 && crownTier.b - crownTier.a >= 2 ? 'slant' : 'flat';
        }
        if (T.crown === 'slant') {
          const dir = r() < 0.5;
          const span = crownTier.b - crownTier.a;
          for (let k = crownTier.a; k <= crownTier.b; k++) T.tops[k] += Math.round(((dir ? k - crownTier.a : crownTier.b - k) / span) * Math.min(3, span));
        } else if (T.crown === 'spire') {
          const n = opt.spire ?? 3 + Math.floor(r() * 4);
          for (let s = 1; s <= n; s++) T.extras.push({ k: mid, r: T.tops[mid] - s, kind: s <= Math.ceil(n * 0.4) ? TILE : GLYPH, ink: ink.frame, glyph: s <= Math.ceil(n * 0.4) ? PLAIN : G.pipe });
          L.beacons.push({ c: c0 + mid, r: T.tops[mid] - n - 1, phase: r() * 3 });
        } else if (T.crown === 'antenna') {
          const n = 2 + Math.floor(r() * 2);
          const k = crownTier.a + Math.floor(r() * (crownTier.b - crownTier.a + 1));
          for (let s = 1; s <= n; s++) T.extras.push({ k, r: T.tops[k] - s, kind: GLYPH, ink: layer === 0 ? ink.farShade : ink.frame, glyph: G.pipe });
          if (layer > 0 && r() < 0.6) L.beacons.push({ c: c0 + k, r: T.tops[k] - n - 1, phase: r() * 3 });
        } else if (layer === 2) {
          T.garden = r() < 0.55;
        }
        if (layer === 2 && night) {
          if (r() < 0.25) T.neon = r() < 0.55 ? ink.neonA : ink.neonB;
          T.roofNeon = r() < 0.15;
        }
        return T;
      };

      const fill = (layer, ca, cb, wMin, wMax, gapP, heightAt) => {
        const list = [];
        let c = ca;
        let prev = 0;
        while (c < cb) {
          let wc = wMin + Math.floor(r() * (wMax - wMin + 1));
          if (cb - (c + wc) < wMin) wc = cb - c;
          if (wc < 2) break;
          let hRows = Math.round((heightAt((c + wc / 2) * cw) * h * r.range(0.72, 1)) / ch);
          if (Math.abs(hRows - prev) < 2) hRows += hRows >= prev ? 2 : -2;
          hRows = Math.max(3, hRows);
          list.push(makeTower(layer, c, wc, hRows));
          prev = hRows;
          c += wc + (r() < gapP ? 1 : 0);
        }
        return list;
      };

      const edgeCol = Math.round(edge / cw);
      const far = fill(0, -2, edgeCol + 4, 2, 4, 0, (x) => (0.07 + 0.06 * (noise2(x / 150, 9) + 1)) * fall(x) + env(x) * 0.25);
      const mid = fill(1, -1, edgeCol + 4, 3, 6, 0.15, (x) => (env(x) * 0.88 + 0.06) * fall(x));
      const heroW = 7;
      const hc0 = Math.round(L.heroX / cw - heroW / 2);
      const hero = makeTower(2, hc0, heroW, Math.round((h * 0.47) / ch), { mat: 'glass', style: 'curtain', crown: 'spire', spire: 5, sets: 2, garden: false, winInk: ink.lit2, altInk: ink.lit1, litRatio: 0.4, neon: night ? ink.neonA : -1, neonSide: 'b', roofNeon: night });
      const left = fill(2, -1, hc0 - 1, 3, 6, 0.3, env);
      const right = fill(2, hc0 + heroW + 1, edgeCol + 3, 4, 7, 0.35, env);
      const near = [...left, hero, ...right];
      L.towers = [...far, ...mid, ...near];

      // Signage: the hero's board and vertical sign sit in the visible gap,
      // a rooftop board on its left neighbour, a big board mid-city, an LED
      // ticker to the right of the hero.
      const heroTier = hero.tiers[0];
      L.boards.push({ slots: signSlots.hero, c: hc0 + 1, r: qr - Math.round(hero.hRows * 0.3), ink: ink.signText2, frame: ink.neonB, seed: 1 });
      L.boards.push({ slots: signSlots.side, c: hc0 - 1, r: heroTier.top - 2, ink: ink.signText, frame: ink.neonA, vertical: true, seed: 5 });
      const lt = left[left.length - 1];
      if (lt && lt.wc >= 3) {
        const len = signSlots.roof.length;
        const c = lt.c0 + Math.floor((lt.wc - len) / 2);
        const roof = Math.min(...lt.tops);
        L.boards.push({ slots: signSlots.roof, c, r: roof - 3, ink: ink.signText, frame: ink.neonA, stilts: roof, seed: 3 });
      }
      const centre = right.reduce((best, T) => (Math.abs((T.c0 + T.wc / 2) * cw - w * 0.56) < Math.abs((best.c0 + best.wc / 2) * cw - w * 0.56) ? T : best), right[0] ?? hero);
      if (centre) {
        const len = signSlots.big.length;
        L.boards.push({ slots: signSlots.big, c: centre.c0 + Math.floor((centre.wc - len) / 2), r: Math.min(...centre.tops) + 3, ink: ink.signText2, frame: ink.neonB, seed: 4 });
        L.beams.push({ x: (centre.c0 + centre.wc / 2) * cw, y: Math.min(...centre.tops) * ch, speed: 0.27, phase: 2.1 });
      }
      L.beams.push({ x: (hc0 + heroW / 2) * cw, y: (Math.min(...hero.tops) - 1) * ch, speed: 0.21, phase: 0 });
      const rt = right[0];
      if (rt) L.ticker = { c: rt.c0, wc: rt.wc, r: Math.min(...rt.tops) + 2, slots: signSlots.ticker };

      // Night glows + reflection streaks for the neon, windows to flicker,
      // day sheen sweeps over the glass in the visible left strip.
      for (const T of near) {
        if (T.neon >= 0) {
          const tier = T.tiers[0];
          const c = T.c0 + (T.neonSide === 'a' ? tier.a : tier.b);
          const r0 = T.tops[c - T.c0] + 1;
          for (let rr = r0 + 1; rr < qr; rr += 3) L.glows.push({ x: (c + 0.5) * cw, y: (rr + 0.5) * ch, r: 22, color: NEON_HEX[T.neon], a: 0.26 });
          L.streaks.push({ c, wc: 1, ink: T.neon, a: 0.7, len: Math.min(12, T.hRows), phase: r() * 6 });
        }
        if (night) {
          let best = -1;
          let bestN = 0;
          for (let k = 0; k < T.wc; k++) {
            let n = 0;
            for (let rr = qr - 8; rr < qr; rr++) if (rr >= T.tops[k] && isWindow(T, k, rr) && windowOn(T, k, rr)) n++;
            if (n > bestN) [best, bestN] = [k, n];
          }
          if (best >= 0 && bestN >= 2) L.streaks.push({ c: T.c0 + best, wc: 1, ink: T.winInk, a: 0.4, len: 7, phase: r() * 6 });
          for (let n = 0; n < 3; n++) {
            const k = Math.floor(r() * T.wc);
            const rr = T.tops[k] + 1 + Math.floor(r() * Math.max(1, qr - T.tops[k] - 1));
            if (rr < qr && isWindow(T, k, rr) && T.c0 + k >= 0) L.flicker.push({ i: rr * cols + T.c0 + k, ink: windowInk(T, k, rr), on: windowOn(T, k, rr), rate: r.range(0.05, 0.2), phase: r() * 10 });
          }
        } else if (T.mat === 'glass' && (T.c0 + T.wc / 2) * cw < colX + 40) {
          const cells = [];
          for (let k = 0; k < T.wc; k++) for (let rr = T.tops[k] + 1; rr < qr; rr++) if (faceLit(T, k, rr) && isWindow(T, k, rr) && T.c0 + k >= 0) cells.push((T.c0 + k) | (rr << 12));
          if (cells.length) L.sheen.push({ cells: Int32Array.from(cells), phase: r() * 9, lo: T.c0 - 2, hi: T.c0 + T.wc + (qr - Math.min(...T.tops)) * 0.6 + 2 });
        }
      }
      for (const b of L.boards) {
        const wide = b.vertical ? 1 : b.slots.length;
        const tall = b.vertical ? b.slots.length : 1;
        L.glows.push({ x: (b.c + wide / 2) * cw, y: (b.r + tall / 2) * ch, r: Math.max(40, wide * cw * 0.9), color: NEON_HEX[b.ink], a: 0.3 });
        L.streaks.push({ c: b.c, wc: wide, ink: b.ink, a: 0.6, len: 10, phase: b.seed * 2 });
      }
    };
    build();

    const clouds = night ? [] : Array.from({ length: 5 }, () => ({ x: rand() * view.w, v: rand.range(0.04, 0.16), w: rand.range(140, 240), speed: rand.range(5, 11), seed: rand() * 50 }));
    const LANES = [0.12, 0.23, 0.33, 0.45];
    const cars = Array.from({ length: night ? 9 : 4 }, (_, k) => {
      const lane = k % LANES.length;
      return { x: rand() * view.w, lane, vx: (lane % 2 ? -1 : 1) * rand.range(50, night ? 140 : 70), trail: k % 2 ? ink.trail1 : ink.trail2 };
    });
    const birds = night ? [] : Array.from({ length: 6 }, (_, k) => ({ x: rand() * view.w, v: rand.range(0.1, 0.36), vx: rand.range(18, 30), phase: k }));
    const flies = Array.from({ length: night ? 8 : 0 }, () => ({ u: rand(), v: rand(), phase: rand() * 6.28, speed: rand.range(0.3, 0.7) }));

    const drawTower = (f, T) => {
      const { cols, rows } = view;
      const occ = L.occ;
      for (let k = 0; k < T.wc; k++) {
        const c = T.c0 + k;
        if (c < 0 || c >= cols) continue;
        const calm = calmAt((c + 0.5) * cw);
        for (let rr = Math.max(0, T.tops[k]); rr < L.qr && rr < rows; rr++) {
          const i = rr * cols + c;
          occ[i] = 1;
          const lit = faceLit(T, k, rr);
          const roof = rr === T.tops[k];
          if (T.layer === 0) {
            if (night && !roof && hash2(c * 7 + 1, rr) < 0.07) f.put(i, TILE, hash1(c + rr * 3) < 0.6 ? ink.lit1 : ink.lit2, 0.3, PLAIN);
            else f.put(i, BLOCK, lit ? ink.farLit : ink.farShade, 1);
            continue;
          }
          if (T.layer === 1) {
            const win = !roof && isWindow(T, k, rr);
            if (night && win && windowOn(T, k, rr) && (k & 1) && hash2(T.seed, rr) < 0.75) f.put(i, TILE, windowInk(T, k, rr), 0.5, PLAIN);
            else if (!night && roof) f.put(i, BLOCK, ink.farLit, 1);
            else if (!night && win && (rr & 1)) f.put(i, TILE, lit ? ink.midLit : ink.midShade, 1, PLAIN);
            else f.put(i, BLOCK, lit ? ink.midLit : ink.midShade, 1);
            continue;
          }
          const neonCol = T.neon >= 0 && k === (T.neonSide === 'a' ? T.tiers[0].a : T.tiers[0].b) && rr > T.tops[k];
          if (neonCol) {
            f.put(i, TILE, T.neon, 0.95, PLAIN);
            continue;
          }
          if (roof) {
            if (T.garden && !night) f.put(i, TILE, hash2(c, rr) < 0.5 ? ink.garden : ink.gardenDark, 1, PLAIN);
            else if (T.garden) f.put(i, BLOCK, ink.garden, 1);
            else if (night && T.roofNeon) f.put(i, TILE, T.neon >= 0 ? T.neon : ink.neonB, 0.9, PLAIN);
            else f.put(i, TILE, ink.rim, night ? 0.75 : lit ? 1 : 0.8, PLAIN);
            continue;
          }
          const win = isWindow(T, k, rr);
          if (night) {
            if (win && windowOn(T, k, rr)) f.put(i, TILE, windowInk(T, k, rr), 0.7 + hash2(c, rr) * 0.3, PLAIN);
            else if (win && T.mat === 'glass') f.put(i, TILE, ink.winDark, 0.9, PLAIN);
            else f.put(i, BLOCK, T.mat === 'glass' ? (lit ? ink.glassLit : ink.glassShade) : lit ? ink.stoneLit : ink.stoneShade, 1);
            continue;
          }
          // Day: flat lit/shadow glass, one crisp diagonal sky reflection per lit face.
          if (win) {
            const sheen = T.mat === 'glass' && lit && calm < 0.5 && (((c + (L.qr - rr) * 0.6 + T.seed) % 9) + 9) % 9 < 1.3;
            f.put(i, TILE, sheen ? ink.glassHi : lit ? ink.glassLit : ink.glassShade, 1, PLAIN);
          } else {
            f.put(i, BLOCK, lit ? ink.stoneLit : ink.stoneShade, 1);
          }
        }
      }
      for (const e of T.extras) {
        const c = T.c0 + e.k;
        if (c < 0 || c >= view.cols || e.r < 0) continue;
        const i = e.r * view.cols + c;
        L.occ[i] = 1;
        f.put(i, e.kind, e.ink, T.layer === 0 ? 0.7 : 1, e.glyph);
      }
      // Rooftop shrubs by day, string lights by night.
      if (T.garden) {
        for (let k = 0; k < T.wc; k++) {
          const c = T.c0 + k;
          const rr = T.tops[k] - 1;
          if (c < 0 || c >= view.cols || rr < 0) continue;
          const i = rr * view.cols + c;
          if (night) {
            if (k % 2 === 0) f.put(i, GLYPH, ink.lit1, 0.8, G.dot);
          } else if (hash2(T.seed, k) < 0.55) {
            L.occ[i] = 1;
            f.put(i, TILE, hash2(k, T.seed) < 0.5 ? ink.garden : ink.gardenDark, 1, PLAIN);
          }
        }
      }
    };

    // Water reflections of the near/mid skyline, broken by ripple rows.
    const drawReflection = (f, T) => {
      const { cols, rows } = view;
      const maxLen = Math.round(((view.h - L.horizon) / ch) * 0.55);
      const len = Math.min(T.hRows, maxLen);
      const a0 = T.layer === 2 ? (night ? 0.85 : 0.6) : night ? 0.6 : 0.4;
      for (let k = 0; k < len; k++) {
        const rr = L.hr + k;
        if (rr >= rows) break;
        const src = L.qr - 1 - k;
        const shift = Math.round(Math.sin(k * 1.7 + (T.seed % 13)) * Math.min(1, 0.3 + k * 0.08));
        const trough = k % 3 === 2 ? 0.45 : 1;
        const a = a0 * (1 - k / len) ** 1.3 * trough;
        for (let kk = 0; kk < T.wc; kk++) {
          if (src < T.tops[kk]) continue;
          const c = T.c0 + kk + shift;
          if (c < 0 || c >= cols) continue;
          const i = rr * cols + c;
          f.put(i, BLOCK, faceLit(T, kk, src) ? ink.reflLit : ink.reflShade, a);
        }
      }
    };

    const putBoardText = (f, b, alpha) => {
      const { cols, rows } = view;
      const put = (c, rr, kind, inkId, a, glyph) => {
        if (c < 0 || c >= cols || rr < 0 || rr >= rows) return;
        f.put(rr * cols + c, kind, inkId, a, glyph);
      };
      if (b.vertical) {
        for (let k = 0; k < b.slots.length; k++) if (b.slots[k] >= 0) put(b.c, b.r + k, GLYPH, b.ink, alpha, b.slots[k]);
        put(b.c, b.r - 1, GLYPH, b.frame, alpha * 0.9, G.eq);
        put(b.c, b.r + b.slots.length, GLYPH, b.frame, alpha * 0.9, G.eq);
        return;
      }
      for (let k = 0; k < b.slots.length; k++) if (b.slots[k] >= 0) put(b.c + k, b.r, GLYPH, b.ink, alpha, b.slots[k]);
      for (let k = -1; k <= b.slots.length; k++) {
        put(b.c + k, b.r - 1, GLYPH, b.frame, alpha * 0.85, G.dash);
        put(b.c + k, b.r + 1, GLYPH, b.frame, alpha * 0.85, G.dash);
      }
    };

    return {
      resize(sx) {
        build();
        for (const c of clouds) c.x *= sx;
        for (const c of cars) c.x *= sx;
        for (const b of birds) b.x *= sx;
      },

      update(dt) {
        for (const c of clouds) {
          c.x += c.speed * dt;
          if (c.x - c.w > view.w) c.x = -c.w;
        }
        for (const c of cars) {
          c.x += c.vx * dt;
          if (c.x < -160) c.x = view.w + 140;
          if (c.x > view.w + 160) c.x = -140;
        }
        for (const b of birds) {
          b.x += b.vx * dt;
          if (b.x > view.w + 30) b.x = -30;
        }
      },

      back(f) {
        const { h, cols, rows } = view;
        L.occ.fill(0);
        const occ = L.occ;
        // Distant hills across the bay, barely darker than the haze.
        f.each(0, L.horizon - h * 0.3, L.edge + cw * 6, L.horizon - 1, (x, y, i) => {
          if (y > L.horizon - h * (0.07 + (fbm2(x / 300, 3.7) + 0.5) * 0.1)) {
            f.put(i, BLOCK, ink.ridge, 1);
            occ[i] = 1;
          }
        });
        for (const T of L.towers) drawTower(f, T);

        // Waterfront: a crisp quay line, then the bright far water.
        const lastCol = Math.min(cols - 1, Math.ceil(L.edge / cw) + 6);
        for (let c = 0; c <= lastCol; c++) {
          const iq = L.qr * cols + c;
          f.put(iq, BLOCK, ink.quay, 1);
          occ[iq] = 1;
          if (L.hr < rows) f.put(L.hr * cols + c, BLOCK, ink.waterFar, night ? 0.7 : 0.85);
        }
        for (const T of L.towers) if (T.layer > 0) drawReflection(f, T);

        // Billboard backings (text and frames are painted live so they can flicker).
        for (const b of L.boards) {
          const wide = b.vertical ? 1 : b.slots.length;
          const tall = b.vertical ? b.slots.length : 1;
          for (let rr = b.r - 1; rr <= b.r + tall; rr++) {
            for (let c = b.c - 1; c <= b.c + wide; c++) {
              if (c < 0 || c >= cols || rr < 0 || rr >= rows) continue;
              f.put(rr * cols + c, BLOCK, ink.board, night ? 0.92 : 1);
              occ[rr * cols + c] = 1;
            }
          }
          if (b.stilts) {
            for (let rr = b.r + 2; rr < b.stilts; rr++) {
              for (const c of [b.c, b.c + wide - 1]) if (c >= 0 && c < cols) f.put(rr * cols + c, GLYPH, ink.frame, 1, G.pipe);
            }
          }
        }
        if (L.ticker) {
          const { c: c0, wc, r: rr } = L.ticker;
          for (let c = c0; c < c0 + wc; c++) if (c >= 0 && c < cols && rr >= 0) f.put(rr * cols + c, BLOCK, ink.board, 0.95);
        }
      },

      paint(f, t) {
        const { w, h, cols, rows } = view;
        const occ = L.occ;
        if (night) {
          stars.paint(f, t, ink.star);
          // Searchlights sweeping up from the towers, behind the skyline.
          for (const b of L.beams) {
            const ang = -Math.PI / 2 + Math.sin(t * b.speed + b.phase) * 0.5;
            const dx = Math.cos(ang);
            const dy = Math.sin(ang);
            const len = h * 0.55;
            const ex = b.x + dx * len;
            const ey = b.y + dy * len;
            const hwEnd = 10 + len * 0.11;
            f.each(Math.min(b.x, ex) - hwEnd, Math.min(b.y, ey) - hwEnd, Math.max(b.x, ex) + hwEnd, b.y, (x, y, i) => {
              if (occ[i]) return;
              const px = x - b.x;
              const py = y - b.y;
              const d = px * dx + py * dy;
              if (d < 0 || d > len) return;
              const s = Math.abs(py * dx - px * dy);
              const hw = 10 + d * 0.11;
              if (s > hw) return;
              f.put(i, BLOCK, ink.beam, 0.13 * (1 - d / len) * (1 - (s / hw) ** 2));
            });
            f.glow(b.x, b.y, 30, hex('beam'), 0.35);
          }
        }

        for (const c of clouds) {
          const cy = c.v * h;
          const base = cy + c.w * 0.09;
          f.each(c.x - c.w * 0.62, cy - c.w * 0.36, c.x + c.w * 0.62, base, (x, y, i) => {
            if (occ[i]) return;
            let d = sdCircle(x, y, c.x, cy, c.w * 0.2);
            d = smin(d, sdCircle(x, y, c.x - c.w * 0.26, cy + c.w * 0.05, c.w * 0.14), 16);
            d = smin(d, sdCircle(x, y, c.x + c.w * 0.27, cy + c.w * 0.06, c.w * 0.13), 16);
            d = smin(d, sdCircle(x, y, c.x + c.w * 0.05, cy - c.w * 0.13, c.w * 0.15), 16);
            d = Math.max(d, y - base) + noise2(x / 26 + c.seed, y / 18 + t * 0.1) * 4;
            if (d >= 0) return;
            const col = Math.floor(x / cw);
            const row = Math.floor(y / ch);
            f.put(i, TILE, crisp([ink.cloudShade, ink.cloud], 0.3 + (base - y) / (c.w * 0.3) + (c.x - x) / (c.w * 1.4), col, row, 0.3), 0.95, PLAIN);
          });
        }

        // Water: drifting ripple glints and, at night, wavering neon streaks.
        const waterRows = rows - L.hr;
        const xEnd = L.edge;
        for (let k = 1; k < waterRows; k++) {
          const rr = L.hr + k;
          const persp = k / waterRows;
          const n = 2 + Math.floor(persp * 3);
          for (let m = 0; m < n; m++) {
            const seed = rr * 31 + m * 7;
            const speed = (hash1(seed) - 0.5) * 16;
            const span = xEnd + 120;
            let x = (hash1(seed + 3) * span + t * speed) % span;
            if (x < 0) x += span;
            const segs = 1 + Math.floor(persp * 3 * hash1(seed + 5));
            const a = (night ? 0.28 : 0.6) * (0.4 + 0.6 * Math.max(0, Math.sin(t * 0.7 + hash1(seed + 9) * 6.28)));
            for (let s = 0; s < segs; s++) {
              const c = Math.floor((x - 60) / cw) + s;
              if (c < 0 || c * cw > xEnd) continue;
              f.put(rr * cols + c, GLYPH, ink.glint, a, (seed + s) % 3 ? G.dash : G.tilde);
            }
          }
        }
        if (night) {
          for (const s of L.streaks) {
            for (let k = 0; k < s.len; k++) {
              const rr = L.hr + k;
              if (rr >= rows) break;
              const wob = Math.round(Math.sin(t * 1.6 + k * 0.9 + s.phase) * (0.3 + k * 0.08));
              const a = s.a * (1 - k / s.len) * (0.6 + 0.4 * Math.sin(t * 2.3 + k * 1.7 + s.phase));
              for (let j = 0; j < s.wc; j++) {
                const c = s.c + j + wob;
                if (c >= 0 && c < cols && c * cw < xEnd) f.put(rr * cols + c, GLYPH, s.ink, a, k & 1 ? G.dash : G.eq);
              }
            }
          }
          for (const g of L.glows) f.glow(g.x, g.y, g.r, g.color, g.a);
          // Waterfront lamps along the quay.
          const quay = L.qr * cols;
          for (let c = 1; c * cw < L.edge; c += 3) if (hash1(c * 7) < 0.6) f.put(quay + c, GLYPH, hash1(c) < 0.6 ? ink.lit1 : ink.lit2, 0.6 + 0.3 * Math.sin(t * 1.3 + c), G.dot);
          for (const fl of L.flicker) {
            const on = Math.sin(t * fl.rate * 6.28 + fl.phase) > (fl.on ? -0.6 : 0.4);
            f.put(fl.i, TILE, on ? fl.ink : ink.winDark, on ? 0.95 : 0.9, PLAIN);
          }
        } else {
          // A sun sheen sliding across the glass towers now and then.
          for (const s of L.sheen) {
            const cycle = (t * 0.11 + s.phase / 9) % 1;
            const pos = s.lo + (s.hi - s.lo) * (cycle / 0.35);
            if (cycle > 0.35) continue;
            for (let k = 0; k < s.cells.length; k++) {
              const c = s.cells[k] & 4095;
              const rr = s.cells[k] >> 12;
              const u = Math.abs(c + (L.qr - rr) * 0.6 - pos);
              if (u < 1.3) f.put(rr * cols + c, TILE, ink.glassHi, 0.95 * (1 - u / 1.3), PLAIN);
            }
          }
        }

        // Signs: steady by day, neon with the odd flicker by night.
        for (const b of L.boards) {
          const flick = night && hash1(Math.floor(t * 8) + b.seed * 977) < 0.03 ? 0.3 : 1;
          putBoardText(f, b, (night ? 1 : 0.95) * flick);
        }
        if (L.ticker) {
          const { c: c0, wc, r: rr, slots } = L.ticker;
          const off = Math.floor(t * 3);
          for (let k = 0; k < wc; k++) {
            const g = slots[(off + k) % slots.length];
            const c = c0 + k;
            if (g >= 0 && c >= 0 && c < cols && rr >= 0) f.put(rr * cols + c, GLYPH, night ? ink.lit1 : ink.signText2, night ? 0.95 : 0.85, g);
          }
        }
        for (const b of L.beacons) {
          if (b.r < 0 || b.c < 0 || b.c >= cols || (t + b.phase) % 1.8 > 0.5) continue;
          f.put(b.r * cols + b.c, GLYPH, ink.beacon, 1, G.star);
          if (night) f.glow((b.c + 0.5) * cw, (b.r + 0.5) * ch, 16, hex('beacon'), 0.5);
        }

        for (const c of cars) {
          const y = LANES[c.lane] * h;
          const dir = Math.sign(c.vx);
          const body = night ? 2 : 1;
          for (let k = 0; k < body; k++) {
            const i = f.at(c.x - dir * k * cw, y);
            if (i >= 0) f.put(i, TILE, ink.car, 1, PLAIN);
          }
          const tail = night ? 8 : 5;
          for (let k = 0; k < tail; k++) {
            const i = f.at(c.x - dir * (k + body) * cw, y);
            if (i >= 0) f.put(i, GLYPH, c.trail, (night ? 0.85 : 0.45) * (1 - k / tail), k === 0 && night ? G.eq : G.dash);
          }
          if (night) f.glow(c.x, y, 24, c.trail === ink.trail1 ? hex('trail1') : hex('trail2'), 0.4);
        }
        for (const b of birds) {
          const i = f.at(b.x, b.v * h + Math.sin(t + b.phase) * 6);
          if (i >= 0) f.put(i, GLYPH, ink.bird, 0.8, Math.floor(t * 3 + b.phase) % 2 ? G.up : G.down);
        }

        if (night) {
          // Fireflies around the tree, and the laptop's glow.
          for (const fl of flies) {
            const x = L.edge + cw + fl.u * (w - L.edge - cw) + Math.sin(t * fl.speed + fl.phase) * 18;
            const y = top(L.edge + fl.u * (w - L.edge)) - ch * (0.8 + fl.v * 3.5) + Math.sin(t * fl.speed * 1.4 + fl.phase * 2) * 8;
            const a = 0.5 + 0.5 * Math.sin(t * 2 + fl.phase * 3);
            const i = f.at(x, y);
            if (i >= 0 && a > 0.15) f.put(i, GLYPH, ink.lit1, a, G.dot);
          }
          f.glow((L.pc - 0.5) * cw, (L.rs - 1.5) * ch, 46, hex('screen'), 0.55);
        }
      },

      front(f) {
        const { w, h } = view;
        const { edge, lip, bands, tx, R } = L;
        const bandOf = (yb) => {
          let b = 0;
          while (b < bands.length - 1 && yb >= bands[b].y1) b++;
          return b;
        };
        const faceX = (b) => edge + bands[b].off - (bands[b].y0 - lip) * 0.05;
        const shadowAt = (x) => clamp(1 - Math.abs(x - (tx + R * 0.5)) / (R * 1.4), 0, 1);

        f.each(edge - cw * 4, lip - h * 0.08, w, h, (x, y, i) => {
          const c = Math.floor(x / cw);
          const r = Math.floor(y / ch);
          const s = top(x);
          if (x < edge) {
            // Only rock can reach left of the lip (protruding strata).
            if (y < s + ch * 2) return;
          }
          if (y < s) {
            // Tufts and flowers along the grass line.
            if (y > s - ch && x >= edge) {
              const clump = 0.12 + 0.3 * Math.max(0, noise2(x / 50, 4.2));
              if (hash1(i * 5 + 1) < 0.08) f.put(i, GLYPH, ink.flower, night ? 0.6 : 0.95, hash1(i) < 0.5 ? G.star : G.dot);
              else if (hash1(i) < clump) f.put(i, GLYPH, hash1(i * 3) < 0.5 ? ink.grassLight : ink.grass, night ? 0.8 : 1, G.tufts[Math.floor(hash1(i * 7) * 4)]);
            }
            return;
          }
          const depth = y - s;
          const sh = shadowAt(x);
          if (depth < ch && x >= edge) {
            f.put(i, TILE, crisp([ink.grass, ink.grassLight], 0.8 - sh * 0.9, c, r, 0.3), 1, BLADES);
            return;
          }
          if (depth < ch * 2 && x >= edge) {
            f.put(i, BLOCK, crisp([ink.grassDark, ink.grass], 0.55 - sh * 0.6, c, r, 0.3), 1);
            return;
          }
          const yb = y - (s - lip) * 0.7;
          const b = bandOf(yb);
          const band = bands[b];
          const fx = faceX(b);
          if (x < fx) return;
          const dxFace = x - fx;
          const bt = yb - band.y0;
          const prev = bands[b - 1];
          if (prev && bt < ch && band.off < prev.off - cw * 0.3 && x < faceX(b - 1) + cw * 1.5) {
            f.put(i, TILE, ink.rockRim, 1, STRATA);
            return;
          }
          if (night && dxFace < cw) {
            // City glow catching the face that looks at the bay.
            f.put(i, TILE, ink.rockRim, 0.65 * (1 - clamp((y - lip) / (h - lip), 0, 1)) + 0.1, PLAIN);
            return;
          }
          // Sun from the upper left: warm lit face toward the bay, cooler
          // and darker deeper down; ledge tops catch light, overhangs shade.
          let v = 0.66 + band.tone * 0.6;
          v += 0.16 * clamp(1 - dxFace / (cw * 2.5), 0, 1);
          v -= 0.16 * clamp((y - lip) / (h - lip), 0, 1);
          v -= 0.08 * ((x - edge) / Math.max(1, w - edge));
          v += fbm2(x / 64, yb / 26) * 0.1;
          if (depth < ch * 3) v -= 0.3;
          if (bt < ch) v += prev && band.off > prev.off + cw * 0.3 ? -0.36 : 0.16;
          if (band.y1 - yb < ch) v -= 0.22;
          for (const cx of band.cracks) {
            const d = x - (edge + cx);
            if (bt >= ch && band.y1 - yb >= ch && Math.abs(d) < cw / 2) v = 0;
            else if (bt >= ch && d >= cw / 2 && d < cw * 1.5) v += 0.1;
          }
          // By night the rock is a calm silhouette: same strata, compressed range.
          if (night) v = 0.36 + (v - 0.6) * 0.65;
          f.put(i, BLOCK, crisp(rockRamp, v, c, r, 0.22), 1);
        });

        // The lone tree: clumped canopy lit from the upper left.
        const base = top(tx);
        const crownY = base - R * 2.3;
        const clumps = [
          [-0.15, -2.45, 0.95, 0.1],
          [-1.05, -1.8, 0.66, 0.06],
          [0.95, -1.9, 0.68, 0.04],
          [-0.55, -3.05, 0.6, 0],
          [0.45, -2.95, 0.62, 0],
          [-0.45, -1.45, 0.6, 0],
          [0.5, -1.5, 0.58, -0.04],
          [0.05, -2.1, 0.68, 0],
        ].map(([cx, cy, cr, lift]) => ({ x: tx + cx * R, y: base + cy * R, r: cr * R, lift }));
        f.each(tx - R * 2, base - R * 3.9, tx + R * 2, base, (x, y, i) => {
          const c = Math.floor(x / cw);
          const r = Math.floor(y / ch);
          const wob = noise2(x / 14, y / 14) * 7;
          let hit = null;
          for (const cl of clumps) if (sdCircle(x, y, cl.x, cl.y, cl.r) + wob < 0) hit = cl;
          if (hit) {
            const nx = (x - hit.x) / hit.r;
            const ny = (y - hit.y) / hit.r;
            let v = 0.48 - 0.3 * (nx * 0.6 + ny * 0.8) + hit.lift;
            v -= ((x - tx) / R) * 0.12 + ((y - crownY) / R) * 0.16;
            f.put(i, TILE, crisp(leafRamp, v, c, r, 0.3), 1, PLAIN);
            return;
          }
          const up = clamp((base - y) / (R * 1.8), 0, 1);
          const axis = tx - R * 0.12 * up;
          const flare = cw * (0.55 + 1.05 * clamp((y - (base - ch * 1.2)) / (ch * 1.2), 0, 1));
          const trunk = sdSegment(x, y, tx, base, tx - R * 0.12, base - R * 1.8, flare);
          const branch = Math.min(sdSegment(x, y, axis, base - R * 1.2, tx - R * 0.85, base - R * 1.75, cw * 0.4), sdSegment(x, y, axis, base - R * 1.35, tx + R * 0.8, base - R * 1.95, cw * 0.4));
          if (Math.min(trunk, branch) < 0) f.put(i, TILE, x < axis ? ink.trunkLit : ink.trunk, 1, PLAIN);
        });

        // Someone sitting at the lip, legs over the edge, laptop on their knees.
        f.sprite(
          ['..h', '.sb', '.pp', 'p..'],
          { h: [TILE, ink.skin, 1, PLAIN], b: [TILE, ink.person, 1, PLAIN], s: [TILE, ink.screen, 1, PLAIN], p: [TILE, ink.pants, 1, PLAIN] },
          (L.pc - 2) * cw,
          (L.rs - 3) * ch,
        );
      },
    };
  },
};
