---
sidebar_position: 2
related_reading:
  - label: Styling System
    to: /diagram-craft/diagram-craft/use/styling/styling-system
  - label: Effects
    to: /diagram-craft/diagram-craft/use/styling/effects
  - label: Shapes and Elements
    to: /diagram-craft/diagram-craft/use/core-diagramming/shapes-elements
---

import ThemedImage from '@theme/ThemedImage';

# Colors and Gradients

Color is the fastest way to make a diagram easier to scan, but it works best when it reinforces structure instead of competing with it. In Diagram Craft, routine styling starts in the **Style** tab with fill and stroke changes, then moves into gradients, patterns, or images only when the diagram needs extra emphasis.

<ThemedImage
  alt="Diagram Craft style panel showing fill and effects controls for a selected shape"
  sources={{
    light: require('/img/diagram-craft/styling/style-controls-light.png').default,
    dark: require('/img/diagram-craft/styling/style-controls-dark.png').default,
  }}
/>

## Start With Fill And Stroke

For most diagrams, a simple workflow is enough:

1. Select the shape you want to adjust.
2. Open the **Style** tab in the right sidebar.
3. In **Fill**, choose a solid color first.
4. In **Stroke**, adjust the outline color or width only if the shape needs stronger separation.

Use fill color to group related elements, and stroke changes to make exceptions stand out. If everything gets a thick outline or a saturated fill, the diagram becomes harder to read.

## Set Fill And Stroke Independently

The fill and stroke controls are independent. A node can have no fill while retaining an outline, or no visible stroke while retaining its fill. Use the color controls in each section to choose a color and adjust opacity where available.

## Configure A Gradient

Gradients are available in the **Fill** panel by switching the fill type to **Gradient**. Diagram Craft supports both **Linear** and **Radial** gradients.

1. Select the node.
2. In **Fill**, change **Type** to **Gradient**.
3. Choose the primary and secondary colors.
4. Set the gradient **Type** to **Linear** or **Radial**.
5. If you use a linear gradient, adjust the **Direction** until the shading supports the layout instead of fighting it.

## Use Pattern, Texture, Or Image Fills

The fill panel also supports **Pattern**, **Texture**, and **Image** fills:

- patterns can differentiate regions when color alone is not enough
- textures can make title or background panels feel distinct
- image fills work best for illustrative nodes, posters, or mockups inside a diagram

The available configuration fields change with the selected fill type.
