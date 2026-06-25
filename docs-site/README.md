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
- Screenshot automation
- Content migration from existing `/docs` directory
- Search integration (Algolia DocSearch)
- Versioning support
- Dark mode customization

## Contributing

When adding new documentation:

1. Follow the existing structure and naming conventions
2. Use clear, concise language
3. Include code examples where appropriate
4. Add screenshots for UI-related documentation (when screenshot automation is set up)
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