// Renders themes to PNGs with headless Chromium, for working on scenes
// without Codex. By default the frame mimics the app: reading lanes dimmed,
// glass sidebar, chat column and composer, and some sample text.
//
//   node scripts/preview.mjs [theme…] [--scheme light|dark|both] [--time 6]
//                            [--size 1454x902] [--dpr 1] [--raw] [--out dir]
//
// Themes default to all of them. Set CHROME to pick a browser binary.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = new URL('..', import.meta.url).pathname;

function parseArgs(argv) {
  const opts = { themes: [], scheme: 'both', time: 6, size: '1454x902', dpr: 1, raw: false, out: join(root, 'dist/preview') };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--scheme') opts.scheme = argv[++i];
    else if (arg === '--time') opts.time = Number(argv[++i]);
    else if (arg === '--size') opts.size = argv[++i];
    else if (arg === '--dpr') opts.dpr = Number(argv[++i]);
    else if (arg === '--raw') opts.raw = true;
    else if (arg === '--out') opts.out = resolve(argv[++i]);
    else if (arg.startsWith('--')) throw new Error(`unknown option ${arg}`);
    else opts.themes.push(arg);
  }
  return opts;
}

function findChrome() {
  const candidates = [
    process.env.CHROME,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ].filter(Boolean);
  const found = candidates.find((path) => existsSync(path));
  if (!found) throw new Error('no Chromium/Chrome found; set CHROME=/path/to/browser');
  return found;
}

// Runs in the page: draws one theme the way the app would show it.
const PAGE = `
import { Renderer } from './src/engine/renderer.js';
import { THEME_BY_ID } from './src/themes/index.js';

const q = new URLSearchParams(location.search);
const w = Number(q.get('w'));
const h = Number(q.get('h'));
const theme = THEME_BY_ID.get(q.get('theme'));
if (!theme) throw new Error('unknown theme ' + q.get('theme'));
const canvas = document.createElement('canvas');
canvas.style.cssText = 'position:fixed;left:0;top:0;width:' + w + 'px;height:' + h + 'px';
document.body.append(canvas);
const renderer = new Renderer(canvas);
renderer.resize(w, h, devicePixelRatio || 1);
renderer.setTheme(theme, q.get('scheme'));
const ui = renderer.palette.ui;
document.documentElement.style.background = ui.base;

if (q.get('ui') === '1') {
  // Codex's layout at this size: rail, sidebar, header, centered 768px column.
  const side = { x0: 0, x1: 290, y0: 44, y1: h };
  const colW = Math.min(768, w - 290 - 48);
  const colX = Math.round(290 + (w - 290 - colW) / 2);
  const composer = { left: colX + 16, top: h - 118, width: colW - 32, height: 98 };
  renderer.setLanes([{ x0: colX + 4, x1: colX + colW - 4, y0: 44, y1: composer.top + composer.height + 8 }, side]);
  renderer.bake();
  const night = q.get('scheme') === 'dark';
  const text = night ? 'rgba(255,255,255,0.92)' : 'rgba(13,13,13,0.92)';
  const panel = (css) => {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;' + css;
    document.body.append(el);
    return el;
  };
  panel('left:' + (colX - 20) + 'px;top:44px;width:' + (colW + 40) + 'px;height:' + (h - 44) + 'px;background:color-mix(in srgb,' + ui.base + ' 24%,transparent);backdrop-filter:blur(7px) saturate(1.15);mask-image:linear-gradient(to right,transparent,#000 44px,#000 calc(100% - 44px),transparent),linear-gradient(to bottom,transparent,#000 32px);mask-composite:intersect');
  panel('left:0;top:44px;width:318px;height:' + (h - 44) + 'px;background:color-mix(in srgb,' + ui.base + ' 30%,transparent);backdrop-filter:blur(9px) saturate(1.2);mask-image:linear-gradient(to right,#000 calc(100% - 56px),transparent),linear-gradient(to bottom,transparent,#000 32px);mask-composite:intersect');
  panel('left:' + composer.left + 'px;top:' + composer.top + 'px;width:' + composer.width + 'px;height:' + composer.height + 'px;border-radius:26px;background:' + ui.composer + ';backdrop-filter:blur(22px) saturate(1.4)');
  const copy = panel('left:' + (colX + 16) + 'px;top:96px;width:' + (colW - 32) + 'px;font:15px/1.65 -apple-system,system-ui,sans-serif;color:' + text);
  copy.innerHTML = '<div style="margin-left:auto;width:62%;padding:10px 16px;border-radius:18px;background:' + ui.bubble + '">Can you make the cliff face read a bit better?</div>'
    + '<p style="margin:28px 0 14px">Sure. The rock now has strata, cracks and moss, and the falls catch light at the lip, so the scene keeps its shape behind the conversation.</p>'
    + '<p style="margin:0 0 14px">Colours were pushed apart: shadows lean cool, highlights warm, and each layer keeps its own value so nothing turns to mud.</p>'
    + '<p style="margin:0">Everything still dims where text sits, so the chat stays easy to read.</p>';
  const list = panel('left:72px;top:60px;width:200px;font:14px/2.4 -apple-system,system-ui,sans-serif;color:' + text);
  list.innerHTML = ['New chat', 'Recents', 'Complete class roster', 'Design macropad logo', 'Update resume skills', 'Create banner art'].map((s) => '<div>' + s + '</div>').join('');
}

renderer.preroll(Number(q.get('t')));
renderer.frame(0);
document.title = 'ready';
`;

