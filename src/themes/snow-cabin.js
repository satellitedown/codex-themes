import { solid, tone } from '../engine/color.js';
import { BLOCK, GLYPH, TILE } from '../engine/field.js';
import { clamp, hash1, noise2, rng } from '../engine/math.js';
import { drifters, starfield } from './kit.js';

/** Snow-laden pine: tiers with white caps on their upper edge. */
function pine(f, x, base, height, leaf, leafLight, snow, trunk) {
  const trunkH = height * 0.12;
  const crown = height - trunkH;
  f.each(x - height * 0.4, base - height, x + height * 0.4, base, (cx, cy, i) => {
    const up = base - cy;
    if (up < trunkH) {
      if (Math.abs(cx - x) < f.cw * 0.6) f.put(i, TILE, trunk, 1);
      return;
    }
    const p = (up - trunkH) / crown;
    const tier = (p * 3) % 1;
    const half = height * 0.34 * (1 - p) * (0.55 + 0.45 * (1 - tier));
    if (Math.abs(cx - x) >= half) return;
    const capped = tier > 0.62 || p > 0.88;
    f.put(i, TILE, capped ? snow : cx < x ? leafLight : leaf, 1);
  });
}

/**
 * A log cabin in a snowy clearing: mountains behind, pines around, smoke
 * curling from the chimney while snow falls. Day: crisp blue sky. Night: the
 * aurora ripples overhead and the windows glow warm.
 */
