import { solid, tone } from '../engine/color.js';
import { BLOCK, GLYPH, TILE } from '../engine/field.js';
import { clamp, fbm2, hash1, noise2, rng, sdCircle, smin, smoothstep } from '../engine/math.js';
import { ripples, starfield } from './kit.js';

const RAINBOW = ['rb1', 'rb2', 'rb3', 'rb4', 'rb5', 'rb6'];

/** Layered pine: three stacked tiers narrowing to a point, trunk underneath. */
function pine(f, x, base, height, leaf, leafLight, trunk, alpha = 1) {
  const trunkH = height * 0.14;
  const crown = height - trunkH;
  f.each(x - height * 0.4, base - height, x + height * 0.4, base, (cx, cy, i) => {
    const up = base - cy;
    if (up < trunkH) {
      if (Math.abs(cx - x) < f.cw * 0.6) f.put(i, TILE, trunk, alpha);
      return;
    }
    const p = (up - trunkH) / crown;
    const tier = (p * 3) % 1;
    const half = height * 0.36 * (1 - p) * (0.55 + 0.45 * (1 - tier));
    if (Math.abs(cx - x) < half) f.put(i, TILE, cx < x ? leafLight : leaf, alpha);
  });
}

/**
 * A waterfall pouring from a mossy cliff into a pool, pines on the rim and
 * along the valley, distant mountains in haze. Day: blue sky and a rainbow in
 * the spray. Night: moonlight on the water, stars, fireflies over the meadow.
 */
