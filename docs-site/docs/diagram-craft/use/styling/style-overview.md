---
sidebar_position: 2
related_reading:
  - label: Styling System
    to: /diagram-craft/diagram-craft/use/styling/styling-system
  - label: Tool Windows
    to: /diagram-craft/diagram-craft/user-interface/tool-windows
  - label: Tool Windows Reference
    to: /diagram-craft/diagram-craft/reference/tool-windows-reference
---

# Style Overview

The **Style Overview** window helps you keep a diagram visually consistent. Open it from the right sidebar to inspect document-level styles, find elements with matching formatting, and switch supported stencil libraries between visual variants.

Unlike the **Style** window, which edits the current selection, Style Overview shows how styles are used across the document. It is especially useful after importing a diagram or when you need to harmonize one-off formatting changes.

## Open Style Overview

Open **Style Overview** from the right sidebar. The window contains three tabs:

- **Stylesheets** lists the reusable node, edge, and text styles in the document.
- **Styles** groups elements by their applied stylesheet and direct formatting.
- **Variants** switches the visual presentation of supported stencil libraries.

The available results reflect the active document. If the document does not use a stencil library with variants, the Variants tab has nothing to switch.

## Apply And Manage Stylesheets

The **Stylesheets** tab provides an inventory of reusable styles. Stylesheets are grouped by element type and can be used as the starting point for consistent formatting across nodes, edges, and text.

To apply a stylesheet quickly, select compatible elements and choose the stylesheet from the stylesheet selector in the Style window or contextual toolbar. Use the Style Overview tab when you need to review which reusable styles exist in the document.

For creating or modifying stylesheets, use the stylesheet menu in the Style window. See [Styling System](./styling-system) for the normal stylesheet workflow.

## Find And Harmonize Direct Styles

The **Styles** tab summarizes the formatting currently used by the document. When elements are selected, it focuses on that selection; with no selection, it can summarize all diagram elements.

Style groups show elements that share a stylesheet and the same direct formatting differences. Use them to identify scattered one-off changes:

- Click a style group to select all matching elements on the canvas.
- Filter the summary by properties such as fill, stroke, shadow, effects, or text.
- Use **Reset** to remove the selected direct overrides and return those properties to stylesheet values.
- Use **Create Stylesheet** to turn a useful combination of base and direct properties into a reusable stylesheet.
- Use **Copy Style** and **Paste Style** to transfer formatting between compatible groups.

Resetting a field does not remove the stylesheet. It removes the direct override so the element inherits that field from its stylesheet again. This makes the tab useful for bringing imported or manually adjusted elements back into alignment.

## Switch Style Variants

The **Variants** tab is available for stencil libraries that provide alternate visual presentations. Selecting a variant updates the document styles supplied by that library, so the same shapes can adopt a different visual language without rebuilding the diagram.

For example, UML supports a **Default** presentation with black-and-white styling and a **Classic** presentation with colored fills and strokes. Supported C4 libraries can likewise expose alternate old and new appearances when those styles are present in the document.

Variants apply to the library's supported styles as a coordinated set. Custom changes that do not belong to the selected library remain separate, and a document can show **Custom** when its current styles do not exactly match a provided variant.

## A Practical Consistency Workflow

1. Open **Styles** and select a property filter to locate inconsistent formatting.
2. Click a group to select the matching elements and inspect the highlighted differences.
3. Use **Reset** for accidental one-off overrides, or use **Create Stylesheet** when the formatting represents a deliberate new convention.
4. Use **Stylesheets** to review the reusable style inventory and apply a preset to a compatible selection.
5. If the diagram uses a supported stencil library, use **Variants** to compare or apply a coordinated visual presentation.

For individual fill, stroke, text, effects, and layout edits, continue using the [Style window](./styling-system).
