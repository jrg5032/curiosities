// Google Chat Sub-Bullets
// Intercepts Tab/Shift+Tab inside bullet lists in the Google Chat composer
// to indent/outdent list items.
//
// Uses document.execCommand so that Google Chat's internal content model
// picks up the change (direct DOM mutations are ignored on send).

(function () {
  "use strict";

  function getClosestElement(node, selector) {
    if (!node) return null;
    const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    return el ? el.closest(selector) : null;
  }

  function isInsideListItem(node) {
    return !!getClosestElement(node, "li");
  }

  function isInsideComposer(node) {
    return !!getClosestElement(node, "[contenteditable='true']");
  }

  function getComposer(node) {
    return getClosestElement(node, "[contenteditable='true']");
  }

  function getCurrentListItem(selection) {
    if (!selection || !selection.rangeCount) return null;
    const range = selection.getRangeAt(0);
    return getClosestElement(range.startContainer, "li");
  }

  // Select the entire contents of an <li>, excluding any nested sub-list
  function selectListItemContent(li) {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(li);

    // If the li contains a nested list, end the selection before it
    const nestedList = li.querySelector(":scope > ul, :scope > ol");
    if (nestedList) {
      range.setEndBefore(nestedList);
    }

    sel.removeAllRanges();
    sel.addRange(range);
    return sel;
  }

  // Place cursor at the start of an element's text
  function setCursorStart(el) {
    const sel = window.getSelection();
    const range = document.createRange();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    const firstText = walker.nextNode();
    if (firstText) {
      range.setStart(firstText, 0);
      range.collapse(true);
    } else {
      range.selectNodeContents(el);
      range.collapse(true);
    }
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // ---------- Indent via execCommand ----------
  // The browser's built-in "indent" command wraps the current selection's
  // list item in a deeper nested list — exactly what we want.
  function indentListItem(li, composer) {
    // Can't indent if there's no previous sibling to nest under
    if (!li.previousElementSibling) return false;

    // Select the li content so execCommand operates on it
    selectListItemContent(li);

    // "indent" on a list item wraps it in a nested <ul>/<ol>
    document.execCommand("indent", false, null);

    // Re-find and place cursor (the old li reference may be stale)
    const sel = window.getSelection();
    if (sel.rangeCount) {
      const newLi = getClosestElement(sel.getRangeAt(0).startContainer, "li");
      if (newLi) setCursorStart(newLi);
    }

    return true;
  }

  // ---------- Outdent via execCommand ----------
  function outdentListItem(li, composer) {
    const parentList = li.parentElement;
    if (!parentList) return false;
    const parentLi = parentList.parentElement;
    // Already at top level — nothing to outdent
    if (!parentLi || parentLi.tagName !== "LI") return false;

    selectListItemContent(li);

    document.execCommand("outdent", false, null);

    const sel = window.getSelection();
    if (sel.rangeCount) {
      const newLi = getClosestElement(sel.getRangeAt(0).startContainer, "li");
      if (newLi) setCursorStart(newLi);
    }

    return true;
  }

  document.addEventListener(
    "keydown",
    function (e) {
      if (e.key !== "Tab") return;

      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;

      const anchorNode = selection.anchorNode;
      if (!isInsideComposer(anchorNode)) return;
      if (!isInsideListItem(anchorNode)) return;

      const li = getCurrentListItem(selection);
      if (!li) return;

      const composer = getComposer(anchorNode);

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      if (e.shiftKey) {
        outdentListItem(li, composer);
      } else {
        indentListItem(li, composer);
      }
    },
    true // capture phase to beat Google Chat's own handler
  );
})();
