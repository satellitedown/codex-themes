import { GLYPH } from '../engine/field.js';
import { bayer, clamp, hash1, smoothstep, wrap } from '../engine/math.js';

/**
 * Picks an ink from `ramp` (dark → light ink indices) for a light level
 * `value` in [0, 1], dithering between neighbouring tones with an ordered
 * pattern at cell (c, r): smooth form shading that still reads as pixel art.
 */
export function shade(ramp, value, c, r) {
  const x = clamp(value, 0, 1) * (ramp.length - 1);
  const k = Math.floor(x);
  return ramp[k + 1 < ramp.length && x - k > bayer(c, r) ? k + 1 : k];
}

/**
 * Like shade(), but dithers only in a seam around each step between tones
 * (`seam` = fraction of a step), so big faces read as flat planes with clean
 * edges instead of a speckled gradient.
 */
export function crisp(ramp, value, c, r, seam = 0.4) {
  const x = clamp(value, 0, 1) * (ramp.length - 1);
  const k = Math.floor(x);
  return ramp[k + 1 < ramp.length && smoothstep(0.5 - seam / 2, 0.5 + seam / 2, x - k) > bayer(c, r) ? k + 1 : k];
}

/** Expanding rings of bare glyphs (pond/boat ripples). */
export function ripples(view) {
  const rings = [];
  const ring = view.glyph('o');
  const dot = view.glyph('.');
  return {
    spawn(x, y, maxRadius, duration, squash = 0.55) {
      rings.push({ x, y, maxRadius, duration, squash, age: 0 });
    },
    get count() {
      return rings.length;
    },
    update(dt) {
      for (let k = rings.length - 1; k >= 0; k--) {
        rings[k].age += dt;
        if (rings[k].age >= rings[k].duration) rings.splice(k, 1);
      }
    },
    paint(f, ink) {
      for (const r of rings) {
        const p = r.age / r.duration;
        const radius = r.maxRadius * (1 - (1 - p) * (1 - p));
        const fade = (1 - p) * Math.min(1, p * 6);
        const ry = radius * r.squash;
        f.each(r.x - radius - 8, r.y - ry - 8, r.x + radius + 8, r.y + ry + 8, (x, y, i) => {
          const d = Math.abs(Math.hypot((x - r.x) / radius, (y - r.y) / Math.max(ry, 1)) - 1) * radius;
          if (d < 5 && hash1(i * 5 + 3) < 0.8) f.put(i, GLYPH, ink, fade * 0.8, p < 0.6 ? ring : dot);
        });
      }
    },
  };
}

/** Field of twinkling bare-glyph stars; positions are fractions of the view. */
export function starfield(view, rand, { count, top = 0, bottom = 1, glyphs = '.+*', bright = 0.25 }) {
  const slots = [...glyphs].map((g) => view.glyph(g));
  const stars = Array.from({ length: count }, () => ({
    x: rand(),
    y: top + rand() * (bottom - top),
    slot: rand() < bright ? slots[1 + Math.floor(rand() * (slots.length - 1))] : slots[0],
    speed: rand.range(0.6, 2.2),
    phase: rand() * 6.28,
    base: rand.range(0.35, 0.9),
  }));
  return {
    paint(f, t, ink, dimInk = ink) {
      for (const s of stars) {
        const i = f.at(s.x * view.w, s.y * view.h);
        if (i < 0) continue;
        const tw = 0.55 + 0.45 * Math.sin(t * s.speed + s.phase);
        f.put(i, GLYPH, s.slot === slots[0] ? dimInk : ink, s.base * tw, s.slot);
      }
    },
  };
}

/**
 * Falling/rising bare-glyph particles (snow, rain, bubbles, embers). Positions
 * are fractions of `region` (defaults to the whole view) so resizes are free.
 * vy/vx are px/s ranges; alpha is a [min, max] range.
 */
export function drifters(view, rand, { count, vy, vx = [0, 0], sway = 6, glyphs, alpha = [0.25, 0.75], region = () => ({ x0: 0, y0: 0, x1: view.w, y1: view.h }) }) {
  const slots = [...glyphs].map((g) => view.glyph(g));
  const items = Array.from({ length: count }, () => ({
    u: rand(),
    v: rand(),
    vy: rand.range(vy[0], vy[1]),
    vx: rand.range(vx[0], vx[1]),
    phase: rand() * 6.28,
    slot: slots[Math.floor(rand() * slots.length)],
    alpha: rand.range(alpha[0], alpha[1]),
  }));
  return {
    update(dt) {
      const { x0, y0, x1, y1 } = region();
      const w = Math.max(1, x1 - x0);
      const h = Math.max(1, y1 - y0);
      for (const p of items) {
        p.v += (p.vy * dt) / h;
        p.u += (p.vx * dt) / w;
        if (p.v < 0 || p.v > 1) {
          p.v = wrap(p.v, 0, 1);
          p.u = rand();
        }
        p.u = wrap(p.u, 0, 1);
      }
    },
    paint(f, t, ink, fade = 1) {
      const { x0, y0, x1, y1 } = region();
      for (const p of items) {
        const i = f.at(x0 + p.u * (x1 - x0) + Math.sin(t * 0.7 + p.phase) * sway, y0 + p.v * (y1 - y0));
        if (i >= 0) f.put(i, GLYPH, ink, p.alpha * fade, p.slot);
      }
    },
  };
}
