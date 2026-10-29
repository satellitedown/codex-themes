/**
 * One requestAnimationFrame loop shared by every renderer, each with its own
 * frame-rate cap. Chromium already stops rAF for hidden/occluded windows.
 */
const subscribers = new Set();
let rafId = 0;

function tick(now) {
  rafId = subscribers.size ? requestAnimationFrame(tick) : 0;
  for (const sub of subscribers) {
    const fps = typeof sub.fps === 'function' ? sub.fps() : sub.fps;
    if (fps <= 0) {
      sub.last = now;
      continue;
    }
    const elapsed = now - sub.last;
    if (elapsed < 1000 / fps - 2) continue;
    sub.last = now;
    sub.fn(Math.min(elapsed, 100) / 1000);
  }
}

/** fn(dtSeconds) runs at most `fps` times per second; fps may be a getter. Returns an unsubscribe function. */
export function subscribe(fn, fps) {
  const sub = { fn, fps, last: performance.now() };
  subscribers.add(sub);
  if (!rafId) rafId = requestAnimationFrame(tick);
  return () => {
    subscribers.delete(sub);
    if (!subscribers.size && rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };
}
