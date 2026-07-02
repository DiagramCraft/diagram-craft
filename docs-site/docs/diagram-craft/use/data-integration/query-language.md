---
sidebar_position: 3
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

## Useful Query Patterns

Common examples include:

- elements with unresolved comments
- elements linked to a specific schema
- elements missing expected data
- selection-scoped checks before bulk editing

For example, if you are reviewing feedback, you might query for elements whose serialized comment data includes unresolved discussion instead of manually scanning the whole diagram.

## Save Queries That You Reuse

If a query is part of your normal workflow, save it from the tool window instead of rewriting it each time.

Good candidates for saved queries:

- release-readiness checks
- ownership or lifecycle reviews
- “show me all linked service nodes”
- “show me elements with unresolved comments”

Saved queries are most valuable when the team agrees on what the query is meant to answer.

## Export When The Result Is The Deliverable

Use **Export** when the result set itself is useful outside the canvas, such as:

- handing a filtered list to another tool
- attaching findings to a review
- comparing query outputs before and after a cleanup pass

Treat exported results as snapshots. They reflect the current document state at the moment you ran the query.

## DJQL Versus Provider Search

Use **provider search** in model/data pickers when you are trying to locate records inside one schema. Use **DJQL** when you are asking broader questions about the diagram, selection, document, or attached metadata.

That distinction keeps the tool choice simple:

- provider search answers “which data record do I want?”
- DJQL answers “which diagram objects match this condition?”

## Limits And Expectations

- DJQL is powerful, but it is still only as good as the underlying document structure and attached data
- broad document-scoped queries can return noisy results if your document mixes many diagram types
- this page focuses on workflow; use the reference page for syntax details

## Related Reading

- [DJQL Reference](../../reference/djql-reference)
- [Data Binding](data-binding)
- [Dynamic Updates](dynamic-updates)
