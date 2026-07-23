---
sidebar_position: 2
related_reading:
  - label: Data Sources
    to: /diagram-craft/diagram-craft/use/data-integration/data-sources
  - label: Query Language (DJQL)
    to: /diagram-craft/diagram-craft/use/data-integration/query-language
  - label: Dynamic Updates
    to: /diagram-craft/diagram-craft/use/data-integration/dynamic-updates
---

# Data Binding

Data binding is the step where a generic shape stops being “just a box” and starts representing a specific record. In Diagram Craft, that usually means enabling a schema on an element, then either storing local values or linking the element to an external data record.

## Think In Terms Of Schemas First

Bindings are schema-driven. Before an element can carry useful data, the relevant schema must exist in the document and be enabled for that element.

In the **Extended Data** tab for a selected element, you can:

- enable or disable available schemas
- edit local values for enabled schemas
- link an enabled schema to an external record
- unlink or fully remove the schema entry later

This makes binding explicit. The element tells you which schemas it participates in instead of hiding data behind ad hoc custom fields.

## Local Data Versus External Links

There are two common binding modes:

- **Local schema data** keeps the values on the element itself
- **External data links** connect the element to a provider record by UID

Use local data when the values are diagram-specific. Use an external link when the same record should stay shared with other elements, other diagrams, or another system.

## Link An Element To A Record

A practical external-link workflow is:

1. select one element
2. open **Extended Data**
3. enable the schema you want
4. choose **Link**
5. pick an existing record, or create one if the provider allows edits

Once linked, the element stores the schema reference plus the external UID. That gives the diagram a stable connection back to the provider record.

## Use Templates To Turn Data Into Reusable Shapes

Linked data becomes more useful when you combine it with templates.

Diagram Craft lets you:

- link an element to a data record
- save that linked element as a template for the schema
- reuse the template when dragging future records from the model picker

This is the fastest way to keep repeated data-driven shapes visually consistent.

## Text Binding Uses Field Tokens

The clearest visible binding pattern is text substitution. Default data-driven nodes often use field tokens such as `%name%` in their label text so the element can display record content directly.

This is useful for:

- service names on architecture boxes
- owner names on responsibility maps
- status or identifier fields inside cards

Keep the first version simple. Start with one or two fields that help users recognize the item immediately.

## Know The Difference Between Unlink And Remove

When an element already has external data, the current UI gives you two distinct cleanup options:

- **Unlink** keeps the schema entry but breaks the external reference
- **Unlink & Clear** removes the schema data from the element

Use **Unlink** when you want to keep the structure and possibly replace the record later. Use **Unlink & Clear** when the element should stop participating in that schema entirely.

## Limits To Call Out

- binding in Diagram Craft is schema- and metadata-driven, not a generic spreadsheet-style formula system
- if an upstream record changes shape, you may need to refresh providers and review affected elements
- bindings do not automatically guarantee style or layout updates unless another feature, such as rules or templates, uses that data
