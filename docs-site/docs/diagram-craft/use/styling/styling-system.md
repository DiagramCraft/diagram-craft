---
sidebar_position: 1
related_reading:
  - label: Colors and Gradients
    to: /diagram-craft/diagram-craft/use/styling/colors-gradients
  - label: Effects
    to: /diagram-craft/diagram-craft/use/styling/effects
  - label: Custom Shapes
    to: /diagram-craft/diagram-craft/use/styling/custom-shapes
---

import ThemedImage from '@theme/ThemedImage';

# Styling System

Diagram Craft collects visual properties for the current selection in the **Style** window on the right sidebar. The available tabs and controls change with the selected element type.

<ThemedImage
  alt="Diagram Craft style controls in the right sidebar for consistent diagram styling"
  sources={{
    light: require('/img/diagram-craft/styling/style-controls-light.png').default,
    dark: require('/img/diagram-craft/styling/style-controls-dark.png').default,
  }}
/>

## Open The Style Window

Select a node, edge, or text element, then open **Style** from the right sidebar. The window exposes the properties supported by that selection, including:

- **Fill** and **Stroke** for node appearance
- **Line** and endpoint properties for edges
- **Text** for labels and standalone text
- **Shadow** and other effect controls when the element supports them
- **Arrange** for position, size, rotation, and stacking

When several compatible elements are selected, a change is applied to the whole selection.

## Use Stylesheets

The style selectors in the contextual toolbar and Style window apply document stylesheets. Use them when several elements should share a maintained style rather than a one-off set of properties.

- choose a node, edge, or text stylesheet for the selected element
- use **Copy Style** and **Paste Style** to transfer direct styling between compatible selections
- manage document style assets from **Style Overview** when you need to inspect or change reusable styles

Direct property changes override the inherited stylesheet values for that element.

## Apply Properties By Element Type

The right sidebar breaks styling into a few practical layers:

- **Fill** for color, gradients, patterns, textures, and images
- **Stroke** for outline weight and separation
- **Text** for label readability
- **Shadow** and **Effects** for polish

Node, edge, and text selections do not expose identical controls. If a property is missing, confirm that the intended element is selected and that the active tab applies to that element type.
