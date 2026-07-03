---
sidebar_position: 5
---

import ThemedImage from '@theme/ThemedImage';

# Dark Mode

Diagram Craft supports light and dark presentation, and the current theme affects both the canvas chrome and the surrounding editor UI.

<ThemedImage
  alt="Diagram Craft editor in light and dark themes"
  sources={{
    light: require('/img/diagram-craft/user-interface/editor-layout-light.png').default,
    dark: require('/img/diagram-craft/user-interface/editor-layout-dark.png').default,
  }}
/>

## Default Behavior

When there is no saved preference yet, the user state defaults to `system`. In practice that means a fresh session can follow the operating system color-scheme preference until you explicitly switch themes.

## Switching Themes

The current app exposes a **Toggle Dark Mode** action. Once you toggle it, the stored preference becomes an explicit light or dark choice rather than “follow system”.

That is useful when you want predictable appearance for presentations, screenshots, or long editing sessions.

## Why Use Dark Mode

Dark mode is especially helpful when:

- you work on dense diagrams for long sessions
- you present on large screens in darker rooms
- bright chrome around the canvas is more distracting than helpful

Light mode is often still better for exported screenshots that will be embedded into broader light-themed documentation.

## Persistence

The preference is stored in Diagram Craft user state, so reopening the app keeps the last explicit choice.

## Screenshot Expectations

Documentation screenshots may appear in both themes when the visual difference matters. That is intentional: it helps users recognize the editor regardless of their current preference.
