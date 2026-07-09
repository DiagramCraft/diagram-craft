# Embedding diagram-craft

This document describes the supported way to embed the diagram-craft editor into a host
application, as used by both the standalone app (`packages/main/src/main.tsx`) and
arch-register (`arch-register-packages/web`).

## Consumption model

There is no npm package yet for diagram-craft. Host apps in this monorepo consume it via
direct deep imports through the workspace's tsconfig path aliases — the same convention
used throughout the codebase (`@diagram-craft/main/...`, `@diagram-craft/model/...`, etc.).
There is no barrel `index.ts`; import each entry point from its specific file.

## Entry points

- `@diagram-craft/main/embed/bootstrapDiagramCraft` — the init facade. Builds the global
  config (`AppConfig`, `CollaborationConfig`, `Autosave`, stencil/file loader registries)
  and returns the factories/registries needed to load and render documents.
- `@diagram-craft/main/embed/loadDocument` — document-loading orchestration (CRDT
  connect, autosave restore, file loading, data-provider policy application, optional
  content seeding).
- `@diagram-craft/main/embed/registerStencils` — pre-registers lazy stencil loaders on a
  document so stencils referenced by a diagram but not included by default can still be
  lazy-loaded on demand.
- `@diagram-craft/main/EmbeddableEditor` — the editor React component.
- `@diagram-craft/main/embed/embed.css` — explicit styles entry (see CSS section below).

## Single-instance-per-page constraint

