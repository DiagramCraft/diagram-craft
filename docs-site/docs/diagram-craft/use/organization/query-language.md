---
sidebar_position: 4
related_reading:
  - label: DJQL Reference
    to: /diagram-craft/diagram-craft/reference/djql-reference
  - label: Data Binding
    to: /diagram-craft/diagram-craft/use/data-integration/data-binding
  - label: Dynamic Updates
    to: /diagram-craft/diagram-craft/use/data-integration/dynamic-updates
---

# Query Language (DJQL)

DJQL is the practical way to inspect the document model, filter elements, and build repeatable searches without clicking through the canvas one item at a time. Use it when basic text search is not expressive enough.

## Start With The Query Tool Window

The **DJQL** tab in the query tool window gives you four core controls:

- a query editor
- a scope selector
- a response panel
- save/export actions

That makes DJQL useful even if you are still learning the syntax. You can run a query, inspect the returned objects, and refine from there.

## Choose The Right Scope

Queries run against one of four current scopes:

- **Active Layer**
- **Active Diagram**
- **Active Document**
- **Selection**

Use the narrowest scope that matches the question you are asking. That keeps results easier to understand and reduces accidental matches from unrelated parts of the document.

## What DJQL Is Good For

DJQL is strongest when you want to:

- find elements that match structured conditions
- inspect data and metadata attached to elements
- build reusable searches for cleanup or review
- export result sets for further inspection

It is especially useful for data-driven diagrams, comments-aware searches, and layer/rule troubleshooting.

## Read The Results As Working Data

Search results are not just a yes/no answer. The response panel shows the returned objects, and hovering results can highlight matching elements on the canvas when the result represents a diagram element.

That makes DJQL practical for iterative work:

1. run a broad query
2. inspect the returned shape
3. tighten the filter
4. confirm the highlighted elements are the ones you meant

## Query Implemented Document Data

Queries can inspect element types, text, styles, metadata, attached schemas, and comments exposed by the selected scope. Use the [DJQL Reference](../../reference/djql-reference) for supported syntax and query examples.

## Save Queries That You Reuse

If a query is part of your normal workflow, save it from the tool window instead of rewriting it each time.

## Export When The Result Is The Deliverable

Use **Export** when the result set is useful outside the canvas, such as handing a filtered list to another tool or attaching findings to a review. Treat exported results as snapshots of the current document state.

## DJQL Versus Provider Search

Use **provider search** in model/data pickers to locate records inside one schema. Use **DJQL** for broader questions about the diagram, selection, document, or attached metadata.

## Limits And Expectations

- DJQL is only as good as the underlying document structure and attached data
- broad document-scoped queries can return noisy results when a document mixes many diagram types
- this page focuses on workflow; use the reference page for syntax details
