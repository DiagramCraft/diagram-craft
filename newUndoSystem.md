# New Undo System Proposal

This note proposes a cleaner target architecture for undo.

The goal is to make `UndoManager` the single public entry point for undo orchestration, and to make `UnitOfWork` an internal structural-change mechanism rather than a public coordination API.

## Problem statement

The current implementation works, but the abstraction boundary is not ideal.

Today, the public undo workflow is split across two concepts:

- `UndoManager`
- `UnitOfWork`

That creates several signs of leakage:

- short-lived undoable work is started via `UnitOfWork.executeWithUndo(...)`
- long-lived undoable interactions use `UnitOfWork.begin(...)` plus undo-manager session state
- `UndoManager` needs to know about `UnitOfWork`'s structural undo construction
- `UnitOfWork` needs to know about undo-manager capture mechanisms

This is especially visible in the collaboration-backed path, where the timing requirements differ:

- structural undo is naturally derived after mutation
- collaboration-backed undo needs the mutation boundary marked before mutation

The current system solves that, but with a fairly complex interaction between:

- `runUndoable(...)`
- `beginUndoableSession(...)`
- `withNativeUndoCapture(...)`
- `commitWithUndo(...)`

## Design goals

- Make `UndoManager` the single public API for undo orchestration
- Keep `UnitOfWork` focused on structural tracking and replay
- Hide collaboration-specific capture timing behind `UndoManager`
- Support both:
  - short-lived atomic operations
  - long-lived interactive captures such as drags
- Keep stack-specific behavior explicit behind `StackedUndoManager`

## Proposed public API

## `UndoManager`

```ts
interface UndoManager extends EventEmitter<UndoEvents>, Releasable {
  canUndo(): boolean;
  canRedo(): boolean;

  execute<T>(label: string, callback: (uow: UnitOfWork) => T): T;
  beginCapture(label: string): UndoCapture;

  addAndExecute(action: UndoableAction): void;

  setMark(markName?: string): void;
  getToMark(markName?: string): UndoableAction[];
  undoToMark(markName?: string): void;
  clearRedo(): void;
  combine(callback: () => void): void;

  undo(): void;
  redo(): void;
}
```

### Purpose

- `execute(...)`
  Public API for short-lived undoable work

- `beginCapture(...)`
  Public API for long-lived interactions such as move, resize, rotate, edge endpoint drag, and similar operations

- `addAndExecute(...)`
  For explicit command-style undo actions that are not naturally expressed as structural `UnitOfWork` updates

## `UndoCapture`

```ts
interface UndoCapture extends Releasable {
  readonly unitOfWork: UnitOfWork;
  commit(): void;
  abort(): void;
}
```

### Purpose

An `UndoCapture` represents one user-visible undo boundary.

It owns:

- a `UnitOfWork`
- the label for the capture
- any collaboration-backed tracked transaction/session
- any metadata attachment needed for the concrete undo implementation

The caller does not need to coordinate `UnitOfWork.begin(...)` with undo-manager session state manually.

## `UnitOfWork`

The proposal is not to remove `UnitOfWork`, but to narrow its role.

`UnitOfWork` should be responsible for:

- tracking structural operations (`add`, `remove`, `update`)
- consolidating operations
- producing a structural undo description
- replaying structural undo and redo

`UnitOfWork` should not be the main public orchestration API for undo.

## Proposed internal API shape

Internally, a useful shape would be:

```ts
interface StructuralUndoResult {
  action?: UndoableAction;
}

class UnitOfWork {
  static begin(diagram: Diagram): UnitOfWork;

  commit(): void;
  abort(): void;

  compact(): void;

  finishAsUndoableAction(label: string): UndoableAction | undefined;
}
```

The important shift is:

- instead of `commitWithUndo(...)` directly pushing into an `UndoManager`
- the `UndoCapture` would ask the `UnitOfWork` to produce its structural action
- then the `UndoCapture` would decide what to do with that action

This keeps undo orchestration on the undo side.

## High-level behavior by implementation

## `DefaultUndoManager`

### `execute(label, cb)`

1. create a capture
2. run callback with `capture.unitOfWork`
3. `capture.commit()`

### `beginCapture(label)`

Creates:

- `UnitOfWork.begin(diagram)`

On `commit()`:

- finalize the `UnitOfWork`
- produce a structural `UndoableAction`
- push that action to the default in-memory undo stack

## `CollaborationBackendUndoManager`

### `execute(label, cb)`

1. create a capture
2. run callback with `capture.unitOfWork`
3. `capture.commit()`

### `beginCapture(label)`

Creates:

- `UnitOfWork.begin(diagram)`
- a collaboration-backed tracked session
- a place to collect the structural action metadata

On `commit()`:

- finalize the `UnitOfWork`
- produce the structural `UndoableAction`
- attach it as metadata to the collaboration-backed history item
- close the backend capture boundary

