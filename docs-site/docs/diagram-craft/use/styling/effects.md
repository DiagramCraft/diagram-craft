---
sidebar_position: 3
related_reading:
  - label: Colors and Gradients
    to: /diagram-craft/diagram-craft/use/styling/colors-gradients
  - label: Geometry Operations
    to: /diagram-craft/diagram-craft/use/advanced-editing/geometry-operations
  - label: Alignment and Distribution
    to: /diagram-craft/diagram-craft/use/advanced-editing/alignment-distribution
---

import ThemedImage from '@theme/ThemedImage';

# Effects

Diagram Craft provides shadow and effect controls in the **Style** window for selected nodes and other supported elements.

<ThemedImage
  alt="Diagram Craft effects controls for reflection, blur, glass, sketch, and rounding"
  sources={{
    light: require('/img/diagram-craft/styling/effects-controls-light.png').default,
    dark: require('/img/diagram-craft/styling/effects-controls-dark.png').default,
  }}
/>

## Available Effects

- **Shadow** for separating foreground nodes from containers or the canvas
- **Opacity** for de-emphasizing supporting elements
- **Sketch** for rough, workshop-style diagrams
- **Rounding** for shapes that should feel less mechanical
- **Reflection** for presentation-style callouts or polished cards
- **Glass** for decorative emphasis
- **Blur** for softening an element
- **Isometric** to draw isometric, quasi-3D diagrams

## Configure A Shadow

1. Select the node.
2. Open **Style**.
3. Expand **Shadow**.
4. Enable it and keep the blur and offset modest.

## Configure Sketch And Rounding

Enable **Sketch** to use the hand-drawn renderer, then adjust the exposed sketch parameters. Use **Rounding** to change supported corners without converting the node to curves. The controls update the selected element immediately, so you can inspect the result on the canvas before closing the panel.
