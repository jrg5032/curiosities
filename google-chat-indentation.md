# Google Chat: Multi-level Indentation / Sub-bullets

## TL;DR

Google Chat **does not natively support** sub-bullets or multi-level indentation. The `Tab` key cycles through UI elements instead of indenting list items.

We built a Chrome extension to fix this: [`google-chat-indent-extension/`](./google-chat-indent-extension/)

## Chrome Extension: Google Chat Sub-Bullets

A lightweight Chrome extension that intercepts `Tab` / `Shift+Tab` inside bullet lists in the Google Chat composer and indents/outdents list items.

### Install (developer mode)

1. Open `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `google-chat-indent-extension/` folder
5. Open [Google Chat](https://chat.google.com) and start a bulleted list

### Usage

- Start a bulleted list in Google Chat (toolbar button or `Ctrl+Shift+8`)
- Press `Tab` on a list item to indent it into a sub-bullet
- Press `Shift+Tab` to outdent it back up
- Works at multiple nesting levels

### How it works

The extension listens for `Tab` keydown events in the capture phase on `contenteditable` elements within Google Chat. When the cursor is inside an `<li>`, it prevents the default tab behavior and instead manipulates the DOM to nest/unnest the list item.

## Other workarounds

- **Use a Google Doc**: Write nested bullet content in Docs and share the link in Chat.
- **Manual visual nesting**: Use spaces and dashes to approximate sub-bullets in plain text.

## References

- [Tab indent is not working with bulletin list items](https://support.google.com/chat/thread/288024455) — Google Chat Community thread confirming the limitation
- [Google Chat message formatting docs](https://support.google.com/chat/answer/7649118) — official formatting reference (no mention of nested lists)
