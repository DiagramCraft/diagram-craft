---
sidebar_position: 1
---

# Real-time Editing

Real-time editing lets multiple people work in the same diagram without taking turns or passing files around. In practice, the workflow should feel simple for users: open the same collaborative document, edit normally, and watch changes appear for everyone else.

## Know The Prerequisite

Real-time editing only exists when Diagram Craft is configured with a collaboration backend.

In the current codebase, that means:

- the app uses the **Yjs** collaboration backend rather than the no-op backend
- a websocket collaboration server is available
- users connect to the same document or room

If collaboration is disabled, Diagram Craft still works as an editor, but not as a shared live session.

## What Users Experience

When collaboration is configured correctly, users can:

- open the same document
- edit shapes, text, links, comments, and document-backed collaborative state
- see each other’s changes appear without manually reloading

The important user-facing idea is consistency, not CRDT theory. People should think “we are in the same diagram”, not “we are merging files”.

## Conflict Handling Is Built Into The Session

Diagram Craft uses CRDT-based synchronization so normal simultaneous edits do not require explicit locking.

That means teams can usually:

- move different parts of the diagram at the same time
- add comments while someone else edits layout
- keep working through short overlap instead of stopping to coordinate every action

You still need human coordination for design intent, but not for the mechanics of merging ordinary edits.

## Joining The Same Session

The exact entry flow depends on the host application, but the underlying rule is simple: collaborators must resolve to the same shared document/room.

For self-hosted or local development setups, this usually means:

1. start the server with collaboration enabled
2. ensure the client points at the collaboration websocket URL
3. open the same collaborative document from each client

If users do not see each other, verify the session target and backend configuration before troubleshooting the editor itself.

## What Real-Time Editing Is Good At

- live review meetings
- distributed diagramming sessions
- fast clarification while someone narrates a system change
- keeping one shared source of truth instead of many local copies

It is especially effective when the team is actively shaping structure together rather than just handing off comments asynchronously.

## Performance And Reliability Expectations

Collaboration still depends on the surrounding environment.

Expect better results when:

- the websocket server is stable
- clients have reliable network access
- very large diagrams are broken into sensible documents or tabs instead of one giant canvas

If collaboration feels unreliable, check deployment and document size before assuming the synchronization model is at fault.

## Practical Example

A common architecture-review workflow looks like this:

1. one person opens the shared diagram during a call
2. another person updates labels or relationships live
3. reviewers add comments to elements that need follow-up
4. everyone watches the canvas converge on one agreed version

That is where real-time editing is strongest: fast alignment without duplicate offline edits.

## Limits To Call Out

- collaboration requires explicit backend/server configuration
- “same file name” does not guarantee “same session”; users must open the same shared document context
- real-time editing does not replace versioning policy, review discipline, or diagram decomposition for very large canvases

## Related Reading

- [Presence Awareness](presence-awareness)
- [Comments and Review](comments-review)
- [Version History](version-history)
