# Diagram Craft

Diagram Craft is an open-source interactive diagram editor designed for creating professional-quality diagrams,
flowcharts, and visual representations with ease and precision. Built with TypeScript, it emphasizes performance,
extensibility, and a modern user experience.

The core diagram component has no runtime dependencies, ensuring lightweight performance and easy integration, while the
editor application leverages React and Radix UI for a polished and accessible user interface.

## Features

### Notable features

* **Import from Drawio**: Import existing diagrams from Drawio, preserving layouts, styles, and connections.

* **Extensive alignment and snapping capabilities**: Create aligned diagrams with intelligent snapping to
  grids, and other elements. 

* **Advanced layer management**: Organize your diagrams with multiple layers, including specialized rule layers. Layers can be locked, hidden, or grouped for precise control over complex diagrams.

* **Nested tabs**: Structure complex projects with hierarchical tabs, allowing you to organize related diagrams together
  while maintaining a clean workspace. 

* **Rich visual effects**: Apply effects such as reflections, glass surfaces, and hand-drawn styles to
  create visually appealing and distinctive diagrams.

* **Integrated data management**: Connect your diagrams to data sources, enabling dynamic updates and interactive
  elements. Create data-driven visualizations that automatically reflect changes in your underlying data.

* **Boolean operations**: Combine shapes using union, intersection, difference, and other boolean operations to create
  complex custom shapes with precision.

### Planned features

* **Multi-user collaboration**: Work simultaneously with team members on the same diagram with real-time updates,
  comments, and version control.

* **Comments and review system**: Add comments, feedback, and review notes directly to diagrams, facilitating team
  collaboration and iterative design processes.

* **Text to diagram conversion**: Automatically generate diagrams from text descriptions and convert existing diagrams
  back to structured text for documentation and accessibility.

## Build/Configuration Instructions

### Project Structure

Diagram Craft is organized as a monorepo using pnpm workspaces. The project is divided into multiple packages in the
`packages` directory, including:

- `main`: The main application package
- `model`: Data models
- `geometry`: Geometric utilities
- `utils`: Utility functions
- `canvas`, `canvas-app`, `canvas-drawio`, `canvas-edges`, `canvas-nodes`, `canvas-react`: Canvas-related packages
- `query`: Query utilities
- `server-main`: Server-side code
- `playwright`: End-to-end tests using Playwright

### Setup and Installation

1. Ensure you have [pnpm](https://pnpm.io/) installed (version 9.3.0 or later)
2. Clone the repository
3. Install dependencies:
   ```bash
   pnpm install
   ```

### Development Scripts

- `pnpm client:dev`: Start the development server for the main client application
- `pnpm client:build`: Build the client application for production
- `pnpm client:preview`: Preview the production build
- `pnpm test`: Run tests
- `pnpm lint`: Run linting checks

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

## Testing Information

### Testing Framework

The project uses [Vitest](https://vitest.dev/) as the testing framework. Tests are written using a describe/test pattern
similar to Jest.

### Running Tests

Tests can be run in several ways:

1. Run all tests:
   ```bash
   pnpm test
   ```

2. Run tests for a specific file:
   ```bash
   npx vitest run path/to/test/file.test.ts
   ```

3. Run tests in watch mode (automatically re-run tests when files change):
   ```bash
   npx vitest path/to/test/file.test.ts
   ```

## Additional Development Information

### Code Style

The project uses:

- TypeScript for type safety
- ESLint for linting
- Prettier for code formatting

A `.prettierrc.mjs` file is included in the project root to maintain consistent formatting.

### TypeScript Configuration

The project uses a root `tsconfig.json` file with specific configurations for different packages. Path aliases are set
up to make imports cleaner.

### Monorepo Structure

The project uses pnpm workspaces as defined in `pnpm-workspace.yaml`. This allows for efficient dependency management
across packages.

### Debugging

For debugging tests, you can use the `--inspect` flag with Vitest:

```bash
npx vitest --inspect
```

Then connect to the debugger using Chrome DevTools or your IDE.
