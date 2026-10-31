# Color tokens in Arch Register

How to pick foreground (text/icon) colors in `web/` CSS modules and inline styles. The tokens are defined in
`packages/main/src/tokens.css` (themes) and `web/src/tokens.css` (the `.surface` nesting rules).

## 1. Match the foreground to the background it sits on

Use the foreground family that belongs to the background token you are painting on:

| Background | Foreground tokens |
|---|---|
| `--base-bg` (page / app canvas) | `--base-fg`, `--base-fg-secondary`, `--base-fg-tertiary`, `--base-fg-dimmed` |
| `--panel-bg` (cards, panels, sidebars) | `--panel-fg`, `--panel-fg-secondary`, `--panel-fg-tertiary`, `--panel-fg-dimmed` |
| `--cmp-bg` (inputs, buttons, chips, other controls) | `--cmp-fg`, `--cmp-fg-secondary`, `--cmp-fg-tertiary`, `--cmp-fg-dimmed`, `--cmp-fg-disabled` |
| Solid accent / status fill (`--accent-fg`, `--warning-fg`, `--green`, ...) | `--inverse-fg` |

Borders follow the same rule: `--panel-border` on panels, `--cmp-border` on controls.

## 2. If you don't know the background, use `--fg-*`

Shared and reusable components (rows, tables, widgets, anything dropped into different containers) often cannot
know whether they end up on base, panel or component background. They should use the surface-relative tokens:

`--fg`, `--fg-secondary`, `--fg-tertiary`, `--fg-dimmed`

These resolve to the `base-fg*` or `panel-fg*` set depending on the enclosing `.surface` nesting level, so the
text keeps the right contrast when a component moves between a page and a panel. Prefer them over hard-coding
`--base-fg` / `--panel-fg` unless the background is fixed and known.

Typical case: you own the element *and* its `background` in the same rule, so use the matching family. Otherwise
use `--fg-*`.

## 3. Choosing the level (base and panel)

| Level | Use for |
|---|---|
| `fg` | Truly primary content: the thing the user came to read (titles, names, main values) |
| `fg-secondary` | The default for ordinary text: body copy, labels, descriptions |
| `fg-tertiary` | Supplemental data: metadata, timestamps, counts, hints, helper text |
| `fg-dimmed` (and `*-dimmed`) | Even more supplemental: placeholders, separators, empty-state filler, de-emphasised icons |

Don't use a lower level just to "look lighter": dimming signals lower importance, and anything the user must act
on or read should not be tertiary or dim. `--cmp-fg-disabled` is only for disabled controls, not for general
"muted" text.

## 4. Semantic colors

Meaning, not hierarchy, so they are not part of the levels above:

- `--accent-fg` (+ `-hover`): links, selection, active state
- `--error-fg`, `--warning-fg`, `--green`: status/severity
- `--inverse-fg`: text on top of a solid fill in one of these colors (pills, badges, count bubbles)

## 5. Don't

- Invent tokens (`--text-muted`, `--text-primary`, `--danger`, `--success-fg`, ...). They don't exist and fall
  back silently.
- Hard-code colors (`white`, `#fff`, `oklch(...)`) for text.
- Use background tokens as text color (`color: var(--base-bg)`); use `--inverse-fg`.
- Add a global utility class for muted text (the old `.dim`); put `color: var(--fg-dimmed)` (or the right level) on
  the semantic class of the element.
