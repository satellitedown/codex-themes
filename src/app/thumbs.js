import { Renderer } from '../engine/renderer.js';

// Thumbnails simulate a typical window and draw it with coarse cells.
const WORLD = { w: 1280, h: 800 };

/** Draws a preview of `theme` into `canvas` at its CSS size; keep the renderer to animate it with frame(dt). */
export function thumbnail(canvas, theme, scheme) {
  const { width, height } = canvas.getBoundingClientRect();
  const renderer = new Renderer(canvas, { thumb: true, cellW: 24, cellH: 32, world: WORLD });
  renderer.resize(width, height, devicePixelRatio || 1);
  renderer.setTheme(theme, scheme);
  renderer.preroll(4);
  renderer.frame(0);
  return renderer;
}
