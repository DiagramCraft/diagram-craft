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

Diagram Craft provides color controls in the **Style** tab. Select a node, edge, or text element, then use the relevant **Fill**, **Stroke**, or **Text** controls in the right sidebar.

<ThemedImage
  alt="Diagram Craft style panel showing fill and effects controls for a selected shape"
  sources={{
    light: require('/img/diagram-craft/styling/style-controls-light.png').default,
    dark: require('/img/diagram-craft/styling/style-controls-dark.png').default,
  }}
/>

## Fill Types

In the **Fill** panel, choose a value from **Type**. The available controls change with the selected type.

- **Solid** — choose a single **Color**.
- **Gradient** — choose the two colors, then set **Type** to **Linear** or **Radial**. Linear gradients also provide a **Direction** control.
- **Pattern** — choose a pattern preview and set its foreground and background colors.
- **Texture** — choose a built-in texture. Adjust its **Scale**, **Contrast**, **Brightness**, and **Saturation**, and optionally apply a **Tint** with a **Strength** value.
- **Image** — use **Upload** to select an image, then choose its **Fit** mode: **Fill**, **Contain**, **Cover**, **Keep**, or **Tile**. Tiled images also expose **Scale**; all image fills provide **Contrast**, **Brightness**, **Saturation**, and optional **Tint** controls.

The panel can also expose **Additional** fills when the selected node supports them.

## Stroke Color

In the **Stroke** panel, use **Color** to choose the outline color. The **Style** controls set the stroke width and dash pattern; the additional stroke options include size, spacing, cap, join, and miter settings where supported.

## Text Color

In the **Text** panel, use **Color** to set the color of a label or standalone text element. The color picker also provides stylesheet and foreground color options when they are available for the selection.
