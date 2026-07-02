---
sidebar_position: 3
---

# Troubleshooting

This page focuses on failure modes that are real in the current monorepo and the fastest way to debug them.

## `pnpm install` Fails Or The App Will Not Start

Check the expected toolchain first:

- Node.js 18 or newer
- `pnpm`

Then retry from the repo root:

```bash
pnpm install
```

If you see inconsistent dependency behavior, confirm you are using the workspace root and not installing from an individual package first.

## The Browser App Starts But API Calls Fail

The browser app in `packages/main` proxies `/api` to the Diagram Craft server during development. If the UI loads but data, filesystem, or AI features fail:

1. Start the backend:

```bash
pnpm --filter @diagram-craft/server-main dev
```

2. Check which port the frontend expects. The Vite config uses `VITE_DC_SERVER_PORT` and defaults to `3000`.
3. Verify the server is reachable directly at `http://localhost:3000/api/...`.

Typical symptoms:

- 404 or connection refused: backend not running or wrong port
- browser loads but remote file operations fail: `filesystem.endpoint` or proxy path mismatch
- AI actions fail: backend is running, but OpenRouter is not configured

## Collaboration Does Not Connect

The most common cause is starting the server without collaboration enabled.

Start the backend with:

```bash
pnpm --filter @diagram-craft/server-main dev -- --collaboration
```

Then verify the frontend is configured for the same websocket endpoint:

- backend websocket path is `/ws`
- the app-side collaboration URL must match `ws://host:port/ws`

If collaboration still behaves oddly, use the debug config pattern in `packages/main/app.config.debug.ts` to test flags such as forced server state reloads.

## Stencil Packages Or Draw.io Libraries Do Not Load

First separate built-in stencils from external asset-backed stencils:

- built-in packages such as UML, BPMN, C4, and ArchiMate come from workspace code
- Draw.io-based libraries depend on asset URLs and the `drawioXml` loader

If external stencil libraries are missing:

1. Check `VITE_STENCIL_ROOT`.
2. Confirm the XML assets are actually reachable in the browser.
3. Verify your app config still registers the relevant stencil entry and loader.

If a custom node type renders as unknown, check whether its node definition was registered eagerly in the default registry or lazily through `AppConfig.elementDefinitions.registry`.

## Docs Site Builds Or API Docs Are Stale

The docs site intentionally skips TypeDoc generation in normal dev mode for speed.

Use:

```bash
pnpm docs:dev
pnpm docs:typedoc
```

If the API section looks outdated, regenerate TypeDoc before debugging the Markdown itself.

If Docusaurus fails because of old cached state:

```bash
pnpm docs:clear
pnpm docs:build
```

## Screenshot Or Dev Ports Conflict

The docs screenshot tooling and app dev servers use dedicated ports. If a command starts but hangs or fails to bind:

- check whether another local process is already using the expected port
- override the documented environment variables instead of patching the scripts

Relevant ports already used in the repo include:

- `5173` for the main app dev server by default
- `3000` for `server-main` by default
- `5073`, `5074`, and `5175` for docs screenshot generation defaults

## A Change Passes In One Package But Breaks Elsewhere

The repo is intentionally split into many packages, so validate the narrowest surface first and then expand:

```bash
pnpm --filter @diagram-craft/main test
pnpm --filter @diagram-craft/server-main test
pnpm --filter @diagram-craft/e2e test
pnpm lint
pnpm lint:tsc
```

If a stencil or rendering change behaves differently in the app than in unit tests, also check Storybook-backed or Playwright coverage in the relevant package.

## Where To Look When You Are Stuck

Useful source-of-truth files:

- `README.md` for monorepo-level entrypoints
- `docs-site/README.md` for docs-site development and screenshot flows
- `packages/server-main/README.md` for the standalone backend
- `packages/main/src/appConfig.default.ts` for current frontend wiring
- `packages/main/src/initial-loader.ts` for startup behavior

When the behavior and the docs disagree, trust the code and update the docs.
