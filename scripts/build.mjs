// Bundles src/ into dist/codex-themes.js: one self-contained IIFE that the
// launcher (or scripts/inject.mjs) evaluates inside Codex's renderer.
import { build, context } from 'esbuild';
import { readFile } from 'node:fs/promises';

const root = new URL('..', import.meta.url);
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));

/** @type {import('esbuild').BuildOptions} */
const options = {
  absWorkingDir: root.pathname,
  entryPoints: ['src/main.js'],
  outfile: 'dist/codex-themes.js',
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  loader: { '.css': 'text' },
  define: {
    __VERSION__: JSON.stringify(pkg.version),
    // Unique per build so a re-injected bundle replaces the running one.
    __BUILD_ID__: JSON.stringify(`${pkg.version}+${Date.now().toString(36)}`),
  },
  legalComments: 'none',
  logLevel: 'info',
};

if (process.argv.includes('--watch')) {
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
}
