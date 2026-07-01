---
sidebar_position: 2
---

import ThemedImage from '@theme/ThemedImage';

# Snapping and Guides

Snapping helps you place shapes accurately while you work. Guides help you define deliberate alignment targets that stay useful across a larger editing session. Together they reduce the amount of manual cleanup you need later.

<ThemedImage
  alt="Diagram Craft grid and snap controls with guides available for precise placement"
  sources={{
    light: require('/img/diagram-craft/advanced-editing/snapping-guides-light.png').default,
    dark: require('/img/diagram-craft/advanced-editing/snapping-guides-dark.png').default,
  }}
/>

## Know What Can Snap

In the **Grid** tab, the **Snap** panel lets you turn snapping on or off and choose what the cursor should lock to:

- **Snap to grid**
- **Snap to guides**
- **Snap to object bounds**
- **Snap to canvas midpoint**
- **Snap to object size**
- **Snap to object distance**

You can also adjust the snap **Threshold** to control how aggressively elements lock into place.

## When To Use Each Magnet Type

A good default setup is:

- grid snapping on while roughing out a layout
- object bounds snapping on during cleanup
- guides on for larger pages or repeated structures

Object size and distance magnets are especially helpful when you are trying to make repeated cards or columns feel consistent without measuring everything manually.

## Use Guides For Long-Running Layout Work

Guides are better than one-off nudges when several elements must share the same visual rule. In the **Guides** panel, you can:

1. add a guide
2. choose horizontal or vertical orientation
3. set its exact position
4. change its color
5. remove it when the cleanup pass is finished

You can also drag guides from the rulers when rulers are visible.

## Turn On Rulers When Precision Matters

The ruler toggle is useful when you need to place elements at specific positions or maintain alignment across a larger canvas. That is usually worth enabling for:

- poster-style diagrams
- dashboards or UI mockups
- architecture overviews with strict columns

For smaller flowcharts, rulers are optional. Guides and object snapping are often enough.

## Snapping Is A Helper, Not A Rule

If snapping keeps pulling an element to the wrong target, reduce the enabled magnet types instead of fighting the cursor. It is often faster to disable one magnet category temporarily than to keep nudging an element away from unwanted snap points.

## Real Diagram Examples

- Use grid snapping for the first pass of a process flow, then switch to object bounds and distance snapping for final cleanup.
- Add vertical guides for swimlane columns so new elements drop into the same structure automatically.
- Turn on rulers before building a title area, legend, and content block that all need to share margins.

## Related Reading

- [Alignment and Distribution](alignment-distribution)
- [Canvas Navigation](../core-diagramming/canvas-navigation)
- [Document Structure](../organization/document-structure)
