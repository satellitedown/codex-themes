import { solid, tone } from '../engine/color.js';
import { BLOCK, GLYPH, TILE } from '../engine/field.js';
import { TAU, clamp, fbm2, hash1, noise2, rng, sdCircle } from '../engine/math.js';
import { starfield } from './kit.js';

const SAILBOAT = ['...m...', '..sm...', '.ssmS..', 'sssmSS.', 'hhhhhhh', '.hhhhh.'];

/**
 * A striped lighthouse on a grassy headland, a keeper's cottage beside it,
 * open sea to the horizon. Day: a sailboat crossing, gulls wheeling, sun
 * glitter. Night: the lamp's beam sweeping the sky, ship lights, moonlight.
 */
export default {
  id: 'lighthouse',
  name: 'Lighthouse',
  chars: { tile: 't%S;:#', halo: "'.:;o", extra: "|~-v^.+*:'" },
  shimmer: 1.1,
  palettes: {
    light: {
      bg: {
        stops: [[0, '#62b4ea'], [0.42, '#a6daf6'], [0.6, '#e4f4fa'], [1, '#bfe0ef']],
        spots: [{ x: 0.22, y: 0.1, r: 0.3, color: 'rgba(255, 250, 225, 0.75)' }],
        vignette: 0,
        texture: { color: '#ffffff', alpha: 0.28, chars: '-.', scale: 0.08, threshold: 0.2, density: 0.4, bottom: 0.45 },
      },
      inks: {
        seaFar: solid('#86c6e6'),
        sea: solid('#62aedb'),
        seaDeep: solid('#4c9dcd'),
        wave: solid('#eaf8ff'),
        foam: tone('#ffffff', 0.06),
        glint: solid('#ffffff'),
        island: solid('#a9cada'),
        rock: solid('#9b8f7d'),
        rockDark: solid('#877b6a'),
        rockEdge: tone('#908472', 0.15),
        grass: tone('#74b558', 0.18),
        grassLight: tone('#93cd70', 0.18),
        white: tone('#f8f5ef', 0.08),
        red: tone('#d9473f', 0.14),
        rail: tone('#3d3d46', 0.12),
        lamp: tone('#dceff8', 0.1),
        dome: tone('#3d3d46', 0.12),
        wall: tone('#efe4d0', 0.1),
        roof: tone('#c4553f', 0.14),
        window: solid('#7fb0d0'),
        door: solid('#7a5a44'),
        sail: tone('#ffffff', 0.08),
        jib: tone('#fff4dc', 0.08),
        hull: tone('#b5532f', 0.14),
        mast: solid('#5a4a3a'),
        gull: solid('#4f5d6b'),
        beam: solid('#fff3c4'),
        star: solid('#ffffff'),
        moon: tone('#fff6dc', 0.1),
        shipLight: solid('#ffd27a'),
        shipRed: solid('#ff5a5a'),
      },
      ui: { base: '#cde9f6', sidebar: 'rgba(234, 246, 252, 0.66)', composer: 'rgba(250, 253, 255, 0.86)', accent: '#2a7fc0', bubble: 'rgba(42, 127, 192, 0.13)' },
      lane: 0.55,
    },
    dark: {
      bg: {
        stops: [[0, '#030817'], [0.4, '#0a1631'], [0.6, '#142a4c'], [1, '#071226']],
        spots: [{ x: 0.42, y: 0.12, r: 0.3, color: 'rgba(210, 225, 255, 0.12)' }],
        vignette: 0.25,
        texture: null,
      },
      inks: {
        seaFar: solid('#10264a'),
        sea: solid('#0b1c36'),
        seaDeep: solid('#08152a'),
        wave: solid('#3f6c9c'),
        foam: tone('#a3c5e8', 0.06),
        glint: solid('#cfe0ff'),
        island: solid('#0e1c33'),
        rock: solid('#141a26'),
        rockDark: solid('#0f141e'),
        rockEdge: tone('#1c2333', 0.12),
        grass: tone('#0f2420', 0.12),
        grassLight: tone('#13302a', 0.12),
        white: tone('#2b3142', 0.08),
        red: tone('#5a2328', 0.12),
        rail: tone('#1a1d26', 0.1),
        lamp: tone('#ffe08a', 0.2),
        dome: tone('#1a1d26', 0.1),
        wall: tone('#2a2a36', 0.08),
        roof: tone('#3a2024', 0.1),
        window: solid('#ffcf6b'),
        door: solid('#1a1416'),
        sail: tone('#2a3040', 0.08),
        jib: tone('#2a3040', 0.08),
        hull: tone('#2a1a18', 0.1),
        mast: solid('#1a1a22'),
        gull: solid('#1a2a3a'),
        beam: solid('#ffe9a8'),
        star: solid('#dfe7ff'),
        moon: tone('#f3eed8', 0.12),
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
    const stars = starfield(view, rand, { count: 90, top: 0, bottom: 0.55, glyphs: '.+*', bright: 0.25 });
    const slot = { wave: view.glyph('~'), dash: view.glyph('-'), up: view.glyph('^'), down: view.glyph('v'), colon: view.glyph(':'), tick: view.glyph("'"), dot: view.glyph('.'), mast: view.glyph('|') };

    const geo = () => {
      const horizon = view.h * 0.6;
      const lx = view.w * 0.84;
      const ground = view.h * 0.47;
      const towerH = clamp(view.h * 0.28, 150, 260);
      const base = clamp(view.w * 0.045, 40, 64);
      const top = (x) => {
        const rise = clamp((x - view.w * 0.64) / (view.w * 0.14), 0, 1);
        return horizon - (horizon - ground) * rise * rise * (3 - 2 * rise) + noise2(x / 50, 2.2) * 5;
      };
      return { horizon, lx, ground, towerH, base, top, lampY: ground - towerH + view.ch * 2.5 };
    };

    const sailboat = { x: view.w * 0.2, speed: 12 };
    const gulls = night ? [] : Array.from({ length: 4 }, () => ({ r: rand.range(40, 110), speed: rand.range(0.3, 0.6) * (rand() < 0.5 ? -1 : 1), phase: rand() * TAU, dy: rand.range(-30, 30) }));
    const ships = night ? Array.from({ length: 2 }, () => ({ x: rand() * view.w * 0.6, speed: rand.range(3, 7) })) : [];

    return {
      update(dt) {
        sailboat.x += sailboat.speed * dt;
        if (sailboat.x > view.w * 0.62) sailboat.x = -100;
        for (const s of ships) {
          s.x += s.speed * dt;
          if (s.x > view.w * 0.62) s.x = -20;
        }
      },

      back(f) {
        const { horizon, lx, ground, towerH, base, top } = geo();
        // Distant islands on the horizon.
        f.each(0, horizon - view.h * 0.05, view.w * 0.55, horizon, (x, y, i) => {
          const h = Math.max(0, noise2(x / 120, 8.8)) * view.h * 0.05;
          if (y > horizon - h) f.put(i, BLOCK, ink.island, 1);
        });
        // Sea bands.
        f.each(0, horizon, view.w, view.h, (x, y, i) => {
          const depth = (y - horizon) / (view.h - horizon);
          f.put(i, BLOCK, depth < 0.15 ? ink.seaFar : depth < 0.55 ? ink.sea : ink.seaDeep, 1);
        });
        // Headland.
        f.each(view.w * 0.6, ground - view.ch, view.w, view.h, (x, y, i) => {
          const surface = top(x);
          const shore = view.w * 0.62 + (y - horizon) * 0.35 + noise2(y / 18, 5.1) * 14;
          if (y < surface || x < shore) return;
          if (y - surface < view.ch * 1.1) f.put(i, TILE, hash1(i) < 0.35 ? ink.grassLight : ink.grass, 1);
          else if (x - shore < view.cw) f.put(i, TILE, ink.rockEdge, 1);
          else f.put(i, BLOCK, fbm2(x / 80, y / 20) > 0.05 ? ink.rockDark : ink.rock, 1);
        });
        // Keeper's cottage.
        const cx = lx + base * 1.4;
        f.sprite(['....rr....', '..rrrrrr..', 'rrrrrrrrrr', '.wwwwwwww.', '.wWwwdwWw.', '.wwwwdwww.'], { r: [TILE, ink.roof], w: [TILE, ink.wall], W: [TILE, ink.window], d: [TILE, ink.door] }, cx, top(cx + view.cw * 5) - view.ch * 6);
        // Tower: tapered, striped, gallery, lamp room, dome.
        const bodyTop = ground - towerH;
        f.each(lx - base, bodyTop, lx + base, ground + view.ch, (x, y, i) => {
          const p = (ground - y) / towerH;
          const half = base * (1 - p * 0.38);
          if (Math.abs(x - lx) > half || y > top(x) + view.ch * 0.5) return;
          const band = Math.floor(p * 7);
          f.put(i, TILE, band % 2 ? ink.red : ink.white, 1);
        });
        const topHalf = base * 0.62;
        f.each(lx - topHalf - view.cw, bodyTop - view.ch, lx + topHalf + view.cw, bodyTop, (x, y, i) => f.put(i, TILE, ink.rail, 1));
        f.each(lx - topHalf * 0.8, bodyTop - view.ch * 3, lx + topHalf * 0.8, bodyTop - view.ch, (x, y, i) => f.put(i, TILE, ink.lamp, 1));
        f.each(lx - topHalf * 0.8, bodyTop - view.ch * 5, lx + topHalf * 0.8, bodyTop - view.ch * 3, (x, y, i) => {
          if (Math.abs(x - lx) < topHalf * 0.8 * ((bodyTop - view.ch * 3 - y) < view.ch ? 1 : 0.5)) f.put(i, TILE, ink.dome, 1);
        });
      },

      paint(f, t) {
        const { horizon, lx, lampY } = geo();

        if (night) {
          stars.paint(f, t, ink.star);
          const mx = view.w * 0.42;
          const my = view.h * 0.13;
          f.glow(mx, my, 140, '#cfdcff', 0.24);
          f.each(mx - 46, my - 46, mx + 46, my + 46, (x, y, i) => f.shape(i, sdCircle(x, y, mx, my, 30), ink.moon, 1, ink.moon, 0.4));
          f.each(mx - 70, horizon + view.ch, mx + 70, view.h, (x, y, i) => {
            const spread = 1 - Math.abs(x - mx) / (40 + (y - horizon) * 0.25);
            if (spread > 0 && hash1(i * 3 + Math.floor(t * 2.5)) < spread * 0.5) f.put(i, GLYPH, ink.glint, 0.6 * spread, slot.dash);
          });
          for (const s of ships) {
            const i = f.at(s.x, horizon - view.ch * 0.6);
            if (i >= 0) f.put(i, TILE, Math.floor(t * 1.2) % 2 ? ink.shipRed : ink.shipLight, 0.9);
            f.glow(s.x, horizon - view.ch * 0.6, 20, '#ffd27a', 0.3);
          }
        } else {
          f.each(view.w * 0.1, horizon + view.ch, view.w * 0.36, view.h, (x, y, i) => {
            if (hash1(i * 3 + Math.floor(t * 2.5)) < 0.05) f.put(i, GLYPH, ink.glint, 0.75, slot.dash);
          });
          f.sprite(SAILBOAT, { m: [GLYPH, ink.mast, 1, slot.mast], s: [TILE, ink.sail], S: [TILE, ink.jib], h: [TILE, ink.hull] }, sailboat.x, horizon - view.ch * 4.4 + Math.sin(t * 1.3) * 2);
          for (const g of gulls) {
            const a = t * g.speed + g.phase;
            const i = f.at(lx + Math.cos(a) * g.r * 1.6, lampY - 40 + Math.sin(a) * g.r * 0.5 + g.dy);
            if (i >= 0) f.put(i, GLYPH, ink.gull, 0.85, Math.floor(t * 3 + g.phase) % 2 ? slot.up : slot.down);
          }
        }

        // Waves rolling toward shore.
        f.each(0, horizon + view.ch, view.w, view.h, (x, y, i) => {
          if (hash1(i) > 0.4) return;
          const n = noise2(x / 110 - t * 0.04, (y - horizon) / 18 - t * 0.12);
          if (n > 0.42) f.put(i, GLYPH, ink.wave, Math.min(0.75, (n - 0.42) * 1.8), slot.wave);
        });

        if (night) {
          // Two opposed beams rotating around the lamp; the near side flashes.
          const phase = t * 0.55;
          for (const b of [phase, phase + Math.PI]) {
            const reach = Math.cos(b) * view.w * 0.75;
            const toward = Math.max(0, Math.sin(b));
            const brightness = 0.22 + 0.4 * toward;
            const len = Math.abs(reach);
            const dir = Math.sign(reach) || 1;
            for (let d = view.cw; d < len; d += view.cw) {
              const half = 4 + d * 0.07;
              const cx = lx + dir * d;
              const cy = lampY - d * 0.05;
              for (let y = cy - half; y <= cy + half; y += view.ch) {
                const i = f.at(cx, y);
                if (i < 0 || hash1(i * 11 + Math.floor(t * 6)) > 0.65) continue;
                const fade = (1 - d / len) ** 0.7;
                f.put(i, GLYPH, ink.beam, brightness * fade, hash1(i) < 0.5 ? slot.colon : slot.tick);
              }
            }
            const flash = toward ** 8;
            f.glow(lx, lampY, 70 + flash * 110, '#ffe7a0', 0.5 + flash * 0.4);
          }
        } else {
          f.glow(lx, lampY, 40, '#fff6c8', 0.25);
        }
      },
    };
  },
};
