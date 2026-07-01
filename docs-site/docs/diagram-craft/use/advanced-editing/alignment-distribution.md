---
sidebar_position: 1
---

import ThemedImage from '@theme/ThemedImage';

# Alignment and Distribution

Alignment and distribution are the fastest way to turn a loose draft into something that looks intentional. In Diagram Craft, these tools live in the selection context menu and are designed for cleanup passes after the main structure is already on the canvas.

<ThemedImage
  alt="Diagram Craft selection context menu with align and distribute actions visible"
  sources={{
    light: require('/img/diagram-craft/advanced-editing/alignment-distribution-light.png').default,
    dark: require('/img/diagram-craft/advanced-editing/alignment-distribution-dark.png').default,
  }}
/>

## Align First, Distribute Second

Treat these as two separate jobs:

- **Align** makes edges, centers, widths, or heights consistent
- **Distribute** evens out spacing between multiple items

If shapes are still drifting vertically or horizontally, align them before you distribute them.

## A Practical Cleanup Sequence

For a row or column of related shapes:

1. Select the shapes that belong together.
2. Use **Align** to line up their top, bottom, left, right, or center.
3. If needed, use **Align Width** or **Align Height** to normalize the shape sizes.
4. Use **Distribute Horizontally** or **Distribute Vertically** once the edges are consistent.
5. Recheck the connected edges after the move.

This keeps the spacing fix from introducing new visual noise.

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

## Real Diagram Examples

- Align service boxes before distributing them across a sequence diagram lane.
- Equalize the width of repeated callout cards before spacing them under a heading.
- Select a single group and distribute only its internal steps while keeping the group anchored.

## Related Reading

- [Selection and Manipulation](../core-diagramming/selection-manipulation)
- [Snapping and Guides](snapping-guides)
- [Geometry Operations](geometry-operations)
