---
sidebar_position: 1
title: Built-in Stencils
sidebar_label: Built-in Stencils
---

![Diagram Craft stencil picker with built-in and optional package groups](/img/diagram-craft/stencils-templates/stencil-picker-overview.png)

# Built-in Stencils

Diagram Craft ships with a small set of general-purpose shapes and a larger set of notation-specific stencil packages. The quickest way to choose well is to decide whether the reader needs formal notation or just a clear picture.

## Start With General Shapes

Stay with the built-in `Basic shapes` and `Arrow` packages when you are:

- sketching a system quickly
- explaining relationships to a mixed audience
- building a diagram that does not need a formal modelling standard

These packages keep the canvas lightweight and are usually the right default for architecture overviews, whiteboard-style drafts, and early discussions.

## Move To A Notation Package When Meaning Matters

Use the notation-specific packages when the shape language itself carries meaning:

- **C4** for software architecture context, container, and component views
- **BPMN 2.0** for workflows, approvals, and operational processes
- **UML** for software design, behavior, and modelling relationships
- **Data Modelling** for entities, relationships, and schema-oriented diagrams
- **ArchiMate** for enterprise architecture across business, application, and technology layers

If your audience expects a specific notation, prefer that package over generic boxes. It reduces explanation overhead and makes reviews faster.

## Optional Packages Versus Built-In Packages

The package dialog also exposes optional libraries such as Draw.io-backed stencil packs and cloud vendor icon sets.

- Use the built-in packages first when you want the most native Diagram Craft experience.
- Add Draw.io-backed or vendor-icon packages when compatibility or recognizable service branding matters more than a purely native shape set.
- Avoid enabling every package at once unless you regularly switch domains; a shorter picker is easier to scan.

## How To Choose Packages In Practice

A good working pattern is:

1. start with `Basic shapes`
2. add one domain package when the diagram needs stronger semantics
3. add optional icon libraries only if the diagram benefits from vendor branding or Draw.io parity

This keeps the picker focused and prevents the diagram from mixing too many visual languages.

## Picker Workflow

- The **Shape** tab in the left sidebar is the main entry point.
- The picker settings menu lets you switch between list and grid browsing, expand search across all enabled packages, and manage which packages are active for the current document.
- Active packages are document-scoped, so the set you choose travels with the document instead of being only a local preference.

## Related Reading

- [Diagram Templates](./diagram-templates)
- [Stencil Reference](../reference/stencil-reference)