The caller should not need to know any of the collaboration-specific timing requirements.

## Example usage

## Short-lived operation

Current style:

```ts
UnitOfWork.executeWithUndo(diagram, 'Rename', uow => {
  node.setName('New name', uow);
});
```

Proposed style:

```ts
diagram.undoManager.execute('Rename', uow => {
  node.setName('New name', uow);
});
```

## Long-lived drag interaction

Current style:

```ts
const session = diagram.undoManager.beginUndoableSession('Move');
const uow = UnitOfWork.begin(diagram);

// mutate across drag events

uow.commitWithUndo('Move');
session.release();
```

Proposed style:

```ts
const capture = diagram.undoManager.beginCapture('Move');
const uow = capture.unitOfWork;

// mutate across drag events

capture.commit();
```

This is simpler because the caller only thinks in terms of one concept: a capture.

## Stack-specific behavior

The current split between:

- `UndoManager`
- `StackedUndoManager`

still makes sense.

This proposal does not change that direction.

Stack-inspection and stack-rewriting features should remain explicit capabilities.

The main change is only to consolidate orchestration under `UndoManager`.

## Suggested migration plan

## Phase 1: Introduce new public API without changing behavior

Add:

- `undoManager.execute(label, cb)`
- `undoManager.beginCapture(label): UndoCapture`

Implement them in terms of the current machinery:

- `execute(...)` can internally call today's `runUndoable(...)`
- `beginCapture(...)` can internally use today's `beginUndoableSession(...)` plus `UnitOfWork.begin(...)`

This phase is mainly about creating the right public shape.

## Phase 2: Move callers off `UnitOfWork.executeWithUndo(...)`

Convert callers from:

```ts
UnitOfWork.executeWithUndo(diagram, label, cb)
```

to:

```ts
diagram.undoManager.execute(label, cb)
```

At the end of this phase:

- `UndoManager` is the public entry point for short-lived undoable work
- `UnitOfWork.executeWithUndo(...)` can become a compatibility wrapper

## Phase 3: Move drag/edit sessions to `beginCapture(...)`

Convert long-lived interactions from:

- `UnitOfWork.begin(...)`
- `beginUndoableSession(...)`
- `commitWithUndo(...)`

to:

- `beginCapture(...)`
- `capture.unitOfWork`
- `capture.commit()`

At the end of this phase:

- long-lived interaction code only coordinates with `UndoCapture`
- `UnitOfWork.begin(...)` is no longer part of normal caller-facing undo orchestration

## Phase 4: Pull undo finalization out of `UnitOfWork`

Refactor `UnitOfWork` so it no longer calls back into `UndoManager`.

Move toward:

- `UnitOfWork.finishAsUndoableAction(label)`

instead of:

- `UnitOfWork.commitWithUndo(label)`

At this point:

- `withNativeUndoCapture(...)`
- session-based native capture plumbing

should either disappear or become much smaller internal implementation details of `UndoCapture`.

## Phase 5: Simplify the concrete implementations

After the public API and orchestration are consolidated:

- simplify `DefaultUndoManager`
- simplify `CollaborationBackendUndoManager`
- reduce the need for cross-wiring between `UndoManager` and `UnitOfWork`

This is where the design should become easier to explain and maintain.

## What should become internal

The following should ideally stop being part of normal caller-facing patterns:

- `UnitOfWork.begin(...)`
- `UnitOfWork.executeWithUndo(...)`
- `UnitOfWork.commitWithUndo(...)`
- `UndoManager.runUndoable(...)`
- `UndoManager.beginUndoableSession(...)`
- `UnitOfWork.withNativeUndoCapture(...)`

These are all useful building blocks, but they are too low-level to remain the main public orchestration surface.

## What should stay public

The stable caller-facing concepts should be:

- `undoManager.execute(...)`
- `undoManager.beginCapture(...)`
- `capture.unitOfWork`
- `capture.commit()`
- `capture.abort()`
- `undoManager.addAndExecute(...)`
- `undoManager.undo()`
- `undoManager.redo()`

## Why this direction is better

- One public abstraction owns undo orchestration
- `UnitOfWork` becomes easier to understand
- collaboration-backed undo stays hidden behind `UndoManager`
- drag-based interactions become simpler to write correctly
- the model no longer exposes as much of the default-vs-collaboration mismatch

## Summary

The proposed target is:

- `UndoManager` is the public undo API
- `UndoCapture` is the public long-lived interaction API
- `UnitOfWork` is the internal structural change engine

That keeps the system aligned with the way callers actually think:

- short operation: execute one undoable action
- long interaction: begin one undo capture, mutate over time, commit it once

This should reduce complexity compared to the current split orchestration between `UndoManager` and `UnitOfWork`.
