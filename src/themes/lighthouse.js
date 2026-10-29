import { solid, tone } from '../engine/color.js';
import { BLOCK, GLYPH, TILE } from '../engine/field.js';
import { TAU, bayer, clamp, hash1, hash2, noise2, rng, sdCircle, smoothstep } from '../engine/math.js';
import { shade, starfield } from './kit.js';

const TILE_CHARS = 't%S;:#*';
const SAILBOAT = ['...m...', '..sm...', '.ssmS..', 'sssmSS.', 'hhhhhhh', '.HHHHH.'];

/**
 * A striped lighthouse on a grassy headland, a keeper's cottage beside it,
 * open sea to the horizon. Day: a sailboat crossing, gulls wheeling, sun
 * glitter. Night: the lamp's beam sweeping the sky, ship lights, moonlight.
 *
 * Light comes from the upper left (sun by day, moon by night): the cliff's
 * left faces and every ledge top catch it, the far side falls into shadow.
 * The headland, tower and cottage sit in the visible right strip and are
 * baked into the front layer so the beam and the sea animate behind them.
 */
export default {
  id: 'lighthouse',
  name: 'Lighthouse',
  chars: { tile: TILE_CHARS, halo: "'.:;o", extra: '|~-v^+*,' },
  shimmer: 1.1,
  palettes: {
    light: {
      bg: {
        stops: [[0, '#4ea6e6'], [0.3, '#7fc4f0'], [0.52, '#c4e7f8'], [0.6, '#e9f7fc'], [1, '#bfe0ef']],
        spots: [{ x: 0.24, y: 0.14, r: 0.22, color: 'rgba(255, 255, 246, 0.7)' }],
        vignette: 0,
        texture: { color: '#ffffff', alpha: 0.3, chars: '-.', scale: 0.08, threshold: 0.2, density: 0.4, bottom: 0.45 },
      },
      inks: {
        seaFar: solid('#a4dbf1'),
        sea1: solid('#72c2e8'),
        sea2: solid('#4aa6da'),
        sea3: solid('#2f8bc6'),
        seaDeep: solid('#2272b0'),
        shallow: solid('#45c2c6'),
        swell: solid('#c8ecfb'),
        wave: solid('#ffffff'),
        foam: tone('#ffffff', 0.05),
        glint: solid('#ffffff'),
        island: solid('#93c4df'),
        islandLit: solid('#b2d8ec'),
        rock0: solid('#4a4a64'),
        rock1: solid('#726f86'),
        rock2: solid('#a08f7c'),
        rock3: solid('#c9ae87'),
        rock4: solid('#efd8ac'),
        grassDark: solid('#3a8443'),
        grass: tone('#5daa4c', 0.14),
        grassLit: tone('#8fd064', 0.14),
        tuft: solid('#4f9f45'),
        path: tone('#e6d29e', 0.08),
        flower: { bg: '#5daa4c', fg: '#fff6b0', halo: '#fff6b0' },
        whiteLit: tone('#ffffff', 0.06),
        white: tone('#e6e4e2', 0.07),
        whiteShade: tone('#b4b8cb', 0.08),
        redLit: tone('#f0604a', 0.12),
        red: tone('#cd3a34', 0.12),
        redShade: tone('#8c2833', 0.12),
        plinth: solid('#a9a296'),
        door: solid('#45363a'),
        rail: tone('#2c303d', 0.16),
        lamp: tone('#cdeaf8', 0.1),
        lampCore: tone('#ffffff', 0.06),
        dome: tone('#2c303d', 0.1),
        domeLit: tone('#5c6478', 0.1),
        roofLit: tone('#d6623f', 0.12),
        roofShade: tone('#8f3a32', 0.12),
        wallLit: tone('#f7eedb', 0.08),
        wall: tone('#c9bfb3', 0.08),
        window: tone('#6fb6e0', 0.14),
        chimney: tone('#8a7c74', 0.1),
        smoke: solid('#ffffff'),
        sail: tone('#ffffff', 0.06),
        jib: tone('#fff0d2', 0.08),
        hull: tone('#b9532d', 0.12),
        hullShade: solid('#7c3620'),
        mast: solid('#5a4a3a'),
        gull: solid('#34404f'),
        buoy: tone('#e2463c', 0.12),
        buoyBand: tone('#f8f5ef', 0.08),
        buoyLight: solid('#ffe79a'),
        beam: solid('#fff3c4'),
        star: solid('#ffffff'),
        sun: tone('#fffbe8', 0.05),
        moon: tone('#fff6dc', 0.08),
        moonShade: tone('#e2d9c2', 0.08),
        shipHull: solid('#24324a'),
        shipLight: solid('#ffd27a'),
        shipRed: solid('#ff5a5a'),
      },
      ui: { base: '#cde9f6', sidebar: 'rgba(234, 246, 252, 0.66)', composer: 'rgba(250, 253, 255, 0.86)', accent: '#2a7fc0', bubble: 'rgba(42, 127, 192, 0.13)' },
      lane: 0.55,
    },
    dark: {
      bg: {
        stops: [[0, '#030716'], [0.32, '#0a1533'], [0.52, '#172b58'], [0.6, '#20386a'], [1, '#071226']],
        spots: [{ x: 0.25, y: 0.3, r: 0.3, color: 'rgba(150, 175, 255, 0.16)' }, { x: 0.25, y: 0.3, r: 0.11, color: 'rgba(198, 212, 255, 0.22)' }],
        vignette: 0.25,
        texture: null,
      },
      inks: {
        seaFar: solid('#1e3a6a'),
        sea1: solid('#152b52'),
        sea2: solid('#0f2142'),
        sea3: solid('#0b1834'),
        seaDeep: solid('#081228'),
        shallow: solid('#113a52'),
        swell: solid('#3a5f96'),
        wave: solid('#89acdc'),
        foam: tone('#cfe0f8', 0.06),
        glint: solid('#eef3ff'),
        island: solid('#0c1830'),
        islandLit: solid('#17294b'),
        rock0: solid('#070a17'),
        rock1: solid('#0e1429'),
        rock2: solid('#17203a'),
        rock3: solid('#28385e'),
        rock4: solid('#435b8c'),
        grassDark: solid('#0a1a1d'),
        grass: tone('#113026', 0.07),
        grassLit: tone('#1d4c3d', 0.07),
        tuft: solid('#1a4437'),
        path: tone('#3a4560', 0.08),
        flower: { bg: '#113026', fg: '#7d9cc8', halo: '#7d9cc8' },
        whiteLit: tone('#a3b4da', 0.08),
        white: tone('#5c6a90', 0.08),
        whiteShade: tone('#2a3252', 0.08),
        redLit: tone('#a8414f', 0.12),
        red: tone('#71283b', 0.12),
        redShade: tone('#3a182a', 0.12),
        plinth: solid('#2a3150'),
        door: solid('#080a12'),
        rail: tone('#131726', 0.14),
        lamp: tone('#ffd978', 0.16),
        lampCore: tone('#fff6d6', 0.1),
        dome: tone('#141a2b', 0.1),
        domeLit: tone('#33405f', 0.1),
        roofLit: tone('#434c70', 0.1),
        roofShade: tone('#1d2139', 0.1),
        wallLit: tone('#56628a', 0.08),
        wall: tone('#2c3554', 0.08),
        window: tone('#ffcd66', 0.14),
        chimney: tone('#272e48', 0.1),
        smoke: solid('#8d9dc6'),
        sail: tone('#2a3040', 0.08),
        jib: tone('#2a3040', 0.08),
        hull: tone('#2a1a18', 0.1),
        hullShade: solid('#140c0c'),
        mast: solid('#1a1a22'),
        gull: solid('#1a2a3a'),
        buoy: tone('#6a2630', 0.12),
        buoyBand: tone('#3e4a68', 0.08),
        buoyLight: solid('#7dffb4'),
        beam: solid('#ffe9a8'),
        star: solid('#e2e9ff'),
        sun: tone('#f6f1de', 0.08),
        moon: tone('#f8f3e0', 0.06),
        moonShade: tone('#dcd8c8', 0.06),
        shipHull: solid('#050913'),
        shipLight: solid('#ffd27a'),
        shipRed: solid('#ff5050'),
      },
      ui: { base: '#0a1631', sidebar: 'rgba(6, 12, 30, 0.62)', composer: 'rgba(9, 18, 40, 0.86)', accent: '#ffd27a', bubble: 'rgba(255, 210, 122, 0.18)' },
      lane: 0.62,
    },
  },

  scene(view) {
    const rand = rng(0x11e7);
    const { ink, night } = view;
    const stars = starfield(view, rand, { count: 110, top: 0, bottom: 0.56, glyphs: '.+*', bright: 0.3 });
    const slot = {
      wave: view.glyph('~'),
      dash: view.glyph('-'),
      up: view.glyph('^'),
      down: view.glyph('v'),
      dot: view.glyph('.'),
      tick: view.glyph("'"),
      comma: view.glyph(','),
      bar: view.glyph('|'),
      plus: view.glyph('+'),
      star: view.glyph('*'),
      ring: view.glyph('o'),
    };
    const tileSlot = (char) => TILE_CHARS.indexOf(char);
    const rockRamp = [ink.rock0, ink.rock1, ink.rock2, ink.rock3, ink.rock4];
    const seaRamp = [ink.seaDeep, ink.sea3, ink.sea2, ink.sea1, ink.seaFar];
    const grassRamp = [ink.grassDark, ink.grass, ink.grassLit];

    // Layout in whole cells so the architecture stays crisp; rebuilt when the view resizes.
    let L = null;
    const layout = () => {
      if (L && L.w === view.w && L.h === view.h) return L;
      const { cw, ch, cols, rows } = view;
      const hr = Math.round((view.h * 0.6) / ch); // first sea row
      const gr = Math.round((view.h * 0.5) / ch); // plateau surface row
      const lc = Math.floor((view.w * 0.885) / cw); // tower centre column
      const cTop = Math.round((view.w * 0.775) / cw); // cliff lip column
      const towerRows = clamp(Math.round((view.h * 0.3) / ch), 10, 20);
      const bt = gr - towerRows; // top row of the tower body
      const cc0 = lc + 4; // cottage left column (eave)

      // Rock strata: bands 2-4 rows tall, tilted and gently warped.
      const n = rows + cols * 2 + 16;
      const band = new Int16Array(n);
      const pos = new Int8Array(n);
      const height = new Int8Array(n);
      for (let s = 0, k = 0; s < n; k++) {
        const hgt = 2 + Math.floor(hash1(k * 13 + 5) * 3);
        for (let q = 0; q < hgt && s < n; q++, s++) {
          band[s] = k;
          pos[s] = q;
          height[s] = hgt;
        }
      }
      const strata = (c, r) => clamp(r + cols - Math.round((c - cTop) * 0.09 + noise2(c / 13, 4.2) * 1.2), 0, n - 1);

      // Cliff face: first rock column per row, stepping out ledge by ledge toward the sea.
      const edge = new Int16Array(rows).fill(cols + 1);
      for (let r = gr; r < rows; r++) {
        const k = band[strata(cTop, r)];
        let e = cTop - (r - gr) * 0.32 + (hash1(k * 7 + 1) - 0.5) * 3.4 + noise2(r / 3.5, 1.7) * 1.1;
        if (r === gr) e += 2.4;
        else if (r === gr + 1) e += 1;
        edge[r] = Math.round(e);
      }

      // Foreground rocks in the left gap, two lumps.
      const bottom = Math.floor((view.h - 1) / ch);
      const rockA = (view.w * 0.232) / cw;
      const rockB = (view.w * 0.262) / cw;
      const rockTop = new Int16Array(cols).fill(rows + 1);
      for (let c = 0; c < cols; c++) {
        const hA = 5 - Math.abs(c + 0.5 - rockA) * 0.9;
        const hB = 2.8 - Math.abs(c + 0.5 - rockB) * 0.9;
        const hgt = Math.round(Math.max(hA, hB) + noise2(c / 2.5, 6.1) * 0.6);
        if (hgt > 0) rockTop[c] = bottom - hgt + 1;
      }

      L = {
        w: view.w,
        h: view.h,
        hr,
        gr,
        lc,
        cTop,
        towerRows,
        bt,
        cc0,
        band,
        pos,
        height,
        strata,
        edge,
        rockTop,
        lx: (lc + 0.5) * cw,
        lampY: (bt - 3) * ch,
        sunX: view.w * 0.245,
        sunY: view.h * 0.14,
        moonX: view.w * 0.25,
        moonY: view.h * 0.3,
        buoyC: Math.round((view.w * 0.3) / cw),
        buoyR: Math.round((view.h * 0.74) / ch),
      };
      return L;
    };

    const sailboat = { x: view.w * 0.2, speed: 9 };
    const gulls = night
      ? []
      : Array.from({ length: 5 }, (_, k) => ({
          home: k < 3 ? 'tower' : 'left',
          r: rand.range(36, 90),
          speed: rand.range(0.3, 0.55) * (rand() < 0.5 ? -1 : 1),
          phase: rand() * TAU,
          dy: rand.range(-24, 24),
        }));
    const ships = night ? Array.from({ length: 2 }, (_, k) => ({ x: view.w * (0.08 + k * 0.34), speed: rand.range(3, 6) })) : [];

    // Squeezes dithering into the middle of each step between ramp tones, so
    // bands read as clean fields with a short ordered transition between them.
    const crisp = (v, steps, lo = 0.3, hi = 0.7) => {
      const x = clamp(v, 0, 1) * (steps - 1);
      const k = Math.floor(x);
      return (k + smoothstep(lo, hi, x - k)) / (steps - 1);
    };

    // Light a rock cell. Each stratum is cut into blocks; a block is a flat
    // facet whose brightness follows the slope of a broad relief (buttresses
    // turning toward the light on their left), so neighbouring facets form
    // coherent masses. Ledge tops catch a rim, undersides and joints go dark.
    const relief = (x, k) => noise2(x / 8 + k * 0.37, k * 0.23 + 1.3);
    const gully = (x) => noise2(x / 6 + 7.3, 2.1); // buttresses and gullies running down through the strata
    const rockValue = (c, r, G) => {
      const s = G.strata(c, r);
      const k = G.band[s];
      const p = G.pos[s];
      const hgt = G.height[s];
      const bw = 3 + Math.floor(hash1(k * 31 + 2) * 5);
      const u = c + Math.floor(hash1(k * 17 + 9) * 40);
      const j = Math.floor(u / bw);
      const mid = j * bw - (u - c) + bw / 2;
      const slope = relief(mid + 1.5, k) - relief(mid - 1.5, k);
      let v = 0.48 + slope * 0.85 + (hash2(k, j) - 0.5) * 0.12 + (0.5 - ((u % bw) + 0.5) / bw) * 0.1;
      if (p === 0) v = Math.max(v + 0.1, 0.62);
      else if (p === hgt - 1) v -= 0.2;
      if (u % bw === bw - 1 && p > 0 && hash2(k, j + 97) < 0.45) v -= 0.3;
      v += (gully(c + 1) - gully(c - 1)) * 0.6 - Math.max(0, -gully(c)) * 0.16;
      v -= clamp((c - G.cTop) / Math.max(1, view.cols - G.cTop), 0, 1) * 0.12;
      if (r >= G.hr) v -= ((r - G.hr) / Math.max(1, view.rows - G.hr)) * 0.16;
      return night ? Math.min(v - 0.06, 0.7) : v;
    };

    return {
      update(dt) {
        sailboat.x += sailboat.speed * dt;
        if (sailboat.x > view.w * 0.64) sailboat.x = -100;
        for (const s of ships) {
          s.x += s.speed * dt;
          if (s.x > view.w * 0.66) s.x = -60;
        }
      },

      resize(sx) {
        sailboat.x *= sx;
        for (const s of ships) s.x *= sx;
      },

      back(f) {
        const G = layout();
        const { cw, cols, rows } = view;
        const { hr, edge } = G;

        // Distant islands: low and close to the sky value, sunward slopes a touch lighter.
        const ridge = (x) => Math.max(0, noise2(x / 150, 8.8) * 4.4 - 0.5) * (1 - smoothstep(0.42, 0.6, x / view.w));
        for (let c = 0; c < cols; c++) {
          const x = (c + 0.5) * cw;
          if (x > view.w * 0.6) break;
          const hgt = ridge(x);
          const top = Math.round(hr - hgt);
          const rising = ridge(x + cw) > ridge(x - cw);
          for (let r = top; r < hr; r++) f.put(r * cols + c, BLOCK, r === top && rising ? ink.islandLit : ink.island, 1);
        }

        // Sea: light at the horizon, deepening toward the viewer. Neighbouring
        // tones interleave in wavy horizontal streaks rather than a dither grid.
        for (let r = hr; r < rows; r++) {
          const p = (r - hr + 0.5) / (rows - hr);
          const depth = (0.02 + (1 - Math.pow(p, 0.65)) * 0.97) * (seaRamp.length - 1);
          const k = Math.floor(depth);
          for (let c = 0; c < cols && c < edge[r]; c++) {
            const i = r * cols + c;
            const shore = edge[r] - c;
            if (shore <= 3 && r > hr && bayer(c, r) * 3.4 > shore - 0.6) {
              f.put(i, BLOCK, ink.shallow, 1);
              continue;
            }
            const streak = 0.5 + 0.6 * noise2(c / 4.5, r * 0.9 + 3.3);
            f.put(i, BLOCK, seaRamp[Math.min(seaRamp.length - 1, depth - k > streak ? k + 1 : k)], 1);
          }
        }
      },

      front(f) {
        const G = layout();
        const { cols, rows } = view;
        const { gr, edge, lc, bt, cc0, towerRows } = G;
        const put = (c, r, kind, k, glyph = -1) => {
          if (c >= 0 && c < cols && r >= 0 && r < rows) f.put(r * cols + c, kind, k, 1, glyph);
        };

        // Moon, front-most so stars and the beam never cross it (the sun is pure glow).
        if (night) {
          const R = 44;
          f.each(G.moonX - R - 16, G.moonY - R - 16, G.moonX + R + 16, G.moonY + R + 16, (x, y, i) => {
            const d = sdCircle(x, y, G.moonX, G.moonY, R);
            const crater = d < -10 && noise2(x / 24 + 3, y / 20) > 0.25;
            if (d <= 0) f.put(i, BLOCK, crater || (d > -10 && x > G.moonX + 12) ? ink.moonShade : ink.moon, 1);
            else f.shape(i, d, ink.moon, 1, ink.moon, 0.35);
          });
        }

        // Headland: grass cap, turf shadow, then faceted strata down to the sea.
        const towerL = lc - 4;
        const towerR = lc + 4;
        const cottageR = cc0 + 10;
        const lip = edge[gr + 2] + 2;
        for (let r = gr; r < rows; r++) {
          for (let c = Math.max(0, edge[r]); c < cols; c++) {
            const i = r * cols + c;
            const below = r - gr;
            const cap = c >= lip ? 3 : 2;
            const fromEdge = c - edge[r];
            if (below < cap) {
              const onPath = (below === 0 && c > lc + 4 && c <= cc0 + 5) || (below === 1 && c >= lc - 5 && c <= lc && hash2(c, 41) < 0.8);
              if (onPath) {
                f.put(i, TILE, ink.path, 1);
                continue;
              }
              const castShadow = below === 0 && ((c > towerR && c <= towerR + 2) || (c > cottageR && c <= cottageR + 2));
              let v = below === 0 ? 0.78 : below === 1 ? 0.45 : 0.08;
              v += noise2(c / 5, r * 0.7) * 0.25;
              if (fromEdge < 1) v += 0.4;
              if (castShadow) v = 0.05;
              if (below < 2 && !castShadow && hash2(c, r * 7) < 0.07) f.put(i, TILE, ink.flower, 1, tileSlot('*'));
              else f.put(i, below === 2 ? BLOCK : TILE, shade(grassRamp, v, c, r), 1);
              continue;
            }
            // Grass spilling over the lip and moss on high ledges.
            if (fromEdge < 2 && below < cap + 3 && hash2(c, r) < 0.55 - (below - cap) * 0.18) {
              f.put(i, TILE, hash2(c, r + 9) < 0.5 ? ink.grass : ink.grassDark, 1);
              continue;
            }
            let v = rockValue(c, r, G);
            if (fromEdge < 1) v += 0.38;
            else if (fromEdge < 2) v += 0.14;
            if (below === cap) v = Math.min(v, -0.1);
            f.put(i, BLOCK, shade(rockRamp, crisp(v, rockRamp.length, 0.25, 0.75), c, r), 1);
          }
        }

        // Tussocks and tufts breaking the skyline of the plateau.
        for (let c = edge[gr] + 1; c < cols; c++) {
          if (c >= towerL && c <= towerR) continue;
          if (c >= cc0 - 1 && c <= cottageR + 1) continue;
          if (noise2(c / 3.1, 9.1) > 0.3) {
            put(c, gr - 1, TILE, hash2(c, 3) < 0.5 ? ink.grassLit : ink.grass);
            if (hash2(c, 5) < 0.4) put(c, gr - 2, GLYPH, ink.tuft, hash2(c, 6) < 0.5 ? slot.comma : slot.tick);
          } else if (hash2(c, 7) < 0.45) {
            put(c, gr - 1, GLYPH, ink.tuft, hash2(c, 8) < 0.5 ? slot.comma : slot.tick);
          }
        }

        // Foreground rocks in the left gap.
        for (let c = 0; c < cols; c++) {
          const top = G.rockTop[c];
          if (top > rows) continue;
          const lit = G.rockTop[c - 1] === undefined || G.rockTop[c - 1] > top;
          for (let r = top; r < rows; r++) {
            let v = 0.5 + (r === top ? 0.35 : 0) - (r - top) * 0.16 + (lit ? 0.25 : 0) - (G.rockTop[c + 1] > top ? 0.2 : 0);
            if (hash2(c * 5, r) < 0.12) v -= 0.25;
            put(c, r, BLOCK, shade(rockRamp, v, c, r));
          }
        }

        // Tower: crisp bands with cylindrical shading (lit left, shadow right).
        const bandRows = Math.max(2, Math.round(towerRows / 8));
        const winA = bt + Math.round(towerRows * 0.3);
        const winB = bt + Math.round(towerRows * 0.62);
        for (let k = 0; k < towerRows; k++) {
          const r = bt + k;
          const half = k < towerRows * 0.4 ? 2 : 3;
          const red = Math.floor(k / bandRows) % 2 === 0;
          for (let o = -half; o <= half; o++) {
            const u = o / half;
            const lv = u < -0.4 ? 2 : u > 0.6 ? 0 : 1;
            put(lc + o, r, TILE, red ? [ink.redShade, ink.red, ink.redLit][lv] : [ink.whiteShade, ink.white, ink.whiteLit][lv]);
          }
        }
        for (let o = -4; o <= 4; o++) put(lc + o, gr - 1, BLOCK, o < -2 ? ink.rock4 : o > 2 ? ink.rock1 : ink.plinth);
        put(lc, gr - 2, BLOCK, ink.door);
        put(lc, gr - 3, BLOCK, ink.door);
        put(lc, winA, BLOCK, ink.door);
        put(lc, winB, BLOCK, night ? ink.window : ink.door);
        // Gallery deck, railing, lantern room, dome, finial.
        for (let o = -3; o <= 3; o++) put(lc + o, bt - 1, BLOCK, ink.rail);
        for (let o = -3; o <= 3; o++) put(lc + o, bt - 2, Math.abs(o) === 3 ? GLYPH : TILE, ink.rail, Math.abs(o) === 3 ? slot.bar : tileSlot('#'));
        for (const r of [bt - 3, bt - 4]) {
          for (let o = -2; o <= 2; o++) {
            if (Math.abs(o) === 2) put(lc + o, r, BLOCK, ink.dome);
            else put(lc + o, r, TILE, (night ? o === 0 : o === -1) ? ink.lampCore : ink.lamp);
          }
        }
        for (let o = -3; o <= 3; o++) put(lc + o, bt - 5, BLOCK, o < -1 ? ink.domeLit : ink.dome);
        for (let o = -2; o <= 2; o++) put(lc + o, bt - 6, TILE, o < 0 ? ink.domeLit : ink.dome);
        put(lc - 1, bt - 7, TILE, ink.domeLit);
        put(lc, bt - 7, TILE, ink.dome);
        put(lc, bt - 8, GLYPH, ink.rail, slot.bar);

        // Keeper's cottage: lit and shaded roof pitches, eave shadow, chimney, door, windows.
        for (let j = 0; j <= 3; j++) {
          const r = gr - 7 + j;
          for (let o = -j - 2; o <= j + 2; o++) put(cc0 + 5 + o, r, TILE, o < 0 || (o === 0 && j < 3) ? ink.roofLit : ink.roofShade);
        }
        for (let r = gr - 9; r <= gr - 7; r++) put(cc0 + 8, r, TILE, ink.chimney);
        for (let r = gr - 3; r <= gr - 1; r++) {
          for (let c = cc0 + 1; c <= cc0 + 9; c++) put(c, r, TILE, r === gr - 3 || c === cc0 + 9 ? ink.wall : ink.wallLit);
        }
        put(cc0 + 3, gr - 2, TILE, ink.window);
        put(cc0 + 7, gr - 2, TILE, ink.window);
        put(cc0 + 5, gr - 2, BLOCK, ink.door);
        put(cc0 + 5, gr - 1, BLOCK, ink.door);
      },

      paint(f, t) {
        const G = layout();
        const { cw, ch, cols, rows } = view;
        const { hr, edge, lx, lampY, gr, cc0 } = G;

        if (night) {
          stars.paint(f, t, ink.star);
          f.glow(G.moonX, G.moonY, 80, '#eef2ff', 0.4);

          // Two opposed beams turning round the lamp, foreshortened as they swing toward us:
          // a few large additive glows, spaced geometrically, make the soft wedge; faint
          // cells give it a mosaic edge. Glows are fill-rate bound, so keep them few.
          const phase = t * 0.42 + 0.7;
          let flash = 0;
          for (const b of [phase, phase + Math.PI]) {
            const cos = Math.cos(b);
            const toward = Math.max(0, Math.sin(b));
            flash = Math.max(flash, toward ** 6);
            const len = Math.abs(cos) * view.w * 0.82;
            if (len < cw * 2) continue;
            const dir = cos < 0 ? -1 : 1;
            const bright = 0.65 + 0.35 * toward;
            const spread = 0.1 + 0.14 * (1 - Math.abs(cos));
            const tilt = -0.03;
            const reach = 6 + len * spread;
            f.each(dir < 0 ? lx - len : lx, lampY - reach - len * 0.03, dir < 0 ? lx : lx + len, lampY + reach, (x, y, i) => {
              const d = (x - lx) * dir;
              if (d < cw || d >= len) return;
              const q = Math.abs(y - (lampY + d * tilt)) / (6 + d * spread);
              if (q >= 1) return;
              const a = bright * Math.pow(1 - d / len, 1.1) * Math.pow(1 - q, 1.2) * 0.42;
              if (a > 0.04) f.put(i, BLOCK, ink.beam, a);
            });
            for (let d = 20; d < len; d = d * 1.75 + 30) {
              const half = 6 + d * spread;
              const x = lx + dir * d;
              const a = 0.34 * bright * Math.pow(1 - d / len, 1.2) * (0.35 + 0.65 * smoothstep(40, 280, d));
              if (a < 0.03 || x - half * 1.6 > view.w) break;
              f.glow(x, lampY + d * tilt, half * 1.6, '#ffe8a8', a);
            }
          }
          f.glow(lx, lampY, 60 + flash * 170, '#ffe39a', 0.7 + flash * 0.3);
          f.glow(lx, lampY, 24, '#fff6d8', 0.8);
          f.glow(cc0 * cw + cw * 3.5, (gr - 1.5) * ch, 26, '#ffc860', 0.5);
          f.glow(cc0 * cw + cw * 7.5, (gr - 1.5) * ch, 26, '#ffc860', 0.5);
        } else {
          f.glow(G.sunX, G.sunY, 130, '#fffbea', 0.5);
          f.glow(G.sunX, G.sunY, 34, '#ffffff', 0.95);
        }

        // Glitter path under the sun or moon.
        const lightC = (night ? G.moonX : G.sunX) / cw;
        for (let r = hr + 1; r < rows; r++) {
          const p = (r - hr) / (rows - hr);
          const hw = 1.2 + p * 6.5;
          for (let c = Math.max(0, Math.floor(lightC - hw)); c <= lightC + hw && c < edge[r]; c++) {
            const q = Math.abs(c + 0.5 - lightC) / hw;
            if (q >= 1) continue;
            const i = r * cols + c;
            const roll = hash1(i * 3 + Math.floor(t * 3 + hash1(i) * 7) * 131);
            if (roll > (1 - q) * (night ? 0.55 : 0.8)) continue;
            f.put(i, GLYPH, ink.glint, 0.4 + 0.6 * (1 - q), !night && roll < 0.08 ? slot.star : p > 0.5 && roll < 0.2 ? slot.wave : slot.dash);
          }
        }

        // Swells rolling in: brighter bands that travel toward the viewer, cresting into whitecaps.
        for (let r = hr + 1; r < rows; r++) {
          const p = (r - hr) / (rows - hr);
          const bend = Math.sqrt(r - hr) * 7 - t * 1.1;
          const scale = 1 / (110 + 170 * p);
          const amp = 0.35 + 0.65 * p;
          for (let c = 0; c < cols && c < edge[r]; c++) {
            const i = r * cols + c;
            const x = (c + 0.5) * cw;
            const crest = 0.5 + 0.5 * Math.sin(bend + noise2(x / 190, r * 0.15) * 4);
            const n = 0.5 + 0.5 * noise2(x * scale + r * 1.7, t * 0.09 + r * 0.31);
            const s = crest * crest * crest * n;
            if (s > 0.62 && hash1(i * 7 + Math.floor(t * 2 + hash1(i) * 3)) < 0.55) f.put(i, GLYPH, ink.wave, Math.min(0.85, (s - 0.45) * 2 * amp), p > 0.35 ? slot.wave : slot.dash);
            else if (s > 0.18) f.put(i, BLOCK, ink.swell, (s - 0.18) * 0.42 * amp);
          }
        }

        if (night) {
          for (const s of ships) {
            const c0 = Math.floor(s.x / cw);
            for (let o = 0; o < 4; o++) if (c0 + o >= 0 && c0 + o < cols) f.put((hr - 1) * cols + c0 + o, BLOCK, ink.shipHull, 1);
            const lit = (hr - 2) * cols + c0 + 2;
            if (c0 + 2 >= 0 && c0 + 2 < cols) {
              f.put(lit, TILE, ink.shipLight, 0.95);
              f.put((hr - 3) * cols + c0 + 1, GLYPH, ink.shipLight, 0.8, slot.dot);
              for (let k = 0; k < 2; k++) f.put((hr + k) * cols + c0 + 2, GLYPH, ink.shipLight, (0.45 - k * 0.15) * (0.6 + 0.4 * Math.sin(t * 3 + k + s.x)), slot.dash);
            }
            if (c0 >= 0 && c0 < cols) f.put((hr - 1) * cols + c0, TILE, Math.floor(t * 1.2 + s.speed) % 2 ? ink.shipRed : ink.shipHull, 0.95);
            f.glow((c0 + 2.5) * cw, (hr - 1.5) * ch, 26, '#ffd27a', 0.35);
          }
        } else {
          const hullY = (hr + 1) * ch;
          f.sprite(SAILBOAT, { m: [GLYPH, ink.mast, 1, slot.bar], s: [TILE, ink.sail], S: [TILE, ink.jib], h: [TILE, ink.hull], H: [BLOCK, ink.hullShade] }, sailboat.x, hullY - ch * 4);
          const wr = hr + 2;
          for (let k = 1; k <= 4; k++) {
            const i = f.at(sailboat.x - k * cw, (wr + 0.5) * ch);
            if (i >= 0 && hash1(i + Math.floor(t * 4) * 31) < 0.8 - k * 0.15) f.put(i, GLYPH, ink.wave, 0.8 - k * 0.15, slot.wave);
          }
        }

        // Surf along the foot of the cliff: surges roll down the shore and throw spray.
        for (let r = hr; r < rows; r++) {
          const e = edge[r];
          if (e > cols) continue;
          const s = 0.5 + 0.5 * Math.sin(t * 1.5 - (r - hr) * 0.42);
          const reach = 1 + Math.round(s * s * 3 * (0.5 + 0.5 * (r - hr) / (rows - hr)));
          for (let k = 1; k <= reach; k++) {
            const c = e - k;
            if (c < 0) break;
            const i = r * cols + c;
            const a = (1 - (k - 1) / (reach + 0.5)) * (0.55 + 0.45 * s);
            if (k === 1 && s > 0.3) f.put(i, TILE, ink.foam, a);
            else f.put(i, GLYPH, ink.wave, a, hash1(i + Math.floor(t * 3)) < 0.5 ? slot.wave : slot.dash);
          }
          if (s > 0.86 && r > hr) {
            const i = (r - 1 - Math.floor(hash1(r + Math.floor(t * 4)) * 2)) * cols + e - 1 - Math.floor(hash1(r * 3 + Math.floor(t * 4)) * 2);
            if (i >= 0) f.put(i, GLYPH, ink.foam, (s - 0.86) * 6, hash1(i) < 0.5 ? slot.dot : slot.tick);
          }
        }

        // Waves washing over the foreground rocks.
        for (let c = 0; c < cols; c++) {
          const top = G.rockTop[c];
          if (top > rows) continue;
          const s = 0.5 + 0.5 * Math.sin(t * 1.3 + c * 0.5);
          if (s > 0.35) f.put((top - 1) * cols + c, GLYPH, ink.wave, (s - 0.35) * 1.4, s > 0.8 ? slot.tick : slot.wave);
          for (const side of [-1, 1]) {
            if (G.rockTop[c + side] === undefined || G.rockTop[c + side] <= rows) continue;
            for (let r = top; r < rows; r++) {
              const a = 0.5 + 0.5 * Math.sin(t * 1.3 + r * 0.8 + c);
              f.put(r * cols + c + side, r === top ? GLYPH : TILE, ink.foam, a * 0.8, r === top ? slot.wave : -1);
            }
          }
        }

        // Buoy: red spar with a white band, its topmark light blinking green at night.
        {
          const c = G.buoyC;
          const r = G.buoyR;
          const bob = Math.sin(t * 1.6) > 0;
          f.put(r * cols + c, TILE, ink.buoy, 1);
          f.put((r + 1) * cols + c, TILE, ink.buoyBand, 1);
          f.put((r + 1) * cols + c + (bob ? 1 : -1), GLYPH, ink.wave, 0.75, slot.wave);
          f.put((r + 2) * cols + c, GLYPH, ink.wave, 0.45, slot.dash);
          const on = night && (t % 3) < 0.8;
          f.put((r - 1) * cols + c, GLYPH, on ? ink.buoyLight : ink.buoy, on ? 1 : 0.85, slot.plus);
          if (on) {
            f.glow((c + 0.5) * cw, (r - 0.5) * ch, 34, '#7dffb4', 0.5);
            f.put((r + 2) * cols + c, GLYPH, ink.buoyLight, 0.55, slot.dash);
            f.put((r + 3) * cols + c, GLYPH, ink.buoyLight, 0.3, slot.dash);
          }
        }

        // Chimney smoke drifting off on the breeze.
        for (let k = 0; k < 5; k++) {
          const age = (t * 0.22 + k / 5) % 1;
          const x = (cc0 + 8.5) * cw - age * 46 + Math.sin(age * 6 + k) * 5;
          const y = (gr - 9) * ch - age * 90;
          const i = f.at(x, y);
          if (i >= 0) f.put(i, GLYPH, ink.smoke, (1 - age) * (night ? 0.4 : 0.6), age < 0.45 ? slot.ring : slot.dot);
        }

        for (const g of gulls) {
          const a = t * g.speed + g.phase;
          const cx = g.home === 'tower' ? lx - 30 : view.w * 0.27;
          const cy = g.home === 'tower' ? lampY - 30 : view.h * 0.3;
          const i = f.at(cx + Math.cos(a) * g.r * 1.6, cy + Math.sin(a) * g.r * 0.45 + g.dy);
          if (i >= 0) f.put(i, GLYPH, ink.gull, 0.9, Math.floor(t * 3 + g.phase) % 2 ? slot.up : slot.down);
        }
      },
    };
  },
};
