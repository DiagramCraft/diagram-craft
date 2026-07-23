---
sidebar_position: 4
related_reading:
  - label: Boolean Operations
    to: /diagram-craft/diagram-craft/use/advanced-editing/boolean-operations
  - label: Geometry Operations
    to: /diagram-craft/diagram-craft/use/advanced-editing/geometry-operations
  - label: Shapes and Elements
    to: /diagram-craft/diagram-craft/use/core-diagramming/shapes-elements
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

## Build From Existing Nodes

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

Boolean commands replace the selected source nodes with the resulting geometry. Duplicate the source nodes first if you need to preserve an editable copy of the original construction.
