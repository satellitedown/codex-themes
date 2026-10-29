import { css, mix } from '../engine/color.js';
import styles from './styles.css';

const UI_VARS = {
  base: '--cx-base',
  sidebar: '--cx-sidebar',
  composer: '--cx-composer',
  accent: '--cx-accent',
  bubble: '--cx-bubble',
};

/**
 * Codex's neutral surface tokens pulled toward the scene's base colour, so
 * menus, popovers, settings cards and secondary panels match the wallpaper.
 * Opaque where Codex layers text over arbitrary content (menus), translucent
 * for in-page panels that sit on the wallpaper.
 */
function surfaceTokens(base, scheme) {
  const tint = (neutral, amount, alpha = 1) => css({ ...mix(neutral, base, amount), a: alpha });
  const light = scheme === 'light';
  const elevated = light ? tint('#ffffff', 0.16) : tint('#252528', 0.42);
  return {
    '--cx-panel': elevated,
    '--color-surface-elevated': light ? tint('#ffffff', 0.16, 0.96) : tint('#2c2c30', 0.42, 0.96),
    '--color-surface-elevated-secondary': elevated,
    '--app-shell-sidebar-popover-background': elevated,
    '--color-background-control-opaque': elevated,
    '--color-background-tooltip': elevated,
    '--color-background-panel': light ? tint('#ffffff', 0.12, 0.66) : tint('#1e1e21', 0.45, 0.62),
    '--color-surface-secondary': light ? tint('#f3f3f4', 0.22) : tint('#141416', 0.42),
    '--color-surface-tertiary': light ? tint('#ececee', 0.22) : tint('#28282b', 0.42),
  };
}

/**
 * Owns the two <style> elements: static rules (styles.css) and the active
 * theme's tokens. Kept out of <html style> because Codex writes its own
 * inline variables there.
 */
export class Surfaces {
  constructor({ signal }) {
    this.rules = document.createElement('style');
    this.rules.id = 'cx-rules';
    this.rules.textContent = styles;
    this.vars = document.createElement('style');
    this.vars.id = 'cx-vars';
    document.head.append(this.rules, this.vars);
    signal.addEventListener('abort', () => this.destroy(), { once: true });
  }

  apply(theme, palette, scheme) {
    const vars = {
      ...Object.fromEntries(Object.entries(UI_VARS).map(([key, name]) => [name, palette.ui[key]])),
      ...surfaceTokens(palette.ui.base, scheme),
    };
    const decls = Object.entries(vars)
      .map(([name, value]) => `${name}: ${value};`)
      .join(' ');
    this.vars.textContent = `:root[data-cx-wallpaper] { ${decls} }`;
    document.documentElement.dataset.cxWallpaper = theme.id;
  }

  clear() {
    this.vars.textContent = '';
    delete document.documentElement.dataset.cxWallpaper;
  }

  destroy() {
    this.clear();
    this.rules.remove();
    this.vars.remove();
  }
}
