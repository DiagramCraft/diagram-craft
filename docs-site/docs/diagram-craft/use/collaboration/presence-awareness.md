---
sidebar_position: 3
---

# Presence Awareness

Presence awareness answers the basic collaboration question: “who else is here, and where are they working?” It is lightweight by design. The goal is not to add ceremony, but to reduce collisions and give the team shared context while editing.

## Start With The Awareness Toolbar

The awareness toolbar is the fastest way to confirm that other collaborators are in the same live session.

It shows the active users known to the collaboration backend using their current awareness state, including:

- display name
- user color
- avatar-style presence chip

If the toolbar is empty during a supposedly shared editing session, treat that as a configuration or connection signal first.

## Remote Cursors Show Active Work Areas

When collaboration is enabled, Diagram Craft can surface remote cursor state so you can see where other users are currently interacting.

This is useful for:

- avoiding accidental overlap during a live workshop
- following along while someone explains a change
- spotting which region another editor is actively adjusting

Remote cursor awareness is most valuable during synchronous sessions. It matters less in slower, comment-driven review flows.

## Use Color As The Main Identity Cue

Presence in Diagram Craft is intentionally simple. The collaboration state includes a user name and color, and that color is reused for visible collaboration cues.

That means teams can quickly build a habit such as:

- “blue is editing the gateway area”
- “green is reviewing comments on the service lane”

This is often enough for small-group collaboration without introducing heavier user-management concepts into the canvas.

## What Presence Awareness Helps You Avoid

- editing directly on top of another person
- talking about one region while someone else is looking somewhere else
- misreading silence as inactivity when another user is obviously active on the canvas

Presence is not the same thing as permission control. It tells you who is active, not what governance model your deployment uses.

## Practical Example

In a live modeling session:

1. three users join the same collaborative diagram
2. the toolbar confirms everyone is present
3. one user points at a problem area with the cursor
4. another user edits that section while the rest of the team follows the movement

This is a small feature, but it removes a surprising amount of friction from shared editing.

## Limits To Call Out

- presence awareness depends on a live collaboration backend
- current docs should not promise separate “viewer versus editor” indicators unless the host product adds them
- current docs should not promise configurable privacy controls unless that behavior exists in the deployed product

## Related Reading

- [Real-time Editing](real-time-editing)
- [Comments and Review](comments-review)
