# UnitOfWork and UndoManager Flow

This note describes the high-level shape of undo in `@diagram-craft/model`.

Implementation-specific behavior now lives mainly in TSDoc on:
- `UndoManager`
- `UndoCapture`
- `DefaultUndoManager`
- `CollaborationBackendUndoManager`
- `createUndoManager(...)`

## Main pieces

- `UnitOfWork`
  Tracks structural model changes (`add`, `remove`, `update`) for `UOWTrackable` objects and can build a structural `UndoableAction` from them via `asUndoableAction(...)`.

- `UndoManager`
  The app-facing undo contract. Callers mostly interact with:
  - `execute(label, callback)`
  - `beginCapture(label)`
  - `addAndExecute(action)`
  - `undo()`
  - `redo()`
  - mark-related methods such as `setMark()` and `undoToMark()`

- `UndoCapture`
  Owns the `UnitOfWork` for one long-lived undo boundary and is responsible for either committing it into one undo step or aborting it entirely.

## Why `execute(...)` exists

`execute(label, callback)` defines the public execution boundary for one user-visible undo step.

Callers should not need to know whether undo is backed by:
- a local in-memory stack
- a collaboration backend's native undo system

They just go through the active manager:

```ts
diagram.undoManager.execute(label, uow => {
  // perform the actual work in the provided UnitOfWork
})
```

## Why `asUndoableAction(...)` exists

`UnitOfWork` knows how to derive a structural `UndoableAction` from tracked operations, but it no longer decides where that action goes.

Instead:
- `capture.commit()` performs `uow.commit()`
- `capture.commit()` then asks `UnitOfWork` for `asUndoableAction(label)`
- the owning `UndoManager` implementation decides how to finalize that action

This keeps structural tracking in `UnitOfWork` and history semantics in `UndoManager`.

## Collaboration-backed undo

For collaboration-backed undo:
- undoable local changes must run inside a backend-tracked boundary
- remote replicated changes must stay out of the local undo stack
- structural model actions are attached as metadata to backend-native undo items so UI and events can still refer to higher-level actions

Those implementation details are documented on `CollaborationBackendUndoManager` and `CollaborationUndoAdapter`.

## Practical rule of thumb

- use `undoManager.execute(...)` for structural model changes
- use `undoManager.beginCapture(...)` for long-lived interactions such as drags
- use `undoManager.addAndExecute(...)` only for explicit command-style undo actions
- do not assume every `UndoManager` has a mutable in-memory stack
- if a feature requires stack inspection or post-hoc stack rewriting, treat that as `StackedUndoManager`-specific behavior
