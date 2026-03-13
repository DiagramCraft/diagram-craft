# CSS Guidelines

This document summarizes the CSS conventions currently used in Diagram Craft based on the styles in
`packages/app-components`, `packages/main`, and `packages/canvas`.

## Summary

- Start new reusable UI with a `c*` root class.
- Start new app-internal UI with an `ic*` root class.
- Name child parts with `e*` and nest them according to the DOM.
- Use camelCase for all class names.
- Prefer data attributes for variants and state.
- Prefer theme tokens and CSS variables over hard-coded colors.
- Use `:global(...)` only for deliberate shared `c*` component hooks.
- Add a short structure comment at the top of reusable component stylesheets.

### Avoid

- Modifier class systems like `component--active` when a data attribute is already appropriate.
- Flat, repeated selectors when nested selectors express the same structure more clearly.
- Introducing broad utility classes for styles that are only used by a single component.
- Styling through tag selectors when the style is really component-specific.

## Details

### Naming

- Reusable component root classes start with `c`, for example `cButton`, `cTextInput`, `cToolbar`.
- Internal app-specific component root classes start with `ic`, for example `icSidebar`, `icCommandPalette`,
  `icCommentItem`.
- Utility classes start with `u`. These are rare and should stay narrowly scoped, for example `uScaleStrokes`.
- Internal elements within a component start with `e`, for example `eContent`, `eButton`, `eSearchInput`.
- Class names use camelCase.

### Component Structure

- Prefer one root class per component and nest all internal selectors inside that root.
- Internal `e*` elements should follow the HTML structure. Nest selectors to reflect actual DOM nesting.
- Keep element names semantic to the component, for example `eHeader`, `eButtons`, `eReplyTextArea`.
- When a stylesheet has multiple roots, they usually represent closely related parts of the same feature, for example
  trigger and portal content.

Example:

```css
.cDialog {
  .eContent {
  }

  .eButtons {
    .eButton {
    }
  }
}
```

### Document the Expected Structure

- For reusable components, start the file with a short comment that describes the component tree and key data
  attributes.
- Use that header to show the root class, child elements, and portal content when relevant.

Example:

```css
/**
 *  Dialog - .cDialog
 *  | Title - .eTitle
 *  | Content - .eContent
 *  | Buttons - .eButtons
 */
```

### Scope First, Global Only When Needed

- Prefer CSS modules and local scoping by default.
- Only reusable components with a `c*` prefix should normally be exposed with `:global(...)`.
- Use `:global(...)` only when a `c*` class is intentionally shared across modules or exposed as a styling contract.
- Global classes are used for public component hooks such as `cTabs`, `cToggleButtonGroup`, and `cSelectTrigger`.
- If a selector can stay local to one module, keep it local.

### State Styling

- Prefer data attributes for component state and variants instead of modifier classes.
- Common patterns in the repo:
    - `data-variant`
    - `data-state`
    - `data-focus`
    - `data-hover`
    - `data-active`
    - `data-disabled`
    - `data-selected`
- Put state selectors next to the base selector they modify.
- Use native pseudo-classes alongside data attributes when both matter, for example `:focus` and `[data-focus="true"]`.

Example:

```css
.cButton {
  &[data-variant="danger"] {
  }

  &:focus,
  &[data-focus="true"] {
  }
}
```

### Theme and Token Usage

- Prefer CSS custom properties over hard-coded values for colors, borders, backgrounds, shadows, and radii.
- Use the shared theme tokens from `packages/main/src/App.css` for app styling, especially:
    - `--panel-*`
    - `--cmp-*`
    - `--accent-*`
    - `--base-*`
    - `--canvas-*`
    - `--error-fg`, `--warning-fg`
- Reusable components should consume these tokens instead of defining their own color system.
- Hard-coded values are mostly acceptable for layout, spacing, sizing, and one-off animation details.

### Local CSS Variables

- Use local CSS variables to express component-level variations.
- Use a single local variable pattern: `--_name`.
- Keep these local variables close to where they are used.
- Use them for component-local configuration and computed values.

Examples from the repo:

```css
--_button-border
--_padding
--_width
--_size
```

### Nesting

- Prefer nested selectors over repeating the full class name.
- Keep nesting aligned with structure and state. Do not nest unrelated selectors just because you can.
- Use direct-child selectors like `>` when the structure matters.

### Cross-Component Styling

- Styling another component from the outside is allowed, but it should be explicit and limited to stable public hooks.
- When doing this from a CSS module, target the public class through `:global(...)`.
- Avoid reaching into another component's private internal structure unless there is already an established pattern for
  it.

### Utilities

- Utility classes are the exception, not the default.
- Create a `u*` class only when the behavior is intentionally reusable and independent of one specific component.
- If the style belongs to one component, keep it under that component root instead of extracting a utility.
