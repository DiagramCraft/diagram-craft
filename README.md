# Diagram Craft

This is an attempt to create an open-source for an interactive diagram editor.
It's written in TypeScript with a minimal set of dependencies. 

The core diagram component has no runtime dependencies, whereas the editor application
uses React and Radix UI.

## Features

### Notable features

* Import from Drawio
* Extensive alignment and snapping capabilities
* Layers, including rule layers
* Nested tabs
* Effects such as reflection, glass, hand-drawing
* Data management

### Planned features

* External data management
* Multi-user
* Boolean operations
* Comments and review
* Text to diagram and back


## Getting started

### Server

```bash
pnpm install
cd packages/server/main
pnpm run dev
```

### Client

```bash
pnpm install
pnpm run client:dev
```