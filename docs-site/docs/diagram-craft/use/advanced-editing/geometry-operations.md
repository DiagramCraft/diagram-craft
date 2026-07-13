---
sidebar_position: 4
related_reading:
  - label: Boolean Operations
    to: /diagram-craft/diagram-craft/use/advanced-editing/boolean-operations
  - label: Alignment and Distribution
    to: /diagram-craft/diagram-craft/use/advanced-editing/alignment-distribution
  - label: Connectors and Edges
    to: /diagram-craft/diagram-craft/use/core-diagramming/connectors-edges
---

import ThemedImage from '@theme/ThemedImage';

# Geometry Operations

Geometry operations change the structure of a shape or connector rather than its color or effect. This is where you move from visual polish into direct manipulation of bounds, orientation, edge paths, and editable curves.

<ThemedImage
  alt="Diagram Craft arrange tools with transform controls for direct geometry editing"
  sources={{
    light: require('/img/diagram-craft/advanced-editing/geometry-editing-light.png').default,
    dark: require('/img/diagram-craft/advanced-editing/geometry-editing-dark.png').default,
  }}
/>

## Routine Geometry Changes

Most diagrams only need a few direct geometry actions:

- move and resize a shape precisely
- rotate it to a specific angle
- flip it horizontally or vertically
- change an edge type and adjust its path

These are still advanced compared with ordinary styling, but they are common and safe when used carefully.

## Use The Arrange Tab For Precise Transforms

For a selected node, the **Arrange** tab gives you direct control over:

- position
- width and height
- rotation
- flip states

This is useful when a shape must line up with a precise layout, when grouped elements need mirrored orientation, or when a visual motif repeats across the page.

## Convert To Curves Only When Needed

**Convert to curves** is the point where a normal shape becomes an editable path. Use it when:

- the built-in shape is close but not exact
- a boolean result still needs manual refinement
- the outline itself carries meaning that styling cannot express

Do not convert too early. Standard shapes remain easier to resize and reuse cleanly.

## Edge Geometry Counts Too

Advanced editing also includes connector geometry:

- changing the edge type between straight, orthogonal, curved, bezier, or axis-aligned
- adding waypoints to control the route
- refining bezier handles when a connection path needs to flow around nearby elements

That is often the difference between a readable diagram and one where lines feel accidental.
