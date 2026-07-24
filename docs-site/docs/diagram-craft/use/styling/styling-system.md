---
sidebar_position: 1
related_reading:
  - label: Colors and Gradients
    to: /diagram-craft/diagram-craft/use/styling/colors-gradients
  - label: Effects
    to: /diagram-craft/diagram-craft/use/styling/effects
  - label: Geometry Operations
    to: /diagram-craft/diagram-craft/use/advanced-editing/geometry-operations
---

import ThemedImage from '@theme/ThemedImage';

# Styling System

Diagram Craft collects visual properties for the current selection in the **Style** window on the right sidebar. The available tabs and controls change with the selected element type, so nodes and edges expose the controls that apply to them.

<ThemedImage
  alt="Diagram Craft style controls in the right sidebar for consistent diagram styling"
  sources={{
    light: require('/img/diagram-craft/styling/style-controls-light.png').default,
    dark: require('/img/diagram-craft/styling/style-controls-dark.png').default,
  }}
/>

## Open The Style Window

Select a node, edge, or text element, then open **Style** from the right sidebar. The stylesheet selector at the top shows the applicable stylesheet for the selection. The controls below it expose the properties supported by that element:

- For **nodes**, the main groups are **Fill**, **Shadow**, **Stroke**, **Effects**, and node-specific properties.
- For **edges**, the main groups are **Line**, **Shadow**, and **Effects**, along with endpoint and edge-specific properties.
- **Text** controls are available for labels and standalone text, while **Arrange** controls cover position, size, rotation, and stacking when supported.

When several compatible elements are selected, a change is applied to the whole selection.

## Use Stylesheets

Stylesheets provide consistent formatting that can be reused across multiple elements. The stylesheet selector in the contextual toolbar and Style window lists all styles applicable to the current selection; choose one to apply it instead of maintaining the same properties on each element.

Use the **...** menu beside the selector to modify the selected stylesheet, update it from the current element, or create a new stylesheet. You can also use **Copy Style** and **Paste Style** to transfer direct styling between compatible selections, and open **Style Overview** to inspect and manage reusable document styles.

Direct property changes override the inherited stylesheet values for that element.