export default {
  id: 'snow-cabin',
  name: 'Snow Cabin',
  chars: { tile: 't%S;:#', halo: "'.:;o", extra: "*.+|:'o" },
  shimmer: 0.9,
  palettes: {
    light: {
      bg: {
        stops: [[0, '#79c3f0'], [0.38, '#b7e1f8'], [0.6, '#e6f5fc'], [1, '#f3f8fc']],
        spots: [{ x: 0.1, y: 0.08, r: 0.32, color: 'rgba(255, 252, 230, 0.75)' }],
        vignette: 0,
        texture: null,
      },
      inks: {
        farRock: solid('#aac1d8'),
        farSnow: solid('#eef5fc'),
        nearRock: solid('#8aa4bf'),
        nearSnow: solid('#f7fbff'),
        ridgeEdge: tone('#dbe7f3', 0.08),
        pineFar: tone('#86ad9e', 0.1),
        pine: tone('#2f6b4f', 0.16),
        pineLight: tone('#3f7d5e', 0.16),
        pineSnow: tone('#f2f7fc', 0.06),
        trunk: tone('#6b4a34', 0.12),
        snow: solid('#f5f9fd'),
        snowShade: solid('#e4edf6'),
        snowEdge: tone('#edf3f9', 0.05),
        print: solid('#b8c8da'),
        log: tone('#a0673f', 0.14),
        logDark: tone('#83532f', 0.14),
        roofSnow: tone('#ffffff', 0.05),
        roofEdge: tone('#d6e2ee', 0.08),
        chimney: tone('#8a8a92', 0.12),
        window: tone('#9cc6e8', 0.12),
        door: tone('#6b4528', 0.12),
        post: tone('#7a5a40', 0.12),
        smoke: solid('#b9c4d2'),
        flake: solid('#ffffff'),
        aurora1: solid('#5dffb0'),
        aurora2: solid('#38e0d0'),
        aurora3: solid('#b47bff'),
        star: solid('#ffffff'),
      },
      ui: { base: '#e3f2fb', sidebar: 'rgba(240, 248, 253, 0.68)', composer: 'rgba(252, 254, 255, 0.88)', accent: '#3a7cc0', bubble: 'rgba(58, 124, 192, 0.13)' },
      lane: 0.55,
    },
    dark: {
      bg: {
        stops: [[0, '#020812'], [0.4, '#061428'], [0.62, '#0b2038'], [1, '#0e2238']],
        spots: [{ x: 0.45, y: 0.18, r: 0.55, color: 'rgba(60, 255, 170, 0.07)' }],
        vignette: 0.22,
        texture: null,
      },
      inks: {
        farRock: solid('#15253b'),
        farSnow: solid('#40597a'),
        nearRock: solid('#101d30'),
        nearSnow: solid('#506c8e'),
        ridgeEdge: tone('#2a3e58', 0.08),
        pineFar: tone('#0f2229', 0.08),
        pine: tone('#0b1f1c', 0.12),
        pineLight: tone('#0f2724', 0.12),
        pineSnow: tone('#4a6684', 0.08),
        trunk: tone('#0d1414', 0.1),
        snow: solid('#1e3049'),
        snowShade: solid('#18283f'),
        snowEdge: tone('#24384f', 0.06),
        print: solid('#142339'),
        log: tone('#3a2418', 0.12),
        logDark: tone('#2c1b12', 0.12),
        roofSnow: tone('#5d7796', 0.08),
        roofEdge: tone('#4b6483', 0.08),
        chimney: tone('#2a2c34', 0.1),
        window: tone('#ffcf6b', 0.25),
        door: tone('#1f140e', 0.1),
        post: tone('#1f1812', 0.1),
        smoke: solid('#4c5c70'),
        flake: solid('#cfe3ff'),
        aurora1: solid('#5dffb0'),
        aurora2: solid('#38e0d0'),
        aurora3: solid('#b47bff'),
        star: solid('#dfe7ff'),
      },
      ui: { base: '#061428', sidebar: 'rgba(4, 12, 26, 0.62)', composer: 'rgba(6, 18, 36, 0.86)', accent: '#5dffb0', bubble: 'rgba(93, 255, 176, 0.16)' },
      lane: 0.62,
    },
  },

  scene(view) {
    const rand = rng(0x5e0e);
    const { ink, night } = view;
    const stars = starfield(view, rand, { count: 70, top: 0, bottom: 0.4, glyphs: '.+*', bright: 0.2 });
    const near = drifters(view, rand, { count: Math.round(view.w / 26), vy: [26, 46], vx: [-14, -4], sway: 10, glyphs: '*+*', alpha: [0.55, 0.9] });
    const far = drifters(view, rand, { count: Math.round(view.w / 14), vy: [12, 22], vx: [-8, -2], sway: 6, glyphs: '..', alpha: [0.3, 0.6] });
    const slot = { o: view.glyph('o'), dot: view.glyph('.'), bar: view.glyph('|'), tick: view.glyph("'") };

    const geo = () => {
      const ground = view.h * 0.68;
      const cx = view.w * 0.8;
      const cw = clamp(Math.round((view.w * 0.1) / view.cw), 9, 13) * view.cw;
      return { ground, cx, cw, cabinBase: ground + view.h * 0.06 };
    };

    const puffs = [];
    let nextPuff = 0;

    return {
      update(dt) {
        near.update(dt);
        far.update(dt);
        nextPuff -= dt;
        if (nextPuff <= 0) {
          nextPuff = 0.35;
          puffs.push({ age: 0, life: rand.range(3.5, 5), drift: rand.range(10, 18), seed: rand() * 10 });
        }
        for (let k = puffs.length - 1; k >= 0; k--) {
          puffs[k].age += dt;
          if (puffs[k].age > puffs[k].life) puffs.splice(k, 1);
        }
      },

      back(f) {
        const { ground, cx, cw, cabinBase } = geo();
        // Two mountain ranges with snow caps.
        for (const [baseY, amp, scale, rock, snow, seed] of [
          [ground - view.h * 0.12, view.h * 0.26, 210, ink.farRock, ink.farSnow, 1.7],
          [ground, view.h * 0.2, 160, ink.nearRock, ink.nearSnow, 6.1],
        ]) {
          f.each(0, baseY - amp - view.ch, view.w, ground, (x, y, i) => {
            const ridge = baseY - amp * (0.45 + 0.55 * Math.abs(noise2(x / scale, seed))) + noise2(x / 40, seed) * 6;
            if (y < ridge) return;
            const cap = y - ridge < amp * 0.22 + noise2(x / 30, seed + 3) * 8;
            f.put(i, y - ridge < view.ch ? TILE : BLOCK, y - ridge < view.ch ? ink.ridgeEdge : cap ? snow : rock, 1);
          });
        }
        // Snowfield.
        f.each(0, ground - view.ch, view.w, view.h, (x, y, i) => {
          const edge = ground + noise2(x / 90, 2.5) * 8;
          if (y < edge) return;
          f.put(i, y - edge < view.ch ? TILE : BLOCK, y - edge < view.ch ? ink.snowEdge : noise2(x / 140, y / 40) > 0.25 ? ink.snowShade : ink.snow, 1);
        });
        // Pines: a hazy far row and nearer clusters.
        const r = rng(0x917e);
        for (let x = -10; x < view.w + 10; x += r.range(16, 30)) pine(f, x, ground + view.ch * 0.5, r.range(30, 52), ink.pineFar, ink.pineFar, ink.ridgeEdge, ink.pineFar);
        for (let x = view.w * 0.02; x < view.w; x += r.range(55, 110)) {
          if (Math.abs(x - cx) < cw * 1.2) continue;
          pine(f, x, ground + view.ch * r.range(1.5, 4), r.range(80, 150), ink.pine, ink.pineLight, ink.pineSnow, ink.trunk);
        }
        // Footprints from the cabin door to the bottom left.
        for (let k = 0; k < 40; k++) {
          const p = k / 40;
          const x = cx - p * view.w * 0.32 + Math.sin(p * 7) * 30;
          const y = cabinBase + view.ch + p * (view.h - cabinBase);
          const i = f.at(x + (k % 2 ? 6 : -6), y);
          if (i >= 0) f.put(i, GLYPH, ink.print, 0.9, slot.dot);
        }
        // Fence.
        for (let k = 0; k < 6; k++) {
          const x = cx + cw * 0.9 + k * view.cw * 2;
          for (let r2 = 0; r2 < 3; r2++) {
            const i = f.at(x, cabinBase - r2 * view.ch);
            if (i >= 0) f.put(i, r2 === 2 ? TILE : GLYPH, r2 === 2 ? ink.roofSnow : ink.post, 1, r2 === 2 ? -1 : slot.bar);
          }
        }
        // Cabin: logs, door, windows, snowy roof, chimney.
        const left = cx - cw / 2;
        const wallTop = cabinBase - view.ch * 4;
        f.each(left, wallTop, left + cw - 1, cabinBase, (x, y, i) => {
          const col = Math.floor((x - left) / view.cw);
          const row = Math.floor((y - wallTop) / view.ch);
          const cols = Math.round(cw / view.cw);
          const door = Math.abs(col - Math.floor(cols / 2)) < 1 && row >= 1;
          const window = (col === 2 || col === cols - 3) && row === 1;
          f.put(i, TILE, door ? ink.door : window ? ink.window : row % 2 ? ink.logDark : ink.log, 1);
        });
        const roofH = view.ch * 4;
        f.each(left - view.cw, wallTop - roofH, left + cw + view.cw, wallTop, (x, y, i) => {
          const p = (wallTop - y) / roofH;
          if (Math.abs(x - cx) < (cw / 2 + view.cw) * (1 - p)) f.put(i, TILE, wallTop - y < view.ch ? ink.roofEdge : ink.roofSnow, 1);
        });
        const chx = cx + cw * 0.25;
        for (let k = 0; k < 4; k++) {
          const i = f.at(chx, wallTop - roofH * 0.45 - k * view.ch);
          if (i >= 0) f.put(i, TILE, k === 3 ? ink.roofSnow : ink.chimney, 1);
        }
      },

      paint(f, t) {
        const { cx, cw, cabinBase } = geo();
        if (night) {
          stars.paint(f, t, ink.star);
          // Aurora: two folded ribbons. Soft glows give the body, sparse vertical
          // glyph rays the texture; brightness is strongest along the lower hem.
          for (let k = 0; k < 2; k++) {
            for (let c = 0; c < f.cols; c++) {
              const x = (c + 0.5) * view.cw;
              const presence = Math.max(0, Math.min(1, (noise2(x / 280 + k * 7, t * 0.05) + 0.25) * 1.6));
              if (presence < 0.05) continue;
              const base = view.h * (0.2 + k * 0.08) + Math.sin(x * 0.0035 + t * 0.1 + k * 2) * view.h * 0.06 + Math.sin(x * 0.012 - t * 0.17 + k) * view.h * 0.018;
              const height = view.h * (0.05 + 0.08 * presence);
              const ray = 0.55 + 0.45 * Math.sin(x * 0.09 + t * 0.8 + k * 1.7);
              if (c % 4 === 0) f.glow(x, base - height * 0.35, 80, k ? '#a06bff' : '#3cffa8', 0.14 * presence);
              for (let y = base - height; y < base; y += view.ch) {
                const i = f.at(x, y);
                if (i < 0) continue;
                const frac = (base - y) / height;
                if (frac > 0.2 && hash1(i * 3 + Math.floor(t * 2)) > 0.55) continue;
                const alpha = presence * ray * (frac < 0.18 ? 0.7 : (1 - frac) ** 1.3 * 0.65);
                const color = frac < 0.45 ? ink.aurora1 : frac < 0.8 ? ink.aurora2 : ink.aurora3;
                if (frac < 0.18) f.put(i, TILE, k ? ink.aurora2 : ink.aurora1, alpha * 0.85);
                else f.put(i, GLYPH, color, alpha, hash1(i) < 0.6 ? slot.bar : slot.tick);
              }
            }
          }
          // Warm window light spilling onto the snow.
          f.glow(cx - cw / 2 + view.cw * 2.5, cabinBase - view.ch * 2.5, 60, '#ffcf6b', 0.45);
          f.glow(cx + cw / 2 - view.cw * 2.5, cabinBase - view.ch * 2.5, 60, '#ffcf6b', 0.45);
        }

        // Chimney smoke.
        const chx = cx + cw * 0.25;
        const chy = cabinBase - view.ch * 4 - view.ch * 4 * 0.45 - view.ch * 4;
        for (const p of puffs) {
          const q = p.age / p.life;
          const x = chx - p.drift * p.age + Math.sin(p.age * 1.3 + p.seed) * 8;
          const y = chy - p.age * 26;
          const i = f.at(x, y);
          if (i >= 0) f.put(i, q < 0.35 ? TILE : GLYPH, ink.smoke, 0.7 * (1 - q), q < 0.35 ? -1 : q < 0.7 ? slot.o : slot.dot);
        }

        far.paint(f, t, ink.flake, 0.8);
        near.paint(f, t, ink.flake);
      },
    };
  },
};
