---
sidebar_position: 4
---

# Contributing

This page is the shortest path from fresh checkout to productive contribution. It is aimed at contributors who want to make a focused change without reverse-engineering the whole monorepo first.

## First Local Setup

From the repo root:

```bash
pnpm install
```

Then choose the smallest workflow that matches your task:

```bash
pnpm client:dev
pnpm --filter @diagram-craft/server-main dev
pnpm docs:dev
pnpm electron:dev
```

Use:

- `client:dev` for browser app work
- `server-main dev` for backend, filesystem, AI, or collaboration work
- `docs:dev` for Docusaurus docs changes
- `electron:dev` only when you are working on the desktop wrapper

## Monorepo Orientation

You do not need every package at once. Start with the responsibility split:

- `packages/main`: React app and app bootstrapping
- `packages/canvas-app`, `packages/canvas`, `packages/model`: editor behavior, rendering, and document model
- `packages/canvas-nodes`, `packages/canvas-edges`, `packages/stencil-*`: built-in shapes, connectors, and notation libraries
- `packages/server-main`: standalone backend and collaboration server
- `packages/e2e`: Playwright coverage for the editor
- `docs-site`: Docusaurus docs and generated API docs

The root `README.md` is the best first stop if you need a quick map of the packages.

## Pick A Small Verification Loop

Do not default to running everything.

Typical commands:

```bash
pnpm --filter @diagram-craft/main test
pnpm --filter @diagram-craft/server-main test
pnpm --filter @diagram-craft/e2e test
pnpm test
pnpm lint
pnpm lint:tsc
```

Guidance:

- use package-local Vitest for logic changes
- use Playwright when the behavior depends on real UI interaction
- run `pnpm lint` and `pnpm lint:tsc` before finishing a non-trivial code change
- run `pnpm docs:build` for docs-only work

If you add or rely on API docs, regenerate them with:

```bash
pnpm docs:typedoc
```

## Working On Shapes, Stencils, And Editor Behavior

For editor features, find the lowest layer that owns the behavior before editing:

- use `packages/main` for UI composition and app wiring
- use `packages/canvas-app` or `packages/canvas` for core editor behavior
- use `packages/canvas-nodes`, `packages/canvas-edges`, or `packages/stencil-*` for shape-specific logic
- use `AppConfig` when the change is really configuration, not editor core

This keeps extension logic out of the app shell when it belongs in a reusable package.

## Working On Backend Or Collaboration Changes

If your change touches remote filesystem access, `/api/data`, `/api/schemas`, AI proxying, or Yjs collaboration, work from `packages/server-main` and test with the browser app against the running local server.

For collaboration changes, make sure you explicitly run the server with:

```bash
pnpm --filter @diagram-craft/server-main dev -- --collaboration
```

## Working On Docs

For docs work:

```bash
pnpm docs:dev
pnpm docs:build
```

If the change references API docs or uses generated content, also run:

```bash
pnpm docs:typedoc
```

The docs site has separate Diagram Craft and Arch Register sections, so make sure you edit the correct product space.

## Contribution Expectations

The current repo conventions are simple:

- keep changes scoped to the package that owns the behavior
- prefer targeted tests over broad, slow verification until the end
- update docs when behavior, commands, or extension surfaces change
- avoid inventing new infrastructure layers when an existing package boundary already fits

If you are touching a non-obvious workflow, leave the next contributor a clearer trail by updating the docs or the nearest README in the same change.

## Useful References

- [Custom Development](./custom-development) for app and extension wiring
- [Self-hosting](./self-hosting) for deployment and backend setup
- [Troubleshooting](./troubleshooting) for common setup failures
- [`README.md`](https://github.com/DiagramCraft/diagram-craft/blob/main/README.md) for root-level commands
- [`docs-site/README.md`](https://github.com/DiagramCraft/diagram-craft/blob/main/docs-site/README.md) for docs-site specifics
