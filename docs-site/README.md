# Documentation Site

This package contains the Docusaurus-based documentation site for both Diagram Craft and Arch Register.

## Structure

The documentation is organized into two separate product spaces:

- **Diagram Craft** (`/docs/diagram-craft/`): Documentation for the diagramming tool
- **Arch Register** (`/docs/arch-register/`): Documentation for the architecture management platform

## Development

### Prerequisites

- Node.js 18+
- pnpm 8+

### Local Development

From the repository root:

```bash
pnpm docs:dev
```

Or from this directory:

```bash
pnpm start
```

This starts a local development server and opens a browser window. Most changes are reflected live without having to restart the server.

TypeDoc API generation is skipped in dev mode so the site starts faster. If you want to refresh the API docs while the site is running, open a second terminal and run:

```bash
pnpm docs:typedoc
```

If you want the dev server to generate TypeDoc on startup anyway, set:

```bash
DOCS_SITE_TYPEDOC=1 pnpm docs:dev
```

The generated API pages live under the Diagram Craft docs section, not as a separate top-level docs area.

### Build

From the repository root:

```bash
pnpm docs:build
```

Or from this directory:

```bash
pnpm build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.

### TypeDoc API Docs

Generate the TypeDoc markdown files used by the API docs with:

```bash
pnpm docs:typedoc
```

### Screenshot Generation

The docs site includes a Playwright-based screenshot generator for documentation UI assets.

```bash
pnpm docs:screenshots
```

The command:

1. Boots the required local app or apps in dev mode.
2. Seeds temporary demo data when the target product needs it.
3. Captures screenshots for the configured product and category.
4. Writes PNG files into `static/img/{product}/{category}/`.

Current products:

- `arch-register`: captures both light and dark themes by default
- `diagram-craft`: captures the getting-started screenshots in both light and dark themes

By default the generator uses dedicated ports `5073` for the Arch Register server, `5074` for the Arch Register web app, and `5175` for the Diagram Craft web app.
You can override them with `SCREENSHOT_SERVER_PORT`, `SCREENSHOT_WEB_PORT`, and `SCREENSHOT_DIAGRAM_CRAFT_PORT` if those ports are already in use.

Screenshots default to a `1280x800` viewport. Individual screenshots can override that size and can also target a
specific element with a CSS selector when a cropped capture is more useful than a full-page image.

#### Theme Support

By default, each screenshot is captured in both light and dark themes, producing two files:
- `{name}-light.png` - Light theme variant
- `{name}-dark.png` - Dark theme variant

To capture only a specific theme, add the `themes` property:

```ts
{
  product: 'arch-register',
  category: 'entities',
  name: 'browser-filtered',
  themes: ['dark'], // Only capture dark theme
  setup: async ({ entitiesPage }) => {
    await entitiesPage.goto();
    await entitiesPage.expectLoaded();
  }
}
```

When only one theme is specified, the filename will not include a theme suffix (e.g., `browser-filtered.png`).

#### Example Screenshot Config

```ts
{
  product: 'arch-register',
  category: 'entities',
  name: 'browser-filtered',
  selector: '[data-testid="entity-browser-title"]',
  themes: ['light', 'dark'], // Optional: defaults to both if omitted
  setup: async ({ entitiesPage }) => {
    await entitiesPage.goto();
    await entitiesPage.expectLoaded();
  }
}
```

#### Adding New Screenshots

To add a new screenshot:

1. Add a new config entry in `scripts/generate-screenshots.ts`.
2. Reuse the existing Arch Register page objects for Arch Register captures, or the main app entrypoint for Diagram Craft captures.
3. Choose an output category under `static/img/{product}/`.
4. Optionally specify which themes to capture with the `themes` property.
5. Run `pnpm docs:screenshots` to regenerate the asset.

### Serve Built Site

To test the production build locally:

```bash
pnpm docs:serve
```

## Configuration

### Multi-Instance Docs Plugin

The site uses Docusaurus's multi-instance docs plugin to maintain separate documentation spaces:

- Each product has its own sidebar configuration (`sidebars-diagram-craft.ts`, `sidebars-arch-register.ts`)
- Each product has its own route base path (`/diagram-craft/`, `/arch-register/`)
- Documentation files are organized in separate directories

### Adding New Pages

1. Create a new `.md` or `.mdx` file in the appropriate product directory
2. Add frontmatter with `sidebar_position` if needed
3. The page will automatically appear in the sidebar based on the configuration

Example:

```markdown
---
sidebar_position: 2
---

# My New Page

Content goes here...
```

### Customizing Sidebars

Edit the appropriate sidebar file:
- `sidebars-diagram-craft.ts` for Diagram Craft docs
- `sidebars-arch-register.ts` for Arch Register docs

## Deployment

Deployment configuration is set up for GitHub Pages. The site will be deployed to:

```
https://diagramcraft.github.io/diagram-craft/
```

### Manual Deployment

```bash
GIT_USER=<Your GitHub username> pnpm deploy
```

### CI/CD Deployment

GitHub Actions workflow will be configured separately to automatically deploy on push to main.

## Future Enhancements

- TypeDoc API documentation integration
- Content migration from existing `/docs` directory
- Search integration (Algolia DocSearch)
- Versioning support
- Dark mode customization

## Contributing

When adding new documentation:

1. Follow the existing structure and naming conventions
2. Use clear, concise language
3. Include code examples where appropriate
4. Add screenshots for UI-related documentation by adding a config to `scripts/generate-screenshots.ts`
5. Test locally before committing

## Troubleshooting

### Port Already in Use

If port 3000 is already in use, you can specify a different port:

```bash
pnpm start -- --port 3001
```

### Build Errors

Clear the cache and rebuild:

```bash
pnpm docs:clear
pnpm docs:build
```

### TypeScript Errors

Run type checking:

```bash
pnpm typecheck
```
