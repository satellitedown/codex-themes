# Codex Themes

Animated ASCII wallpapers for the Codex desktop app on macOS, with a `/theme`
picker built into the composer. Each wallpaper is a live scene painted in
glyph tiles, with a day and a night version.

| Theme | Day (light appearance) | Night (dark appearance) |
|---|---|---|
| Codex | Codex blossom and blinking `>_` on pale indigo | Same on near-black, code typing itself in the margins |
| Overlook | Grassy cliff over a glassy city with rooftop gardens | Cyberpunk skyline: neon windows, billboards, flying cars, searchlights |
| Waterfall | Falls between mossy cliffs with a rainbow in the spray | Moonlit falls, stars, fireflies over the meadow |
| Corner Café | Sunny street through the café window; cars, a bus, bikes pass | Rain on the glass, lit windows, headlights, neon OPEN |
| Lighthouse | Striped lighthouse on a headland, sailboat, gulls | Rotating beam sweeping the sky, ship lights, moon glitter |
| Snow Cabin | Snowfall, pines, chimney smoke | Aurora ribbons, warm windows |
| Lantern Valley | Hot-air balloons rising over terraced hills | Sky lanterns floating up from the village |
| Desert Railway | Mesas, telegraph poles, a steam train now and then | Milky Way, crescent moon, lit coaches and a headlight |

Day and night follow Codex's appearance setting. With macOS appearance set to
Auto, the wallpaper changes over at sunset.

## Install

Requires macOS 13+, Node.js 22+ and the Xcode Command Line Tools
(`xcode-select --install`).

```sh
./scripts/install-macos.sh            # installs /Applications/Codex Themes.app
./scripts/install-macos.sh ~/Applications
```

Open **Codex Themes** instead of Codex; it is worth putting it in the Dock in
Codex's place. It starts Codex (or offers to restart it if it is already open
without themes), and it quits when Codex quits.

## Use

- Pick a wallpaper from the **Wallpaper** previews at the bottom of the sidebar
  (hover to play one); **Off** turns it off. **Day / Night** below the previews
  switches Codex between its light and dark appearance (the same setting as
  Settings → Appearance), and each wallpaper follows with its day or night scene.
- Type `/theme` in any composer, or press **⌘⌥T**.
- **← →** preview a theme in the real wallpaper, **↵** applies it and **esc** reverts.
- Clicking a card applies it right away.
- `/theme lantern`, `/theme 4` or `/theme off` select a theme directly; **↵** applies it.

The choice is saved in Codex's own storage and syncs across Codex windows.

## How it works

Codex is a Chromium/Electron app whose bundle is code-signed and integrity
checked, so nothing inside `ChatGPT.app` is modified. Instead:

1. `macos/CodexThemes.swift` (the launcher) opens Codex with
   `--remote-debugging-port=<random free port>`.
2. It connects over the Chrome DevTools Protocol, attaches to each Codex window,
   and registers `dist/codex-themes.js` to run on every page load. Utility
   windows (quick ask, pet overlay) are skipped.
3. The engine (`src/`) draws the scene on a canvas behind Codex's UI. Its CSS
   makes the window shell transparent, turns the sidebar, composer and settings
   panels into tinted glass, puts a frosted strip behind the conversation,
   retints menus and popovers to the theme, and adds the picker and the sidebar
   switcher.

Per frame, a scene writes cells into a `Field` (tile, bare glyph or solid
block, with ink and opacity). The renderer blits them from a pre-rendered glyph
atlas, and static scenery is pre-rendered once per resize. It runs at 30 fps
when focused and 12 fps in the background, stops when the window is hidden,
and draws a still frame when reduced motion is on. Tiles behind the
conversation column and the sidebar are drawn faint so text stays readable.

## Develop

```sh
npm install
npm run watch                               # rebuild dist/codex-themes.js on change
node scripts/inject.mjs --watch             # on the Mac: re-inject into the running Codex
```

`inject.mjs` reads the debug port from the running Codex process, or takes
`--port N`. A re-injected build replaces the running one in place. Themes live
in `src/themes/`; the contract is documented in `src/themes/index.js`.

To work on scenes without Codex, render them with headless Chromium (or Chrome;
set `CHROME` to pick a binary):

```sh
npm run preview -- waterfall --out /tmp/preview   # day + night, framed like the app
npm run preview -- --raw --size 1920x1080         # every theme, scene only
```

The default frame mimics the app: reading areas dimmed, glass sidebar, chat
column and composer, sample text. Options: `--scheme light|dark|both`,
`--time <seconds>`, `--size WxH`, `--dpr N`, `--raw`, `--out <dir>`.

## Caveats

- Themes appear only when Codex was opened through Codex Themes. If Codex
  relaunches itself (for example after an update), open Codex Themes again.
- While Codex runs with themes, its DevTools port accepts connections from
  local processes. It is bound to 127.0.0.1 and closes when Codex quits.
- Styling hooks rely on Codex's current markup (composer and surface CSS
  variables, sidebar and layout class names). A Codex update can break the
  glass styling until it is adjusted here.
- Day / Night writes Codex's appearance setting through Codex's internal
  settings service. If an update moves that service, the switch hides itself;
  Settings → Appearance keeps working.
- Log: `~/Library/Logs/CodexThemes.log`. Uninstall: delete `Codex Themes.app`.

## Credits

Inspired by Marko Vineli's ([@handsher_NGU](https://x.com/handsher_NGU)) fan
concept of live ASCII wallpapers. The scenes here are original.
