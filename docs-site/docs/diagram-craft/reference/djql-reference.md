---
sidebar_position: 3
---

# Query Language (DJQL) Reference

This page is the syntax companion to the workflow guide in [Query Language (DJQL)](../use/data-integration/query-language). Use it when you already know what you want to ask and need help shaping the query text.

## Query Inputs

In the current query tool window, DJQL can run against one of these scopes:

- active layer
- active diagram
- active document
- selection

Start with the narrowest scope that contains the objects you care about.

## Mental Model

DJQL in Diagram Craft is powered by structured query evaluation over the diagram/document model. In practice, most useful queries follow the same pattern:

1. start from a collection such as elements
2. filter with `select(...)`
3. optionally drill into nested properties
4. inspect the resulting objects

If you are new to DJQL, build the query a step at a time instead of trying to write the final version in one pass.

## Common Building Blocks

These patterns are the ones end users reach for most often:

- iterate a collection such as `.elements[]`
- filter with `select(...)`
- compare strings, numbers, and booleans inside the current object
- inspect nested metadata such as attached data or comments
- chain steps with pipes

## Example Patterns

Find elements with comments:

```jq
.elements[]
| select(.comments | length > 0)
```

Find elements with unresolved comments:

```jq
.elements[]
| select(any(.comments[]; .state == "unresolved"))
```

Find elements whose text or data contains a specific value:

```jq
.elements[]
| select(.texts.text == "Payments API")
```

Filter from the current selection instead of the whole diagram:

```jq
.[]
| select(.type == "node")
```

The exact shape of the input depends on the chosen scope, so inspect a simple result first if a property path is not obvious.

## Practical Advice

- prefer small queries you can explain to someone else
- test against **Selection** first when developing a risky query
- use export when the result set needs to leave the editor
- inspect returned objects before assuming a property name

## Limits

- this page is intentionally practical, not a full language specification
- available properties depend on the queried diagram/document model
- very broad document-scoped queries can produce noisy results

## Related Reading

- [Query Language (DJQL)](../use/data-integration/query-language)
