---
sidebar_position: 2
related_reading:
  - label: Real-time Editing
    to: /diagram-craft/diagram-craft/use/collaboration/real-time-editing
  - label: Presence Awareness
    to: /diagram-craft/diagram-craft/use/collaboration/presence-awareness
  - label: Query Language (DJQL)
    to: /diagram-craft/diagram-craft/use/data-integration/query-language
---

# Comments and Review

Comments let teams review a diagram without turning every discussion into a live editing session. In Diagram Craft, comments are attached either to the whole diagram or to a specific element, which makes them useful for both broad review threads and focused feedback.

## Understand The Two Comment Scopes

The current comment system supports:

- **diagram comments** for feedback about the document as a whole
- **element comments** for feedback attached to one specific node or edge

That distinction is important. The current feature set is not a freeform pin-on-canvas annotation system. If you need location-specific feedback, attach the comment to the most relevant element or use a diagram-level thread that describes the area in plain language.

## Add Comments From The Current Context

When you add a comment, Diagram Craft checks the current selection:

- if one element is selected, the comment is attached to that element
- otherwise, the comment becomes a diagram-level comment

This is a practical workflow because it keeps element review lightweight. Reviewers do not need a separate mapping step to decide where a comment belongs.

## Work In Threads, Not Isolated Notes

Comments support replies, so one root comment can grow into a short decision thread instead of scattering multiple disconnected notes across the diagram.

Use threads when you need to:

- ask for clarification
- propose a change and discuss alternatives
- close the loop after the diagram is updated

That keeps the review history readable even when several people participate.

## Use Resolve/Unresolve As The Main Review State

The current comment state model is intentionally simple:

- **unresolved** means the issue still needs attention
- **resolved** means the discussion is complete for now

If new information appears, resolved comments can be reopened. This is usually enough for diagram review without inventing a heavier ticket workflow inside the editor.

## Review Through The Comments Tool Window

The **Comments** tool window is the main place to manage review activity. It supports:

- a full comments view
- a **My Threads** view
- grouping by element or author
- sorting by date
- hiding resolved comments

When something is selected on the canvas, the comments view can narrow naturally to threads related to the selected element.

## Understand Stale Comments

Element comments can become **stale** if the target element is deleted. Those comments are not automatically erased from history, but they no longer point to a live element.

This is useful because:

- review context is not silently lost
- teams can still understand what was discussed
- you can decide whether to resolve, delete, or rewrite the thread

## Limits To Call Out

- current docs should not promise freeform canvas-position comments
- current docs should not promise mention workflows unless that behavior is added later
- comment resolution tracks discussion state, not approval gates or formal sign-off
