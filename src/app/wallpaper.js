import { subscribe } from '../engine/loop.js';
import { Renderer } from '../engine/renderer.js';

const FPS_FOCUSED = 30;
const FPS_BLURRED = 12;

/** Full-window canvas behind Codex's UI, driven by the shared animation loop. */
export class Wallpaper {
  constructor({ signal }) {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'cx-wallpaper';
    this.canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(this.canvas);
    this.renderer = new Renderer(this.canvas);
    this.active = false;
    this.reducedMotion = false;

    const onResize = () => this.resize();
    window.addEventListener('resize', onResize, { signal });
    this.watchPixelRatio(signal);
    this.resize();

    this.unsubscribe = subscribe(
      (dt) => this.renderer.frame(dt),
      () => (!this.active || this.reducedMotion ? 0 : document.hasFocus() ? FPS_FOCUSED : FPS_BLURRED),
    );
    signal.addEventListener('abort', () => this.destroy(), { once: true });
  }

  /** Re-renders when the window moves between displays with different scale factors. */
  watchPixelRatio(signal) {
    const query = matchMedia(`(resolution: ${devicePixelRatio}dppx)`);
    query.addEventListener(
      'change',
      () => {
        if (signal.aborted) return;
        this.resize();
        this.watchPixelRatio(signal);
      },
      { once: true, signal },
    );
  }

  resize() {
    this.renderer.resize(innerWidth, innerHeight, devicePixelRatio || 1);
    if (this.active) this.renderer.frame(0);
  }

  show(theme, scheme) {
    this.active = true;
    this.renderer.setTheme(theme, scheme);
    this.renderer.frame(0);
  }

  hide() {
    this.active = false;
  }

  setReducedMotion(on) {
    this.reducedMotion = on;
  }

  setLanes(rects) {
    this.renderer.setLanes(rects);
  }

  destroy() {
    this.unsubscribe?.();
    this.canvas.remove();
  }
}
