import { solid, tone } from '../engine/color.js';
import { BLOCK, GLYPH, TILE } from '../engine/field.js';
import { clamp, hash1, rng, sdCircle, smin } from '../engine/math.js';
import { drifters } from './kit.js';

const FACADES = ['facadeA', 'facadeB', 'facadeC', 'facadeD'];
const SHOPS = ['BAKERY', 'BOOKS', 'FLOWERS', 'RECORDS'];
const CAR_COLORS = ['carRed', 'carBlue', 'carYellow', 'carMint'];

// Sprites face right; legend keys map to inks per vehicle.
const CAR = ['..bbbbb...', '.bwwbwwb..', 'tbbbbbbbbh', '..k....k..'];
const BUS = ['bbbbbbbbbbbbbbb.', 'bwwbwwbwwbwwbwwb', 'bbbbbbbbbbbbbbbh', 'tbbbbbbbbbbbbbbb', '..kk.......kk...'];
const BIKE = ['...h.', '..pp.', '.bpb.', 'k.b.k'];
const PERSON = ['h', 'p', 'l'];

/**
 * Inside a corner café looking out through a big window: facades across the
 * street, a lamp post, a tree, and traffic now and then — cars, a bus, someone
 * on a bike. Coffee steams on the counter next to a laptop running Codex.
 * Day: warm sunny interior. Night: rain on the glass, lit windows, neon OPEN.
 */
