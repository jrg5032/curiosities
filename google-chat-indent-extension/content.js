// Google Chat Sub-Bullets (Visual Indentation)
//
// Google Chat does NOT support nested bullet lists — the send pipeline
// strips any nesting. This extension fakes sub-bullets using unicode
// bullet characters and non-breaking spaces that survive sending.
//
// Uses the proven innerHTML + click() + <br> caret trick from
// gchat-copy/google-chat-tweaks to make changes stick in Chat's editor.
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

  function getComposer(node) {
    return getClosestElement(node, "[contenteditable='true']");
  }

  function isInsideComposer(node) {
    return !!getComposer(node);
  }

  function isInsideListItem(node) {
    return !!getClosestElement(node, "li");
  }

  function getCurrentListItem(sel) {
    if (!sel || !sel.rangeCount) return null;
    return getClosestElement(sel.getRangeAt(0).startContainer, "li");
  }

  // Find the nearest block-level ancestor that is a direct child of composer
  function getCurrentBlock(sel) {
    if (!sel || !sel.rangeCount) return null;
    let node = sel.getRangeAt(0).startContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;

    const composer = getComposer(node);
    if (!composer) return null;

    let cur = node;
    while (cur && cur !== composer) {
      if (cur.parentElement === composer) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  // -----------------------------------------------------------
  // The proven trick to make Google Chat recognise DOM changes:
  //   1. Modify innerHTML directly
  //   2. .click() on the composer
  //   3. Place caret at end with a <br> sentinel
  //
  // This is the technique used by gchat-copy / google-chat-tweaks.
  // -----------------------------------------------------------

  function placeCaretAtEnd(el) {
    const sel = window.getSelection();
    const range = document.createRange();

    // Append a <br> — this is the secret sauce that makes Google Chat
    // register the content as user-generated input.
    const br = document.createElement("br");
    el.appendChild(br);

    range.setStartAfter(br);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function commitToComposer(composer) {
    composer.scrollIntoView();
    composer.click();
    placeCaretAtEnd(composer);
  }

  // --- Rebuild the composer's HTML after a change ---
  // We rebuild the entire composer content, swapping the target block's
  // content while keeping everything else intact.

  function getBlockIndex(composer, block) {
    const children = Array.from(composer.childNodes);
    return children.indexOf(block);
  }

  // --- Tab from a native bullet list item → unicode sub-bullet ---

  function convertListItemToSubBullet(li, composer) {
    const text = li.textContent;
    const ul = li.closest("ul, ol");
    if (!ul) return;

    // Build replacement: all list items, but replace the target li with
    // a text div that has our unicode bullet prefix.
    const items = Array.from(ul.querySelectorAll(":scope > li"));
    const targetIndex = items.indexOf(li);

    // Build new HTML fragments
    const beforeItems = items.slice(0, targetIndex);
    const afterItems = items.slice(targetIndex + 1);

    const subBulletDiv =
      "<div>" + getPrefix(0) + escapeHTML(text) + "</div>";

    let newHTML = "";

    // Items before the target stay as a list
    if (beforeItems.length > 0) {
      const tag = ul.tagName.toLowerCase();
      newHTML +=
        "<" +
        tag +
        ">" +
        beforeItems.map((item) => item.outerHTML).join("") +
        "</" +
        tag +
        ">";
    }

    // Our unicode sub-bullet line
    newHTML += subBulletDiv;

    // Items after the target stay as a list
    if (afterItems.length > 0) {
      const tag = ul.tagName.toLowerCase();
      newHTML +=
        "<" +
        tag +
        ">" +
        afterItems.map((item) => item.outerHTML).join("") +
        "</" +
        tag +
        ">";
    }

    // Replace the original <ul> with our new HTML
    ul.outerHTML = newHTML;

    // Now commit the change so Google Chat recognizes it
    commitToComposer(composer);
  }

  // --- Tab / Shift+Tab on a unicode bullet line ---

  function changeIndentLevel(block, currentLevel, direction, composer) {
    const text = block.textContent;
    const content = stripPrefix(text, currentLevel);
    const newLevel = currentLevel + direction;

    if (newLevel < 0) {
      // Convert back to a native bullet list item
      block.outerHTML = "<ul><li>" + escapeHTML(content) + "</li></ul>";
      commitToComposer(composer);
      return;
    }

    if (newLevel >= LEVELS.length) return; // already at max depth

    block.innerHTML = escapeHTML(getPrefix(newLevel) + content);
    commitToComposer(composer);
  }

  function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
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

      const composer = getComposer(anchor);
      if (!composer) return;

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

        convertListItemToSubBullet(li, composer);
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

      changeIndentLevel(block, level, direction, composer);
    },
    true // capture phase
  );
})();
