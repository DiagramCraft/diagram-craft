---
sidebar_position: 2
title: Command Palette
sidebar_label: Command Palette
---

![Diagram Craft command palette searching editor actions and shortcuts](/img/diagram-craft/user-interface/command-palette.png)

# Command Palette

The command palette is the fastest way to run an action when you know what you want to do but do not remember where the control lives.

## When To Use It

The palette is especially useful when you want to:

- jump to a command instead of scanning menus
- confirm whether an action exists in the current build
- discover the shortcut for an action you already use with the mouse

Open it with `Command+K`.

## How Search Works

The palette filters actions by:

- the user-facing action name
- the internal action id
- the resolved shortcut text

That means you can search by intent such as `preview`, by a known action name, or by part of a keybinding.

## Result Behavior

- Enabled actions sort ahead of disabled ones.
- Disabled actions can still appear in the results, which is useful when the action exists but the current selection or document state does not support it.
- Press `Arrow Up` and `Arrow Down` to move through results, then `Enter` to run the selected action.

## Good Uses In Daily Work

- Open **Preview** without leaving the keyboard.
- Run alignment or layout commands when you remember the action but not the menu location.
- Find panel-related actions and confirm their shortcuts.

## What It Is Not

The command palette is an action launcher, not a global content search surface. If you are looking for nodes, labels, or metadata inside the current diagram, use the **Search** tool window instead.

## Related Reading

- [Keyboard Shortcuts](./keyboard-shortcuts)
- [Keyboard Shortcuts Reference](../reference/keyboard-shortcuts-reference)
