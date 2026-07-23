---
sidebar_position: 2
related_reading:
  - label: SVG Export
    to: /diagram-craft/diagram-craft/use/import-export/svg-export
  - label: File Formats
    to: /diagram-craft/diagram-craft/use/import-export/file-formats
---

# Image Export

Use PNG export when the goal is simple sharing: chat, tickets, slide decks, docs, or anywhere else that needs a static image rather than an editable diagram.

## What PNG Export Is Good For

- posting a diagram in a ticket or review thread
- dropping a diagram into slides or notes
- sharing a stable visual snapshot with people who do not need to edit it

## What The Current Export Does

Diagram Craft exports the visible diagram as a PNG download. In the current implementation:

- the export is rasterized from the diagram SVG
- the output uses a white image background
- the export includes the diagram bounds rather than preserving an editable document

That makes it a presentation artifact, not a working source file.

## Tradeoffs To Keep In Mind

- PNG is easy to share almost everywhere.
- PNG is not meaningfully editable once exported.
- Text can become soft if you scale the image up later.
- If future editing matters, keep the native document or a `.diagramCraft.svg` alongside the PNG.

## A Good Workflow

1. Finish the structure and labels first.
2. Check that the diagram reads clearly at the size you expect people to see.
3. Export the PNG for sharing.
4. Keep the editable source separately.

## Choose Another Format

- Choose [SVG Export](svg-export) when you need scaling without raster blur.
- Choose [File Formats](file-formats) when you are deciding what to keep as the editable source of truth.
