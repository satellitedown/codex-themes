// Codex layout hooks. Class names are CSS-module hashes, so match their stable prefixes.

/** Main content area (conversation, settings pages, …). */
export const MAIN = 'main[class*="_MainContentSurface_"]';

/** The conversation column inside MAIN; it scrolls with the messages. */
export const TRANSCRIPT = '[class*="_transcriptContent_"]';

/** The sidebar's outermost panel; it nests further .sidebar-navigation elements. */
export const SIDEBAR = '.sidebar-navigation:not(.sidebar-navigation *)';

/** Holds the icon rail and the sidebar. */
const LEFT_PANEL = 'aside[class*="_LeftPanel_"]';

/**
 * The sidebar's visible bounds (null while hidden) and the elements whose size
 * changes them. Codex hides the sidebar by shrinking the left panel to the
 * icon rail rather than resizing the sidebar, so its box is clipped to the panel's.
 */
export function sidebarBounds() {
  const side = document.querySelector(SIDEBAR);
  const panel = side?.closest(LEFT_PANEL);
  const watch = [side, panel].filter(Boolean);
  if (!side) return { watch, rect: null };
  const box = side.getBoundingClientRect();
  const right = panel ? Math.min(box.right, panel.getBoundingClientRect().right) : box.right;
  if (right - box.left < 40) return { watch, rect: null };
  return { watch, rect: { left: box.left, right, top: box.top, bottom: box.bottom } };
}