export default {
  id: 'corner-cafe',
  name: 'Corner Café',
  chars: { tile: 't%S;:#', halo: "'.:;o", extra: "ABCDEFGHIJKLMNOPQRSTUVWXYZ>_|/\\-~()'." },
  shimmer: 0.9,
  palettes: {
    light: {
      bg: {
        stops: [[0, '#f3e5d0'], [0.7, '#eddcc4'], [1, '#e5d1b5']],
        spots: [{ x: 0.12, y: 0.45, r: 0.35, color: 'rgba(255, 246, 222, 0.55)' }],
        vignette: 0,
        texture: { color: '#c4a982', alpha: 0.18, chars: "'.", scale: 0.4, threshold: -1, density: 0.12 },
      },
      inks: {
        sky: solid('#bfe3f6'),
        facadeA: solid('#e2a07f'),
        facadeB: solid('#f0dbb5'),
        facadeC: solid('#b4cead'),
        facadeD: solid('#c3d0e1'),
        facadeEdge: tone('#cf8c6c', 0.16),
        glass: tone('#8fb6cc', 0.12),
        lit: tone('#fff0c4', 0.15),
        awningA: tone('#e46a5a', 0.12),
        awningB: tone('#fbf3e6', 0.08),
        signBoard: solid('#3b4a5a'),
        signText: solid('#fff3d6'),
        door: solid('#7a5a44'),
        pavement: solid('#d8cfc2'),
        pavement2: solid('#e5ddd1'),
        curb: tone('#c7bdaf', 0.1),
        asphalt: solid('#9a9da5'),
        laneMark: solid('#f6f2e4'),
        treeLeaf: tone('#69ae5b', 0.2),
        treeTrunk: tone('#7d5a3c', 0.14),
        pole: solid('#4f5560'),
        lampHead: tone('#f3e3ae', 0.15),
        carRed: tone('#e35d4f', 0.15),
        carBlue: tone('#4f86d9', 0.15),
        carYellow: tone('#f2c14e', 0.15),
        carMint: tone('#5fc6aa', 0.15),
        busGreen: tone('#3f9e74', 0.15),
        carGlass: solid('#d3e8f6'),
        tire: solid('#2d2d33'),
        headlight: solid('#fff6c8'),
        taillight: solid('#ff6a5a'),
        person1: solid('#3d5a80'),
        person2: solid('#d9734f'),
        skin: solid('#efc79f'),
        rain: solid('#ffffff'),
        frame: tone('#9a6844', 0.12),
        frameDark: tone('#7d5234', 0.12),
        woodTop: tone('#c98f5c', 0.16),
        wood: solid('#a8714a'),
        woodDark: solid('#9c6943'),
        cup: tone('#ffffff', 0.08),
        saucer: tone('#efe8de', 0.08),
        steam: solid('#ffffff'),
        laptop: tone('#cdd2da', 0.1),
        screen: solid('#1d2233'),
        prompt: solid('#9aa2ff'),
        pot: tone('#c96f4a', 0.15),
        plant: tone('#4f9a4c', 0.2),
        plantLight: tone('#73bf5f', 0.2),
        shade: tone('#d39a5a', 0.14),
        shadeRim: tone('#b07a3e', 0.14),
        bulb: solid('#fff2c4'),
        cord: solid('#4a3a30'),
        neon: tone('#e9a0b8', 0.15),
      },
      ui: { base: '#f1e2cc', sidebar: 'rgba(248, 240, 228, 0.7)', composer: 'rgba(255, 252, 247, 0.88)', accent: '#b0663a', bubble: 'rgba(176, 102, 58, 0.13)' },
      lane: 0.55,
    },
    dark: {
      bg: {
        stops: [[0, '#2b1c16'], [0.7, '#22160f'], [1, '#1a110c']],
        spots: [
          { x: 0.47, y: 0.1, r: 0.32, color: 'rgba(255, 175, 90, 0.17)' },
          { x: 0.8, y: 0.1, r: 0.32, color: 'rgba(255, 175, 90, 0.17)' },
        ],
        vignette: 0.3,
        texture: { color: '#6a4a36', alpha: 0.2, chars: "'.", scale: 0.4, threshold: -1, density: 0.12 },
      },
      inks: {
        sky: solid('#0b1430'),
        facadeA: solid('#3a2730'),
        facadeB: solid('#2e2a36'),
        facadeC: solid('#243030'),
        facadeD: solid('#282c3e'),
        facadeEdge: tone('#3e3040', 0.12),
        glass: tone('#1a2236', 0.1),
        lit: tone('#ffc96b', 0.25),
        awningA: tone('#6e2a2a', 0.12),
        awningB: tone('#4a4040', 0.1),
        signBoard: solid('#141822'),
        signText: solid('#ffd98a'),
        door: solid('#24181a'),
        pavement: solid('#24242c'),
        pavement2: solid('#2b2b34'),
        curb: tone('#30303a', 0.1),
        asphalt: solid('#14151b'),
        laneMark: solid('#4a4a3a'),
        treeLeaf: tone('#13261d', 0.14),
        treeTrunk: tone('#1a1412', 0.1),
        pole: solid('#2a2e36'),
        lampHead: tone('#ffd27a', 0.2),
        carRed: tone('#9e3a32', 0.14),
        carBlue: tone('#2f4f86', 0.14),
        carYellow: tone('#a8862f', 0.14),
        carMint: tone('#2f7a68', 0.14),
        busGreen: tone('#2a6a50', 0.14),
        carGlass: solid('#ffd98a'),
        tire: solid('#0c0c10'),
        headlight: solid('#fff3c0'),
        taillight: solid('#ff3b3b'),
        person1: solid('#1c2433'),
        person2: solid('#3a2420'),
        skin: solid('#5a4038'),
        rain: solid('#8fb3d9'),
        frame: tone('#4a3024', 0.1),
        frameDark: tone('#3a251b', 0.1),
        woodTop: tone('#6e4528', 0.14),
        wood: solid('#4a2f1e'),
        woodDark: solid('#442b1b'),
        cup: tone('#e8e2dc', 0.08),
        saucer: tone('#d4ccc4', 0.08),
        steam: solid('#e8d8c8'),
        laptop: tone('#5a5f6a', 0.1),
        screen: solid('#0d1020'),
        prompt: solid('#9aa2ff'),
        pot: tone('#7a3f28', 0.12),
        plant: tone('#1d3a24', 0.14),
        plantLight: tone('#28502f', 0.14),
        shade: tone('#8a5a32', 0.12),
        shadeRim: tone('#6e4526', 0.12),
        bulb: solid('#ffd98a'),
        cord: solid('#1a120e'),
        neon: tone('#ff5fa8', 0.25),
      },
      ui: { base: '#22160f', sidebar: 'rgba(28, 18, 13, 0.64)', composer: 'rgba(36, 24, 18, 0.88)', accent: '#ffb35c', bubble: 'rgba(255, 179, 92, 0.18)' },
      lane: 0.62,
    },
  },

  scene(view) {
    const rand = rng(0xcafe);
    const { ink, night } = view;
    const slots = { prompt: view.glyphs('>_'), open: view.glyphs('OPEN'), paren: [view.glyph('('), view.glyph(')'), view.glyph('~')], legs: [view.glyph('/'), view.glyph('\\'), view.glyph('|')] };
    const shopSlots = SHOPS.map((s) => view.glyphs(s));

    const geo = () => {
      const wx0 = Math.round((view.w * 0.3) / view.cw) * view.cw;
      const wx1 = Math.round((view.w * 0.97) / view.cw) * view.cw;
      const wy0 = Math.round((view.h * 0.07) / view.ch) * view.ch;
      const wy1 = Math.round((view.h * 0.66) / view.ch) * view.ch;
      const H = wy1 - wy0;
      return {
        wx0,
        wx1,
        wy0,
        wy1,
        skyline: wy0 + H * 0.16,
        farWalk: wy0 + H * 0.64,
        road: wy0 + H * 0.71,
        nearWalk: wy0 + H * 0.92,
        counter: view.h * 0.8,
      };
    };

    const rain = drifters(view, rand, {
      count: night ? 70 : 0,
      vy: [420, 620],
      vx: [-40, -20],
      sway: 0,
      glyphs: '|/|',
      alpha: [0.25, 0.55],
      region: () => {
        const g = geo();
        return { x0: g.wx0, y0: g.wy0, x1: g.wx1, y1: g.wy1 };
      },
    });

    // Facades depend only on the view size; rebuild when it changes.
    let facadeKey = '';
    let facadeCache = [];
    const facades = () => {
      const key = `${view.w}x${view.h}`;
      if (key === facadeKey) return facadeCache;
      const g = geo();
      const out = [];
      const r = rng(0xfacade);
      for (let x = g.wx0 - view.cw * 2; x < g.wx1 + view.cw * 2; ) {
        const width = (6 + Math.floor(r() * 6)) * view.cw;
        out.push({ x, width, top: g.skyline + r.range(0, 0.1) * (g.wy1 - g.wy0), ink: ink[FACADES[out.length % FACADES.length]], shop: r() < 0.6 ? Math.floor(r() * SHOPS.length) : -1 });
        x += width;
      }
      facadeKey = key;
      facadeCache = out;
      return out;
    };

    const traffic = [];
    let nextVehicle = 1.5;
    const spawn = () => {
      const g = geo();
      const roll = rand();
      const dir = rand() < 0.5 ? 1 : -1;
      const lane = dir > 0 ? g.road + (g.nearWalk - g.road) * 0.42 : g.road + (g.nearWalk - g.road) * 0.02;
      const color = ink[CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)]];
      const kind = roll < 0.6 ? 'car' : roll < 0.82 ? 'bike' : 'bus';
      const sprite = kind === 'car' ? CAR : kind === 'bus' ? BUS : BIKE;
      const width = sprite[0].length * view.cw;
      traffic.push({
        kind,
        sprite,
        dir,
        y: kind === 'bike' ? lane + view.ch * 0.5 : lane,
        x: dir > 0 ? g.wx0 - width - 10 : g.wx1 + 10,
        width,
        speed: kind === 'car' ? rand.range(150, 210) : kind === 'bus' ? rand.range(95, 120) : rand.range(55, 75),
        legend: {
          b: [TILE, kind === 'bus' ? ink.busGreen : kind === 'bike' ? ink.pole : color],
          w: [TILE, ink.carGlass, night && kind === 'bus' ? 1 : 0.9],
          h: [TILE, kind === 'bike' ? ink.skin : ink.headlight],
          t: [TILE, ink.taillight],
          k: [TILE, ink.tire],
          p: [TILE, rand() < 0.5 ? ink.person1 : ink.person2],
        },
      });
    };
    const walkers = Array.from({ length: 2 }, (_, k) => ({ u: rand(), speed: rand.range(18, 28) * (k ? -1 : 1), shirt: k ? ink.person2 : ink.person1 }));

    return {
      update(dt) {
        nextVehicle -= dt;
        if (nextVehicle <= 0) {
          spawn();
          nextVehicle = rand.range(5, 13);
        }
        const g = geo();
        for (let k = traffic.length - 1; k >= 0; k--) {
          const v = traffic[k];
          v.x += v.dir * v.speed * dt;
          if (v.x > g.wx1 + 20 || v.x + v.width < g.wx0 - 20) traffic.splice(k, 1);
        }
        for (const w of walkers) w.u = (((w.u + (w.speed * dt) / Math.max(1, g.wx1 - g.wx0)) % 1) + 1) % 1;
        rain.update(dt);
      },

      back(f) {
        const g = geo();
        f.setClip(g.wx0, g.wy0, g.wx1, g.wy1);
        f.each(g.wx0, g.wy0, g.wx1, g.wy1, (x, y, i) => {
          if (y < g.farWalk) f.put(i, BLOCK, ink.sky, 1);
          else if (y < g.road) f.put(i, BLOCK, ink.pavement, 1);
          else if (y < g.nearWalk) f.put(i, BLOCK, ink.asphalt, 1);
          else f.put(i, y < g.nearWalk + view.ch ? TILE : BLOCK, y < g.nearWalk + view.ch ? ink.curb : ink.pavement2, 1);
        });
        // Lane markings.
        const laneY = g.road + (g.nearWalk - g.road) * 0.5;
        for (let x = g.wx0; x < g.wx1; x += view.cw) {
          const i = f.at(x + 1, laneY);
          if (i >= 0 && Math.floor(x / view.cw) % 4 < 2) f.put(i, GLYPH, ink.laneMark, 0.9, view.glyph('-'));
        }
        for (const fa of facades()) {
          f.each(fa.x, fa.top, fa.x + fa.width - 1, g.farWalk - 1, (x, y, i) => {
            const row = Math.floor((y - fa.top) / view.ch);
            const col = Math.floor((x - fa.x) / view.cw);
            const groundFloor = y > g.farWalk - view.ch * 3.2;
            if (row === 0) f.put(i, TILE, ink.facadeEdge, 1);
            else if (groundFloor && fa.shop >= 0) {
              const awning = y < g.farWalk - view.ch * 2.2;
              if (awning) f.put(i, TILE, col % 2 ? ink.awningA : ink.awningB, 1);
              else f.put(i, BLOCK, col === 1 ? ink.door : ink.glass, 1);
            } else if (row % 2 === 0 && col % 3 !== 0 && row > 1) f.put(i, TILE, ink.glass, 1);
            else f.put(i, BLOCK, fa.ink, 1);
          });
          if (fa.shop >= 0) {
            const label = shopSlots[fa.shop];
            const y = fa.top + view.ch * 1.5;
            if (label.length + 2 <= fa.width / view.cw && fa.x >= g.wx0 && fa.x + fa.width <= g.wx1) {
              const x = fa.x + Math.floor((fa.width / view.cw - label.length) / 2) * view.cw;
              for (let k = -1; k <= label.length; k++) {
                const i = f.at(x + k * view.cw + 1, y);
                if (i >= 0) f.put(i, BLOCK, ink.signBoard, 1);
              }
              f.text(label, x + 1, y, ink.signText, 1);
            }
          }
        }
        // Street tree and lamp post on the far sidewalk.
        const tx = g.wx0 + (g.wx1 - g.wx0) * 0.3;
        const R = clamp(view.h * 0.06, 34, 60);
        f.each(tx - R * 1.4, g.farWalk - R * 3.4, tx + R * 1.4, g.farWalk, (x, y, i) => {
          let d = sdCircle(x, y, tx, g.farWalk - R * 2.4, R);
          d = smin(d, sdCircle(x, y, tx - R * 0.7, g.farWalk - R * 1.9, R * 0.65), 14);
          d = smin(d, sdCircle(x, y, tx + R * 0.75, g.farWalk - R * 2, R * 0.6), 14);
          if (d < 0) f.put(i, TILE, ink.treeLeaf, 1);
          else if (Math.abs(x - tx) < view.cw * 0.6 && y > g.farWalk - R * 1.6) f.put(i, TILE, ink.treeTrunk, 1);
        });
        const lx = g.wx0 + (g.wx1 - g.wx0) * 0.72;
        for (let y = g.farWalk - view.h * 0.2; y < g.farWalk; y += view.ch) {
          const i = f.at(lx, y);
          if (i >= 0) f.put(i, GLYPH, ink.pole, 1, view.glyph('|'));
        }
        const head = f.at(lx, g.farWalk - view.h * 0.2 - view.ch);
        if (head >= 0) f.put(head, TILE, ink.lampHead, 1);
        f.clearClip();
      },

      paint(f, t) {
        const g = geo();
        f.setClip(g.wx0, g.wy0, g.wx1, g.wy1);

        // Lit windows across the street (night) flick on and off slowly.
        if (night) {
          for (const fa of facades()) {
            for (let y = fa.top + view.ch * 2.5; y < g.farWalk - view.ch * 3.2; y += view.ch * 2) {
              for (let x = fa.x + view.cw * 1.5; x < fa.x + fa.width; x += view.cw) {
                const i = f.at(x, y);
                if (i < 0 || Math.floor((x - fa.x) / view.cw) % 3 === 0) continue;
                if (hash1(i * 13 + Math.floor(t * 0.05 + hash1(i) * 40)) < 0.5) f.put(i, TILE, ink.lit, 0.95);
              }
            }
          }
          const lx = g.wx0 + (g.wx1 - g.wx0) * 0.72;
          f.glow(lx, g.farWalk - view.h * 0.2 - view.ch * 0.5, 90, '#ffd27a', 0.45);
          // Wet road shimmer under the lamp.
          f.each(lx - 90, g.road, lx + 90, g.nearWalk, (x, y, i) => {
            if (hash1(i * 5 + Math.floor(t * 3)) < 0.12) f.put(i, GLYPH, ink.lampHead, 0.45, view.glyph('-'));
          });
        }

        for (const w of walkers) {
          const x = g.wx0 + w.u * (g.wx1 - g.wx0);
          const step = Math.floor(t * 4 + w.u * 10) % 2;
          f.sprite(PERSON, { h: [TILE, ink.skin], p: [TILE, w.shirt], l: [GLYPH, w.shirt, 1, slots.legs[step]] }, x, g.farWalk - view.ch * 2.6);
        }

        for (const v of traffic) {
          f.sprite(v.sprite, v.legend, v.x, v.y, v.dir < 0);
          if (night && v.kind !== 'bike') {
            const front = v.dir > 0 ? v.x + v.width : v.x;
            f.glow(front, v.y + view.ch * 2.5, 70, '#fff1b0', 0.5);
            f.glow(v.dir > 0 ? v.x : v.x + v.width, v.y + view.ch * 2.5, 30, '#ff3b3b', 0.45);
          }
        }

        rain.paint(f, t, ink.rain);
        f.clearClip();

        // Neon sign on the glass.
        const flicker = night ? (hash1(Math.floor(t * 7)) < 0.06 ? 0.3 : 1) : 0.55;
        const nx = g.wx0 + view.cw * 2;
        const ny = g.wy0 + view.ch * 3;
        f.text(slots.open, nx, ny, ink.neon, flicker);
        if (night) f.glow(nx + view.cw * 2, ny + view.ch * 0.5, 70, '#ff5fa8', 0.35 * flicker);

        // Steam over the cup.
        const cupX = view.w * 0.42;
        for (let k = 0; k < 7; k++) {
          const rise = ((t * 0.45 + k / 7) % 1);
          const y = g.counter - view.ch * 4 - rise * view.ch * 5;
          const x = cupX + view.cw * 1.5 + Math.sin(rise * 5 + k) * 7;
          const i = f.at(x, y);
          if (i >= 0) f.put(i, GLYPH, ink.steam, 0.6 * (1 - rise), slots.paren[k % 3]);
        }

        // Laptop screen with a blinking prompt.
        const lx = view.w * 0.55;
        const ly = g.counter - view.ch * 4;
        f.each(lx + view.cw, ly + view.ch, lx + view.cw * 5 - 1, ly + view.ch * 3 - 1, (x, y, i) => f.put(i, BLOCK, ink.screen, 1));
        f.text(t % 1.1 < 0.6 ? slots.prompt : slots.prompt.slice(0, 1), lx + view.cw * 1.5, ly + view.ch * 1.5, ink.prompt, 1);
        if (night) f.glow(lx + view.cw * 3, ly + view.ch * 2, 50, '#8a93f7', 0.35);

        // Pendant lamps glow.
        for (const px of [0.47, 0.8]) f.glow(view.w * px, g.wy0 + view.ch * 2.5, night ? 150 : 90, '#ffd28a', night ? 0.38 : 0.18);
      },

      front(f) {
        const g = geo();
        // Window frame and mullions.
        f.each(g.wx0 - view.cw, g.wy0 - view.ch, g.wx1 + view.cw - 1, g.wy1 + view.ch - 1, (x, y, i) => {
          const onBorder = x < g.wx0 || x > g.wx1 || y < g.wy0 || y > g.wy1;
          const third = (g.wx1 - g.wx0) / 3;
          const mullion = Math.abs(x - (g.wx0 + third)) < view.cw / 2 || Math.abs(x - (g.wx0 + third * 2)) < view.cw / 2;
          const transom = Math.abs(y - (g.wy0 + (g.wy1 - g.wy0) * 0.2)) < view.ch / 2;
          if (onBorder || mullion || transom) f.put(i, BLOCK, y > g.wy1 ? ink.frameDark : ink.frame, 1);
        });

        // Counter.
        f.each(0, g.counter, view.w, view.h, (x, y, i) => {
          if (y < g.counter + view.ch) f.put(i, TILE, ink.woodTop, 1);
          else f.put(i, BLOCK, Math.floor(x / view.cw) % 8 === 0 ? ink.woodDark : ink.wood, 1);
        });

        // Cup and saucer.
        const top = g.counter - view.ch * 3;
        f.sprite(['.ccc.', '.ccch', '.ccc.', 'sssss'], { c: [TILE, ink.cup], h: [TILE, ink.cup], s: [TILE, ink.saucer] }, view.w * 0.42, top - view.ch);
        // Laptop shell (the screen is painted live).
        f.sprite(['LLLLLL', 'L....L', 'L....L', 'LLLLLL', 'BBBBBBBB'], { L: [TILE, ink.laptop], B: [TILE, ink.laptop] }, view.w * 0.55, g.counter - view.ch * 4);
        // Potted plant.
        const px = view.w * 0.88;
        f.each(px - 70, g.counter - view.ch * 8, px + 70, g.counter, (x, y, i) => {
          const potTop = g.counter - view.ch * 2;
          if (y > potTop) {
            if (Math.abs(x - px) < view.cw * 1.6 - (y - potTop) * 0.15) f.put(i, TILE, ink.pot, 1);
            return;
          }
          let d = sdCircle(x, y, px, potTop - 36, 30);
          d = smin(d, sdCircle(x, y, px - 34, potTop - 22, 22), 10);
          d = smin(d, sdCircle(x, y, px + 34, potTop - 26, 22), 10);
          if (d < 0) f.put(i, TILE, hash1(i) < 0.35 ? ink.plantLight : ink.plant, 1);
        });

        // Pendant lamps hanging in front of the window.
        for (const lxFrac of [0.47, 0.8]) {
          const lx = view.w * lxFrac;
          for (let y = 0; y < g.wy0 + view.ch; y += view.ch) {
            const i = f.at(lx, y);
            if (i >= 0) f.put(i, GLYPH, ink.cord, 1, view.glyph('|'));
          }
          f.sprite(['.ssss.', 'ssssss', 'RRRRRR', '..bb..'], { s: [TILE, ink.shade], R: [TILE, ink.shadeRim], b: [TILE, ink.bulb] }, lx - view.cw * 2.5, g.wy0 + view.ch);
        }
      },
    };
  },
};
