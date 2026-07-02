---
sidebar_position: 4
---

# Version History

The current history tooling in Diagram Craft is best understood as **working history**, not as a full document-version management system. Use it to understand recent undoable work and recover from mistakes during editing, but do not treat it as a complete long-term revision browser.

## Start With Undo And Redo

The shipped history behavior is grounded in the undo manager:

- actions are recorded as you edit
- undo walks backward through recorded changes
- redo walks forward again when available

This is the safety net you use while building, refining, and correcting the diagram.

## Use The Undo Stack For Short-Term History

When the active diagram uses the stacked undo implementation, the **History** tool window exposes an **Undo Stack** tab that shows:

- undoable actions
- redoable actions
- action descriptions
- timestamps for recorded entries

This is useful when you need to understand what just happened before deciding whether to undo once, several times, or not at all.

## Be Precise About The Current UI

The current tool window also includes a **Document History** tab, but it is not yet a full end-user timeline with preview-and-restore behavior.

Document it as it exists:

- **Undo Stack** is functional and useful today
- **Document History** is not currently the same thing as a full version browser

That distinction matters because teams will otherwise expect named versions, preview states, or long-range restoration that the current UI does not provide.

## What History Is Good For Right Now

- recovering from accidental edits
- stepping backward through a recent modeling experiment
- checking the order of recent changes during active work
- understanding the immediate editing sequence in a live session

It is especially helpful during dense editing sessions where many small actions happen quickly.

## Collaboration Changes The Context, Not The Need

In collaborative setups, users still need to think in terms of editing history, but the underlying implementation may be backed by collaboration-aware undo behavior rather than a purely local stack.

The practical guidance stays the same:

- use undo/redo for recent correction
- avoid promising this as a full audit system
- rely on broader workspace or repository policy for long-term version governance

## Practical Example

After trying an automatic layout that did not read well:

1. open the **History** tool window
2. inspect the recent undoable actions
3. undo the layout-related changes
4. reapply a different layout or continue with manual refinement

This is a strong use case for working history because the goal is immediate recovery, not archival restoration.

## Limits To Call Out

- current docs should not promise full version snapshots or named restore points
- current docs should not describe the placeholder **Document History** tab as a complete feature
- undo history is an editing aid, not a substitute for external versioning or review process

## Related Reading

- [Real-time Editing](real-time-editing)
- [Comments and Review](comments-review)
