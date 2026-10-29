import { GLYPH, TILE } from '../engine/field.js';
import { TAU, clamp, noise2, rng, sdSegment, smin } from '../engine/math.js';

const CODE_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789{}[]()<>=+-*/_$#@!?&|"\':;.,~^';
const TOKENS = '{}<>()[];=*+/$#';
const SNIPPETS = [
  '$ codex "make it alive"',
  'git checkout -b themes',
  'npm test -- --watch',
  'apply_patch <<EOF',
  'fn render(&self) -> Frame {',
  'export default scene;',
  'while (alive) tick(dt);',
  '// TODO: ship it',
  'ok: 42 passed, 0 failed',
  'cargo build --release',
  'git push origin HEAD',
  'const vibes = await agent.run();',
];

/** The Codex blossom drawn in tiles, a blinking >_ prompt, and ghost code typing itself in the margins. */
export default {
  id: 'codex',
  name: 'Codex',
  chars: { tile: 't%S;:$#', halo: "'.:;o", extra: CODE_CHARS },
  shimmer: 1.5,
  palettes: {
    dark: {
      bg: {
        stops: [[0, '#0d0e15'], [0.6, '#0f101a'], [1, '#131528']],
        spots: [
          { x: 0.76, y: 0.34, r: 0.42, color: 'rgba(92, 98, 240, 0.2)' },
          { x: 0.04, y: 1.0, r: 0.5, color: 'rgba(150, 110, 240, 0.1)' },
        ],
        vignette: 0.3,
        texture: { color: '#8d93ff', alpha: 0.06, chars: '.-', scale: 0.11, threshold: 0.05, density: 0.4 },
      },
      inks: {
        c1: { bg: '#cdbffb', fg: '#8e7fe0', halo: '#a99cf5' },
        c2: { bg: '#a6a9f8', fg: '#6c71dc', halo: '#8f93f2' },
        c3: { bg: '#7c87f2', fg: '#4952cc', halo: '#7480ee' },
        c4: { bg: '#5761ec', fg: '#2d35c0', halo: '#5a64ea' },
        c5: { bg: '#3b38e2', fg: '#201e98', halo: '#4a48e6' },
        prompt: { bg: '#eef0ff', fg: '#7c86f0', halo: '#dfe3ff' },
        code: { bg: '#8a93f7', fg: '#2a2d55', halo: '#6d75d6' },
      },
      ui: { base: '#0e0f17', sidebar: 'rgba(15, 16, 28, 0.66)', composer: 'rgba(22, 24, 42, 0.86)', accent: '#8a93f7', bubble: 'rgba(110, 118, 240, 0.24)' },
      lane: 0.62,
    },
    light: {
      bg: {
        stops: [[0, '#f6f6fc'], [1, '#e7e8f6']],
        spots: [
          { x: 0.76, y: 0.34, r: 0.42, color: 'rgba(120, 126, 245, 0.16)' },
          { x: 0.04, y: 1.0, r: 0.5, color: 'rgba(170, 140, 245, 0.12)' },
        ],
        vignette: 0,
        texture: { color: '#5b63d8', alpha: 0.07, chars: '.-', scale: 0.11, threshold: 0.05, density: 0.4 },
      },
      inks: {
        c1: { bg: '#c3b3fa', fg: '#7f6fd6', halo: '#a596f0' },
        c2: { bg: '#9da1f6', fg: '#5f64d4', halo: '#878cee' },
        c3: { bg: '#717df0', fg: '#3f48c4', halo: '#6c78ec' },
        c4: { bg: '#4f59ea', fg: '#262eb6', halo: '#525ce6' },
        c5: { bg: '#3532dc', fg: '#1b1990', halo: '#4341e0' },
        prompt: { bg: '#ffffff', fg: '#6c76e8', halo: '#eef0ff' },
        code: { bg: '#5b63d8', fg: '#ffffff', halo: '#7f86dc' },
      },
      ui: { base: '#eef0fa', sidebar: 'rgba(241, 242, 251, 0.7)', composer: 'rgba(255, 255, 255, 0.86)', accent: '#4b55d0', bubble: 'rgba(75, 85, 208, 0.12)' },
      lane: 0.55,
    },
  },

  scene(view) {
    const rand = rng(0xc0de);
    const { ink } = view;
    const bands = [ink.c1, ink.c2, ink.c3, ink.c4, ink.c5];
    const tokenSlots = [...TOKENS].map((ch) => view.glyph(ch));
    const snippetSlots = SNIPPETS.map((s) => [...s].map((ch) => (ch === ' ' ? -1 : view.glyph(ch))));

    const spawnToken = (anywhere) => ({
      x: rand() * view.w,
      y: anywhere ? rand() * view.h : view.h + 10,
      vy: -rand.range(5, 13),
      slot: tokenSlots[Math.floor(rand() * tokenSlots.length)],
      alpha: rand.range(0.18, 0.5),
      phase: rand() * TAU,
    });
    const tokens = Array.from({ length: Math.round((view.w * view.h) / 26000) }, () => spawnToken(true));

    const lines = [];
    let nextLine = 1.2;

    const logo = () => {
      const R = clamp(Math.min(view.w, view.h) * 0.19, 80, 190);
      return { R, cx: view.w * 0.78, cy: Math.max(R * 1.2, view.h * 0.3) };
    };

    return {
      resize(sx, sy) {
        for (const p of tokens) {
          p.x *= sx;
          p.y *= sy;
        }
        lines.length = 0;
      },

      update(dt, t) {
        for (const p of tokens) {
          p.y += p.vy * dt;
          if (p.y < -10) Object.assign(p, spawnToken(false));
        }
        nextLine -= dt;
        if (nextLine <= 0) {
          nextLine = rand.range(2.2, 4.2);
          const k = Math.floor(rand() * SNIPPETS.length);
          const { R, cx, cy } = logo();
          const width = SNIPPETS[k].length * view.cw;
          for (let attempt = 0; attempt < 6; attempt++) {
            const x = Math.floor((rand() * Math.max(1, view.w - width - 40) + 20) / view.cw) * view.cw;
            const y = Math.floor(rand.range(0.08, 0.92) * view.h / view.ch) * view.ch;
            const hitsLogo = y > cy - R * 1.3 && y < cy + R * 1.3 && x + width > cx - R * 1.3 && x < cx + R * 1.3;
            const hitsLine = lines.some((l) => Math.abs(l.y - y) < view.ch * 2);
            if (hitsLogo || hitsLine) continue;
            lines.push({ x, y, slots: snippetSlots[k], born: t });
            break;
          }
        }
        for (let k = lines.length - 1; k >= 0; k--) if (t - lines[k].born > lines[k].slots.length / 14 + 5) lines.splice(k, 1);
      },

      paint(f, t) {
        for (const p of tokens) {
          const i = f.at(p.x, p.y);
          if (i >= 0) f.put(i, GLYPH, ink.code, p.alpha * (0.6 + 0.4 * Math.sin(t * 1.3 + p.phase)), p.slot);
        }

        for (const line of lines) {
          const age = t - line.born;
          const typed = Math.min(line.slots.length, Math.floor(age * 14));
          const life = line.slots.length / 14 + 5;
          const fade = Math.min(1, (life - age) / 1.5);
          for (let k = 0; k < typed; k++) {
            if (line.slots[k] < 0) continue;
            const i = f.at(line.x + k * view.cw + 1, line.y + 1);
            if (i >= 0) f.put(i, GLYPH, ink.code, 0.55 * fade, line.slots[k]);
          }
          if (typed < line.slots.length || Math.floor(age * 2) % 2 === 0) {
            const i = f.at(line.x + typed * view.cw + 1, line.y + 1);
            if (i >= 0) f.put(i, TILE, ink.code, 0.7 * fade);
          }
        }

        const { R, cx, cy } = logo();
        const breathe = 1 + Math.sin(t * 0.9) * 0.018;
        const lobeR = R * 0.36 * breathe;
        const ring = R * 0.68;
        const rot = t * 0.015;
        const pr = Math.max(R * 0.075, view.cw * 0.55);
        const cursorOn = t % 1.1 < 0.62;
        const sweep = ((t * 0.11) % 1.7) - 0.35;
        f.each(cx - R * 1.15, cy - R * 1.15, cx + R * 1.15, cy + R * 1.15, (x, y, i) => {
          const dx = x - cx;
          const dy = y - cy;
          let d = Math.hypot(dx, dy) - R * 0.72 * breathe;
          for (let k = 0; k < 7; k++) {
            const a = rot + (k * TAU) / 7 - TAU / 4;
            d = smin(d, Math.hypot(dx - Math.cos(a) * ring, dy - Math.sin(a) * ring) - lobeR, R * 0.03);
          }
          if (d > view.cw * 1.2) return;
          let dp = Math.min(sdSegment(dx, dy, -0.46 * R, -0.28 * R, -0.27 * R, 0, pr), sdSegment(dx, dy, -0.27 * R, 0, -0.46 * R, 0.28 * R, pr));
          if (cursorOn) dp = Math.min(dp, sdSegment(dx, dy, 0.06 * R, 0.29 * R, 0.44 * R, 0.29 * R, pr));
          if (d <= 0 && dp <= 0) {
            f.put(i, TILE, ink.prompt, 1);
            return;
          }
          const v = clamp(((dy / R) * 0.8 + (dx / R) * 0.3 + 1.05) / 2.1, 0, 0.999);
          const along = (dx + dy) / (2.8 * R) + 0.5;
          const glint = Math.exp(-(((along - sweep) / 0.07) ** 2));
          const band = clamp(Math.floor(v * 5 + noise2(x / 28, y / 28 + t * 0.25) * 0.55 - glint * 2), 0, 4);
          f.shape(i, d, bands[band], 1, ink.c2, 0.6);
        });
      },
    };
  },
};