export default {
  id: 'waterfall',
  name: 'Waterfall',
  chars: { tile: 't%S;:#', halo: "'.:;o", extra: "|:'.~-ov^*+" },
  shimmer: 1.1,
  palettes: {
    light: {
      bg: {
        stops: [[0, '#68bfee'], [0.35, '#a4daf6'], [0.6, '#d3eef8'], [1, '#e4f4ef']],
        spots: [{ x: 0.08, y: 0.06, r: 0.34, color: 'rgba(255, 250, 222, 0.75)' }],
        vignette: 0,
        texture: { color: '#ffffff', alpha: 0.28, chars: '-.', scale: 0.08, threshold: 0.2, density: 0.4, bottom: 0.35 },
      },
      inks: {
        mountain: solid('#b6d8ea'),
        mountainEdge: tone('#a9cfe3', 0.08),
        forestFar: tone('#8fc2a0', 0.1),
        forestFarLight: tone('#9fceac', 0.1),
        forest: tone('#4f9558', 0.16),
        forestLight: tone('#66ad69', 0.16),
        trunk: tone('#7b5a3e', 0.12),
        meadow: solid('#b3dc9a'),
        meadowEdge: tone('#9fd286', 0.14),
        flower: solid('#ffffff'),
        rock: tone('#a99d8a', 0.1),
        rockDark: tone('#958974', 0.1),
        moss: tone('#7fb95e', 0.18),
        water: solid('#e8f8fd'),
        waterEdge: solid('#cdeefa'),
        streak: solid('#86c9e4'),
        foam: solid('#ffffff'),
        mist: solid('#ffffff'),
        pool: solid('#8fd0e6'),
        poolDeep: solid('#76c2dd'),
        ripple: solid('#effaff'),
        leaf: tone('#4e9b48', 0.2),
        leafLight: tone('#77c35d', 0.2),
        rb1: solid('#ff7070'),
        rb2: solid('#ffad55'),
        rb3: solid('#ffe36e'),
        rb4: solid('#72dc84'),
        rb5: solid('#58b1f6'),
        rb6: solid('#9b7cf8'),
        star: solid('#ffffff'),
        moon: tone('#fff6d8', 0.1),
        fly: tone('#f4ff9a', 0.3),
        bird: solid('#3d5d6c'),
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
        mountain: solid('#11243a'),
        mountainEdge: tone('#162b42', 0.08),
        forestFar: tone('#0e2229', 0.08),
        forestFarLight: tone('#11272e', 0.08),
        forest: tone('#0a1c1d', 0.12),
        forestLight: tone('#0e2525', 0.12),
        trunk: tone('#0e1716', 0.1),
        meadow: solid('#0c1f1c'),
        meadowEdge: tone('#102722', 0.12),
        flower: solid('#5a7a8a'),
        rock: tone('#26313f', 0.1),
        rockDark: tone('#1e2735', 0.1),
        moss: tone('#1a3d32', 0.14),
        water: solid('#7fb2d8'),
        waterEdge: solid('#6a9cc6'),
        streak: solid('#e2efff'),
        foam: solid('#e6f2ff'),
        mist: solid('#bcd6f2'),
        pool: solid('#10304c'),
        poolDeep: solid('#0b253d'),
        ripple: solid('#93bce4'),
        leaf: tone('#0f2a22', 0.14),
        leafLight: tone('#17392d', 0.14),
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
    const slot = { bar: view.glyph('|'), colon: view.glyph(':'), tick: view.glyph("'"), dot: view.glyph('.'), wave: view.glyph('~'), dash: view.glyph('-'), o: view.glyph('o'), up: view.glyph('^'), down: view.glyph('v') };

    const geo = () => {
      const top = view.h * 0.22;
      const fx = view.w * 0.72;
      const fw = clamp(view.w * 0.055, 50, 96);
      const horizon = view.h * 0.66;
      const pool = view.h * 0.8;
      const cliffEdge = (y) => view.w * 0.61 - (y - top) * 0.1 + noise2(y / 34, 7.7) * 16;
      const cliffTop = (x) => top + noise2(x / 50, 2.9) * 10 + Math.max(0, (x - (fx + fw)) / view.w) * view.h * 0.1;
      return { top, fx, fw, horizon, pool, cliffEdge, cliffTop };
    };

    const birds = night ? [] : Array.from({ length: 5 }, (_, k) => ({ x: rand() * view.w, y: rand.range(0.06, 0.26) * view.h, vx: rand.range(14, 24), phase: k * 1.7 }));
    const flies = night ? Array.from({ length: 12 }, () => ({ u: rand(), v: rand(), seed: rand() * 40, period: rand.range(2.5, 5) })) : [];
    let nextRing = 0;

    return {
      update(dt) {
        const { fx, fw, pool } = geo();
        for (const b of birds) {
          b.x += b.vx * dt;
          if (b.x > view.w + 30) b.x = -30;
        }
        rings.update(dt);
        nextRing -= dt;
        if (nextRing <= 0) {
          nextRing = rand.range(0.45, 1);
          rings.spawn(fx + rand.range(-0.5, 0.5) * fw, pool + view.ch * rand.range(0.6, 2), rand.range(50, 110), rand.range(1.8, 2.8), 0.32);
        }
      },

      back(f) {
        const { fx, fw, horizon, pool, cliffEdge, cliffTop } = geo();
        const left = fx - fw / 2;
        const right = fx + fw / 2;

        // Hazy mountain range.
        f.each(0, view.h * 0.3, view.w, horizon, (x, y, i) => {
          const ridge = horizon - view.h * (0.1 + Math.abs(noise2(x / 220, 1.1)) * 0.2 + noise2(x / 60, 4.4) * 0.015);
          if (y >= ridge) f.put(i, y - ridge < view.ch ? TILE : BLOCK, y - ridge < view.ch ? ink.mountainEdge : ink.mountain, 1);
        });
        // Meadow up to the pool.
        f.each(0, horizon - view.ch, view.w, view.h, (x, y, i) => {
          if (y < horizon + noise2(x / 80, 6.6) * 6) return;
          const flower = hash1(i * 19) < 0.04;
          if (flower) f.put(i, GLYPH, ink.flower, 0.7, slot.dot);
          else f.put(i, y - horizon < view.ch * 1.2 ? TILE : BLOCK, y - horizon < view.ch * 1.2 ? ink.meadowEdge : ink.meadow, 1);
        });
        // Two depths of pines along the valley floor.
        const r = rng(0x9e1e);
        for (let x = -20; x < view.w + 20; x += r.range(18, 34)) pine(f, x, horizon + view.ch * 0.5, r.range(36, 64), ink.forestFar, ink.forestFarLight, ink.forestFar, 1);
        for (let x = -10; x < view.w * 0.6; x += r.range(40, 90)) pine(f, x, horizon + view.ch * r.range(1.5, 3), r.range(70, 120), ink.forest, ink.forestLight, ink.trunk, 1);

        // Pool and stream.
        f.each(view.w * 0.38, pool - view.ch, view.w, view.h, (x, y, i) => {
          const shore = view.w * 0.46 - (y - pool) * 0.6 + noise2(y / 20, 3.1) * 10;
          if (x < shore || y < pool) return;
          f.put(i, BLOCK, x - shore < view.cw * 1.5 || y - pool < view.ch ? ink.pool : ink.poolDeep, 1);
        });

        // Cliff with the falls cutting through it.
        f.each(view.w * 0.45, view.h * 0.12, view.w, pool + view.ch, (x, y, i) => {
          if (y < cliffTop(x) || x < cliffEdge(y) || y > pool) return;
          if (x > left && x < right) return;
          const surface = y - cliffTop(x) < view.ch * 1.2 || x - cliffEdge(y) < view.cw;
          const mossy = surface || fbm2(x / 70, y / 50) > 0.28;
          f.put(i, TILE, mossy ? ink.moss : fbm2(x / 110, y / 24) > 0.05 ? ink.rockDark : ink.rock, 1);
        });
        // Falls curtain.
        f.each(left, cliffTop(fx) - view.ch * 0.5, right - 1, pool, (x, y, i) => f.put(i, BLOCK, Math.abs(x - fx) < fw * 0.3 ? ink.water : ink.waterEdge, 1));
        // Pines on the cliff rim.
        for (const u of [0.04, 0.18, 0.62, 0.8, 0.93]) {
          const x = view.w * (0.62 + u * 0.38);
          if (Math.abs(x - fx) < fw) continue;
          pine(f, x, cliffTop(x) + view.ch * 0.5, 60 + hash1(Math.round(x)) * 50, ink.forest, ink.forestLight, ink.trunk, 1);
        }
      },

      paint(f, t) {
        const { fx, fw, pool, cliffTop } = geo();
        const left = fx - fw / 2;
        const right = fx + fw / 2;

        if (night) {
          stars.paint(f, t, ink.star);
          const mx = view.w * 0.46;
          const my = view.h * 0.13;
          f.glow(mx, my, 150, '#cfdcff', 0.25);
          f.each(mx - 50, my - 50, mx + 50, my + 50, (x, y, i) => f.shape(i, sdCircle(x, y, mx, my, 34) + (sdCircle(x, y, mx + 12, my - 8, 8) < 0 ? 3 : 0), ink.moon, 1, ink.moon, 0.4));
        } else {
          for (const b of birds) {
            const i = f.at(b.x, b.y + Math.sin(t + b.phase) * 5);
            if (i >= 0) f.put(i, GLYPH, ink.bird, 0.8, Math.floor(t * 3 + b.phase) % 2 ? slot.up : slot.down);
          }
        }

        // Streaks scrolling down the curtain.
        const lipY = cliffTop(fx);
        const c0 = Math.ceil(left / view.cw);
        const c1 = Math.floor(right / view.cw) - 1;
        for (let c = c0; c <= c1; c++) {
          const speed = 1.6 + hash1(c * 3) * 1.4;
          const phase = hash1(c * 7) * 10;
          for (let y = lipY + view.ch * 0.5; y < pool; y += view.ch) {
            const i = f.at((c + 0.5) * view.cw, y);
            if (i < 0) continue;
            const p = ((((y / view.ch) * 0.16 - t * speed + phase) % 1) + 1) % 1;
            if (p < 0.32) f.put(i, GLYPH, ink.streak, 0.9, slot.bar);
            else if (p < 0.46) f.put(i, GLYPH, ink.streak, 0.55, slot.colon);
          }
          const lip = f.at((c + 0.5) * view.cw, lipY);
          if (lip >= 0 && hash1(lip + Math.floor(t * 6)) < 0.75) f.put(lip, TILE, ink.foam, 0.95);
        }

        // Spray where the curtain meets the pool.
        f.each(left - fw, pool - view.h * 0.1, right + fw, pool + view.ch * 2, (x, y, i) => {
          const rise = (pool - y) / (view.h * 0.1);
          const spread = 1 - Math.abs(x - fx) / (fw * 1.5);
          const density = spread * (1 - Math.max(0, rise)) * 0.6;
          if (density > 0 && hash1(i * 7 + Math.floor(t * 5 + hash1(i) * 5)) < density) {
            f.put(i, GLYPH, ink.mist, 0.8 * density + 0.15, hash1(i * 3) < 0.4 ? slot.o : hash1(i * 3) < 0.7 ? slot.dot : slot.tick);
          }
        });

        if (!night) {
          // Rainbow arcing through the spray.
          const cx = fx - fw * 0.2;
          const cy = pool + view.ch * 2;
          const R = fw * 2.6;
          const shimmer = 0.8 + 0.2 * Math.sin(t * 0.6);
          f.each(cx - R - 10, cy - R - 10, cx + R + 10, cy, (x, y, i) => {
            const band = Math.floor((R - Math.hypot(x - cx, y - cy)) / (view.cw * 0.7));
            if (band < 0 || band >= RAINBOW.length) return;
            const fade = smoothstep(cy, cy - R * 0.45, y) * shimmer;
            f.put(i, TILE, ink[RAINBOW[band]], 0.5 * fade);
          });
        } else {
          // Moonlight glitter on the pool.
          f.each(view.w * 0.5, pool + view.ch, view.w, view.h, (x, y, i) => {
            if (hash1(i * 3 + Math.floor(t * 2.5)) < 0.06) f.put(i, GLYPH, ink.ripple, 0.6, slot.dash);
          });
        }

        rings.paint(f, ink.ripple);

        for (const fl of flies) {
          const p = ((t + fl.seed) % fl.period) / fl.period;
          const b = smoothstep(0, 0.15, p) * (1 - smoothstep(0.35, 0.6, p));
          if (b < 0.05) continue;
          const x = view.w * (0.02 + fl.u * 0.5) + noise2(fl.seed, t * 0.2) * 40;
          const y = view.h * (0.7 + fl.v * 0.26) + noise2(t * 0.2, fl.seed) * 20;
          f.glow(x, y, 30, '#e6ff8a', 0.45 * b);
          const i = f.at(x, y);
          if (i >= 0) f.put(i, TILE, ink.fly, b);
        }
      },

      front(f) {
        // Fern clumps framing the bottom corners.
        const clumps = [
          [view.w * 0.34, view.h + 10, clamp(view.h * 0.15, 80, 140)],
          [view.w * 0.99, view.h + 6, clamp(view.h * 0.18, 100, 170)],
        ];
        for (const [cx, cy, R] of clumps) {
          f.each(cx - R * 1.4, cy - R * 1.3, cx + R * 1.4, cy, (x, y, i) => {
            let d = 1e9;
            for (let k = 0; k < 7; k++) {
              const a = Math.PI * (0.12 + (k / 6) * 0.76);
              const len = R * (0.75 + hash1(k + Math.round(cx)) * 0.4);
              const dx = -Math.cos(a) * len;
              const dy = -Math.sin(a) * len;
              const h = clamp(((x - cx) * dx + (y - cy) * dy) / (dx * dx + dy * dy), 0, 1);
              d = smin(d, Math.hypot(x - cx - dx * h, y - cy - dy * h) - (1 - h) * 14 - 3, 8);
            }
            if (d < 0) f.put(i, TILE, d < -8 ? ink.leaf : ink.leafLight, 1);
            else if (d < view.cw && hash1(i) < 0.3) f.put(i, GLYPH, ink.leafLight, 0.6);
          });
        }
      },
    };
  },
};
