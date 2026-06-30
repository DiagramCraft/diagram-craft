---
sidebar_position: 2
---

# Installation

There are a few different ways to use Diagram Craft depending on whether you want to try the editor, run it locally, or use the desktop app.

## Use The Hosted Web App

The fastest way to start is the hosted demo:

- Open the Diagram Craft app in a modern desktop browser.
- Create a new diagram or open one of the included sample documents.
- Use this option when you want to explore the editor without setting up a local environment.

## Run The App Locally

If you are working from this repository, start the client app from the repo root:

```bash
pnpm client:dev
```

This launches the main browser app in development mode.

Use local development when you want:

- the latest in-repo version of the editor
- to test documentation steps against local changes
- to work on Diagram Craft itself

## Use The Desktop App

Diagram Craft also has an Electron app in this monorepo. Start it from the repo root with:

```bash
pnpm electron:dev
```

Choose the desktop app when you want a packaged editor experience instead of running in a browser tab.

## Requirements

For normal editing, you only need:

- a modern desktop browser
- a mouse or trackpad for comfortable canvas navigation

For local development, you also need:

- Node.js 18 or newer
- `pnpm`

## Self-Hosting

If you need deployment or hosting details, use [Self-hosting](../developing/self-hosting).

Next: [First Diagram](first-diagram).
