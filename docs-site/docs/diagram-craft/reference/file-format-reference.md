---
sidebar_position: 4
---

# File Format Reference

Use this page when you need the structure of the formats Diagram Craft reads or writes today. This is a reference to the current implementation, not a versioned external schema guarantee.

## Supported File Types

### Native document JSON: `.json`

- primary persisted document format in the current app
- loaded through the standard document deserializer
- saved from the file dialog as `Diagram document (.json)`

### Native document JSON alias: `.dcd`

- loaded through the same deserializer path as `.json`
- treated as the same serialized document shape

### Embedded Diagram Craft SVG: `.diagramCraft.svg`

- saved as an SVG export that also embeds the serialized Diagram Craft document in SVG metadata
- can be reopened by extracting that embedded base64 JSON payload

### Draw.io import: `.drawio`

- imported through a dedicated Draw.io loader
- this is an input format, not the native persisted Diagram Craft document format

## Serialized Document Shape

The current document serializer writes a `SerializedDiagramDocument` object with these top-level sections:

| Field | Purpose |
| --- | --- |
| `diagrams` | top-level diagrams in the document |
| `attachments` | in-use binary attachments encoded as base64 strings |
| `customPalette` | custom palette color values |
| `styles` | node, edge, and text stylesheet snapshots |
| `schemas` | external data schemas attached to the document |
| `schemaMetadata` | schema-level metadata when present |
| `props` | recent stencils, active stencil packages, recent edge stylesheets, query state, and document metadata |
| `data` | serialized providers, templates, and overrides |
| `stories` | story definitions when present |
| `activeDiagramId` | active diagram identifier |
| `hash` | hash of the serialized document content |

## Diagrams

Each serialized diagram includes:

- `id`
- `name`
- `layers`
- `activeLayerId`
- `visibleLayers`
- `views`
- nested `diagrams`
- `guides`
- `comments`
- `zoom`
- `canvas`

That means a saved document can contain multiple diagrams, nested diagrams, layer visibility state, comments, and viewport information.

## Layers

Serialized layers always have:

- `id`
- `name`
- `type: "layer"`
- a `layerType` that determines the rest of the payload

### Regular Layers

Regular layers store:

- `elements`
- `isLocked`

### Reference Layers

Reference layers store:

- `diagramId`
- `layerId`

They point at another diagram and layer instead of embedding their own element list.

### Rule Layers

Rule layers store:

- `rules`

### Modification Layers

Modification layers store:

- `modifications`
- `isLocked`

Each modification can include a serialized delegating node or edge when the modification carries its own element payload.

## Elements

The serializer writes elements as nodes or edges.

### Nodes

Serialized nodes include:

- `id`
- `type`
- `nodeType`
- `bounds`
- `anchors`
- `children`
- `props`
- `metadata`
- `texts`
- `tags`

### Edges

Serialized edges include:

- `id`
- `type`
- `start`
- `end`
- `labelNodes`
- `waypoints`
- `props`
- `metadata`
- `children`
- `tags`

Edge endpoints can be:

- anchored to a node
- positioned inside a node
- positioned on another edge
- free points in space

## Styles, Data, And Metadata

### Styles

`styles` contains three collections:

- `edgeStyles`
- `nodeStyles`
- `textStyles`

Each entry is a stylesheet snapshot rather than a hand-authored CSS fragment.

### Data

`data` contains:

- serialized data providers
- data templates
- per-schema overrides

### Document Properties

`props` currently stores:

- query history and saved queries
- recently used stencils
- active stencil packages
- recent edge stylesheets
- document metadata

## `.diagramCraft.svg` Embedding

When the app saves `.diagramCraft.svg`, it:

1. prepares the export SVG
2. serializes the active document to JSON
3. base64-encodes that JSON
4. writes it into a `<metadata>` block under a `diagramcraft` element

When the app reopens that file, it reads the embedded metadata payload and deserializes it back into a Diagram Craft document.

This makes `.diagramCraft.svg` both:

- a shareable rendered SVG
- a reopenable Diagram Craft document container

## Compatibility Notes

- `.json` and `.dcd` currently use the same deserialization flow.
- The serializer includes a `hash` field derived from the saved content.
- Included stencil packages for native document loading are derived from the app's default included stencil registry, not from an external schema negotiation step.
- This page does not promise stable field-level compatibility for external tools beyond what the current app reads and writes.
