---
sidebar_position: 2
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

## Use A Small Color System

A practical diagram palette usually includes:

- one neutral fill for default shapes
- one accent color for important steps or systems
- one warning or attention color for risks, manual steps, or external dependencies

When two shapes mean the same thing, style them the same way. Readers should be able to identify the category before they read the label.

## Add Gradients Only When They Clarify Emphasis

Gradients are available in the **Fill** panel by switching the fill type to **Gradient**. Diagram Craft supports both **Linear** and **Radial** gradients.

Use a gradient when you want:

- a title card or callout to feel more prominent
- a background container to read as a separate layer
- a small amount of visual depth without switching to a more decorative effect

For most node shapes, keep the contrast between the two gradient colors fairly small. Large shifts can make labels harder to read and can distract from the structure of the diagram.

## Apply A Gradient Step By Step

1. Select the node.
2. In **Fill**, change **Type** to **Gradient**.
3. Choose the primary and secondary colors.
4. Set the gradient **Type** to **Linear** or **Radial**.
5. If you use a linear gradient, adjust the **Direction** until the shading supports the layout instead of fighting it.

In left-to-right process diagrams, subtle top-to-bottom or diagonal gradients usually work better than dramatic horizontal blends.

## Patterns, Textures, And Images Are Secondary Tools

The fill panel also supports **Pattern**, **Texture**, and **Image** fills. These are best used sparingly:

- patterns can differentiate regions when color alone is not enough
- textures can make title or background panels feel distinct
- image fills work best for illustrative nodes, posters, or mockups inside a diagram

If a diagram is primarily technical, these options should usually stay in supporting roles. Let layout and labeling carry the meaning.

## Real Diagram Examples

- Use a pale accent fill on external systems so they read differently from internal services.
- Give grouped ownership areas a softer container fill than the nodes inside them.
- Apply a subtle gradient to a title or legend box when it needs to anchor the page.
- Use a patterned background only when the reader needs to distinguish overlapping regions quickly.

## Related Reading

- [Styling System](styling-system)
- [Effects](effects)
- [Shapes and Elements](../core-diagramming/shapes-elements)
