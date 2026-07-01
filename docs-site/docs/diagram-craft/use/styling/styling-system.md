---
sidebar_position: 1
---

import ThemedImage from '@theme/ThemedImage';

# Styling System

Diagram Craft styling works best when you treat it as a system instead of a sequence of isolated tweaks. The goal is to make related elements look related, exceptions look intentional, and the whole diagram feel readable before it feels decorative.

<ThemedImage
  alt="Diagram Craft style controls in the right sidebar for consistent diagram styling"
  sources={{
    light: require('/img/diagram-craft/styling/style-controls-light.png').default,
    dark: require('/img/diagram-craft/styling/style-controls-dark.png').default,
  }}
/>

## Start With Structure, Then Style

A reliable workflow is:

1. place the shapes and connectors
2. label them clearly
3. align and distribute the layout
4. apply consistent fill, stroke, and text choices
5. add effects only where they improve emphasis

This keeps styling in service of the diagram instead of letting visual tweaks hide layout problems.

## Think In Categories

Before changing colors or effects, decide which categories exist in the diagram. For example:

- default internal components
- external systems
- data stores
- warnings, risks, or manual steps

Once those categories are clear, give each one a stable visual treatment. The reader should not have to guess whether two similar shapes mean the same thing.

## Use The Style Panels As A Stack

The right sidebar breaks styling into a few practical layers:

- **Fill** for color, gradients, patterns, textures, and images
- **Stroke** for outline weight and separation
- **Text** for label readability
- **Shadow** and **Effects** for polish

Use them in that order. Fill and text usually carry most of the meaning. Effects are supporting tools, not the foundation.

## Prefer Repetition Over Novelty

Good styling systems repeat a small number of decisions:

- the same fill for the same type of node
- the same stroke width across similar objects
- the same text treatment for headings, labels, and notes

If every element gets its own treatment, the diagram stops communicating structure and starts communicating noise.

## Keep Styling Changes Cheap

Routine diagram maintenance should not require rebuilding shapes or editing geometry. If a visual distinction can be made with fill, stroke, text, or a light effect, use that first. Move into boolean operations or curve editing only when the shape itself needs to carry meaning.

## Real Diagram Examples

- Give all internal services one fill color, then use a contrasting fill for third-party dependencies.
- Use a slightly heavier stroke on boundary containers so sections stay legible when zoomed out.
- Apply the same heading text style across title cards, legends, and section labels.
- Reserve effects such as sketch or reflection for cases where the tone of the diagram should change.

## Related Reading

- [Colors and Gradients](colors-gradients)
- [Effects](effects)
- [Custom Shapes](custom-shapes)
