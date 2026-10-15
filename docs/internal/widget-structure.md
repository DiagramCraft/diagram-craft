# Widget Structure

A *widget* is a single component definition (`defineWidget`) that can be exposed on one or both
surfaces: as an MDX component in the markdown editor (`mdx`) and as a dashboard widget
(`dashboard`). All widgets live under `arch-register-packages/web/src/widgets/` and are organised
by **category**, not by surface.

## Layout

```
web/src/widgets/
  shared/                  # cross-widget infrastructure and helpers
    defineWidget.ts, widgetRegistry.ts, widgetCategories.ts, types.ts, configSchema.ts, ...
    mdx/                   # base editables, harness, config dialog used by MDX surfaces
    dashboard/             # WidgetFrame, renderer, frame settings, nested widgets
    data/                  # helpers shared by several widgets (aggregation, assessment summaries)
  metrics/<widget>/
  data-views/<widget>/
  visualizations/<widget>/
  content-layout/<widget>/
  basic-blocks/<widget>/
```

The directory name is the widget's `category` (see `shared/widgetCategories.ts`); changing a
widget's category means moving its folder. Folder names are kebab-case.

## Files in a widget folder

Only the files a widget needs exist.

| File                                | Purpose                                                              | Surface   |
| ----------------------------------- | -------------------------------------------------------------------- | --------- |
| `Foo.widget.tsx`                    | `defineWidget(...)`; the only file the registry discovers (glob)     | all       |
| `Foo.tsx`                           | The React view                                                       | all       |
| `types.ts`                          | Config type, defaults and zod schema                                 | all       |
| `fooLogic.ts` / `fooLogic.test.ts`  | Pure logic and its tests                                             | all       |
| `FooConfigForm.tsx` (+ `.module.css`) | Config form, used by both dashboard and MDX config dialogs         | all       |
| `Foo.module.css`, `Foo.stories.tsx` | Styles and stories                                                   | all       |
| `FooEditable.tsx`                   | MDX editor wrapper (Plate element)                                   | mdx only  |
| `FooCodec.ts`                       | MDX serialisation when it isn't trivial                              | mdx only  |

Which surfaces a widget is on is expressed only by the `mdx` / `dashboard` keys in
`Foo.widget.tsx`, so a widget can gain a surface without moving.

## Rules of thumb

- A helper used by one widget lives in its folder; used by several, in `shared/` (`shared/data/`
  for domain data helpers).
- Widgets that are two definitions of the same concept (e.g. MDX Tabs and dashboard Tabs) may share
  a folder.
- Persisted identifiers (`DashboardWidget.type`, MDX tag names) are independent of folder and file
  names and must not change when files move.
- Container-query conventions for dashboard content are in
  [dashboard-widgets.md](./dashboard-widgets.md).
