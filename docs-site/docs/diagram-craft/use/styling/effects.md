---
sidebar_position: 3
related_reading:
  - label: Colors and Gradients
    to: /diagram-craft/diagram-craft/use/styling/colors-gradients
  - label: Custom Shapes
    to: /diagram-craft/diagram-craft/use/styling/custom-shapes
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
- **Blur** for softening an element, usually in mockups or layered compositions
- **Isometric** when a diagram benefits from a stylized projection

## Configure A Shadow

Shadows are usually the best first effect:

1. Select the node.
2. Open **Style**.
3. Expand **Shadow**.
4. Enable it and keep the blur and offset modest.

## Configure Sketch And Rounding

Enable **Sketch** to use the hand-drawn renderer, then adjust the exposed sketch parameters. Use **Rounding** to change supported corners without converting the node to curves. The controls update the selected element immediately, so you can inspect the result on the canvas before closing the panel.
