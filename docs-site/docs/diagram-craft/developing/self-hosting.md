---
sidebar_position: 2
---

# Self-hosting

Diagram Craft can be self-hosted today as a static frontend with an optional standalone Node server for persistence, filesystem access, AI proxying, and collaboration. This page documents the topology that exists in the current repo rather than a broader platform story.

## What You Are Hosting

There are two deployable pieces in this monorepo:

- `packages/main`: the browser app built with Vite
- `packages/server-main`: the optional backend for `/api/data`, `/api/schemas`, `/api/fs`, `/api/ai/generate`, and Yjs collaboration on `/ws`

You can host the frontend on its own if you only need local files or static assets. Add `server-main` when you need:

- remote data providers
- remote filesystem access
- AI generation through OpenRouter
- multi-user collaboration over Yjs websockets

The Electron app in `packages/electron-app` is a desktop distribution target, not a server-side hosting option.

## Local Production-Like Setup

Install dependencies once at the repo root:

```bash
pnpm install
```

Build the web app:

```bash
pnpm client:build
```

Start the server:

```bash
pnpm --filter @diagram-craft/server-main start -- --host 0.0.0.0 --port 3000 --collaboration
```

During local development, the browser app can proxy `/api` requests to the server automatically if you run:

```bash
pnpm client:dev
```

The Vite config in `packages/main/vite.config.ts` proxies `/api` to `http://localhost:${VITE_DC_SERVER_PORT:-3000}`.

## Server Responsibilities

`server-main` is file-backed. It does not use a database by default.

Persistence and services in the current implementation:

- data and schemas are stored as JSON files under `--data-dir`
- remote filesystem reads and writes are rooted at `--fs-root`
- AI requests are proxied to OpenRouter when configured
- collaboration is optional and enabled with `--collaboration`

Important current behavior when collaboration is enabled:

- the websocket endpoint uses the standard `y-websocket` protocol on `/ws`
- opening a `.json` diagram through the filesystem API creates a collaboration room for that file
- recovery snapshots are written to `.temp/`
- pending changes are flushed back to the real file path periodically and on room membership changes

## Core CLI Flags

The backend CLI surface comes from `packages/server-main/src/config.ts`.

Common flags:

```bash
--host <host>
--port <port>
--data-dir <path>
--fs-root <path>
--collaboration
--bootstrap-data <path>
--bootstrap-schemas <path>
--openrouter-api-key <key>
--openrouter-model <model>
--openrouter-site-url <url>
--openrouter-app-name <name>
```

Use this to inspect the current help text directly:

```bash
pnpm --filter @diagram-craft/server-main start -- --help
```

## Frontend Configuration For A Hosted Backend

The browser app is configured through `AppConfig`. In a hosted setup, the important pieces are:

- `filesystem.provider` and `filesystem.endpoint`
- `ai.provider` and `ai.endpoint`
- `collaboration.backend` and `collaboration.config.url`

The default app config already supports:

- remote filesystem loading through `/api/fs`
- Yjs websocket collaboration
- a server-backed AI endpoint

For collaboration, the frontend websocket URL must match the backend `ws://host:port/ws` endpoint.

## OpenRouter Integration

AI generation is optional. To enable it on the server:

```bash
export OPENROUTER_API_KEY=sk-or-v1-...
export OPENROUTER_DEFAULT_MODEL=anthropic/claude-3.5-sonnet
pnpm --filter @diagram-craft/server-main start -- --port 3000
```

You can also pass the key and model via CLI flags instead of environment variables.

If the server is started without an API key, `/api/ai/generate` is not available.

## Static Asset Hosting

The `packages/main` build output can be served by any static file host once built. Common patterns are:

- serve the built frontend behind the same origin as `server-main`
- serve the frontend separately and point it at the hosted server through app config

If you rely on Draw.io XML stencil packs, make sure the deployment also exposes the assets behind whatever value you provide for `VITE_STENCIL_ROOT`.

## Operational Limits To Document Honestly

The current repo supports self-hosting, but it is still an alpha codebase with intentionally simple defaults.

Be aware of these present-day constraints:

- default persistence is JSON files on disk, not a multi-tenant database service
- collaboration is embedded in the same Node process as the REST endpoints
- filesystem access is rooted to a configured directory, not a generic storage abstraction
- AI integration is tied to OpenRouter in the default server implementation

If you need a more complex deployment model, start by adapting `AppConfig` and `packages/server-main` rather than assuming a hidden plugin system exists.

## Related References

- [Custom Development](./custom-development) for app configuration and extension hooks
- [Troubleshooting](./troubleshooting) for startup and connectivity failures
- [Installation](../getting-started/installation) for local entrypoints
- [`packages/server-main/README.md`](https://github.com/DiagramCraft/diagram-craft/blob/main/packages/server-main/README.md) for the full server endpoint and CLI reference
