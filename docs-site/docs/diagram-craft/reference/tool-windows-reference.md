---
sidebar_position: 2
---

# Tool Windows Reference

Use this page when you need to look up which panel holds a feature, which tabs it exposes, or how it is opened. For a lighter orientation to the UI, start with [Tool Windows](../user-interface/tool-windows).

Diagram Craft splits its tool windows between a left sidebar and a right sidebar. Each sidebar window can be toggled from the sidebar itself or by its default keyboard shortcut.

## Left Sidebar

### Objects

- Shortcut: `Alt+1`
- Purpose: insert shapes, revisit recent shapes, browse model-backed objects, and search icons
- Tabs:
  - `Shape`
  - `Recent`
  - `Model`
  - `Icon`

### Structure

- Shortcut: `Alt+2`
- Purpose: inspect and manage the document structure
- Tabs:
  - `Layer`
  - `Document`
  - `Tags`
- Notes:
  - `Layer` includes layer-focused actions and the layer list
  - `Document` exposes document-level structure
  - `Tags` focuses on tag-level inspection

### History

- Shortcut: `Alt+3`
- Purpose: inspect recent editing history
- Tabs:
  - `Undo Stack` when the active diagram uses the stacked undo manager
  - `Document History`
- Notes:
  - `Document History` is present in the UI, but it is currently only a minimal placeholder surface rather than a full restore timeline

### Search

- Shortcut: `Alt+4`
- Purpose: search the current diagram or document in increasingly structured ways
- Tabs:
  - `Search`
  - `Advanced`
  - `DJQL`
- Notes:
  - `DJQL` is the query-oriented tab documented in [DJQL Reference](./djql-reference)

### Story Player

- Shortcut: no default shortcut exposed in the keymap
- Purpose: manage and play document stories
- Tabs:
  - `Stories`
  - `Player`
- Notes:
  - `Player` is disabled until the document contains at least one story

### Diagram As Code

- Shortcut: `Alt+5`
- Purpose: edit the active regular layer through the text-to-diagram format
- Tabs:
  - `Text`
- Notes:
  - shows parse errors inline
  - supports apply and restore actions
  - supports `Command+Enter` or `Control+Enter` to apply changes from the editor

### AI

- Shortcut: `Alt+6`
- Purpose: send prompts to the AI assistant and apply returned diagram changes
- Tabs:
  - `Chat`
- Notes:
  - this panel is only rendered when AI is enabled in the app configuration
  - it is disabled for non-regular or locked active layers

## Right Sidebar

### Style

- Shortcut: `Alt+7`
- Purpose: edit styling, text, arrange/layout settings, grid settings, and advanced properties based on the current selection
- Tabs:
  - selection-sensitive tabs such as `Canvas`, `Grid`, `Style`, `Table`, `Cell`, `Text`, `Arrange`, and `Advanced`
- Notes:
  - the available tabs change with the selection type
  - diagram-level selection exposes canvas and grid controls
  - node, edge, table, and table-cell selections expose different editing surfaces

### Selection Info

- Shortcut: `Alt+8`
- Purpose: inspect information about the current selection
- Tabs:
  - `Selection Info`

### Data

- Shortcut: `Alt+9`
- Purpose: inspect and edit selection-linked data
- Tabs:
  - `Basic Info`
  - `Extended Data`
- Notes:
  - `Basic Info` is only shown when exactly one element is selected

### Comments

- Shortcut: `Alt+0`
- Purpose: review comment threads attached to the current diagram and selection
- Tabs:
  - `Comments`
  - `My Threads`
- Notes:
  - both tabs support sorting, grouping, and hiding resolved threads
  - when elements are selected, the panel narrows to threads attached to that selection

### Style Overview

- Shortcut: no default shortcut exposed in the keymap
- Purpose: inspect reusable style assets at the document level
- Tabs:
  - `Stylesheets`
  - `Styles`
  - `Variants`

## Panel Behavior

- Tool-window tabs persist through user state, so the app reopens each window on the last selected tab when possible.
- The current keyboard map only exposes direct shortcuts for opening sidebar windows, not for switching between tabs inside a window.
- Some windows are always present in the sidebar but expose disabled tabs or limited content until the current document state supports them.
