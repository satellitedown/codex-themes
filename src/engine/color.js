/** Parses #rgb, #rrggbb, #rrggbbaa → { r, g, b, a } with channels 0-255 and a 0-1. */
export function parseColor(input) {
  let hex = input.trim().replace(/^#/, '');
  if (hex.length === 3 || hex.length === 4) hex = [...hex].map((ch) => ch + ch).join('');
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) throw new Error(`codex-themes: unsupported color ${input}`);
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
    a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
  };
}

export function css({ r, g, b, a = 1 }) {
  return a >= 1 ? `rgb(${r | 0}, ${g | 0}, ${b | 0})` : `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${+a.toFixed(3)})`;
}

/** Linear mix in sRGB space; good enough for palette derivation. */
export function mix(a, b, t) {
  const ca = typeof a === 'string' ? parseColor(a) : a;
  const cb = typeof b === 'string' ? parseColor(b) : b;
  return {
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
    a: ca.a + (cb.a - ca.a) * t,
  };
}

const WHITE = { r: 255, g: 255, b: 255, a: 1 };
const BLACK = { r: 0, g: 0, b: 0, a: 1 };

function lightness({ r, g, b }) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * Tile ink from a single colour: the glyph is the same hue pushed toward
 * contrast (darker on light tiles, lighter on dark ones). Low contrast keeps
 * large fills calm; high contrast makes a feature pop.
 */
export function tone(bg, contrast = 0.12, halo = bg) {
  const c = parseColor(bg);
  return { bg, fg: css(mix(c, lightness(c) > 0.5 ? BLACK : WHITE, contrast)), halo };
}

/** Ink for bare glyphs and solid blocks where tile and glyph share one colour. */
export function solid(color) {
  return { bg: color, fg: color, halo: color };
}