**Only one editor configuration is supported per page.** `AppConfig`, `CollaborationConfig`,
`Autosave`, and the stencil/file loader registries are module-scope globals
(`packages/main/src/appConfig.ts`) — there is no per-instance scoping. `bootstrapDiagramCraft()`
enforces this: calling it again with a different `collaboration` / `autosave` / `stencils` /
`fileLoaders` / `elementDefinitions` / `textHandlers` config throws, since a second
`AppConfig.set()` would otherwise silently clobber config out from under an already-mounted
editor. `ai`, `awareness`, and `filesystem` are the exception — they can legitimately change
between calls (e.g. arch-register's AI endpoint changing on workspace switch) and route
through the returned `updateConfig()` instead.

De-globalizing this is a larger effort blocked at several layers (the `model` singleton in
canvas modelState, `CollaborationConfig`, `AppConfig.get()` used across 15+ react-app files,
`Autosave`/`UserState`) and is out of scope for the embedding API as it exists today.

## Basic usage

```ts
const instance = bootstrapDiagramCraft({
  collaboration: { backend: 'yjs', url: wsUrl },
  ai: { provider: 'remote', endpoint: `/api/${workspaceId}` }
});

const { doc, disconnect, awareness } = await loadDocument({
  url: roomName,
  userState,
  documentFactory: instance.documentFactory,
  diagramFactory: instance.diagramFactory,
  dataProviders: {
    providers: () => [myDataProvider],
    includeDefaultProvider: false
  }
});

registerDocumentStencils(doc, instance.stencilConfig);

// later, on unmount:
disconnect();
doc.release();
```

`disconnect()` wraps `CollaborationConfig.Backend.disconnect()` plus releasing the document —
hosts do not need to import `CollaborationConfig` directly.

## Config reference

See the `DiagramCraftConfig` type in `embed/bootstrapDiagramCraft.ts` for the full set of
options (collaboration backend, autosave, awareness, AI, filesystem, stencils, file loaders,
element definitions, text handlers). Standalone additionally has an escape hatch —
`bootstrapDiagramCraft({ appConfig })` — to install a fully-built `AppConfig` as-is; this is how
`initial-loader.ts` keeps `appConfig.default.ts` and the `@diagram-craft/config` vite-alias
mechanism without a lossy mapping through `DiagramCraftConfig`.

`DiagramCraftConfig.state` (a custom localStorage key for `UserState`) is intentionally not
part of the current API — `UserState.ts` hardcodes its storage key today and nothing reads a
configurable one. Add it if a host needs it.

### Extending the default stencils / file loaders

`stencils` and `fileLoaders` are a **full replace, not a merge** — passing either entirely
replaces the built-in defaults rather than extending them. `embed/defaults.ts` exports the
pieces used to build those defaults so hosts can compose on top of them instead:

- `embedStencilConfig(opts?: { stencilRoot?: string })` — the `basic`-loader stencil packs
  (always included) plus, when `stencilRoot` is passed, the Draw.io XML-based packs
  (GCP/AWS/Azure/etc.), whose asset URLs are resolved as `` `${stencilRoot}/stencils/*.xml` ``.
  Omit `stencilRoot` entirely to skip the Draw.io packs (there's nowhere to fetch their
  assets from otherwise). `bootstrapDiagramCraft`'s own default calls this with no `stencilRoot`.
- `makeEmbedFileLoaders(getIncludedPackages: () => string[])` — `.json`, `.dcd`, `.drawio`,
  and `.diagramCraft.svg` file loaders.

```ts
bootstrapDiagramCraft({
  stencils: [...embedStencilConfig({ stencilRoot: 'https://cdn.example.com/stencils' }), ...myExtras],
  fileLoaders: makeEmbedFileLoaders(() => myIncludedPackages)
});
```

A host resolving `stencilRoot` to a value that isn't already fully addressable by `fetch()`
(e.g. a relative path proxied through a backend) needs its own `FileSystem.loadFromUrl`
override — see `appConfig.default.ts`'s `isStencilAssetUrl` check for the pattern standalone
uses to route stencil-asset URLs around its `/api/fs/` remote-filesystem proxying.

## Data-provider seam

Hosts that want to supply their own `DataProvider`s (instead of the CRDT-deserialized
default) pass a `DataProviderPolicy` via `loadDocument`'s `dataProviders` option:

```ts
type DataProviderPolicy = {
  providers: () => DataProvider[]; // called on construction and on remote CRDT provider writes
  includeDefaultProvider?: boolean; // default true
};
```

When a policy is active, the CRDT `provider` key is never written to and remote writes from
other (policy-less) collaborators are ignored — the policy always wins. This is what lets
arch-register serve its own `UrlDataProvider`-backed public schemas without those choices
being overwritten by collaborative sync, and without the reconciliation workaround
(`suppressDefaultProvider`/`enforcePublicProvider`) that `DiagramScreen.tsx` used before this
seam existed.

## CSS / theming

- Import `@diagram-craft/main/embed/embed.css` once per page. It re-exports `App.css` +
  `EmbeddableEditor.css`.
- **Standalone does not import `embed.css`.** `App.tsx` (which standalone renders instead of
  `EmbeddableEditor` directly) already self-imports `App.css`, and standalone never renders
  `EmbeddableEditor`, so it has no need for `EmbeddableEditor.css` either. Only hosts that
  render `EmbeddableEditor` directly (arch-register) need the explicit `embed.css` import.
  Don't "fix" this by adding the import to `main.tsx` — it would just double-load `App.css`.
- `EmbeddableEditor`'s `wrapperClassName` defaults to `'dc dc-embeddable-editor'`, so hosts
  don't need to know about the `.dc` root-scoping convention used by diagram-craft's CSS.
  Pass `wrapperClassName={null}` to opt out (standalone does this, since it already has a
  `.dc`-scoped ancestor via its own layout).
- `EmbeddableEditor`'s `configuration` prop (palette, fonts) defaults to the same palette
  standalone uses; pass a custom `ConfigurationContextType` to theme it per host.

## Document lifecycle

- `loadDocument()` returns `{ doc, url, disconnect, awareness }`.
- On unmount, hosts should call `disconnect()` and `doc.release()` (and `doc.deactivate()` if
  the host doesn't already rely on `disconnect()` alone — both ultimately call
  `CollaborationConfig.Backend.disconnect()`, so calling both is safe but redundant).
- `loadDocument`'s `seedContent` hook (used to deserialize host-owned content into a freshly
  created CRDT document) only runs when the resulting document has zero diagrams — i.e. this
  client is the first to connect to the room. A collaborator joining an already-populated room
  never re-seeds over synced state.

## Deferred / out of scope

- `registerDrawioBaseNodeTypes` — after this refactor the manual call lives in exactly one
  place (`bootstrapDiagramCraft`); further lazy-loading investigation is orthogonal.
- Multi-instance / de-globalization (see above).
- npm publishing / package exports maps.
