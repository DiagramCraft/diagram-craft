/**
 * Maps a DOM (node, offset) pair inside `container` to a plain-text offset,
 * by walking the container's text nodes in document order. This offset space
 * matches `container.textContent`, which MdxPreview's AST-walk rendering
 * (see mdxRenderNode.tsx) is built to reproduce exactly.
 */
const getPlainTextOffset = (container: HTMLElement, node: Node, offset: number): number => {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let pos = 0;
  let current = walker.nextNode();
  while (current) {
    if (current === node) return pos + offset;
    pos += current.textContent?.length ?? 0;
    current = walker.nextNode();
  }
  return pos;
};

export type SelectionPlainTextRange = { start: number; end: number };

/** Returns the current window selection as a plain-text [start, end) range, or null if there's no non-collapsed selection inside `container`. */
export const getSelectionPlainTextRange = (
  container: HTMLElement
): SelectionPlainTextRange | null => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

  const range = selection.getRangeAt(0);
  if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
    return null;
  }

  const start = getPlainTextOffset(container, range.startContainer, range.startOffset);
  const end = getPlainTextOffset(container, range.endContainer, range.endOffset);
  if (start === end) return null;

  return start < end ? { start, end } : { start: end, end: start };
};

/** Bounding rect of the current selection, for positioning a floating "Add comment" button. */
export const getSelectionBoundingRect = (): DOMRect | null => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  return selection.getRangeAt(0).getBoundingClientRect();
};
