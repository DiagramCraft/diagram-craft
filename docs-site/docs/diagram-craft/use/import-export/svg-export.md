---
sidebar_position: 3
---

# SVG Export

Use SVG export when you need a shareable vector artifact for documentation, the web, or any place where the diagram should scale cleanly.

## Why SVG Is Useful

- it stays sharp when scaled
- it works well in documentation sites and web pages
- it is easier to inspect or post-process than a raster image

## What The Current Export Does

Diagram Craft exports the current diagram as SVG and embeds attachments or external images into the file so the result is more self-contained.

That is useful for publishing and handoff, but it is still different from keeping a native editable document.

## SVG Export vs. Diagram SVG

There are two different ideas to keep separate:

- **Export as SVG** produces a shareable vector artifact.
- **Save as `.diagramCraft.svg`** stores Diagram Craft document data inside an SVG so the file can be reopened for editing in Diagram Craft.

If your main concern is future editing in Diagram Craft, prefer the native document or `.diagramCraft.svg`. If your main concern is publication, plain SVG export is the better fit.

## Tradeoffs

- SVG scales better than PNG.
- SVG is usually easier to embed in docs and web pages.
- SVG is not the best source of truth when your main workflow is continued editing in Diagram Craft.
- Downstream tools may render some details differently than Diagram Craft itself, so spot-check the result when fidelity matters.

## Related Reading

- [Image Export](image-export)
- [File Formats](file-formats)
