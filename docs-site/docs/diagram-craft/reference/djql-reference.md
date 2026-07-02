---
sidebar_position: 3
---

# Query Language (DJQL) Reference

Use this page when you already know you need DJQL and want the implemented query scopes, result behavior, and common query shapes. If you are learning when to use the feature, start with [Query Language (DJQL)](../use/data-integration/query-language).

## Where DJQL Lives

DJQL is the `DJQL` tab in the left sidebar `Search` tool window. The panel exposes:

- a scope selector
- a syntax-highlighting query editor
- search, save, and export actions
- a response panel that shows the returned values

## Supported Query Scopes

The current tool window can run DJQL against four scopes:

| Scope | Input |
| --- | --- |
| `Active Layer` | `QueryLayer.fromLayer(diagram.activeLayer)` |
| `Active Diagram` | `new QueryDiagram(diagram)` |
| `Active Document` | `new QueryDocument(diagram.document)` |
| `Selection` | `new QueryDiagram(diagram).selection` |

Use the narrowest scope that still contains the objects you need.

## Result Behavior

- Running a query evaluates it through `parseAndQuery(...)`.
- Results are shown as JSON-like output in the response panel.
- Results can be expanded item by item.
- When a returned object includes both `type` and `id`, hovering the result highlights the matching diagram element on the canvas.
- `Export` writes the current result set as `export.json`.
- Queries executed from the panel are added to the document query history.

## Mental Model

In practice, DJQL is most useful when you:

1. start from one of the current scope objects
2. iterate into collections such as elements
3. filter with `select(...)`
4. inspect returned objects
5. refine the path once you know the real object shape

## Common Query Shapes

### Filter elements by type

```jq
.elements[]
| select(.type == "node")
```

### Match text content

```jq
.elements[]
| select(.texts.text == "Payments API")
```

### Find elements with unresolved comments

```jq
.elements[]
| select(any(.comments[]; .state == "unresolved"))
```

### Search by name pattern

```jq
.elements[]
| select(.type == "node")
| select(.name | test("lorem"; "i"))
```

### Match by style or property value

```jq
.elements[]
| select(.props.fill.color == "white")
```

### Match by tag

```jq
.elements[]
| select(.type == "edge" and (.tags | contains(["component"])))
```

## Working With Selection Scope

The `Selection` scope is useful when you want to validate or narrow the current working set before making a bulk change.

Example:

```jq
.[]
| select(.type == "node")
```

Because this scope starts from the current selection instead of the whole diagram, it is the safest place to develop risky filters.

## Practical Notes

- The response shape depends on the selected scope. If a property path is unclear, run a smaller query first and inspect the returned object.
- The panel includes saved-query and history behavior, but this page documents only the currently exposed interaction model, not a larger team workflow layer.
- The UI supports `Search`, `Advanced`, and `DJQL` tabs in the same tool window. DJQL is the free-form query path; the others are structured search surfaces.

## Limits

- This is an implementation reference, not a formal standalone language specification.
- Available properties depend on the queried diagram or document model.
- Broad document-scoped queries can return a large amount of data.
- The tool highlights matching elements when the returned objects map cleanly to diagram elements, but non-element results are still returned as plain data.

## Related Reading

- [Query Language (DJQL)](../use/data-integration/query-language)
- [File Format Reference](./file-format-reference)
