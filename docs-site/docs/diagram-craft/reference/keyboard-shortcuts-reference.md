---
sidebar_position: 1
---

# Keyboard Shortcuts Reference

Use this page when you need the shipped default bindings for Diagram Craft. If you are still learning where the tools live, start with [Keyboard Shortcuts](../user-interface/keyboard-shortcuts).

Diagram Craft currently exposes one default keymap in the app code: the macOS-style bindings defined in `defaultMacKeymap` and `defaultMacAppKeymap`. The tables below document those bindings as implemented today.

## Reading The Notation

- `M` = Command
- `S` = Shift
- `A` = Alt/Option
- `C` = Control

## Tools

| Shortcut | Action |
| --- | --- |
| `Command+1` | Move tool |
| `Command+2` | Rectangle tool |
| `Command+3` | Edge tool |
| `Command+4` | Text tool |
| `Command+5` | Freehand tool |
| `Command+6` | Pen tool |
| `Command+7` | Node tool |

## Sidebars And Panels

| Shortcut | Action |
| --- | --- |
| `Alt+1` | Objects panel |
| `Alt+2` | Structure panel |
| `Alt+3` | History panel |
| `Alt+4` | Search panel |
| `Alt+5` | Diagram as Code panel |
| `Alt+6` | AI panel |
| `Alt+7` | Style panel |
| `Alt+8` | Selection Info panel |
| `Alt+9` | Data panel |
| `Alt+0` | Comments panel |

## File And Command Actions

| Shortcut | Action |
| --- | --- |
| `Command+N` | New document |
| `Command+O` | Open file |
| `Command+S` | Save |
| `Command+Shift+S` | Save as |
| `Command+E` | Export image |
| `Command+K` | Command palette |

## View And Editor Controls

| Shortcut | Action |
| --- | --- |
| `Command+=` | Zoom in |
| `Command+-` | Zoom out |
| `Command+0` | Zoom to fit |
| `Command+Shift+P` | Preview |
| `Command+Shift+M` | Model center |
| `Command+/` | Toggle help |
| `Command+Shift+R` | Toggle ruler |

## Clipboard And Editing

| Shortcut | Action |
| --- | --- |
| `Command+C` | Copy |
| `Command+X` | Cut |
| `Command+V` | Paste |
| `Command+D` | Duplicate |
| `Backspace` | Delete selection |
| `Command+Z` | Undo |
| `Command+Shift+Z` | Redo |
| `Command+G` | Group |
| `Command+Shift+G` | Ungroup |

## Selection

| Shortcut | Action |
| --- | --- |
| `Command+A` | Select all |
| `Command+Shift+A` | Select all nodes |
| `Alt+Arrow Up` | Grow selection |
| `Alt+Arrow Down` | Shrink selection |

## Move And Resize Selection

| Shortcut | Action |
| --- | --- |
| `Arrow keys` | Move selection by one step |
| `Shift+Arrow keys` | Move selection by grid step |
| `Command+Arrow keys` | Resize selection by one step |
| `Command+Shift+Arrow keys` | Resize selection by grid step |

## Linked Node Creation

| Shortcut | Action |
| --- | --- |
| `Alt+Control+Arrow Up` | Create linked node north |
| `Alt+Control+Arrow Down` | Create linked node south |
| `Alt+Control+Arrow Left` | Create linked node west |
| `Alt+Control+Arrow Right` | Create linked node east |
| `Alt+Control+Shift+Arrow Up` | Create linked node north and keep current node |
| `Alt+Control+Shift+Arrow Down` | Create linked node south and keep current node |
| `Alt+Control+Shift+Arrow Left` | Create linked node west and keep current node |
| `Alt+Control+Shift+Arrow Right` | Create linked node east and keep current node |

## Node Navigation

| Shortcut | Action |
| --- | --- |
| `Control+Command+Arrow Up` | Navigate to node north |
| `Control+Command+Arrow Down` | Navigate to node south |
| `Control+Command+Arrow Left` | Navigate to node west |
| `Control+Command+Arrow Right` | Navigate to node east |
| `Control+Command+Shift+Arrow Up` | Extend navigation north |
| `Control+Command+Shift+Arrow Down` | Extend navigation south |
| `Control+Command+Shift+Arrow Left` | Extend navigation west |
| `Control+Command+Shift+Arrow Right` | Extend navigation east |

## Alignment And Distribution

| Shortcut | Action |
| --- | --- |
| `Alt+Control+L` | Align left |
| `Alt+Control+R` | Align right |
| `Alt+Control+T` | Align top |
| `Alt+Control+B` | Align bottom |
| `Alt+Control+C` | Align vertical centers |
| `Alt+Control+M` | Align horizontal centers |
| `Alt+Control+H` | Distribute horizontally |
| `Alt+Control+V` | Distribute vertically |

## Text Formatting

| Shortcut | Action |
| --- | --- |
| `Command+B` | Bold |
| `Command+I` | Italic |
| `Command+U` | Underline |

## Stacking Order

| Shortcut | Action |
| --- | --- |
| `Command+]` | Bring to front |
| `Command+Shift+]` | Bring forward |
| `Command+[` | Send to back |
| `Command+Shift+[` | Send backward |

## Notes

- The app shows these bindings in tooltips, menus, and the command palette by resolving actions through the active keymap.
- This page documents defaults only. It does not describe a user-facing shortcut customization system because no such system is exposed in the current app.
