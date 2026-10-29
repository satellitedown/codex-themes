import codex from './codex.js';
import cornerCafe from './corner-cafe.js';
import desertRailway from './desert-railway.js';
import lanternValley from './lantern-valley.js';
import lighthouse from './lighthouse.js';
import overlook from './overlook.js';
import snowCabin from './snow-cabin.js';
import waterfall from './waterfall.js';

/**
 * Theme contract:
 *   id, name                    identity + picker label
 *   chars { tile, halo, extra } glyph sets: shimmering tile glyphs, shimmering bare glyphs,
 *                               explicit-only bare glyphs (view.glyph(char) → slot)
 *   shimmer                     glyph re-roll rate per cell per second
 *   palettes { light, dark }    day/night variants keyed by Codex's appearance: bg (gradient
 *                               stops, spots, vignette, texture), inks { name: { bg, fg, halo } },
 *                               ui tokens, lane opacity. Both define the same ink names.
 *   scene(view)                 → { update?(dt, t), paint?(field, t), back?(field), front?(field), resize?(sx, sy) }
 *                               back/front are static and baked; paint runs every frame.
 */
export const THEMES = [codex, overlook, waterfall, cornerCafe, lighthouse, snowCabin, lanternValley, desertRailway];

export const THEME_BY_ID = new Map(THEMES.map((theme) => [theme.id, theme]));
