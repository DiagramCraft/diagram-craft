---
sidebar_position: 3
related_reading:
  - label: Tool Windows
    to: /diagram-craft/diagram-craft/user-interface/tool-windows
  - label: Keyboard Shortcuts
    to: /diagram-craft/diagram-craft/user-interface/keyboard-shortcuts
---

import ThemedImage from '@theme/ThemedImage';

# Toolbars

Toolbars handle the actions you reach for repeatedly while drawing: tool selection, insert actions, zoom controls, and a small set of context-sensitive editing controls.

<ThemedImage
  alt="Diagram Craft editor toolbar with drawing tools, insert actions, and sidebar rails"
  sources={{
    light: require('/img/diagram-craft/user-interface/editor-layout-light.png').default,
    dark: require('/img/diagram-craft/user-interface/editor-layout-dark.png').default,
  }}
/>

## Main Toolbar

The center toolbar is the quickest route to the core drawing modes:

- move
- rectangle
- edge
- text
- freehand
- pen
- node

It also exposes common insertion actions such as image, table, and shape insertion.

## Auxiliary Toolbar

The secondary toolbar handles view-oriented actions such as:

- preview
- zoom out
- zoom in
- zoom tool
- zoom to fit

If you switch frequently between editing and presenting, this toolbar saves repeated trips into menus or the command palette.

## Context-Sensitive Controls

Not every toolbar action is global. Some controls only become useful when a selection exists or when the current tool supports them.

Treat the toolbar as the fast path for the action you already know you want. Use the right sidebar when you need deeper configuration or inspection.

## Toolbars Versus Sidebars

- Use the toolbar to change mode or trigger a frequent action quickly.
- Use the sidebars to inspect details, configure properties, and manage document assets.

That split keeps the top-level chrome compact while still giving the editor room for deeper controls.

## Shortcut Relationship

Many toolbar actions have keyboard equivalents. Tooltips expose those bindings, so the toolbar is also a good place to learn which actions are worth memorizing.
