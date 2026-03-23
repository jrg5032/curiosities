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

  // Native <ul> bullets get ~28px padding-left from browser/Chat CSS.
  // A NBSP at 14px font is ~4-5px, so we need ~6 NBSPs just to reach
  // where the native bullet text starts, then more to appear indented.
  //
  // Indentation levels: indent string + bullet character
  // Level 0 is the native <li> bullet — no entry needed here.
  const BASE_INDENT = 6; // NBSPs to clear <ul> padding
  const PER_LEVEL = 4; // additional NBSPs per nesting level
  const LEVELS = [
    { indent: NBSP.repeat(BASE_INDENT + PER_LEVEL * 0), bullet: "\u25E6 " }, // ◦  (level 1 — first sub-bullet)
    { indent: NBSP.repeat(BASE_INDENT + PER_LEVEL * 1), bullet: "\u25AA " }, // ▪  (level 2)
    { indent: NBSP.repeat(BASE_INDENT + PER_LEVEL * 2), bullet: "\u25B8 " }, // ▸  (level 3)
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
  // Caret + commit helpers
  // -----------------------------------------------------------

  // Place caret at end of a specific element's text content
  function placeCaretAtEndOf(el) {
    const sel = window.getSelection();
    const range = document.createRange();

    // Find the deepest last text node or element
    let target = el;
    while (target.lastChild) {
      target = target.lastChild;
    }

    if (target.nodeType === Node.TEXT_NODE) {
      range.setStart(target, target.length);
    } else {
      range.selectNodeContents(target);
    }
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // Ensure there's exactly one trailing <br> sentinel in the composer
  // (this is the secret sauce that makes Google Chat register the content)
  function ensureSentinelBr(composer) {
    const last = composer.lastChild;
    if (!last || last.nodeName !== "BR") {
      composer.appendChild(document.createElement("br"));
    }
  }

  // Commit DOM changes so Google Chat recognises them, then place caret
  // on the specified target element (instead of jumping to composer end).
  function commitToComposer(composer, caretTarget) {
    ensureSentinelBr(composer);
    composer.click();

    if (caretTarget && composer.contains(caretTarget)) {
      placeCaretAtEndOf(caretTarget);
    } else {
      // Fallback: place at end of composer
      placeCaretAtEndOf(composer);
    }
  }

  // --- Tab from a native bullet list item → unicode sub-bullet ---

  const MARKER_ATTR = "data-subbullet-target";

  function convertListItemToSubBullet(li, composer) {
    const text = li.textContent;
    const ul = li.closest("ul, ol");
    if (!ul) return;

    const items = Array.from(ul.querySelectorAll(":scope > li"));
    const targetIndex = items.indexOf(li);

    const beforeItems = items.slice(0, targetIndex);
    const afterItems = items.slice(targetIndex + 1);

    // Mark the new div so we can find it after outerHTML replacement
    const subBulletDiv =
      '<div ' + MARKER_ATTR + '="1">' +
      escapeHTML(getPrefix(0) + text) +
      "</div>";

    let newHTML = "";

    if (beforeItems.length > 0) {
      const tag = ul.tagName.toLowerCase();
      newHTML +=
        "<" + tag + ">" +
        beforeItems.map((item) => item.outerHTML).join("") +
        "</" + tag + ">";
    }

    newHTML += subBulletDiv;

    if (afterItems.length > 0) {
      const tag = ul.tagName.toLowerCase();
      newHTML +=
        "<" + tag + ">" +
        afterItems.map((item) => item.outerHTML).join("") +
        "</" + tag + ">";
    }

    ul.outerHTML = newHTML;

    // Find the marked element and commit
    const target = composer.querySelector("[" + MARKER_ATTR + "]");
    if (target) target.removeAttribute(MARKER_ATTR);
    commitToComposer(composer, target);
  }

  // --- Tab / Shift+Tab on a unicode bullet line ---

  function changeIndentLevel(block, currentLevel, direction, composer) {
    const text = block.textContent;
    const content = stripPrefix(text, currentLevel);
    const newLevel = currentLevel + direction;

    if (newLevel < 0) {
      // Convert back to a native bullet list item
      block.outerHTML =
        '<ul><li ' + MARKER_ATTR + '="1">' +
        escapeHTML(content) +
        "</li></ul>";

      const target = composer.querySelector("[" + MARKER_ATTR + "]");
      if (target) target.removeAttribute(MARKER_ATTR);
      commitToComposer(composer, target);
      return;
    }

    if (newLevel >= LEVELS.length) return; // already at max depth

    block.innerHTML = escapeHTML(getPrefix(newLevel) + content);
    commitToComposer(composer, block);
  }

  function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // Place caret right after the prefix text in an element
  function placeCaretAfterPrefix(el, level) {
    const prefix = getPrefix(level);
    if (!prefix) return placeCaretAtEndOf(el);

    const sel = window.getSelection();
    const range = document.createRange();

    // Walk text nodes to find the offset that lands right after the prefix
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let remaining = prefix.length;
    let node;
    while ((node = walker.nextNode())) {
      if (node.length >= remaining) {
        range.setStart(node, remaining);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      remaining -= node.length;
    }
    // Fallback
    placeCaretAtEndOf(el);
  }

  // --- Shift+Enter handler: continue sub-bullet on new line ---

  function handleShiftEnter(e) {
    if (e.key !== "Enter" || !e.shiftKey) return;

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const anchor = sel.anchorNode;
    if (!isInsideComposer(anchor)) return;

    const composer = getComposer(anchor);
    if (!composer) return;

    // Only act on our unicode bullet lines
    const block = getCurrentBlock(sel);
    if (!block) return;

    const level = detectLevel(block.textContent);
    if (level === -1) return; // not a sub-bullet line, let default behavior happen

    const prefix = getPrefix(level);
    const content = stripPrefix(block.textContent, level);

    // If the line is empty (just the prefix), remove it and exit sub-bullet mode
    if (content.trim() === "") {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // Replace with an empty div so the user gets a plain new line
      const emptyDiv = document.createElement("div");
      emptyDiv.appendChild(document.createElement("br"));
      block.replaceWith(emptyDiv);
      commitToComposer(composer, emptyDiv);
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    // Create a new div with the same prefix
    const newDiv = document.createElement("div");
    newDiv.textContent = prefix;
    newDiv.setAttribute(MARKER_ATTR, "1");

    // Insert after the current block
    block.after(newDiv);

    ensureSentinelBr(composer);
    composer.click();

    // Place caret right after the prefix (ready to type)
    newDiv.removeAttribute(MARKER_ATTR);
    placeCaretAfterPrefix(newDiv, level);
  }

  // --- Main keydown handler ---

  document.addEventListener("keydown", handleShiftEnter, true);

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

        // Shift+Tab on a native bullet — already at base level, nothing to do
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
