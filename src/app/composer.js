// Helpers for Codex's ProseMirror composer: reading the draft, recognising the
// /theme command, clearing the draft through the editor's own input handling.

const SLASH = /^\/(?:theme|themes|wallpaper)(?:\s+(.*))?$/i;

export function composerOf(node) {
  return node instanceof Element ? node.closest('[data-codex-composer]') : null;
}

/** "/theme", "/theme koi", "/theme 3" → the argument string ('' when none); null when not a theme command. */
export function slashQuery(editor) {
  const match = (editor.innerText || '').replace(/\u200b/g, '').trim().match(SLASH);
  return match ? (match[1] ?? '') : null;
}

/** Selects the draft and deletes it so ProseMirror (and Codex's state) see a normal edit. */
export function clearComposer(editor) {
  if (!editor.isConnected) return;
  editor.focus();
  const range = document.createRange();
  range.selectNodeContents(editor);
  const selection = getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  document.execCommand('delete');
}

/** The composer area a panel should sit above: the card, plus the project tray when it is showing. */
export function composerRect(editor) {
  if (!editor?.isConnected) return null;
  const card = (editor.closest('[class*="_ComposerLayoutRoot_"]') ?? editor).getBoundingClientRect();
  if (card.width === 0) return null;
  const tray = editor.closest('[data-codex-composer-root]')?.querySelector('[data-composer-utility-rail]')?.getBoundingClientRect();
  const top = tray && tray.height > 0 && tray.bottom <= card.top + 2 ? tray.top : card.top;
  return { left: card.left, width: card.width, top };
}

/** Visible composer lowest on screen (the main one when a page has several). */
export function activeComposer() {
  let best = null;
  let bestBottom = -Infinity;
  for (const editor of document.querySelectorAll('[data-codex-composer]')) {
    const rect = (editor.closest('[class*="_ComposerLayoutRoot_"]') ?? editor).getBoundingClientRect();
    if (rect.width < 120 || rect.height === 0 || rect.bottom < 0 || rect.top > innerHeight) continue;
    if (rect.bottom > bestBottom) {
      best = editor;
      bestBottom = rect.bottom;
    }
  }
  return best;
}
