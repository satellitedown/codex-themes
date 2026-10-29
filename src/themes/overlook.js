import { solid, tone } from '../engine/color.js';
import { BLOCK, GLYPH, TILE } from '../engine/field.js';
import { clamp, fbm2, hash1, noise2, rng, sdCircle, smin } from '../engine/math.js';
import { starfield } from './kit.js';

const SIGNS = ['CODEX', 'RAMEN', 'NEO', '24/7', 'HOTEL', 'BAR'];

/**
 * A grassy cliff (right) with a lone tree and someone sitting at the edge,
 * overlooking a mega city across the bay. Day: blue sky, green cliff, glassy
 * towers with rooftop gardens. Night: cyberpunk — neon windows and strips,
 * billboards, flying cars, searchlights and reflections in the water.
 *
 * Large masses are solid blocks; glyph tiles are reserved for silhouettes and
 * details so the scene stays calm behind text.
 */
export default {
  id: 'overlook',
  name: 'Overlook',
  chars: { tile: 't%S;:#', halo: "'.:;o", extra: `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/|-=*+.v^~'` },
  shimmer: 1.2,
  palettes: {
    light: {
      bg: {
        stops: [[0, '#58ace8'], [0.4, '#92cef3'], [0.62, '#d2ecfa'], [1, '#e4f4fb']],
        spots: [{ x: 0.06, y: 0.04, r: 0.4, color: 'rgba(255, 250, 222, 0.8)' }],
        vignette: 0,
        texture: { color: '#ffffff', alpha: 0.3, chars: '-.', scale: 0.08, threshold: 0.2, density: 0.4, bottom: 0.45 },
      },
      inks: {
        far: solid('#bfd6e8'),
        farTower: solid('#b3cde2'),
        tower: solid('#c4d8e8'),
        tower2: solid('#adc4da'),
        tower3: solid('#d3e2ee'),
        roof: tone('#9fb9d1', 0.14),
        window: tone('#e9f3fa', 0.1),
        garden: tone('#77c065', 0.22),
        strip: tone('#e9f3fa', 0.1),
        strip2: tone('#e9f3fa', 0.1),
        water: solid('#a4d3ec'),
        waterFar: solid('#bcdff0'),
        glint: solid('#ffffff'),
        lit1: tone('#ffffff', 0.12),
        lit2: tone('#ffffff', 0.12),
        lit3: tone('#fff6d2', 0.12),
        billboard: solid('#f7fafc'),
        signText: solid('#3a6c98'),
        signText2: solid('#d9604f'),
        car: solid('#6f8399'),
        trail1: solid('#ffffff'),
        trail2: solid('#ffffff'),
        beam: solid('#ffffff'),
        beacon: solid('#e05a5a'),
        star: solid('#ffffff'),
        cloud: tone('#ffffff', 0.1),
        bird: solid('#3f5a74'),
        rock: solid('#a59c82'),
        rockDark: solid('#91896f'),
        rockEdge: tone('#8a826a', 0.16),
        grass: tone('#5fae4a', 0.2),
        grassLight: tone('#8bd168', 0.2),
        rim: tone('#5fae4a', 0.2),
        leaf: tone('#4a9a47', 0.18),
        leafLight: tone('#72c25a', 0.18),
        trunk: tone('#86664a', 0.14),
        person: solid('#e0705a'),
        skin: solid('#f2c9a0'),
        screen: solid('#cfe6fb'),
      },
      ui: { base: '#cdebf9', sidebar: 'rgba(234, 246, 253, 0.66)', composer: 'rgba(250, 253, 255, 0.86)', accent: '#2a82c4', bubble: 'rgba(42, 130, 196, 0.13)' },
      lane: 0.55,
    },
    dark: {
      bg: {
        stops: [[0, '#06021a'], [0.36, '#160735'], [0.56, '#3a0d5a'], [0.64, '#5e1672'], [1, '#0f041e']],
        spots: [
          { x: 0.36, y: 0.64, r: 0.5, color: 'rgba(255, 50, 200, 0.28)' },
          { x: 0.08, y: 0.58, r: 0.32, color: 'rgba(40, 210, 255, 0.16)' },
        ],
        vignette: 0.22,
        texture: { color: '#b48cff', alpha: 0.05, chars: '.', scale: 0.1, threshold: 0.1, density: 0.35, bottom: 0.5 },
      },
      inks: {
        far: solid('#21103c'),
        farTower: solid('#1c0d36'),
        tower: solid('#130a28'),
        tower2: solid('#1a0d33'),
        tower3: solid('#0e0720'),
        roof: tone('#2a1752', 0.14),
        window: tone('#1d1040', 0.08),
        garden: tone('#ff3fd2', 0.3, '#ff6fe0'),
        strip: tone('#36e6ff', 0.3, '#7ff1ff'),
        strip2: tone('#ff3fd2', 0.3, '#ff6fe0'),
        water: solid('#0c0520'),
        waterFar: solid('#160830'),
        glint: solid('#3ff0ff'),
        lit1: tone('#43e8ff', 0.35),
        lit2: tone('#ff4fd8', 0.35),
        lit3: tone('#ffc65a', 0.35),
        billboard: solid('#0d0520'),
        signText: solid('#7dfcff'),
        signText2: solid('#ff7ae6'),
        car: tone('#eaf7ff', 0.2),
        trail1: solid('#2fd9ff'),
        trail2: solid('#ff3fb8'),
        beam: solid('#b39bff'),
        beacon: solid('#ff3b4e'),
        star: solid('#d6c8ff'),
        cloud: tone('#2a1250', 0.08, '#ff4fd8'),
        bird: solid('#2a1250'),
        rock: solid('#120a20'),
        rockDark: solid('#0d0718'),
        rockEdge: tone('#1d1236', 0.12),
        grass: tone('#1f1438', 0.14),
        grassLight: tone('#2b1b4c', 0.14),
        rim: tone('#ff4fd8', 0.3, '#ff8fe8'),
        leaf: tone('#150d2b', 0.12),
        leafLight: tone('#1d1339', 0.12),
        trunk: tone('#0f0a1c', 0.1),
        person: solid('#2b1d4c'),
        skin: solid('#3a2a60'),
        screen: solid('#43e8ff'),
      },
      ui: { base: '#13051f', sidebar: 'rgba(17, 6, 32, 0.62)', composer: 'rgba(22, 9, 42, 0.86)', accent: '#ff4fd8', bubble: 'rgba(255, 79, 216, 0.2)' },
      lane: 0.62,
    },
  },

  scene(view) {
    const rand = rng(0x0e71);
    const { ink, night } = view;
    const stars = starfield(view, rand, { count: 70, top: 0, bottom: 0.42, glyphs: '.+*', bright: 0.2 });
    const dash = view.glyph('-');
    const pipe = view.glyph('|');
    const tilde = view.glyph('~');
    const flapUp = view.glyph('^');
    const flapDown = view.glyph('v');
    const signSlots = SIGNS.map((s) => view.glyphs(s));

    // Cliff occupies the right edge; the city spreads left of it.
    const geo = () => {
      const horizon = view.h * 0.64;
      const edge = view.w - clamp(view.w * 0.27, 230, 480);
      const lip = view.h * 0.57;
      const top = (x) => lip - ((x - edge) / (view.w - edge)) * view.h * 0.07 + noise2(x / 70, 1.3) * 6;
      const face = (y) => edge - (y - lip) * 0.08 + noise2(y / 26, 8.1) * 12;
      return { horizon, edge, lip, top, face };
    };

    const towers = [];
    const farTowers = [];
    let windowCells = [];
    const build = () => {
      const { horizon, edge } = geo();
      towers.length = 0;
      farTowers.length = 0;
      const r = rng(0x5c17);
      for (let x = -view.cw * 2; x < edge + 40; ) {
        const width = (2 + Math.floor(r() * 4)) * view.cw;
        farTowers.push({ x, width, height: view.h * r.range(0.06, 0.22) });
        x += width;
      }
      for (let x = -view.cw; x < edge + view.cw * 4; ) {
        const width = (3 + Math.floor(r() * 6)) * view.cw;
        const dist = Math.abs(x + width / 2 - view.w * 0.4) / view.w;
        const height = Math.max(view.h * 0.08, view.h * (0.44 - dist * 0.6) * r.range(0.5, 1));
        towers.push({
          x,
          width,
          height,
          ink: r.pick([ink.tower, ink.tower2, ink.tower3]),
          spire: r() < 0.2 ? 3 + Math.floor(r() * 5) : 0,
          garden: r() < 0.35,
          strip: r() < 0.3 ? (r() < 0.5 ? ink.strip : ink.strip2) : -1,
          lattice: r() < 0.55,
          sign: r() < 0.3 && height > view.h * 0.18 ? Math.floor(r() * SIGNS.length) : -1,
          phase: r() * 10,
        });
        x += width + (r() < 0.3 ? view.cw : 0);
      }
      windowCells = [];
      for (const t of towers) {
        if (!t.lattice) continue;
        const c0 = Math.ceil(t.x / view.cw);
        const c1 = Math.floor((t.x + t.width) / view.cw) - 1;
        const r0 = Math.ceil((horizon - t.height) / view.ch) + 1;
        const r1 = Math.floor(horizon / view.ch) - 1;
        for (let rr = r0; rr <= r1; rr += 2) for (let c = c0 + 1; c < c1; c += 2) if (c >= 0) windowCells.push(rr * view.cols + c);
      }
    };
    build();

    const clouds = Array.from({ length: 5 }, () => ({ x: rand() * view.w, y: rand.range(0.05, 0.32) * view.h, w: rand.range(160, 300), speed: rand.range(5, 11), seed: rand() * 50 }));
    const flyers = Array.from({ length: night ? 10 : 3 }, () => ({
      x: rand() * view.w,
      y: rand.range(0.16, 0.54) * view.h,
      vx: (rand() < 0.5 ? -1 : 1) * rand.range(50, night ? 150 : 60),
      trail: rand() < 0.5 ? ink.trail1 : ink.trail2,
    }));
    const birds = night ? [] : Array.from({ length: 6 }, (_, k) => ({ x: rand() * view.w, y: rand.range(0.1, 0.38) * view.h, vx: rand.range(18, 30), phase: k }));

    return {
      resize: build,

      update(dt) {
        for (const c of clouds) {
          c.x += c.speed * dt;
          if (c.x - c.w > view.w) c.x = -c.w;
        }
        for (const f of flyers) {
          f.x += f.vx * dt;
          if (f.x < -140) f.x = view.w + 120;
          if (f.x > view.w + 140) f.x = -120;
        }
        for (const b of birds) {
          b.x += b.vx * dt;
          if (b.x > view.w + 30) b.x = -30;
        }
      },

      back(f) {
        const { horizon } = geo();
        f.each(0, view.h * 0.34, view.w, horizon, (x, y, i) => {
          if (y > horizon - view.h * (0.11 + (fbm2(x / 260, 3.7) + 0.5) * 0.13)) f.put(i, BLOCK, ink.far, 1);
        });
        for (const t of farTowers) f.each(t.x, horizon - t.height, t.x + t.width - 1, horizon, (x, y, i) => f.put(i, BLOCK, ink.farTower, 1));
        for (const t of towers) {
          const top = horizon - t.height;
          f.each(t.x, top, t.x + t.width - 1, horizon, (x, y, i) => {
            if (y - top < view.ch) f.put(i, TILE, t.garden ? ink.garden : ink.roof, 1);
            else if (t.strip >= 0 && x > t.x + t.width - view.cw) f.put(i, TILE, t.strip, 0.9);
            else f.put(i, BLOCK, t.ink, 1);
          });
          for (let k = 1; k <= t.spire; k++) {
            const i = f.at(t.x + t.width / 2, top - k * view.ch + 1);
            if (i >= 0) f.put(i, k === t.spire ? GLYPH : TILE, ink.roof, 1, k === t.spire ? pipe : -1);
          }
        }
        if (!night) for (const i of windowCells) f.put(i, TILE, ink.window, 0.55);
        f.each(0, horizon, view.w, view.h, (x, y, i) => f.put(i, BLOCK, y < horizon + view.ch * 2 ? ink.waterFar : ink.water, 1));
      },

      paint(f, t) {
        const { horizon, edge, top } = geo();
        if (night) stars.paint(f, t, ink.star);
        else {
          // Gentle wave strokes on the bay by day.
          f.each(0, horizon + view.ch, edge, view.h, (x, y, i) => {
            if (hash1(i) > 0.35) return;
            const n = noise2(x / 120 - t * 0.05, y / 22);
            if (n > 0.45) f.put(i, GLYPH, ink.glint, Math.min(0.7, (n - 0.45) * 1.6), (i & 3) === 0 ? tilde : dash);
          });
        }

        for (const c of clouds) {
          f.each(c.x - c.w * 0.6, c.y - 40, c.x + c.w * 0.6, c.y + 24, (x, y, i) => {
            let d = sdCircle(x, y, c.x, c.y, c.w * 0.18);
            d = smin(d, sdCircle(x, y, c.x - c.w * 0.22, c.y + 6, c.w * 0.14), 14);
            d = smin(d, sdCircle(x, y, c.x + c.w * 0.24, c.y + 8, c.w * 0.12), 14);
            d = Math.max(d, y - (c.y + 14)) + noise2(x / 30 + c.seed, y / 20 + t * 0.1) * 5 + (night ? 8 : 0);
            f.shape(i, d, ink.cloud, night ? 0.7 : 0.95, ink.cloud, 0.4);
          });
        }
        for (const b of birds) {
          const i = f.at(b.x, b.y + Math.sin(t + b.phase) * 6);
          if (i >= 0) f.put(i, GLYPH, ink.bird, 0.8, Math.floor(t * 3 + b.phase) % 2 ? flapUp : flapDown);
        }

        // Windows: slow random on/off at night, the odd sun glint by day.
        for (const i of windowCells) {
          const h = hash1(i * 7);
          if (night) {
            if (hash1(i * 13 + Math.floor(t * 0.07 + h * 30)) < 0.42) f.put(i, TILE, h < 0.55 ? ink.lit3 : h < 0.8 ? ink.lit1 : ink.lit2, 0.95);
          } else if (hash1(i * 13 + Math.floor(t * 0.6 + h * 30)) < 0.02) {
            f.put(i, TILE, ink.lit1, 0.95);
          }
        }

        for (const tw of towers) {
          const tTop = horizon - tw.height;
          if (tw.spire) {
            const i = f.at(tw.x + tw.width / 2, tTop - (tw.spire + 1) * view.ch + 1);
            if (i >= 0 && (t + tw.phase) % 1.8 < 0.45) f.put(i, TILE, ink.beacon, night ? 1 : 0.75);
          }
          // Billboards only where the board fits inside the tower face.
          if (tw.sign >= 0 && tw.width >= (signSlots[tw.sign].length + 2) * view.cw) {
            const slots = signSlots[tw.sign];
            const sx = tw.x + Math.floor((tw.width - slots.length * view.cw) / 2 / view.cw) * view.cw;
            const sy = tTop + tw.height * 0.3;
            const flicker = night && hash1(Math.floor(t * 9) + tw.sign * 77) < 0.05 ? 0.25 : 1;
            for (let k = -1; k <= slots.length; k++) {
              for (const dy of [-1, 0, 1]) {
                const i = f.at(sx + k * view.cw + 1, sy + dy * view.ch);
                if (i >= 0) f.put(i, BLOCK, ink.billboard, 0.95);
              }
            }
            f.text(slots, sx + 1, sy, tw.sign % 2 ? ink.signText2 : ink.signText, flicker);
          }
          // Reflections in the bay.
          const depth = Math.min(tw.height * 0.6, view.h * 0.15);
          for (let y = horizon + view.ch * 0.5; y < horizon + depth; y += view.ch) {
            for (let x = tw.x + view.cw * 0.5; x < tw.x + tw.width; x += view.cw) {
              const i = f.at(x, y);
              if (i < 0 || hash1(i * 3 + Math.floor(t * 2.5)) > (night ? 0.32 : 0.07)) continue;
              const fade = 1 - (y - horizon) / depth;
              f.put(i, GLYPH, night ? (hash1(i) < 0.5 ? ink.trail1 : ink.trail2) : ink.glint, (night ? 0.5 : 0.65) * fade, hash1(i * 5) < 0.5 ? dash : tilde);
            }
          }
        }

        if (night) {
          for (const [bx, speed, phase] of [[0.18, 0.23, 0], [0.52, 0.31, 2.1]]) {
            const angle = -Math.PI / 2 + Math.sin(t * speed + phase) * 0.55;
            const len = view.h * 0.6;
            for (let d = view.ch; d < len; d += view.ch * 0.8) {
              const spread = 1 + d * 0.035;
              for (let s = -spread; s <= spread; s += view.cw) {
                const x = view.w * bx + Math.cos(angle) * d - Math.sin(angle) * s;
                const y = horizon - view.h * 0.12 + Math.sin(angle) * d + Math.cos(angle) * s;
                const i = f.at(x, y);
                if (i >= 0 && hash1(i * 11 + Math.floor(t * 4)) < 0.6) f.put(i, GLYPH, ink.beam, 0.24 * (1 - d / len));
              }
            }
          }
        }

        for (const fl of flyers) {
          const dir = Math.sign(fl.vx);
          for (let k = 0; k < (night ? 2 : 1); k++) {
            const i = f.at(fl.x - dir * k * view.cw, fl.y);
            if (i >= 0) f.put(i, TILE, ink.car, 1);
          }
          for (let k = 1; k <= (night ? 7 : 10); k++) {
            const i = f.at(fl.x - dir * (k + 1) * view.cw, fl.y);
            if (i >= 0) f.put(i, GLYPH, fl.trail, (night ? 0.75 : 0.5) * (1 - k / 11), dash);
          }
          if (night) f.glow(fl.x, fl.y, 26, fl.trail === ink.trail1 ? '#2fd9ff' : '#ff3fb8', 0.35);
        }

        // Laptop glow of the person on the cliff.
        if (night) f.glow(edge + view.cw * 3.5, top(edge + view.cw * 3) - view.ch * 1.5, 46, '#43e8ff', 0.55);
      },

      front(f) {
        const { edge, lip, top, face } = geo();
        f.each(edge - view.w * 0.06, lip - view.h * 0.1, view.w, view.h, (x, y, i) => {
          const surface = top(x);
          if (y < surface || x < face(y)) return;
          const fromTop = y - surface;
          const fromFace = x - face(y);
          if (fromTop < view.ch * 1.1) f.put(i, TILE, hash1(i) < 0.4 ? ink.grassLight : ink.grass, 1);
          else if (fromFace < view.cw * 1.1) f.put(i, TILE, night ? ink.rim : ink.rockEdge, night ? 0.85 : 1);
          else f.put(i, BLOCK, fbm2(x / 90, y / 22) > 0.08 ? ink.rockDark : ink.rock, 1);
        });

        // Lone tree near the right edge.
        const tx = edge + (view.w - edge) * 0.62;
        const base = top(tx);
        const R = clamp(view.h * 0.08, 48, 84);
        f.each(tx - R * 1.9, base - R * 3.7, tx + R * 1.9, base, (x, y, i) => {
          let d = sdCircle(x, y, tx, base - R * 2.6, R);
          d = smin(d, sdCircle(x, y, tx - R * 0.85, base - R * 2.05, R * 0.7), 18);
          d = smin(d, sdCircle(x, y, tx + R * 0.85, base - R * 2.15, R * 0.72), 18);
          d += noise2(x / 18, y / 18) * 6;
          if (d < 0) {
            const lit = night ? d > -view.cw * 1.2 && x < tx : tx - x + (base - R * 2.6 - y) > R * 0.2;
            f.put(i, TILE, lit ? (night ? ink.rim : ink.leafLight) : ink.leaf, night && lit ? 0.7 : 1);
          } else if (Math.abs(x - tx) < view.cw * 0.8 && y > base - R * 2.2) {
            f.put(i, TILE, ink.trunk, 1);
          }
        });

        // Someone sitting at the edge, laptop open, facing the city.
        const px = edge + view.cw * 2;
        f.sprite(['.h', 'sb', 'bb'], { h: [TILE, ink.skin], b: [TILE, ink.person], s: [TILE, ink.screen] }, px, top(px) - view.ch * 3);
      },
    };
  },
};
