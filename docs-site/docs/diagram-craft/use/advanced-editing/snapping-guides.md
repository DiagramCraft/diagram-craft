---
sidebar_position: 2
related_reading:
  - label: Alignment and Distribution
    to: /diagram-craft/diagram-craft/use/advanced-editing/alignment-distribution
  - label: Canvas Navigation
    to: /diagram-craft/diagram-craft/use/core-diagramming/canvas-navigation
  - label: Document Structure
    to: /diagram-craft/diagram-craft/use/organization/document-structure
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

## Configure Magnet Types

Enable only the snap targets needed for the current edit. **Object size** and **Object distance** provide equal-size and equal-spacing targets, while **Object bounds** aligns element edges. Lower the threshold if several nearby targets compete for the cursor.

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

If snapping pulls an element to an unwanted target, temporarily disable that magnet type or reduce the threshold in the **Snap** panel.
