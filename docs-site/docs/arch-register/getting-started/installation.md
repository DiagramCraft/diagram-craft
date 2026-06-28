# Installation and Setup

## Prerequisites

- Node.js 20 or later
- `pnpm`

## Install dependencies

From the repository root:

```bash
pnpm install
```

## Start the server

From `arch-register-packages/server`:

```bash
pnpm bootstrap
pnpm dev
```

`pnpm bootstrap` resets the database and loads the local development data.

## Start the web app

From `arch-register-packages/web`:

```bash
pnpm dev
```

## Sign in

Open the web app in the browser and sign in with a local account configured for your environment.

## Result

The default workspace opens after sign-in. From there you can create additional workspaces, add entities, and browse projects.

Next: [Your first workspace](first-workspace).
