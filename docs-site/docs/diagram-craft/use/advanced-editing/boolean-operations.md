---
sidebar_position: 3
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

## Build The Rough Composition First

Before you run a boolean operation:

1. place the two shapes so their overlap is intentional
2. style them simply
3. confirm the combined outline is really what the diagram needs

This avoids extra cleanup after the operation replaces the original shapes with a new path-based result.

## A Safe Boolean Workflow

1. Select exactly two shapes.
2. Open the selection context menu.
3. Open **Geometry**.
4. Choose the operation that matches the final silhouette.
5. Inspect the new result before continuing with additional edits.

If you are exploring alternatives, duplicate the source shapes first so you can compare versions quickly.

## Choose The Right Operation

Use **Union** when a single combined form communicates one object better than two overlapping shapes.

Use **Subtract** when you need a notch, cutout, tab, or punched-out shape.

Use **Intersect** when only the common overlap matters.

Use **Exclusive Or** when you want the surrounding remainder without the overlap.

Use **Divide** when you want the overlap to become separate editable pieces.

## Boolean Editing Is More Advanced Than Styling

Once you use boolean tools, you are changing geometry rather than just changing appearance. That is why these commands belong in an advanced-editing workflow: they affect the diagram's shape vocabulary, not just its polish.

## Real Diagram Examples

- Union a badge circle with a card base when the combined outline should read as one component.
- Subtract a small rectangle from a larger panel to create a file-tab shape.
- Divide an overlapped pair when you want separate regions to recolor independently afterward.

## Related Reading

- [Custom Shapes](../styling/custom-shapes)
- [Geometry Operations](geometry-operations)
- [Effects](../styling/effects)
