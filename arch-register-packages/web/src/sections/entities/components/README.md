# Entity Browser

`EntityBrowser.tsx` is the main entity list/search screen (`/entities` and the "Entities" tab on a
project). It combines a shared toolbar, a set of interchangeable view modes, and paging into one
component. The same view components are reused, in a reduced form, by the `entity-browser-embed`
MDX block so wiki pages can show a live (or static, published) snapshot of a saved view.

## State

- `useEntityBrowserLocalState` holds the router-agnostic state machine: search text, filter
  conditions, sort, project scope, active view, and per-view `viewConfigs`.
- `useEntityBrowserSearchState` wraps it and layers URL syncing (`useNavigate`/`useSearch`) on top.
  `EntityBrowser.tsx` uses this; anything that needs the state without a router (the embed edit
  dialog) uses `useEntityBrowserLocalState` directly.
- `useEntityBrowserData` fetches/filters the entity list; `useEntityBrowserPagination` handles
  paged browsing for `table`/`cards` when sorted by name.

## View modes

Views live directly in this folder: `TableView`, `CardsView`, `TreeView`, `RadarView`,
`TimelineView`, `MatrixView`, `HierarchyView`, `ExploreView`. There are two prop shapes:

- `EntityBrowserBaseViewProps` (`entityBrowserViewShared.tsx`) — used by `TableView`/`CardsView`
  (and, with its own local prop type, `TreeView`). Includes `onDelete`/`onClone`/row menu support.
- `EntityBrowserRowViewProps` (`entityBrowserViewTypes.ts`) — used by the "row visualisation"
  views (`Radar`/`Timeline`/`Matrix`/`Hierarchy`/`Explore`). These take `rows`, `onEntityClick`,
  an opaque per-view `config`, and `onConfigChange`.

`EntityBrowser.tsx` deliberately keeps the view switch as a long `view === '...' ? <X /> : ...`
chain rather than a lookup table, because each view wants a different subset of props (see below) —
do not try to collapse this into a generic `Record<ViewMode, Component>` map.

## Consumers of the view components

There are three places that render these view components, each with different constraints:

1. **`EntityBrowser.tsx`** — the full interactive browser. Passes real mutation handlers
   (`onDelete`, `onClone`, row selection), a real `onConfigChange` that persists to the URL/saved
   view, and lets users freely reconfigure a view via its internal toolbar.
2. **`EntityBrowserEmbedDialog.tsx`** (`markdown/mdx-components/blocks/entity-browser-embed/`) —
   the "click to edit" dialog for the `entity-browser-embed` MDX block. Reuses
   `useEntityBrowserLocalState` and `EntityBrowserToolbar` so the same search/filter/sort/view UI
   works without a router. Row-level mutation (`onDelete`/`onClone`/`onEntityClick`) is `noop`'d and
   `readOnly` is passed to `TableView`/`CardsView`/`TreeView`, because this dialog only exists to
   produce a `config` to save — editing entities here would be confusing. Each view's own internal
   toolbar (e.g. Radar's Configure button, Explore's relation-field toggles) is left **visible**
   here, since that's how the config actually gets set.
3. **`EntityBrowserEmbed.tsx`** (same folder) — the published, read-mode render of a saved
   `entity-browser-embed` block. Same `readOnly`/`noop` treatment as the dialog, but additionally
   passes `hideToolbar` to the row-visualisation views, since the page should show a clean static
   snapshot, not another set of controls to fiddle with. `onEntityClick` navigates to the entity
   detail page (a no-op won't do, unlike the dialog).

If you're inspecting the embed config JSON, see `EntityBrowserEmbedCodec.ts`: it's a small
base64url(JSON) codec, not the ordinary URL-param encoding — it exists because the MDX prop
sanitizer's `SAFE_PROP_VALUE` regex strips `{ } " : [ ]` on re-parse, and base64url's alphabet
survives that filter.

## Things to check when adding a new view mode

- **Prop shape**: does the view need row mutation/menus (`EntityBrowserBaseViewProps`) or is it a
  pure visualisation over `rows` with its own `config` (`EntityBrowserRowViewProps`)? Match the
  existing convention rather than inventing a third shape.
- **`readOnly` (Table/Cards/Tree only)**: if your view exposes row selection or a "..." row menu,
  respect a `readOnly?: boolean` prop and drop the checkbox column / menu column entirely — don't
  just disable them, since a visibly-dead control is worse than no control in the published embed.
- **`hideToolbar` (Radar/Timeline/Matrix/Hierarchy/Explore only)**: if your view has its own inline
  settings/search bar, gate it behind `hideToolbar?: boolean`. `EntityBrowserEmbed.tsx` passes this;
  `EntityBrowser.tsx` and `EntityBrowserEmbedDialog.tsx` don't.
- **Wire it into all three consumers**: `EntityBrowser.tsx`'s view switch, the embed dialog's
  preview, and `EntityBrowserEmbed.tsx`'s read-mode switch. It's easy to add a view to the live
  browser and forget the embed — check all three `view === '...'` switches.
- **`config`/`onConfigChange`**: `config` is untyped (`unknown`) at the prop boundary and validated
  internally with a zod schema per view (see `@arch-register/api-types/viewContract`); do the same
  for a new view rather than trusting the caller. `onConfigChange` must be safe to no-op (embed/
  dialog readOnly paths call it with `noop`), so don't rely on it always actually persisting.
- **`linkedEntityIds`**: several views use this (optional) prop to dim entities that aren't part of
  the current project scope. Only relevant when rendered from a project's entities tab.
- **Update `EntityBrowserEmbedCodec.ts`/tests** if the view needs new fields in its saved config —
  `viewConfigs` is serialized per-view-mode and round-tripped through the codec's tests
  (round-trip, malformed input, and `SAFE_PROP_VALUE` compliance).
