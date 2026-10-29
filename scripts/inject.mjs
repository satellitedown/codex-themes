#!/usr/bin/env node
// Development helper: evaluates dist/codex-themes.js in every window of a
// Codex that is already running with a DevTools port (e.g. started by the
// Codex Themes launcher). The running engine replaces itself on re-inject.
//
//   node scripts/inject.mjs [--port N] [--watch]
//
// Without --port the port is read from the running Codex process arguments.
import { execFileSync } from 'node:child_process';
import { readFileSync, watch } from 'node:fs';
import { fileURLToPath } from 'node:url';

const bundlePath = fileURLToPath(new URL('../dist/codex-themes.js', import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => args.indexOf(name);

function detectPort() {
  const ps = execFileSync('ps', ['-Ao', 'args='], { encoding: 'utf8' });
  for (const line of ps.split('\n')) {
    if (!line.includes('/Contents/MacOS/ChatGPT')) continue;
    const match = line.match(/--remote-debugging-port=(\d+)/);
    if (match) return Number(match[1]);
  }
  throw new Error('No Codex process with --remote-debugging-port found; start it with the Codex Themes launcher or pass --port.');
}

const port = flag('--port') >= 0 ? Number(args[flag('--port') + 1]) : detectPort();

function evaluate(wsUrl, expression) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== 1) return;
      ws.close();
      if (message.error || message.result?.exceptionDetails) reject(new Error(JSON.stringify(message.error ?? message.result.exceptionDetails)));
      else resolve(message.result.result.value);
    };
    ws.onerror = () => reject(new Error(`WebSocket error for ${wsUrl}`));
  });
}

async function injectAll() {
  const source = readFileSync(bundlePath, 'utf8');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const pages = targets.filter((t) => t.type === 'page' && /^app:\/\/-\/(index|detached-window)\.html/.test(t.url) && !t.url.includes('initialRoute=%2Fspotlight'));
  for (const page of pages) {
    const build = await evaluate(page.webSocketDebuggerUrl, `${source}\n;window.__codexThemes?.buildId ?? null`);
    console.log(`${page.url} → ${build ?? 'not started'}`);
  }
  if (!pages.length) console.log('No Codex windows found.');
}

await injectAll();
if (flag('--watch') >= 0) {
  console.log('Watching dist/codex-themes.js…');
  let timer;
  watch(bundlePath, () => {
    clearTimeout(timer);
    timer = setTimeout(() => injectAll().catch((error) => console.error(error.message)), 150);
  });
}
