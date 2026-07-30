# Dashboard Widget Container Queries

This document defines where dashboard widgets should hook into CSS container queries and the
naming/breakpoint conventions to use, so individual widgets don't each invent their own approach.

```
/**
 *  WidgetFrame - .frame
 *  | Header - .header (outside the query container: icon, title, controls)
 *  | Body - .body (container-type: inline-size; container-name: widget)
 *  |   | <widget content>
 */
```

## Summary

- The query container is `WidgetFrame`'s `.body` element
  (`arch-register-packages/web/src/sections/dashboard/widgets/WidgetFrame.module.css`), not `.frame`
  and not each widget's own root.
- Containment is `inline-size` only. No widget currently needs block-size (height) queries.
- The container is named `widget`: `container-name: widget`. Widget content should query
  `@container widget (...)`, never an anonymous/unnamed container query, so queries keep resolving
  to the `WidgetFrame` boundary even if a nested component later declares its own container.
- Three breakpoint tiers are the shared vocabulary for widget authors:
  - `compact`: `max-width: 220px` — roughly a 1-column grid allocation.
  - `comfortable`: `221px`–`420px` — roughly 2–3 columns.
  - `spacious`: `min-width: 421px` — 4+ columns.
- Adopting the base container (i.e. this `.body` change) does not require any individual widget to
  add `@container` rules or change behavior. Widgets opt in incrementally by adding their own
  `@container widget (...)` rules scoped to their own module.
- Container queries are CSS-only by default. Reach for `ResizeObserver` only for behavior CSS can't
  express (e.g. computing a numeric pixel value for a non-CSS API, the way `DashboardGrid.tsx` feeds
  `react-grid-layout`'s required `width` prop). Do not use `ResizeObserver` just to react to a
  widget's own size when a container query would do.

## Details

### Why `.body`, not `.frame` or the widget root

`WidgetFrame` renders a `.header` (icon, title, edit/remove controls) and a `.body` (the widget's
`component` slot). Using `.frame` as the container would mix the header's own width needs into the
same containment context as the widget content, and would force every widget to re-derive how much
of the frame's padding/border to subtract. Using each widget's own root as the container would mean
every widget declares its own `container-type`, with no shared name and no guarantee that nested
`c*` components don't collide.

Anchoring the container at `.body` gives every widget the same, predictable containment box:

- Header height and the frame's border/border-radius are outside the container, so they never
  affect width-based `@container` decisions.
- `.body`'s own `padding: 8px` is subtracted automatically — the CSS container-query box model
  measures the container's own content-box, so widget authors query against the space actually
  available to their content, not the frame's outer size.
- The same container applies whether the widget is a dashboard-specific component
  (`ActivityFeedWidget`, `UpcomingMilestonesWidget`, `MarkdownWidget`, ...) or an MDX-backed
  component that also opts into dashboards via `dashboardWidget` in `mdxRegistry.tsx`
  (`EntityCardWidget`, `StatMetricWidget`, `EntityTableWidget`, ...), since both render through the
  same `DashboardWidgetRenderer` → `WidgetFrame` path.

### Nested containers

Some widget-internal components already establish (or may in future establish) their own container
(for example `packages/app-components/src/MultiSelect.module.css` uses an anonymous
`container-type: inline-size`). To avoid ambiguity:

- The `widget` name is reserved for the `WidgetFrame.body` boundary. Nested components must not
  redeclare `container-name: widget`.
- Nested components that need their own containment should either stay anonymous (as
  `MultiSelect` does today) or pick a distinct, component-scoped name.
- `@container widget (...)` queries always target the nearest ancestor named `widget`, so as long as
  nested components follow the rule above, widget content can safely query the `WidgetFrame`
  boundary from any depth.

### Height

`DashboardGrid.tsx` sizes widgets in whole multiples of `GRID_ROW_HEIGHT` (80px), controlled per
widget via `defaultH`/`defaultW` in each `*Registration.tsx`. Height therefore already varies in
coarse, widget-author-controlled steps rather than needing fluid adaptation, so `container-type`
stays `inline-size`-only for now. If a concrete need for height-based queries appears, extending
`container-type` to `size` (or `inline-size` + a separate block-size container deeper in the tree)
is an additive change — it does not require revisiting the boundary or naming decisions above.
