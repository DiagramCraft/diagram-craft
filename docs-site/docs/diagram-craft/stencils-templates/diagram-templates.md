---
sidebar_position: 3
related_reading:
  - label: Data Binding
    to: /diagram-craft/diagram-craft/use/data-integration/data-binding
  - label: Dynamic Updates
    to: /diagram-craft/diagram-craft/use/data-integration/dynamic-updates
---

# Diagram Templates

In the current app, templates are reusable element designs for data-linked shapes. They are most useful when you want every record from a schema to appear with the same structure, styling, and metadata instead of dragging a plain default node every time.

## What Templates Are For

Use a template when you have linked a node to external data and want that linked node shape to become the repeatable pattern for future items from the same schema.

Good examples:

- every application component should use the same card layout
- every actor should use the same visual treatment
- every database-backed entity should expose the same label and field arrangement

## What This Page Does Not Cover

This page is about reusable element templates inside the picker-driven data workflow. It is not a guide to “new diagram from starter template” files.

## Create A Template From A Linked Element

The current flow is:

1. link a node to external data for the relevant schema
2. style or structure that node the way you want future instances to look
3. open the selection context menu
4. go to **External Data**
5. choose the schema and run **Make template**
6. name the template

That stores the selected element as a reusable template for that schema in the current document.

## Use Templates From The Model Picker

Open the left sidebar **Objects** window and switch to the **Model** tab.

- If a schema has no templates yet, the picker uses its default linked-node representation.
- Once a schema has at least one template, the picker can show template previews and drag those templated shapes onto the canvas.
- The grid view is most useful when you want to scan template previews visually instead of reading a plain item list.

Dragging from the model picker creates a linked element that keeps the underlying data reference while reusing the template’s structure.

## Update And Maintain Templates

Templates are document assets, so you should maintain them when the underlying visual standard changes.

- **Rename** templates from the Model tab when the label is no longer clear.
- **Remove** templates when they are obsolete.
- **Update template** from a linked node when you want existing template-based elements to inherit new default props where they have not been customized away.
