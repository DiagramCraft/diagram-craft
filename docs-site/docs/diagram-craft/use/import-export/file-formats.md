---
sidebar_position: 4
related_reading:
  - label: Drawio Import
    to: /diagram-craft/diagram-craft/use/import-export/drawio-import
  - label: Image Export
    to: /diagram-craft/diagram-craft/use/import-export/image-export
  - label: SVG Export
    to: /diagram-craft/diagram-craft/use/import-export/svg-export
---

# File Formats

Treat file-format choice as a workflow decision: are you keeping an editable source, publishing a share artifact, or moving content between tools?

## The Practical Choices

| Format | Best for | Keep editing in Diagram Craft? |
| --- | --- | --- |
| Native document (`.json` or `.dcd`) | your main working file | yes |
| Diagram SVG (`.diagramCraft.svg`) | editable handoff with an SVG wrapper | yes |
| Draw.io (`.drawio`) | import from another tool | no, import first |
| PNG | simple sharing and screenshots | no |
| SVG export | scalable publishing and embedding | usually no |

## Native Document: Your Source Of Truth

Use the native Diagram Craft document when you expect to keep editing later. This format preserves the document structure, layers, diagrams, styles, and other editing state.

Depending on where you use Diagram Craft, that native editable document may appear as `.json` or `.dcd`.

## `.diagramCraft.svg`: Editable SVG

Use `.diagramCraft.svg` when you want an SVG file that can still be reopened in Diagram Craft. It is useful when you need something close to a publication artifact but still want to preserve Diagram Craft editing data inside the file.

That makes it a better choice than plain exported SVG when reopenability matters.

## `.drawio`: Migration Input

Use `.drawio` as an input format when you are moving diagrams into Diagram Craft. It is part of the migration workflow, not the ongoing editable format you should standardize on inside Diagram Craft.

## PNG And SVG: Sharing Artifacts

PNG and exported SVG are usually the outputs you share with other people:

- **PNG** is the easy static option.
- **SVG** is the scalable vector option.

Neither should replace your editable source file when continued editing matters.

## Which One Should You Choose?

- Keep editing over time: native document
- Hand off an SVG that Diagram Craft can still reopen: `.diagramCraft.svg`
- Publish to docs or the web: exported SVG
- Paste into chat, tickets, or slides: PNG
- Bring a Draw.io diagram into Diagram Craft: `.drawio`, then save as a native Diagram Craft format
