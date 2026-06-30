---
sidebar_position: 1
---

# Core Concepts

Diagram Craft is easiest to learn if you start with its mental model instead of treating it like a generic drawing app. At its core, you work on a canvas, place elements on it, connect them, organize them, and then refine structure and appearance as the diagram becomes more detailed.

## Diagram, Document, and Tab

There are a few levels of structure in the editor:

- A **diagram** is the visual content you are building: shapes, connectors, text, styling, and layout.
- A **document** is the file or workspace that stores your work.
- A **tab** is a separate diagram inside the same document.

This matters because you do not need a new file every time you want to separate views. For example, you might keep a system context diagram in one tab and a deployment diagram in another tab within the same document.

## Canvas and Viewport

The **canvas** is the full drawing surface. It is larger than what you can usually see at one time.

The **viewport** is the visible area of that canvas in the editor window. When you zoom or pan, you are changing your view of the canvas rather than moving the document itself.

Thinking about the canvas this way helps with common tasks:

- Zoom out to understand the full structure of a large diagram.
- Zoom in to make precise edits.
- Pan across the canvas when working on diagrams that extend beyond the current view.

## Nodes and Edges

Most diagrams in Diagram Craft are built from two main element types:

- **Nodes** are the objects placed on the canvas, such as rectangles, circles, labels, containers, or stencil-specific symbols.
- **Edges** are the connectors between nodes, such as lines, arrows, or routed connections.

You can think of nodes as the things in your diagram and edges as the relationships between them.

Some nodes are simple standalone shapes. Others behave more like containers and can group or hold related content. This gives you a path from simple sketches to more structured technical diagrams without changing tools.

## Selection and Direct Manipulation

Diagram Craft is built around direct editing on the canvas:

- click elements to select them
- drag to move them
- use handles to resize or reshape them
- connect elements by drawing connectors between them

You can work quickly with a mouse or trackpad, but the same model also supports more precise editing with keyboard shortcuts, tool windows, and alignment commands.

## Styling and Geometry

Elements are not limited to their default appearance. A node or edge has both:

- **content and structure**, such as its text, shape type, and connections
- **presentation**, such as fill, stroke, effects, corner radius, or line endings

This separation is useful because you can change how a diagram looks without rebuilding its structure. A rough early draft can later become a polished presentation diagram by adjusting styles, layout, and effects.

## Layers and Organization

As diagrams grow, organization becomes as important as drawing.

**Layers** let you separate parts of a diagram so they are easier to manage. You can use them to:

- keep background elements separate from editable content
- isolate annotations or review markup
- lock parts of a diagram while working on others
- hide content temporarily without deleting it

Diagram Craft also supports grouping and document structure tools so you can manage complexity without flattening everything into one large canvas.

## Data, Automation, and Collaboration

Diagram Craft is not limited to static drawing. Depending on how you use it, a diagram can also be:

- **data-driven**, with content tied to external sources
- **automated**, using layouts or text-to-diagram workflows
- **collaborative**, with multiple people editing and reviewing together

You do not need these features to get started, but they explain why the editor includes more structure than a basic shape-and-line tool.

## A Practical Way to Think About the Editor

If you are new to Diagram Craft, this simplified model is enough:

1. Open a document.
2. Work inside a tab.
3. Place nodes on the canvas.
4. Connect them with edges.
5. Organize them with layers, groups, or additional tabs.
6. Refine layout and styling as the diagram becomes more complete.

That model will carry through the rest of the documentation, from the getting-started guides to the more advanced sections on layout, data integration, and collaboration.

Next, read [Key Features](key-features) for a high-level tour of what the editor can do, or continue to [Getting Started](../getting-started/introduction) if you want to build something immediately.
