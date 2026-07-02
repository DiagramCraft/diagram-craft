---
sidebar_position: 1
---

import ThemedImage from '@theme/ThemedImage';

# Tool Windows

Tool windows are the main way Diagram Craft exposes editing, inspection, search, and document-management surfaces without forcing everything into modal dialogs. Use this page to understand the overall layout. For the full panel inventory and tab list, use [Tool Windows Reference](../reference/tool-windows-reference).

<ThemedImage
  alt="Diagram Craft editor layout with left and right tool windows around the canvas"
  sources={{
    light: require('/img/diagram-craft/user-interface/editor-layout-light.png').default,
    dark: require('/img/diagram-craft/user-interface/editor-layout-dark.png').default,
  }}
/>

## Two Sidebar Model

Diagram Craft uses two sidebars:

- the **left sidebar** for finding, searching, and navigating
- the **right sidebar** for editing, inspecting, and reviewing

That split is the fastest way to build a mental model of the UI.

## Left Sidebar At A Glance

The left sidebar is where you typically:

- pick shapes or icons
- drag model-backed items and template previews onto the canvas
- inspect document structure
- review undo history
- run search, advanced search, or DJQL queries
- work with stories
- edit the current layer as diagram text
- open the AI assistant when configured

## Right Sidebar At A Glance

The right sidebar is where you typically:

- style the current selection
- inspect selection details
- manage attached data
- review and resolve comments
- inspect document-level style assets

## How To Use Them Well

- Keep the left sidebar focused on finding or navigating the thing you need.
- Use the right sidebar once you are editing or reviewing the selected object.
- Learn the sidebar shortcuts early if you switch panels often; they save more time than deep menu navigation.

## Tabs Inside A Window

Most tool windows are tabbed. That matters because many features live one level deeper than the sidebar icon itself:

- the objects window separates shapes, recents, model-backed items, and icons
- the search window separates simple search, advanced search, and DJQL
- the structure window separates layers, document structure, and tags
- the style window changes tabs based on what is selected

## Reference Versus Overview

This page is the overview. The durable lookup page is [Tool Windows Reference](../reference/tool-windows-reference), which lists the implemented windows, their tabs, and the current shortcut entry points.
