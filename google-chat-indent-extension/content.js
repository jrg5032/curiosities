// Google Chat Sub-Bullets
// Intercepts Tab/Shift+Tab inside bullet lists in the Google Chat composer
// to indent/outdent list items instead of cycling through UI elements.

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

  // Get the <li> element the cursor is currently in
  function getCurrentListItem(selection) {
    if (!selection || !selection.rangeCount) return null;
    const range = selection.getRangeAt(0);
    return getClosestElement(range.startContainer, "li");
  }

  // Check if cursor is at the start of the list item text
  function isCursorAtStartOfListItem(selection, li) {
    if (!selection || !selection.rangeCount || !li) return false;
    const range = selection.getRangeAt(0);

    // If there's a selection (not collapsed), treat Tab as indent anywhere
    if (!range.collapsed) return true;

    // Check if cursor offset is 0 and it's at/near the start of the li
    const treeWalker = document.createTreeWalker(
      li,
      NodeFilter.SHOW_TEXT,
      null
    );
    const firstTextNode = treeWalker.nextNode();

    if (!firstTextNode) return true; // empty li

    if (range.startContainer === firstTextNode && range.startOffset === 0) {
      return true;
    }

    // Also allow if startContainer is the li itself at offset 0
    if (range.startContainer === li && range.startOffset === 0) {
      return true;
    }

    return false;
  }

  // Indent: wrap the current <li> in a new nested <ul> inside the previous <li>
  function indentListItem(li) {
    const prevLi = li.previousElementSibling;
    if (!prevLi) return false; // Can't indent the first item

    const parentList = li.parentElement; // <ul> or <ol>
    const tagName = parentList ? parentList.tagName : "UL";

    // Check if the previous li already has a nested list
    let nestedList = prevLi.querySelector(":scope > ul, :scope > ol");
    if (!nestedList) {
      nestedList = document.createElement(tagName);
      prevLi.appendChild(nestedList);
    }

    // Move the current li into the nested list
    nestedList.appendChild(li);

    return true;
  }

  // Outdent: move the <li> out of its nested list back to the parent level
  function outdentListItem(li) {
    const parentList = li.parentElement;
    if (!parentList) return false;

    const parentLi = parentList.parentElement;
    if (!parentLi || parentLi.tagName !== "LI") return false; // Already at top level

    const grandparentList = parentLi.parentElement;
    if (!grandparentList) return false;

    // Move any remaining siblings after this li into a new nested list
    const siblingsAfter = [];
    let next = li.nextElementSibling;
    while (next) {
      siblingsAfter.push(next);
      next = next.nextElementSibling;
    }

    if (siblingsAfter.length > 0) {
      const newNestedList = document.createElement(parentList.tagName);
      siblingsAfter.forEach((sib) => newNestedList.appendChild(sib));
      li.appendChild(newNestedList);
    }

    // Insert the li after its parent li in the grandparent list
    grandparentList.insertBefore(li, parentLi.nextSibling);

    // Clean up empty lists
    if (parentList.children.length === 0) {
      parentList.remove();
    }

    return true;
  }

  function setCursorInElement(el) {
    const selection = window.getSelection();
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
    selection.removeAllRanges();
    selection.addRange(range);
  }

  // Dispatch an input event so Google Chat registers the DOM change
  function notifyComposer(composer) {
    if (!composer) return;
    composer.dispatchEvent(new Event("input", { bubbles: true }));
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

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const composer = getComposer(anchorNode);
      let success;

      if (e.shiftKey) {
        success = outdentListItem(li);
      } else {
        success = indentListItem(li);
      }

      if (success) {
        setCursorInElement(li);
        notifyComposer(composer);
      }
    },
    true // capture phase to beat Google Chat's own handler
  );
})();
