# Dashboard Widget Container Queries

This document defines where dashboard widgets should hook into CSS container queries and the
naming/breakpoint conventions to use, so individual widgets don't each invent their own approach.

```
/**
 *  WidgetFrame - .frame
 *  | Header - .header (outside the query container: icon, title, controls)
 *  | Body - .body (container-type: inline-size; container-name: frame; data-frame="true")
 *  |   | <widget content>
 */
```

## Summary

- The query container is `WidgetFrame`'s `.body` element
  (`arch-register-packages/web/src/sections/dashboard/widgets/WidgetFrame.module.css`), not
  `WidgetFrame`'s own `.frame` root and not each widget's own root.
- Containment is `inline-size` only. No widget currently needs block-size (height) queries.
- The container is named `frame`: `container-name: frame`. Widget content should query
  `@container frame (...)`, never an anonymous/unnamed container query, so queries keep resolving
  to the `WidgetFrame` boundary even if a nested component later declares its own container.
- `.body` also carries `data-frame="true"`, for the (rarer) cases where a plain descendant-combinator
  override reads better than a container query — e.g. unconditionally stripping a component's own
  chrome whenever it's rendered inside a frame, with no width threshold involved.
- `.body` exposes its own padding as `--_frame-top-padding` / `--_frame-left-padding` custom
  properties (currently `8px` / `10px`). Content that wants to bleed past the frame's padding to the
  container's edge can cancel it locally, e.g.:
  ```css
  div[data-frame="true"] .fullBleed {
    margin: calc(-1 * var(--_frame-top-padding, 0px)) calc(-1 * var(--_frame-left-padding, 0px));
  }
  ```
  The `, 0px` fallback keeps this a no-op when the component renders outside a frame (the variable
  is simply undefined there). The leading `_` follows this codebase's convention for
  locally-scoped/contextual custom properties, as opposed to shared design tokens like `--panel-bg`.
- This convention isn't limited to components under `mdx-components/`: any component that may render
  as widget content — including screens that primarily live elsewhere, like
  `WorkspaceAnalyticsScreen`'s sections reused via `EntityActivityTrendChartWidget` — is expected to
  use `[data-frame="true"]` / `@container frame` rather than reinventing its own signal, since both
  are anchored to the same `WidgetFrame` boundary regardless of where the content itself is defined.
- Three breakpoint tiers are the shared vocabulary for widget authors:
  - `compact`: `max-width: 220px` — roughly a 1-column grid allocation.
  - `comfortable`: `221px`–`420px` — roughly 2–3 columns.
  - `spacious`: `min-width: 421px` — 4+ columns.
- Adopting the base container (i.e. this `.body` change) does not require any individual widget to
  add `@container` rules or change behavior. Widgets opt in incrementally by adding their own
  `@container frame (...)` rules scoped to their own module.
- Container queries are CSS-only by default. Reach for `ResizeObserver` only for behavior CSS can't
  express (e.g. computing a numeric pixel value for a non-CSS API, the way `DashboardGrid.tsx` feeds
  `react-grid-layout`'s required `width` prop). Do not use `ResizeObserver` just to react to a
  widget's own size when a container query would do.

## Details

### Why `.body`, not `.frame` or the widget root

`WidgetFrame` renders a `.header` (icon, title, edit/remove controls) and a `.body` (the widget's
`component` slot). Using `.frame` (the outer element) as the query container would mix the header's
own width needs into the same containment context as the widget content, and would force every
widget to re-derive how much of the frame's padding/border to subtract. Using each widget's own root
as the container would mean every widget declares its own `container-type`, with no shared name and
no guarantee that nested components don't collide. Note `.frame` is just a CSS class name on
`WidgetFrame`'s outer element — unrelated to the `frame` container/attribute name, which is anchored
one level down at `.body`.

Anchoring the container at `.body` gives every widget the same, predictable containment box:

- Header height and the frame's border/border-radius are outside the container, so they never
  affect width-based `@container` decisions.
- `.body`'s own padding (`--_frame-top-padding` / `--_frame-left-padding`) is subtracted
  automatically — the CSS container-query box model measures the container's own content-box, so
  widget authors query against the space actually available to their content, not the frame's outer
  size.
- The same container applies whether the widget is a dashboard-specific component
  (`ActivityFeedWidget`, `UpcomingMilestonesWidget`, `MarkdownWidget`, ...) or an MDX-backed
  component that also opts into dashboards via `dashboardWidget` in `mdxRegistry.tsx`
  (`EntityCardWidget`, `StatMetricWidget`, `EntityTableWidget`, ...), since both render through the
  same `DashboardWidgetRenderer` → `WidgetFrame` path.

### Nested containers

Some widget-internal components already establish (or may in future establish) their own container
(for example `packages/app-components/src/MultiSelect.module.css` uses an anonymous
`container-type: inline-size`). To avoid ambiguity:

- The `frame` name is reserved for the `WidgetFrame.body` boundary. Nested components must not
  redeclare `container-name: frame`.
- Nested components that need their own containment should either stay anonymous (as
  `MultiSelect` does today) or pick a distinct, component-scoped name.
- `@container frame (...)` queries always target the nearest ancestor named `frame`, so as long as
  nested components follow the rule above, widget content can safely query the `WidgetFrame`
  boundary from any depth.

### Height

`DashboardGrid.tsx` sizes widgets in whole multiples of `GRID_ROW_HEIGHT` (80px), controlled per
widget via `defaultH`/`defaultW` in each `*Registration.tsx`. Height therefore already varies in
coarse, widget-author-controlled steps rather than needing fluid adaptation, so `container-type`
stays `inline-size`-only for now. If a concrete need for height-based queries appears, extending
`container-type` to `size` (or `inline-size` + a separate block-size container deeper in the tree)
is an additive change — it does not require revisiting the boundary or naming decisions above.
