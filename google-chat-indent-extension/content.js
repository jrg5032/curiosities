// Google Chat Sub-Bullets (Visual Indentation)
//
// Google Chat does NOT support nested bullet lists — the send pipeline
// strips any nesting. This extension fakes sub-bullets using unicode
// bullet characters and non-breaking spaces that survive sending.
//
// Tab on a native bullet → converts to indented unicode sub-bullet
// Tab on a unicode bullet → increases indent level
// Shift+Tab → decreases indent level (back to native bullet at level 0)

(function () {
  "use strict";

  // Non-breaking space so Google Chat won't trim leading whitespace
  const NBSP = "\u00A0";

  // Indentation levels: indent string + bullet character
  // Level 0 is the native <li> bullet — no entry needed here.
  const LEVELS = [
    { indent: NBSP.repeat(2), bullet: "\u25E6 " }, // ◦  (level 1)
    { indent: NBSP.repeat(4), bullet: "\u25AA " }, // ▪  (level 2)
    { indent: NBSP.repeat(6), bullet: "\u25B8 " }, // ▸  (level 3)
  ];

  function getPrefix(level) {
    if (level < 0 || level >= LEVELS.length) return null;
    return LEVELS[level].indent + LEVELS[level].bullet;
  }

  // Detect which indentation level a text line is at (-1 = not ours)
  function detectLevel(text) {
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      if (text.startsWith(getPrefix(i))) return i;
    }
    return -1;
  }

  // Strip our prefix from text to get the raw content
  function stripPrefix(text, level) {
    const prefix = getPrefix(level);
    return prefix && text.startsWith(prefix) ? text.slice(prefix.length) : text;
  }

  // --- DOM helpers ---

  function getClosestElement(node, selector) {
    if (!node) return null;
    const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    return el ? el.closest(selector) : null;
  }

  function isInsideComposer(node) {
    return !!getClosestElement(node, "[contenteditable='true']");
  }

  function isInsideListItem(node) {
    return !!getClosestElement(node, "li");
  }

  function getCurrentListItem(sel) {
    if (!sel || !sel.rangeCount) return null;
    return getClosestElement(sel.getRangeAt(0).startContainer, "li");
  }

  // Find the nearest block-level ancestor (div, p, span acting as line, etc.)
  function getCurrentBlock(sel) {
    if (!sel || !sel.rangeCount) return null;
    let node = sel.getRangeAt(0).startContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;

    const composer = getClosestElement(node, "[contenteditable='true']");
    if (!composer) return null;

    // Walk up until we hit a direct child of the composer or a block element
    let cur = node;
    while (cur && cur !== composer) {
      if (cur.parentElement === composer) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  function selectAllContent(el) {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // --- Tab from a native bullet list item → unicode sub-bullet ---

  function convertListItemToSubBullet(li) {
    const text = li.textContent;

    // Select the li's content and toggle the list off via execCommand.
    // This is the same command Google Chat's toolbar uses, so the
    // editor model should recognise it.
    selectAllContent(li);
    document.execCommand("insertUnorderedList", false, null);

    // After toggling, the text should now be in a plain block.
    // The selection/cursor should still be in or near that text.
    // Re-select the block and replace its content with our indented version.
    const sel = window.getSelection();
    const block = getCurrentBlock(sel);
    if (block) {
      selectAllContent(block);
      document.execCommand("insertText", false, getPrefix(0) + text);
    } else {
      // Fallback: just insert at cursor
      document.execCommand("insertText", false, getPrefix(0) + text);
    }
  }

  // --- Tab / Shift+Tab on a unicode bullet line ---

  function changeIndentLevel(block, currentLevel, direction) {
    const text = block.textContent;
    const content = stripPrefix(text, currentLevel);
    const newLevel = currentLevel + direction;

    if (newLevel < 0) {
      // Convert back to a native bullet list item
      selectAllContent(block);
      document.execCommand("insertText", false, content);
      // Now turn it into a real list
      const sel = window.getSelection();
      const newBlock = getCurrentBlock(sel);
      if (newBlock) selectAllContent(newBlock);
      document.execCommand("insertUnorderedList", false, null);
      return;
    }

    if (newLevel >= LEVELS.length) return; // already at max depth

    selectAllContent(block);
    document.execCommand("insertText", false, getPrefix(newLevel) + content);
  }

  // --- Main keydown handler ---

  document.addEventListener(
    "keydown",
    function (e) {
      if (e.key !== "Tab") return;

      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;

      const anchor = sel.anchorNode;
      if (!isInsideComposer(anchor)) return;

      const direction = e.shiftKey ? -1 : 1;

      // Case 1: cursor is inside a native bullet list <li>
      if (isInsideListItem(anchor)) {
        const li = getCurrentListItem(sel);
        if (!li) return;

        // Only handle forward-Tab (indent). Shift+Tab in a native bullet
        // has nowhere to go (already at base level).
        if (e.shiftKey) return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        convertListItemToSubBullet(li);
        return;
      }

      // Case 2: cursor is on a line with our unicode bullet prefix
      const block = getCurrentBlock(sel);
      if (!block) return;

      const level = detectLevel(block.textContent);
      if (level === -1) return; // not one of our lines, let Tab do its thing

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      changeIndentLevel(block, level, direction);
    },
    true // capture phase
  );
})();
