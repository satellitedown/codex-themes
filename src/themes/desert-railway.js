import { solid, tone } from '../engine/color.js';
import { BLOCK, GLYPH, TILE } from '../engine/field.js';
import { clamp, hash1, noise2, rng, sdCircle, sdSegment } from '../engine/math.js';
import { starfield } from './kit.js';

// Facing right: cab at the back, boiler and smokestack up front, lamp on the nose.
const LOCO = ['......ss...', '.ccc..ss...', '.cwcbbbbbb.', 'ccccbbbbbbL', '.kk..kk.kk.'];
const COACH = ['.rrrrrrr.', 'bwbwbwbwb', 'bbbbbbbbb', '.kk...kk.'];

/**
 * Red mesas over a desert floor, telegraph poles along a single track, and a
 * steam train that rolls through every so often. Day: hard blue sky and heat
 * shimmer. Night: the Milky Way, a headlight raking the rails, lit coaches.
 */
export default {
  id: 'desert-railway',
  name: 'Desert Railway',
  chars: { tile: 't%S;:#', halo: "'.:;o", extra: "=|-T.+*o~v^:'" },
  shimmer: 1.0,
  palettes: {
    light: {
      bg: {
        stops: [[0, '#3f9ee6'], [0.4, '#8fcaf0'], [0.6, '#f2dcc0'], [1, '#efd2a6']],
        spots: [{ x: 0.82, y: 0.16, r: 0.3, color: 'rgba(255, 245, 210, 0.85)' }],
        vignette: 0,
        texture: { color: '#ffffff', alpha: 0.22, chars: '-.', scale: 0.08, threshold: 0.2, density: 0.4, bottom: 0.4 },
      },
      inks: {
        mesaFar: solid('#e5b694'),
        mesaFarBand: solid('#dcab8a'),
        mesaFarEdge: tone('#dba886', 0.1),
        mesa: solid('#c9774f'),
        mesaBand: solid('#b9693f'),
        mesaEdge: tone('#d18659', 0.14),
        sand: solid('#f0d09c'),
        sandDark: solid('#e8c48c'),
        sandEdge: tone('#e9c896', 0.08),
        ballast: tone('#a08a72', 0.14),
        rail: solid('#5f5044'),
        pole: solid('#7a5a40'),
        wire: solid('#6a5a4a'),
        cactus: tone('#5f9e5a', 0.18),
        cactusLight: tone('#79b46a', 0.18),
        shrub: tone('#a3ad6e', 0.16),
        rock: tone('#b88f6c', 0.14),
        loco: tone('#2f5d8a', 0.14),
        locoDark: tone('#24486c', 0.14),
        coach: tone('#c9473f', 0.14),
        roof: tone('#7a3a32', 0.14),
        window: tone('#f6e7b0', 0.12),
        wheel: solid('#2d2d33'),
        stack: solid('#3a3a42'),
        headlight: solid('#fff6c8'),
        smoke: solid('#ffffff'),
        sun: tone('#fff4c4', 0.08),
        heat: solid('#fff6e2'),
        hawk: solid('#5a4636'),
        star: solid('#ffffff'),
        dust: solid('#ffffff'),
        beam: solid('#fff1b0'),
      },
      ui: { base: '#f3e3cb', sidebar: 'rgba(249, 242, 232, 0.68)', composer: 'rgba(255, 253, 249, 0.88)', accent: '#c9673f', bubble: 'rgba(201, 103, 63, 0.13)' },
      lane: 0.55,
    },
    dark: {
      bg: {
        stops: [[0, '#02030c'], [0.45, '#0a1030'], [0.6, '#1b1c48'], [1, '#0e0c22']],
        spots: [{ x: 0.5, y: 0.62, r: 0.5, color: 'rgba(90, 70, 160, 0.18)' }],
        vignette: 0.22,
        texture: null,
      },
      inks: {
        mesaFar: solid('#2b2552'),
        mesaFarBand: solid('#27214c'),
        mesaFarEdge: tone('#3a3268', 0.1),
        mesa: solid('#211b44'),
        mesaBand: solid('#1c173c'),
        mesaEdge: tone('#3a2f66', 0.12),
        sand: solid('#1c1838'),
        sandDark: solid('#181432'),
        sandEdge: tone('#2a2450', 0.08),
        ballast: tone('#1a1828', 0.1),
        rail: solid('#6a6290'),
        pole: solid('#26213a'),
        wire: solid('#2e2946'),
        cactus: tone('#0f1a22', 0.1),
        cactusLight: tone('#13212a', 0.1),
        shrub: tone('#141a24', 0.1),
        rock: tone('#161424', 0.1),
        loco: tone('#1a2440', 0.12),
        locoDark: tone('#141c33', 0.12),
        coach: tone('#3a1c24', 0.12),
        roof: tone('#24121a', 0.1),
        window: tone('#ffcf6b', 0.25),
        wheel: solid('#0a0a10'),
        stack: solid('#121218'),
        headlight: solid('#fff1b0'),
        smoke: solid('#3c3c58'),
        sun: tone('#fff4c4', 0.08),
        heat: solid('#1a1a33'),
        hawk: solid('#1a1a2a'),
        star: solid('#e8ecff'),
        dust: solid('#b8b8ff'),
        beam: solid('#fff1b0'),
      },
      ui: { base: '#0a1030', sidebar: 'rgba(6, 9, 30, 0.62)', composer: 'rgba(10, 14, 40, 0.86)', accent: '#ffcf6b', bubble: 'rgba(255, 207, 107, 0.16)' },
      lane: 0.62,
    },
  },

  scene(view) {
    const rand = rng(0xde5e);
    const { ink, night } = view;
    const stars = starfield(view, rand, { count: 160, top: 0, bottom: 0.6, glyphs: '.+*', bright: 0.2 });
    const slot = { rail: view.glyph('='), bar: view.glyph('|'), dash: view.glyph('-'), tee: view.glyph('T'), dot: view.glyph('.'), colon: view.glyph(':'), o: view.glyph('o'), wave: view.glyph('~'), up: view.glyph('^'), down: view.glyph('v') };

    const geo = () => {
      const horizon = view.h * 0.62;
      const track = Math.round((view.h * 0.76) / view.ch) * view.ch;
      return { horizon, track };
    };

    const mesas = [
      { x: 0.08, w: 0.2, h: 0.17, far: true },
      { x: 0.42, w: 0.16, h: 0.12, far: true },
      { x: 0.66, w: 0.22, h: 0.2, far: true },
      { x: 0.22, w: 0.14, h: 0.1, far: false },
      { x: 0.9, w: 0.18, h: 0.15, far: false },
    ];

    let train = null;
    let nextTrain = 3;
    const puffs = [];

    return {
      update(dt) {
        const { track } = geo();
        if (!train) {
          nextTrain -= dt;
          if (nextTrain <= 0) {
            const dir = rand() < 0.5 ? 1 : -1;
            const coaches = 4 + Math.floor(rand() * 4);
            const length = (LOCO[0].length + coaches * (COACH[0].length + 1)) * view.cw;
            train = { dir, coaches, length, speed: rand.range(110, 150), x: dir > 0 ? -LOCO[0].length * view.cw : view.w, nextPuff: 0 };
          }
        } else {
          train.x += train.dir * train.speed * dt;
          const gone = train.dir > 0 ? train.x - train.length > view.w : train.x + train.length < 0;
          if (gone) {
            train = null;
            nextTrain = rand.range(14, 28);
          } else {
            train.nextPuff -= dt;
            if (train.nextPuff <= 0) {
              train.nextPuff = 0.22;
              const stackX = train.dir > 0 ? train.x + 6.5 * view.cw : train.x + (LOCO[0].length - 6.5) * view.cw;
              puffs.push({ x: stackX, y: track - view.ch * 6, age: 0, vx: -train.dir * rand.range(20, 40), life: rand.range(2.4, 3.4) });
            }
          }
        }
        for (let k = puffs.length - 1; k >= 0; k--) {
          const p = puffs[k];
          p.age += dt;
          p.x += p.vx * dt;
          p.y -= 18 * dt;
          if (p.age > p.life) puffs.splice(k, 1);
        }
      },

      back(f) {
        const { horizon, track } = geo();
        if (night) {
          // Milky Way: a diagonal band of faint dust.
          f.each(0, 0, view.w, horizon, (x, y, i) => {
            const d = Math.abs((y - view.h * 0.05) - (x - view.w * 0.15) * 0.42) / (view.h * 0.12);
            const density = (1 - d) * (0.55 + 0.45 * noise2(x / 60, y / 60));
            if (density > 0 && hash1(i * 7) < density * 0.6) f.put(i, GLYPH, ink.dust, 0.2 + density * 0.35, hash1(i) < 0.6 ? slot.dot : slot.colon);
          });
          // Thin crescent moon.
          const mx = view.w * 0.84;
          const my = view.h * 0.14;
          f.each(mx - 40, my - 40, mx + 40, my + 40, (x, y, i) => {
            const d = Math.max(sdCircle(x, y, mx, my, 26), -sdCircle(x, y, mx + 11, my - 7, 24));
            f.shape(i, d, ink.sun, 1, ink.sun, 0.35);
          });
        } else {
          const sx = view.w * 0.82;
          const sy = view.h * 0.16;
          f.each(sx - 60, sy - 60, sx + 60, sy + 60, (x, y, i) => f.shape(i, sdCircle(x, y, sx, sy, 36), ink.sun, 1, ink.sun, 0.4));
        }
        for (const far of [true, false]) {
          for (const m of mesas.filter((q) => q.far === far)) {
            const cx = m.x * view.w;
            const half = (m.w * view.w) / 2;
            const top = horizon - m.h * view.h + (far ? 0 : view.h * 0.03);
            const bottom = horizon + (far ? 0 : view.h * 0.03);
            f.each(cx - half * 1.5, top - view.ch, cx + half * 1.5, bottom, (x, y, i) => {
              const p = (y - top) / (bottom - top);
              // Sheer walls with a talus flare at the foot.
              const width = half * (0.9 + 0.35 * Math.max(0, (p - 0.55) / 0.45) ** 2) + noise2(y / 14, m.x * 9) * 5;
              if (Math.abs(x - cx) > width || y < top + noise2(x / 40, m.x) * 3) return;
              const edge = y - top < view.ch;
              const band = Math.floor((y - top) / view.ch) % 3 === 1;
              f.put(i, edge ? TILE : BLOCK, edge ? (far ? ink.mesaFarEdge : ink.mesaEdge) : band ? (far ? ink.mesaFarBand : ink.mesaBand) : far ? ink.mesaFar : ink.mesa, 1);
            });
          }
        }
        // Desert floor.
        f.each(0, horizon, view.w, view.h, (x, y, i) => {
          if (y - horizon < view.ch) f.put(i, TILE, ink.sandEdge, 1);
          else f.put(i, BLOCK, noise2(x / 160, y / 30) > 0.2 ? ink.sandDark : ink.sand, 1);
        });
        // Telegraph poles with sagging wires.
        const spacing = clamp(view.w * 0.16, 170, 260);
        const poleTop = track - view.ch * 6;
        for (let x = spacing * 0.3; x < view.w + spacing; x += spacing) {
          for (let k = 1; k <= 5; k++) {
            const i = f.at(x, track - k * view.ch);
            if (i >= 0) f.put(i, GLYPH, ink.pole, 1, k === 5 ? slot.tee : slot.bar);
          }
          for (let s = view.cw; s < spacing; s += view.cw) {
            const sag = Math.sin((s / spacing) * Math.PI) * view.ch * 0.9;
            const i = f.at(x + s, poleTop + view.ch * 0.6 + sag);
            if (i >= 0) f.put(i, GLYPH, ink.wire, 0.8, slot.dash);
          }
        }
        // Track: rails over a ballast bed.
        for (let x = 0; x < view.w; x += view.cw) {
          const r1 = f.at(x + 1, track);
          if (r1 >= 0) f.put(r1, GLYPH, ink.rail, 1, slot.rail);
          const b = f.at(x + 1, track + view.ch);
          if (b >= 0) f.put(b, TILE, ink.ballast, 1);
        }
      },

      paint(f, t) {
        const { horizon, track } = geo();
        if (night) {
          stars.paint(f, t, ink.star);
          f.glow(view.w * 0.84, view.h * 0.14, 110, '#fff4c4', 0.2);
        } else {
          // Heat shimmer on the horizon and a hawk circling.
          f.each(0, horizon - view.ch * 2, view.w, horizon + view.ch, (x, y, i) => {
            if (hash1(i * 5 + Math.floor(t * 4)) < 0.05) f.put(i, GLYPH, ink.heat, 0.5, slot.wave);
          });
          const a = t * 0.35;
          const i = f.at(view.w * 0.3 + Math.cos(a) * 90, view.h * 0.22 + Math.sin(a) * 30);
          if (i >= 0) f.put(i, GLYPH, ink.hawk, 0.85, Math.floor(t * 2) % 2 ? slot.up : slot.down);
        }

        for (const p of puffs) {
          const q = p.age / p.life;
          const i = f.at(p.x, p.y);
          if (i >= 0) f.put(i, q < 0.3 ? TILE : GLYPH, ink.smoke, (night ? 0.55 : 0.85) * (1 - q), q < 0.3 ? -1 : q < 0.7 ? slot.o : slot.dot);
        }

        if (train) {
          const legend = {
            s: [TILE, ink.stack],
            c: [TILE, ink.locoDark],
            w: [TILE, ink.window],
            b: [TILE, ink.loco],
            L: [TILE, ink.headlight],
            k: [TILE, ink.wheel],
            r: [TILE, ink.roof],
          };
          const coachLegend = { ...legend, b: [TILE, ink.coach] };
          const flip = train.dir < 0;
          const step = (COACH[0].length + 1) * view.cw;
          const locoW = LOCO[0].length * view.cw;
          const y0 = track - view.ch * 5;
          f.sprite(LOCO, legend, train.x, y0, flip);
          for (let k = 0; k < train.coaches; k++) {
            const x = train.dir > 0 ? train.x - (k + 1) * step : train.x + locoW + view.cw + k * step;
            f.sprite(COACH, coachLegend, x, y0 + view.ch, flip);
            if (night) f.glow(x + step / 2, y0 + view.ch * 2.5, 40, '#ffcf6b', 0.22);
          }
          if (night) {
            const nose = train.dir > 0 ? train.x + locoW : train.x;
            f.glow(nose, y0 + view.ch * 3.5, 60, '#fff1b0', 0.55);
            for (let d = view.cw; d < view.w * 0.3; d += view.cw) {
              const i = f.at(nose + train.dir * d, track);
              if (i >= 0 && hash1(i + Math.floor(t * 8)) < 0.7) f.put(i, GLYPH, ink.beam, 0.6 * (1 - d / (view.w * 0.3)), slot.rail);
            }
          }
        }
      },

      front(f) {
        // Saguaros and scrub in the foreground corners.
        const saguaro = (x, base, h) => {
          const arms = [
            [x, base, x, base - h, 12],
            [x - h * 0.28, base - h * 0.45, x - h * 0.28, base - h * 0.78, 9],
            [x, base - h * 0.42, x - h * 0.28, base - h * 0.42, 9],
            [x + h * 0.26, base - h * 0.58, x + h * 0.26, base - h * 0.88, 9],
            [x, base - h * 0.55, x + h * 0.26, base - h * 0.55, 9],
          ];
          f.each(x - h * 0.5, base - h - 10, x + h * 0.5, base, (cx, cy, i) => {
            let d = 1e9;
            for (const [ax, ay, bx, by, r] of arms) d = Math.min(d, sdSegment(cx, cy, ax, ay, bx, by, r));
            if (d < 0) f.put(i, TILE, cx < x - 2 ? ink.cactusLight : ink.cactus, 1);
          });
        };
        saguaro(view.w * 0.36, view.h + 4, clamp(view.h * 0.24, 130, 210));
        saguaro(view.w * 0.95, view.h + 4, clamp(view.h * 0.3, 160, 260));
        f.each(0, view.h * 0.9, view.w, view.h, (x, y, i) => {
          if (hash1(i * 31) < 0.06) f.put(i, TILE, hash1(i) < 0.5 ? ink.shrub : ink.rock, 0.9);
        });
      },
    };
  },
};
