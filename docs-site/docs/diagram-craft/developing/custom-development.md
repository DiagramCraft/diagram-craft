---
sidebar_position: 1
---

# Custom Development

Diagram Craft is designed as a pnpm monorepo with a small runtime surface in the app and most behavior pushed into reusable packages. If you want to extend the editor, start by understanding which layer you are changing and wire that layer into the main app deliberately.

## Start With The Repo Layout

From the repo root, the main extension points are:

- `packages/main`: the browser app, Vite config, app boot, and app-level configuration
- `packages/canvas-app`: the default node, edge, and stencil registries used by the app
- `packages/canvas`, `packages/model`, `packages/collaboration`: shared rendering, model, and collaboration infrastructure
- `packages/canvas-nodes` and `packages/canvas-edges`: reusable built-in node and edge definitions
- `packages/stencil-*`: notation-specific stencil packages such as BPMN, UML, C4, ArchiMate, and data modelling
- `packages/canvas-drawio`: Draw.io import support and Draw.io-backed stencil loading

For API-level details, use the generated docs under the [API](../api) section after running `pnpm docs:typedoc` if you need refreshed output.

## How The App Boots

The browser app starts in `packages/main/src/main.tsx`. At startup it:

1. Loads `AppConfig` from `packages/main/src/initial-loader.ts`.
2. Builds the default node, edge, and stencil registries from `@diagram-craft/canvas-app/defaultRegistry`.
3. Adds lazy element-definition loaders from `AppConfig.elementDefinitions.registry`.
4. Registers file loaders, stencil loaders, and optional collaboration backends from config.
5. Passes the resulting registries into the React app.

That means most customization work falls into one of these buckets:

- change app behavior by overriding `AppConfig`
- add new node or edge definitions
- add or load stencil packages
- point the app at a different filesystem, collaboration, or AI backend

## Run A Local Custom Development Loop

From the repo root:

```bash
pnpm install
pnpm client:dev
```

That starts the main browser app on Vite's dev server. If your change depends on the REST or collaboration server, run this in a second terminal:

```bash
pnpm --filter @diagram-craft/server-main dev -- --collaboration
```

If you are changing docs or generated API references alongside app behavior, these are the relevant companion commands:

```bash
pnpm docs:dev
pnpm docs:typedoc
```

## Override App Configuration

The cleanest app-level extension point is `AppConfig` in `packages/main/src/appConfig.ts`. The default config lives in `packages/main/src/appConfig.default.ts`, and the repo also includes `packages/main/app.config.debug.ts` as a concrete example of overriding it.

Use app config overrides when you need to:

- register extra stencil loaders
- add lazy node or edge definition loaders
- change collaboration backend settings
- change filesystem or AI endpoints
- swap autosave or state behavior

The app loads `@diagram-craft/config` at startup, so custom deployments can provide their own config module instead of editing the default config directly.

## Add Custom Node Or Edge Types

If you need a new built-in shape or connection style:

1. Implement the definition in the appropriate package:
   - nodes usually belong in `packages/canvas-nodes` or a stencil-specific package
   - edges usually belong in `packages/canvas-edges` or a stencil-specific package
2. Register it in a registry:
   - eagerly through `defaultRegistry`
   - or lazily through `AppConfig.elementDefinitions.registry`
3. Add tests close to the implementation, usually with Vitest.
4. If the type should be available from the picker, expose it through a stencil package.

Lazy registration is the normal path for notation-specific shapes. The default config already uses pattern-based lazy loading for BPMN, UML, C4, and data-modelling node families.

## Add Or Load Stencil Packages

Stencil packages are the main user-facing extension mechanism for shape libraries.

Current supported approaches in the repo:

- YAML-backed stencils via `YamlStencilLoader`
- code-backed stencil packages in `packages/stencil-*`
- Draw.io XML stencils through the `drawioXml` loader in app config

Use a code-backed package when you need custom rendering logic or custom properties. Use YAML stencils when the shapes can be described as serialized elements and styles.

The default app config already demonstrates both patterns:

- built-in packages such as `default`, `arrow`, `uml`, `bpmn2`, `c4`
- Draw.io-backed libraries such as `AWS`, `Azure`, and `GCP`

If you load Draw.io-based assets, make sure `VITE_STENCIL_ROOT` resolves to the stencil asset directory in your deployment.

## Extend Collaboration, Filesystem, Or AI Integrations

The app-side configuration for these lives in `AppConfig`, while the default server implementation lives in `packages/server-main`.

Use this split deliberately:

- app changes decide where requests go and which backend mode is active
- server changes decide how `/api/*` and `/ws` are implemented

For example:

- remote filesystem reads go through `AppConfig.filesystem`
- Yjs collaboration is enabled through `AppConfig.collaboration`
- AI generation goes through the server's OpenRouter-backed `/api/ai/generate` endpoint

## Validate The Smallest Surface Possible

Use targeted validation for the area you touched:

```bash
pnpm test
pnpm lint
pnpm --filter @diagram-craft/main test
pnpm --filter @diagram-craft/server-main test
pnpm --filter @diagram-craft/e2e test
```

Prefer the narrowest package-level command that covers your change before running the full repo checks.

## Useful References

- [Contributing](./contributing) for the general contributor workflow
- [Self-hosting](./self-hosting) for wiring the browser app to the standalone server
- [Troubleshooting](./troubleshooting) for common local setup failures
- [Installation](../getting-started/installation) for the basic app entrypoints
- [`packages/server-main/README.md`](https://github.com/DiagramCraft/diagram-craft/blob/main/packages/server-main/README.md) for server CLI and endpoint details
