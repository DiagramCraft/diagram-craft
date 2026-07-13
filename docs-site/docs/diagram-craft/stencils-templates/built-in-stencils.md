---
sidebar_position: 1
title: Built-in Stencils
sidebar_label: Built-in Stencils
related_reading:
  - label: Diagram Templates
    to: /diagram-craft/diagram-craft/stencils-templates/diagram-templates
  - label: Stencil Reference
    to: /diagram-craft/diagram-craft/reference/stencil-reference
---

![Diagram Craft stencil picker with built-in and optional package groups](/img/diagram-craft/stencils-templates/stencil-picker-overview.png)

# Built-in Stencils

Diagram Craft ships with general-purpose shapes and notation-specific stencil packages. Enable and browse them from the **Shape** tab in the left sidebar.

## Enable A Stencil Package

Open the picker settings menu and choose the package-management action. Enable or disable packages for the current document; the active package set is stored with that document.

## Included Notation Packages

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

## Picker Workflow

- The **Shape** tab in the left sidebar is the main entry point.
- The picker settings menu lets you switch between list and grid browsing, expand search across all enabled packages, and manage which packages are active for the current document.
- Active packages are document-scoped, so the set you choose travels with the document instead of being only a local preference.
