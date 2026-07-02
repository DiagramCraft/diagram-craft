---
sidebar_position: 5
---

# Stencil Reference

Use this page when you need the implemented stencil package inventory and how the app groups those packages. If you want a gentler introduction to choosing and using them, start with [Built-in Stencils](../stencils-templates/built-in-stencils).

This reference is based on the stencil registry shipped in the default app configuration.

## Included By Default

These packages are included in the default Diagram Craft app configuration.

| Package ID | Name | Group | Purpose |
| --- | --- | --- | --- |
| `default` | Basic shapes | General | Rectangles, ellipses, lines, and connectors |
| `arrow` | Arrow | General | Directional arrows and flow markers |
| `bpmn2` | BPMN 2.0 | Modelling | Business process model and notation |
| `uml` | UML | Modelling | Class, sequence, activity, and state diagrams |
| `data-modelling` | Data Modelling | Modelling | Entities, relationships, and tables |
| `c4` | C4 | Modelling | Context, container, and component views |
| `archimate` | ArchiMate | Modelling | Enterprise architecture notation |

## Optional Packages

These packages are registered in the default app config but are not included by default.

| Package ID | Name | Group | Purpose |
| --- | --- | --- | --- |
| `drawioUml` | UML (DrawIO) | Modelling | Draw.io-compatible UML stencil set |
| `GCP` | GCP | Cloud & infra | Google Cloud Platform service icons |
| `AWS` | AWS | Cloud & infra | Amazon Web Services icon library |
| `Azure` | Azure | Cloud & infra | Microsoft Azure service icons |
| `Fluid Power` | Fluid Power | Engineering | Hydraulic and pneumatic circuit symbols |
| `IBM` | IBM | Cloud & infra | IBM service icons |
| `Web Logos` | Web Logos | Web | Web logo assets |
| `Web Icons` | Web Icons | Web | General web-oriented icons |
| `EIP` | EIP | Modelling | Enterprise integration pattern shapes |
| `Arrows` | Arrows | General | Draw.io-provided arrow stencil set |
| `Basic` | Basic | General | Draw.io-provided basic stencil set |
| `BPMN` | BPMN | Modelling | Draw.io-compatible BPMN stencil set |

## Loader Types

The current registry uses two loader families:

### Built-In Loaders

Packages such as `default`, `arrow`, `bpmn2`, `uml`, `data-modelling`, `c4`, and `archimate` are loaded through the app's built-in stencil loaders. These are the packages most tightly coupled to Diagram Craft's own node and edge definitions.

### Draw.io XML Loader

Packages such as `GCP`, `AWS`, `Azure`, `Fluid Power`, `IBM`, and the Draw.io-compatible stencil sets are loaded through the Draw.io XML stencil loader. These packages depend on external XML stencil definitions rather than only on built-in TypeScript-defined registries.

## How To Read Package Names

- The package ID is the internal identifier used in the registry and persisted active package state.
- The package name is the user-facing label shown in the product.
- The group is the browsing category used to organize packages in the picker.

## Practical Selection Guidance

- Use `default` and `arrow` when you need general-purpose diagramming without domain notation.
- Move to `bpmn2`, `uml`, `data-modelling`, `c4`, or `archimate` when the notation itself carries meaning for the reader.
- Use the optional Draw.io-backed or cloud-icon packages when compatibility or vendor iconography matters more than a purely native Diagram Craft shape set.

## Scope Of This Reference

- This page documents package-level inventory and purpose.
- It does not attempt to enumerate every individual shape in every package, because the current source of truth is maintained at the package and loader level rather than as one stable per-shape reference table.
- For workflows that start in the picker rather than from a package list, use the tutorial pages in the stencils and templates section.
