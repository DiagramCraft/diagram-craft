# Internationalization Plan for diagram-craft

## Overview

Replace all hard-coded labels with `$tStr` so they can be translated. The `$tStr` function's second
argument serves as the English fallback. Locale files and translation loading will be added in a
future phase.

---

## When to Use `$t` vs `$tStr`

**`$tStr(id, message)`** - Use for values initialized at startup or stored in constants/structures:

- Action definitions
- Menu structures
- Any data that needs to be passed around before rendering

**`$t(id, message)`** - Use directly in React components that re-render:

- JSX content
- Component props that are evaluated on each render
- Context menu labels, panel labels, dialog text

---

## Translation Key Naming Convention

| Category      | Pattern                     | Example                      |
| ------------- | --------------------------- | ---------------------------- |
| Actions       | `action.{ACTION_NAME}.name` | `action.FILE_SAVE.name`      |
| Menu items    | `menu.{menu}.{item}`        | `menu.file.new`              |
| Context menus | `context.{type}.{item}`     | `context.selection.align`    |
| Dialogs       | `dialog.{name}.{element}`   | `dialog.file.save_title`     |
| Tool panels   | `panel.{type}.{element}`    | `panel.text.bold`            |
| Common        | `common.{term}`             | `common.cancel`, `common.ok` |
| Placeholders  | `placeholder.{component}`   | `placeholder.search`         |
| Errors        | `error.{type}.{specific}`   | `error.schema.name_required` |

---

## Label Locations by Priority

### Priority 1: High-Impact Strings

**Main Menu** (`packages/main/src/react-app/mainMenuData.ts`) - **DONE**

**Context Menus**

- `SelectionContextMenu.tsx` - Edit Text, Shape Actions, Selection, Table, Debug, External Data
- `ConnectedNodesSubmenu.tsx` - Connected Items, No connected items, Data Entry
- `GuideContextMenu.tsx` - Delete, Clone, Color, Toggle orientation

**Action Names** (already using `$tStr` - verify consistency)

- `packages/canvas-app/src/actions/*.ts`
- `packages/main/src/react-app/actions/*.ts`

### Priority 2: Medium-Impact Strings

**Tool Window Tabs & Panels** (`packages/main/src/react-app/toolwindow/`)

- `ObjectToolWindow.tsx` - Canvas, Grid, Style, Text, Arrange, Advanced
- `NodeTextPanel.tsx` - Bold, Italic, Regular, Normal, Underline, Strikethrough, Overline
- `NodeFillPanel.tsx` - Tint, Adjustments

**Dialog Components**

- `FileDialog.tsx` - Save As, Open, Save, Cancel, Path:, Filename:
- `EditSchemaDialog.tsx` - New schema, Field names
- `CommandPalette.tsx` - Type a command..., No commands found

### Priority 3: Lower-Priority Strings

- Geometry operations: Convert to path, Union, Subtract, Intersect, Exclusive Or, Divide
- Layout algorithms: Tree, Layered, Force-Directed, Orthogonal, Series-Parallel
- Align options: Auto-Align..., Top, Bottom, Left, Right, Center Horizontal, Center Vertical
- Error and debug messages

---

## Implementation Phases

### Phase 1: Main Menu - DONE

1. Replace hard-coded strings in `mainMenuData.ts` with `$tStr` calls - DONE
2. Update `MenuEntry` type to accept `TranslatedString` - DONE
3. Translate labels in `MainMenu.tsx` at render time - DONE
4. Translate labels in `electron.ts` before IPC - DONE

### Phase 2: Context Menus - DONE

1. Replace hard-coded strings in `SelectionContextMenu.tsx` - DONE
2. Replace hard-coded strings in `ConnectedNodesSubmenu.tsx` - DONE
3. Replace hard-coded strings in `GuideContextMenu.tsx` - DONE

### Phase 3: Tool Windows - DONE

1. Replace hard-coded strings in `ObjectToolWindow.tsx` - DONE
2. Replace hard-coded strings in `NodeTextPanel.tsx` - DONE
3. Replace hard-coded strings in `NodeFillPanel.tsx` - DONE

### Phase 4: Dialogs

1. Replace hard-coded strings in `FileDialog.tsx`
2. Replace hard-coded strings in `EditSchemaDialog.tsx`
3. Replace hard-coded strings in `CommandPalette.tsx`

### Phase 5: Actions & Remaining

1. Audit all action files for consistent `$tStr` usage
2. Replace remaining hard-coded strings in geometry/layout/align operations

---

## Files to Modify

| File                                                                            | Phase    |
| ------------------------------------------------------------------------------- | -------- |
| `packages/main/src/react-app/mainMenuData.ts`                                   | 1 - DONE |
| `packages/electron-client-api/src/electron-api.ts`                              | 1 - DONE |
| `packages/main/src/react-app/MainMenu.tsx`                                      | 1 - DONE |
| `packages/main/src/electron.ts`                                                 | 1 - DONE |
| `packages/electron-app/src/menu/menu.ts`                                        | 1 - DONE |
| `packages/main/src/react-app/context-menu-dispatcher/SelectionContextMenu.tsx`  | 2 - DONE |
| `packages/main/src/react-app/context-menu-dispatcher/ConnectedNodesSubmenu.tsx` | 2 - DONE |
| `packages/main/src/react-app/context-menu-dispatcher/GuideContextMenu.tsx`      | 2 - DONE |
| `packages/main/src/react-app/toolwindow/ObjectToolWindow/ObjectToolWindow.tsx`  | 3 - DONE |
| `packages/main/src/react-app/toolwindow/ObjectToolWindow/NodeTextPanel.tsx`     | 3 - DONE |
| `packages/main/src/react-app/toolwindow/ObjectToolWindow/NodeFillPanel.tsx`     | 3 - DONE |
| `packages/main/src/react-app/toolwindow/ObjectToolWindow/FillPanel.tsx`         | 3 - DONE |
| `packages/main/src/react-app/dialogs/FileDialog.tsx`                            | 4        |
| `packages/main/src/react-app/dialogs/EditSchemaDialog.tsx`                      | 4        |
| `packages/main/src/react-app/toolwindow/CommandPalette.tsx`                     | 4        |
| Action files in `packages/canvas-app/src/actions/`                              | 5        |
| Action files in `packages/main/src/react-app/actions/`                          | 5        |

---

## Future: Translation File Structure

Locale files and translation loading will be added in a future phase. The `$tStr` function's second
argument serves as the English fallback until then.
