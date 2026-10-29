import css from './styles.css';

const UI_VARS = {
  base: '--cx-base',
  sidebar: '--cx-sidebar',
  composer: '--cx-composer',
  accent: '--cx-accent',
  bubble: '--cx-bubble',
};

/**
 * Owns the two <style> elements: static rules (styles.css) and the active
 * theme's tokens. Kept out of <html style> because Codex writes its own
 * inline variables there.
 */
export class Surfaces {
  constructor({ signal }) {
    this.rules = document.createElement('style');
    this.rules.id = 'cx-rules';
    this.rules.textContent = css;
    this.vars = document.createElement('style');
    this.vars.id = 'cx-vars';
    document.head.append(this.rules, this.vars);
    signal.addEventListener('abort', () => this.destroy(), { once: true });
  }

  apply(theme, palette) {
    const decls = Object.entries(UI_VARS)
      .map(([key, name]) => `${name}: ${palette.ui[key]};`)
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
