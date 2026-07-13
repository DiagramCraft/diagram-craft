---
sidebar_position: 3
related_reading:
  - label: Custom Shapes
    to: /diagram-craft/diagram-craft/use/styling/custom-shapes
  - label: Geometry Operations
    to: /diagram-craft/diagram-craft/use/advanced-editing/geometry-operations
  - label: Effects
    to: /diagram-craft/diagram-craft/use/styling/effects
---

import ThemedImage from '@theme/ThemedImage';

# Boolean Operations

Boolean operations let you build new outlines by combining two shapes. They are the bridge between ordinary styling and real shape construction, and they are best used when the meaning of the diagram depends on the outline itself.

<ThemedImage
  alt="Diagram Craft geometry context menu showing boolean operation commands"
  sources={{
    light: require('/img/diagram-craft/advanced-editing/boolean-operations-light.png').default,
    dark: require('/img/diagram-craft/advanced-editing/boolean-operations-dark.png').default,
  }}
/>

## What The Operations Do

Diagram Craft exposes these commands in the selection context menu under **Geometry**:

- **Union** merges the two selected shapes into one outline
- **Subtract** removes the overlap from the first shape using the second
- **Intersect** keeps only the shared overlap
- **Exclusive Or** removes the overlap and keeps the remaining outer parts
- **Divide** splits the overlap into separate resulting regions

These tools operate on two selected nodes at a time.

## Run A Boolean Operation

1. Select exactly two shapes.
2. Open the selection context menu.
3. Open **Geometry**.
4. Choose the operation that matches the final silhouette.
5. Inspect the new result before continuing with additional edits.

The operation replaces the source nodes with its result. Duplicate the source nodes first if you need to keep an editable copy.

## Choose The Right Operation

Use **Union** when a single combined form communicates one object better than two overlapping shapes.

Use **Subtract** when you need a notch, cutout, tab, or punched-out shape.

Use **Intersect** when only the common overlap matters.

Use **Exclusive Or** when you want the surrounding remainder without the overlap.

Use **Divide** when you want the overlap to become separate editable pieces.
