---
sidebar_position: 1
related_reading:
  - label: Selection and Manipulation
    to: /diagram-craft/diagram-craft/use/core-diagramming/selection-manipulation
  - label: Snapping and Guides
    to: /diagram-craft/diagram-craft/use/advanced-editing/snapping-guides
  - label: Geometry Operations
    to: /diagram-craft/diagram-craft/use/advanced-editing/geometry-operations
---

import ThemedImage from '@theme/ThemedImage';

# Alignment and Distribution

Alignment and distribution commands are available from the selection context menu when the current selection contains enough compatible elements.

<ThemedImage
  alt="Diagram Craft selection context menu with align and distribute actions visible"
  sources={{
    light: require('/img/diagram-craft/advanced-editing/alignment-distribution-light.png').default,
    dark: require('/img/diagram-craft/advanced-editing/alignment-distribution-dark.png').default,
  }}
/>

## Choose An Alignment Command

Treat these as two separate jobs:

- **Align** makes edges, centers, widths, or heights consistent
- **Distribute** evens out spacing between multiple items

If shapes are still drifting vertically or horizontally, align them before you distribute them.

## Distribute A Selection

Select three or more elements, open **Distribute**, and choose **Horizontally** or **Vertically**. Diagram Craft keeps the outer elements in place and evens the spacing between the selected elements.

## The First Selected Item Matters

Alignment actions use the first item in the working set as the reference. In practice, that means you should start with the element that is already in the correct position or size before adding the rest of the selection.

That is especially important for:

- aligning widths and heights
- centering a set against the one item you want to keep fixed
- cleaning up repeated nodes in a lane or swimlane

## Alignment Also Works On Children

If you select a single container or group that has at least two children, Diagram Craft applies alignment and distribution to the children inside it. That is useful when you want to tidy a local cluster without disturbing the outer container.

## Useful Shortcuts

Diagram Craft includes keyboard shortcuts for the common alignment and distribution actions. If you use these tools frequently, they are worth learning:

- `Alt+Ctrl+L` align left
- `Alt+Ctrl+R` align right
- `Alt+Ctrl+T` align top
- `Alt+Ctrl+B` align bottom
- `Alt+Ctrl+C` align centers vertically
- `Alt+Ctrl+M` align centers horizontally
- `Alt+Ctrl+H` distribute horizontally
- `Alt+Ctrl+V` distribute vertically