async function bundlePage() {
  const result = await build({
    stdin: { contents: PAGE, resolveDir: root, sourcefile: 'preview-page.js' },
    bundle: true,
    format: 'esm',
    target: 'chrome120',
    write: false,
    logLevel: 'warning',
  });
  return result.outputFiles[0].text;
}

function shoot(chrome, url, out, { width, height, dpr }) {
  return new Promise(async (resolvePromise, reject) => {
    const profile = await mkdtemp(join(tmpdir(), 'cx-preview-'));
    const child = spawn(chrome, [
      '--headless=new',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${profile}`,
      `--force-device-scale-factor=${dpr}`,
      `--window-size=${width},${height}`,
      '--virtual-time-budget=4000',
      `--screenshot=${out}`,
      url,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', async (code) => {
      await rm(profile, { recursive: true, force: true });
      if (code === 0 && existsSync(out)) resolvePromise(out);
      else reject(new Error(`chromium exited ${code} for ${out}\n${stderr.slice(-800)}`));
    });
  });
}

const opts = parseArgs(process.argv.slice(2));
const { THEMES } = await import(pathToFileURL(join(root, 'src/themes/index.js')).href).catch(() => ({ THEMES: null }));
const ids = opts.themes.length ? opts.themes : (THEMES ?? []).map((t) => t.id);
if (!ids.length) throw new Error('name at least one theme');
const schemes = opts.scheme === 'both' ? ['light', 'dark'] : [opts.scheme];
const [width, height] = opts.size.split('x').map(Number);

await mkdir(opts.out, { recursive: true });
const html = join(opts.out, 'preview.html');
await writeFile(html, `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;overflow:hidden}</style><body><script type="module">${(await bundlePage()).replace(/<\/script/g, '<\\/script')}</script>`);

const chrome = findChrome();
const jobs = ids.flatMap((theme) => schemes.map((scheme) => ({ theme, scheme })));
const queue = [...jobs];
const CONCURRENCY = 4;
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, async () => {
  for (let job = queue.shift(); job; job = queue.shift()) {
    const params = new URLSearchParams({ theme: job.theme, scheme: job.scheme, t: String(opts.time), w: String(width), h: String(height), ui: opts.raw ? '0' : '1' });
    const out = join(opts.out, `${job.theme}-${job.scheme}.png`);
    await shoot(chrome, `${pathToFileURL(html).href}?${params}`, out, { width, height, dpr: opts.dpr });
    console.log(out);
  }
}));
