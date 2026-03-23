// Google Chat Sub-Bullets
// Intercepts Tab/Shift+Tab inside bullet lists in the Google Chat composer
// to indent/outdent list items.
//
// Strategy: select the list item content → delete it via execCommand →
// reposition cursor → insert it via execCommand('insertHTML').
// Every DOM change goes through the editing stack so Google Chat's
// internal model stays in sync.

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

  function setCursorEnd(el) {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // Get the inner HTML of an li, excluding any nested sub-lists
  function getListItemTextHTML(li) {
    const clone = li.cloneNode(true);
    clone.querySelectorAll("ul, ol").forEach((l) => l.remove());
    return clone.innerHTML;
  }

  // ---------- Indent ----------
  // Move <li> into a nested list inside the previous <li>.
  // All mutations go through execCommand so the editor model tracks them.
  function indentListItem(li, composer) {
    const prevLi = li.previousElementSibling;
    if (!prevLi) return false;

    const parentList = li.parentElement;
    const tag = parentList ? parentList.tagName.toLowerCase() : "ul";

    // Grab content before we delete
    const contentHTML = getListItemTextHTML(li);
    const nestedChildren = li.querySelector(":scope > ul, :scope > ol");
    const nestedHTML = nestedChildren ? nestedChildren.outerHTML : "";

    // Select the entire <li> node and delete it via execCommand
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNode(li);
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand("delete", false, null);

    // Now position cursor inside the previous li's nested list (create if needed)
    let nestedList = prevLi.querySelector(":scope > ul, :scope > ol");
    if (nestedList) {
      // Place cursor at the end of the existing nested list
      setCursorEnd(nestedList);
    } else {
      // Place cursor at end of prevLi, then insert a new list wrapper
      setCursorEnd(prevLi);
    }

    // Build the HTML to insert
    let insertHTML;
    if (nestedList) {
      // Append a new li to the existing nested list
      insertHTML = "<li>" + contentHTML + nestedHTML + "</li>";
    } else {
      // Create a brand new nested list
      insertHTML =
        "<" + tag + "><li>" + contentHTML + nestedHTML + "</li></" + tag + ">";
    }

    document.execCommand("insertHTML", false, insertHTML);

    // Place cursor in the newly inserted li
    const updatedNested = prevLi.querySelector(":scope > ul, :scope > ol");
    if (updatedNested) {
      const lastLi = updatedNested.querySelector("li:last-child");
      if (lastLi) setCursorStart(lastLi);
    }

    return true;
  }

  // ---------- Outdent ----------
  // Move <li> out of its nested list to the parent level.
  function outdentListItem(li, composer) {
    const parentList = li.parentElement;
    if (!parentList) return false;
    const parentLi = parentList.parentElement;
    if (!parentLi || parentLi.tagName !== "LI") return false;

    const grandparentList = parentLi.parentElement;
    if (!grandparentList) return false;

    const tag = grandparentList.tagName.toLowerCase();
    const contentHTML = getListItemTextHTML(li);

    // Collect any siblings after this li — they need to stay nested
    const siblingsAfter = [];
    let sib = li.nextElementSibling;
    while (sib) {
      siblingsAfter.push(sib.outerHTML);
      sib = sib.nextElementSibling;
    }

    // Existing nested children of this li
    const nestedChildren = li.querySelector(":scope > ul, :scope > ol");
    let nestedHTML = nestedChildren ? nestedChildren.innerHTML : "";

    // Combine: any nested children + any following siblings stay as sub-items
    if (siblingsAfter.length > 0) {
      nestedHTML += siblingsAfter.join("");
    }

    const subListHTML =
      nestedHTML.length > 0
        ? "<" + tag + ">" + nestedHTML + "</" + tag + ">"
        : "";

    // Delete the current li and any siblings after it via execCommand
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNode(li);
    if (siblingsAfter.length > 0) {
      // Extend selection to include the following siblings
      const lastSib = parentList.lastElementChild;
      if (lastSib) range.setEndAfter(lastSib);
    }
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand("delete", false, null);

    // Clean up empty parent list
    if (parentList.children.length === 0) {
      const r2 = document.createRange();
      r2.selectNode(parentList);
      sel.removeAllRanges();
      sel.addRange(r2);
      document.execCommand("delete", false, null);
    }

    // Place cursor after the parent li and insert
    const r3 = document.createRange();
    r3.setStartAfter(parentLi);
    r3.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r3);

    const insertHTML = "<li>" + contentHTML + subListHTML + "</li>";
    document.execCommand("insertHTML", false, insertHTML);

    // Find and focus the new li
    const newLi = parentLi.nextElementSibling;
    if (newLi && newLi.tagName === "LI") {
      setCursorStart(newLi);
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
    true
  );
})();
