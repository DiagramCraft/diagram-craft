---
sidebar_position: 3
---

import ThemedImage from '@theme/ThemedImage';

# Effects

Effects are for visual polish after the structure is already working. In Diagram Craft, that usually means a light touch: a shadow to separate layers, a sketch effect for exploratory work, or rounding to soften a rigid shape set.

<ThemedImage
  alt="Diagram Craft effects controls for reflection, blur, glass, sketch, and rounding"
  sources={{
    light: require('/img/diagram-craft/styling/effects-controls-light.png').default,
    dark: require('/img/diagram-craft/styling/effects-controls-dark.png').default,
  }}
/>

## Add Effects After Layout Is Stable

Finish the basic structure first:

1. place the shapes
2. connect them
3. align and distribute the layout
4. apply color
5. only then add effects

If you add effects too early, you spend time polishing shapes that may still move or change role.

## The Most Useful Effects

These are the effects that pay off most often:

- **Shadow** for separating foreground nodes from containers or the canvas
- **Opacity** for de-emphasizing supporting elements
- **Sketch** for rough, workshop-style diagrams
- **Rounding** for shapes that should feel less mechanical

These are more specialized:

- **Reflection** for presentation-style callouts or polished cards
- **Glass** for decorative emphasis
- **Blur** for softening an element, usually in mockups or layered compositions
- **Isometric** when a diagram benefits from a stylized projection

## A Safe Shadow Workflow

Shadows are usually the best first effect:

1. Select the node.
2. Open **Style**.
3. Expand **Shadow**.
4. Enable it and keep the blur and offset modest.

The goal is separation, not drama. If every shape gets a heavy shadow, the whole canvas starts to feel muddy.

## Use Sketch For Drafts And Workshops

The **Sketch** effect is useful when you want a diagram to feel provisional or collaborative instead of final. That is especially helpful for:

- architecture whiteboarding
- early flowcharts
- workshop deliverables that should invite change

If the diagram is heading into formal documentation, remove the sketch effect before export unless the hand-drawn look is intentional.

## Rounding And Glass Change Tone Quickly

Rounded corners and glass surfaces push a diagram toward a softer, more polished visual language. Use them consistently across a family of elements. Mixing sharp rectangles, glass panels, and rounded containers without a clear reason usually reads as accidental styling.

## Real Diagram Examples

- Add a light shadow to sticky-note style callouts so they sit above the main flow.
- Lower opacity on optional paths to keep the primary path dominant.
- Apply sketch to brainstorming diagrams, then remove it for the final review deck.
- Use rounding on user-facing screens or cards to distinguish them from infrastructure boxes.

## Related Reading

- [Colors and Gradients](colors-gradients)
- [Custom Shapes](custom-shapes)
- [Alignment and Distribution](../advanced-editing/alignment-distribution)
