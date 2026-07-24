# Feature Maps

The feature maps are human-readable inventories of the user-facing capabilities in the two products in this
repository. They complement the end-user documentation: the maps describe what the products can do and the current
state of each capability, while the documentation explains how to use those capabilities.

## Files

- `diagram-craft.md` — Diagram Craft capabilities
- `arch-register.md` — Arch Register capabilities

## Format

Each capability is a Markdown list item. Indentation expresses hierarchy, and each item has a stable product-prefixed
identifier. A capability with no status annotation is assumed to be shipped; status annotations are only needed for
exceptions or uncertainty.

```md
- @id:dc.collaboration
  Diagram Craft supports collaborative editing.

  - @id:dc.collaboration.comments
    Users can submit and view comments on diagram elements.
```

IDs are stable identifiers, not implementation names. Wording can be improved without changing an ID. Keep
descriptions short, user-oriented, and focused on capabilities rather than packages, APIs, or individual tests.

## Status values

- no status — implemented and available as a supported capability
- `partial` — available, but incomplete or narrower than the surrounding concept suggests
- `experimental` — implemented but explicitly provisional, optional, or not yet a mature workflow
- `planned` — explicitly identified as future product scope, but not currently shipped
- `deprecated` — retained for historical or compatibility reasons and no longer a current direction
- `needs-review` — temporary or explicit uncertainty that needs a later product/code review

When adding, substantially changing, removing, or deprecating a user-facing capability, update the relevant map in the
same change. Do not add implementation-only details merely because a new package, endpoint, or internal abstraction was
introduced.
