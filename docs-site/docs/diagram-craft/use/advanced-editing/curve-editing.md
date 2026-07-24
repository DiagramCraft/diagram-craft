---
sidebar_position: 6
related_reading:
  - label: Geometry Operations
    to: /diagram-craft/diagram-craft/use/advanced-editing/geometry-operations
  - label: Boolean Operations
    to: /diagram-craft/diagram-craft/use/advanced-editing/boolean-operations
  - label: Selection and Manipulation
    to: /diagram-craft/diagram-craft/use/core-diagramming/selection-manipulation
---

# Curve Editing

Convert a shape to curves when its outline needs direct path editing. A converted shape becomes an editable path rather than a parameterized built-in shape.

## Convert A Shape To Curves

1. Select the shape.
2. Open the selection context menu.
3. Choose **Geometry**.
4. Run **Convert to curves**.
5. Confirm the conversion.

Use this for shapes that are close but not exact, or for boolean results that need manual refinement. Keep the original shape until the outline is final if you still need the built-in resize and shape controls.

## Edit The Curve

After conversion, select the path to expose its curve editing points. Use the mouse to:

- drag an anchor point to move a corner or endpoint
- drag a control handle to change the direction and tension of a curve
- drag a segment to reposition the path between its anchors

Use `Shift` while dragging when you need constrained movement, where supported by the active editor. Use `Delete` or `Backspace` to remove a selected editable point when the curve editor exposes that action.

Curve editing changes the geometry directly. It does not change the fill, stroke, or stylesheet applied to the shape.
