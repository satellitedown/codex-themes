import { solid, tone } from '../engine/color.js';
import { BLOCK, GLYPH, TILE } from '../engine/field.js';
import { hash1, noise2, rng, sdCircle, smin, smoothstep } from '../engine/math.js';
import { starfield } from './kit.js';

const BALLOON_COLORS = [
  ['balloonRed', 'balloonYellow'],
  ['balloonTeal', 'balloonWhite'],
  ['balloonPurple', 'balloonYellow'],
  ['balloonBlue', 'balloonWhite'],
  ['balloonYellow', 'balloonRed'],
  ['balloonWhite', 'balloonTeal'],
];

/**
 * Rolling hills and terraces around a river village. Day: striped hot-air
 * balloons drifting up out of the valley. Night: paper sky lanterns released
 * from the village float up and fade among the stars.
 */
export default {
  id: 'lantern-valley',
  name: 'Lantern Valley',
  chars: { tile: 't%S;:#', halo: "'.:;o", extra: "|-.+*^'" },
  shimmer: 1.0,
  palettes: {
    light: {
      bg: {
        stops: [[0, '#8bcff2'], [0.42, '#cdeaf6'], [0.6, '#f6eedf'], [1, '#f3e6d0']],
        spots: [{ x: 0.86, y: 0.12, r: 0.3, color: 'rgba(255, 244, 214, 0.8)' }],
        vignette: 0,
        texture: { color: '#ffffff', alpha: 0.28, chars: '-.', scale: 0.08, threshold: 0.2, density: 0.4, bottom: 0.4 },
      },
      inks: {
        hill1: solid('#bcdcc6'),
        hill1Edge: tone('#b0d5bc', 0.08),
        hill2: solid('#9ccf98'),
        hill2Edge: tone('#8fc68a', 0.12),
        hill3: solid('#7abf67'),
        hill3Edge: tone('#6cb45b', 0.14),
        terrace: solid('#88c873'),
        hill4: solid('#5ea84f'),
        hill4Edge: tone('#549e46', 0.16),
        river: solid('#9fd7ec'),
        riverGlint: solid('#ffffff'),
        wall: tone('#f5e8d2', 0.1),
        roof: tone('#d9714f', 0.14),
        houseWindow: solid('#7aa6c8'),
        balloonRed: tone('#ef6a5a', 0.14),
        balloonYellow: tone('#f6c95a', 0.14),
        balloonTeal: tone('#4fc1b9', 0.14),
        balloonPurple: tone('#9b7fe0', 0.14),
        balloonWhite: tone('#ffffff', 0.1),
        balloonBlue: tone('#5f9fe8', 0.14),
        basket: tone('#9a6b44', 0.14),
        rope: solid('#7a6a5a'),
        flame: solid('#ffb347'),
        lantern: tone('#ffb04a', 0.2),
        lanternCore: tone('#ffe2a0', 0.2),
        star: solid('#ffffff'),
        grass: tone('#5ea84f', 0.16),
        grassDark: tone('#4f9644', 0.16),
        flowerPink: solid('#f49ac0'),
        flowerYellow: solid('#ffe27a'),
        flowerWhite: solid('#ffffff'),
      },
      ui: { base: '#e9f2ec', sidebar: 'rgba(242, 248, 244, 0.68)', composer: 'rgba(253, 254, 252, 0.88)', accent: '#d9714f', bubble: 'rgba(217, 113, 79, 0.13)' },
      lane: 0.55,
    },
    dark: {
      bg: {
        stops: [[0, '#050920'], [0.45, '#111a44'], [0.62, '#2a2a5a'], [1, '#0c0f2a']],
        spots: [{ x: 0.7, y: 0.6, r: 0.42, color: 'rgba(255, 150, 60, 0.14)' }],
        vignette: 0.22,
        texture: null,
      },
      inks: {
        hill1: solid('#1c2350'),
        hill1Edge: tone('#232b5e', 0.08),
        hill2: solid('#161c42'),
        hill2Edge: tone('#1c2350', 0.1),
        hill3: solid('#10153a'),
        hill3Edge: tone('#161c47', 0.1),
        terrace: solid('#131942'),
        hill4: solid('#0b0f2c'),
        hill4Edge: tone('#101537', 0.1),
        river: solid('#151d4a'),
        riverGlint: solid('#ffb04a'),
        wall: tone('#1c203e', 0.08),
        roof: tone('#271d3c', 0.1),
        houseWindow: solid('#ffc06b'),
        balloonRed: tone('#5a2a30', 0.1),
        balloonYellow: tone('#5a4a2a', 0.1),
        balloonTeal: tone('#1f4a48', 0.1),
        balloonPurple: tone('#3a2f5a', 0.1),
        balloonWhite: tone('#3a3a50', 0.1),
        balloonBlue: tone('#24365a', 0.1),
        basket: tone('#2a1e18', 0.1),
        rope: solid('#2a2a3a'),
        flame: solid('#ffb347'),
        lantern: tone('#ffa640', 0.25),
        lanternCore: tone('#ffe2a0', 0.2),
        star: solid('#e6e9ff'),
        grass: tone('#0e1434', 0.1),
        grassDark: tone('#0b102c', 0.1),
        flowerPink: solid('#4a3a6a'),
        flowerYellow: solid('#5a5070'),
        flowerWhite: solid('#6a6a90'),
      },
      ui: { base: '#111a44', sidebar: 'rgba(9, 13, 36, 0.62)', composer: 'rgba(13, 18, 48, 0.86)', accent: '#ffb04a', bubble: 'rgba(255, 176, 74, 0.18)' },
      lane: 0.62,
    },
  },

  scene(view) {
    const rand = rng(0x1a7e);
    const { ink, night } = view;
    const stars = starfield(view, rand, { count: 110, top: 0, bottom: 0.5, glyphs: '.+*', bright: 0.22 });
    const slot = { bar: view.glyph('|'), dash: view.glyph('-'), dot: view.glyph('.'), flame: view.glyph('^') };

    const ridge = (k, x) => {
      const [base, amp, freq, phase] = [
        [0.56, 0.08, 1 / 340, 0.4],
        [0.64, 0.1, 1 / 260, 2.1],
        [0.75, 0.09, 1 / 300, 4.2],
        [0.88, 0.07, 1 / 220, 1.3],
      ][k];
      return view.h * base - view.h * amp * (0.5 + 0.35 * Math.sin(x * freq + phase) + 0.25 * noise2(x * freq * 2.3, phase));
    };
    const riverY = (x) => view.h * 0.715 + Math.sin(x / 140 + 0.6) * view.h * 0.02;
    const village = () => ({ x0: view.w * 0.6, x1: view.w * 0.84 });

    const balloons = night
      ? []
      : Array.from({ length: 7 }, (_, k) => ({
          x: rand.range(0.05, 0.95) * view.w,
          y: rand.range(0.12, 0.62) * view.h,
          s: rand.range(0.7, 1.5),
          vy: -rand.range(5, 11),
          vx: rand.range(3, 9),
          colors: BALLOON_COLORS[k % BALLOON_COLORS.length],
          phase: rand() * 10,
        }));
    const lanterns = night
      ? Array.from({ length: 46 }, () => {
          const { x0, x1 } = village();
          return { x: rand.range(x0, x1), y: rand.range(0.05, 0.66) * view.h, s: rand.range(0.5, 1.2), vy: -rand.range(8, 18), phase: rand() * 10 };
        })
      : [];

    return {
      update(dt) {
        for (const b of balloons) {
          b.y += b.vy * b.s * dt;
          b.x += b.vx * dt;
          if (b.y < -90 * b.s || b.x > view.w + 80) {
            b.y = view.h * rand.range(0.58, 0.66);
            b.x = rand.range(-0.05, 0.85) * view.w;
          }
        }
        for (const l of lanterns) {
          l.y += l.vy * l.s * dt;
          if (l.y < -20) {
            const { x0, x1 } = village();
            l.y = view.h * 0.64;
            l.x = rand.range(x0, x1);
          }
        }
      },

      back(f) {
        for (let k = 0; k < 4; k++) {
          const fill = ink[`hill${k + 1}`];
          const edge = ink[`hill${k + 1}Edge`];
          f.each(0, view.h * 0.4, view.w, view.h, (x, y, i) => {
            const top = ridge(k, x);
            if (y < top) return;
            if (k === 2 && Math.abs(y - riverY(x)) < view.ch * 0.9 && y < ridge(3, x)) {
              f.put(i, BLOCK, ink.river, 1);
              return;
            }
            if (y - top < view.ch) f.put(i, TILE, edge, 1);
            else if (k === 2 && Math.floor((y - top) / view.ch) % 2 === 0 && x > view.w * 0.2) f.put(i, BLOCK, ink.terrace, 1);
            else f.put(i, BLOCK, fill, 1);
          });
        }
        // Village houses on the second hill.
        const { x0, x1 } = village();
        for (let x = x0; x < x1; x += view.cw * 6) {
          const base = ridge(1, x + view.cw * 2) + view.ch * 0.6;
          f.sprite(['.rr.', 'rrrr', 'wWww'], { r: [TILE, ink.roof], w: [TILE, ink.wall], W: [TILE, ink.houseWindow] }, x, base - view.ch * 3);
        }
      },

      paint(f, t) {
        if (night) {
          stars.paint(f, t, ink.star);
          const { x0, x1 } = village();
          f.glow((x0 + x1) / 2, view.h * 0.62, 180, '#ff9a3c', 0.18);
          // Lanterns rise, sway and fade high up; the river mirrors the low ones.
          for (const l of lanterns) {
            const x = l.x + Math.sin(t * 0.6 + l.phase) * 10 * l.s;
            const fade = smoothstep(0, view.h * 0.3, l.y);
            const flicker = 0.85 + 0.15 * Math.sin(t * 7 + l.phase * 3);
            f.glow(x, l.y, 14 + 18 * l.s, '#ff9a3c', 0.42 * fade * flicker);
            const i = f.at(x, l.y);
            if (i >= 0) f.put(i, TILE, l.s > 0.9 ? ink.lanternCore : ink.lantern, fade * flicker);
            if (l.s > 0.95) {
              const below = f.at(x, l.y + view.ch);
              if (below >= 0) f.put(below, TILE, ink.lantern, 0.85 * fade);
            }
            if (l.y > view.h * 0.45) {
              const ry = riverY(x);
              const j = f.at(x, ry);
              if (j >= 0) f.put(j, GLYPH, ink.riverGlint, 0.45 * fade, slot.dash);
            }
          }
          // Glow around the lit village windows.
          for (let x = x0; x < x1; x += view.cw * 6) f.glow(x + view.cw * 1.5, ridge(1, x + view.cw * 2) - view.ch * 0.4, 26, '#ffc06b', 0.4);
        } else {
          f.each(0, view.h * 0.67, view.w, view.h * 0.77, (x, y, i) => {
            if (Math.abs(y - riverY(x)) < view.ch * 0.9 && hash1(i * 3 + Math.floor(t * 2)) < 0.08) f.put(i, GLYPH, ink.riverGlint, 0.8, slot.dash);
          });
          const sorted = [...balloons].sort((a, b) => a.s - b.s);
          for (const b of sorted) {
            const r = 34 * b.s;
            const cx = b.x + Math.sin(t * 0.4 + b.phase) * 6;
            const cy = b.y;
            const [c1, c2] = b.colors;
            f.each(cx - r - 4, cy - r * 1.2, cx + r + 4, cy + r * 1.3, (x, y, i) => {
              let d = sdCircle(x, y, cx, cy, r);
              const taper = cy + r * 1.25 - y;
              if (y > cy) d = smin(d, Math.abs(x - cx) - Math.max(0, taper) * 0.55 + 2, r * 0.3);
              if (y > cy + r * 1.25) d = 1;
              if (d < 0) f.put(i, TILE, Math.floor((x - cx) / (r * 0.42) + 10) % 2 ? ink[c1] : ink[c2], 1);
            });
            for (const side of [-0.3, 0.3]) {
              const i = f.at(cx + side * r, cy + r * 1.45);
              if (i >= 0) f.put(i, GLYPH, ink.rope, 0.8, slot.bar);
            }
            const basket = f.at(cx, cy + r * 1.45 + view.ch);
            if (basket >= 0) f.put(basket, TILE, ink.basket, 1);
            if ((t + b.phase) % 6 < 0.7) {
              const flame = f.at(cx, cy + r * 1.3);
              if (flame >= 0) f.put(flame, GLYPH, ink.flame, 0.9, slot.flame);
            }
          }
        }
      },

      front(f) {
        // Meadow edge with flowers along the bottom.
        f.each(0, view.h * 0.9, view.w, view.h, (x, y, i) => {
          const top = view.h * 0.95 + noise2(x / 60, 7.7) * view.h * 0.025;
          if (y < top) return;
          const flower = hash1(i * 23) < 0.14;
          const color = [ink.flowerPink, ink.flowerYellow, ink.flowerWhite][Math.floor(hash1(i * 5) * 3)];
          if (flower && y - top < view.ch * 1.5) f.put(i, TILE, color, 0.95);
          else f.put(i, TILE, hash1(i) < 0.5 ? ink.grass : ink.grassDark, 1);
        });
      },
    };
  },
};
