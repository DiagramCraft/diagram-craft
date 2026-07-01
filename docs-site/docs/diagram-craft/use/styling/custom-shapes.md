---
sidebar_position: 4
---

import ThemedImage from '@theme/ThemedImage';

# Custom Shapes

Custom shapes are where styling turns into editing. Instead of changing how a built-in shape looks, you start building a new outline from existing geometry and then refine it as an editable path.

<ThemedImage
  alt="Diagram Craft context menu showing geometry tools for converting shapes to curves and combining them"
  sources={{
    light: require('/img/diagram-craft/advanced-editing/boolean-operations-light.png').default,
    dark: require('/img/diagram-craft/advanced-editing/boolean-operations-dark.png').default,
  }}
/>

## Start With Simple Primitives

The fastest way to create a custom shape is to begin with a few basic shapes that already approximate what you want:

- rectangles for cards, tabs, or containers
- circles for badges or cutouts
- triangles or diamonds for directional accents

Build the rough silhouette first. Only move to geometry operations once the composition is close.

## Combine Shapes Before Converting To Curves

When the result can still be described as a combination of simple forms, use the **Geometry** menu on the selection:

- **Union** to merge overlapping shapes into one outline
- **Subtract** to cut one shape from another
- **Intersect** to keep only the overlap
- **Exclusive Or** to keep the non-overlapping remainder
- **Divide** to split overlapping areas into separate pieces

This is usually faster and cleaner than jumping directly into path editing.

## Convert To Curves When The Outline Needs Hand Editing

Once a built-in shape is close but not quite right:

1. Select the shape.
2. Open the selection context menu.
3. Choose **Geometry**.
4. Run **Convert to curves**.
5. Confirm the conversion to an editable path.

After that point, you are no longer just styling the shape. You are editing its geometry directly.

## When To Use A Custom Shape

Move beyond built-in shapes when:

- the diagram repeats a distinctive visual motif
- a notch, cutout, or merged silhouette adds real meaning
- the shape must match an established notation or brand treatment

Stay with standard shapes when a label can explain the difference more cheaply. A custom outline should earn its complexity.

## Real Diagram Examples

- Merge a rectangle and a small circle to create a card with a status badge built into the outline.
- Subtract a smaller rectangle from a larger one to create a folder-like tab shape.
- Convert a merged shape to curves when you need to soften one corner or adjust the silhouette manually.

## Related Reading

- [Boolean Operations](../advanced-editing/boolean-operations)
- [Geometry Operations](../advanced-editing/geometry-operations)
- [Shapes and Elements](../core-diagramming/shapes-elements)
