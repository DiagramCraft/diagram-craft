# Screenshot Manifests

This document describes how to add and maintain screenshot definitions for the documentation site.

## Overview

Screenshot definitions are now colocated with the documentation they illustrate, using manifest files named `screenshots.ts` within the docs tree.

## Creating a Screenshot Manifest

### Location

Place your `screenshots.ts` file in the same directory as the documentation that uses the screenshots:

```
docs-site/docs/
├── arch-register/
│   ├── getting-started/
│   │   ├── first-workspace.mdx
│   │   └── screenshots.ts          # Screenshots for getting-started docs
│   ├── use/
│   │   ├── entities.mdx
│   │   └── screenshots.ts          # Screenshots for use docs
│   └── admin/
│       ├── settings.mdx
│       └── screenshots.ts          # Screenshots for admin docs
└── diagram-craft/
    ├── getting-started/
    │   ├── intro.md
    │   └── screenshots.ts          # Screenshots for getting-started docs
    └── use/
        ├── core-diagramming.mdx
        └── screenshots.ts          # Screenshots for use docs
```

### Manifest Structure

Each manifest exports a `screenshots` array with screenshot configurations:

```typescript
import { expect } from '@playwright/test';
import type { ArchRegisterScreenshotConfig } from '../../../scripts/screenshot-types.js';
import { defaultWorkspace } from '../../../../arch-register-packages/e2e/src/ui/support/workspaces';

export const screenshots: ArchRegisterScreenshotConfig[] = [
  {
    product: 'arch-register',
    category: 'workspace',
    name: 'selector-open',
    fullPage: false,
    setup: async ({ homePage }) => {
      await homePage.goto();
      await homePage.expectLoaded(defaultWorkspace.name);
      await homePage.workspaceShell.topBar.openWorkspaceSwitcher();
    }
  }
];
```

### Configuration Options

#### Common Properties

- `product`: Either `'arch-register'` or `'diagram-craft'`
- `category`: Category name (used in output path: `static/img/{product}/{category}/{name}.png`)
- `name`: Screenshot name (used in filename)
- `setup`: Async function that sets up the page state before capturing

#### Capture Options

- `fullPage`: Capture entire scrollable page (default: `true`)
- `clip`: Capture specific region `{ x, y, width, height }`
- `selector`: Capture specific element (with optional gap)
- `selectorGap`: Padding around selector (default: `16`)
- `viewport`: Custom viewport size `{ width, height }`
- `themes`: Array of themes to capture (default: `['light', 'dark']`)

### Setup Context

#### Arch Register Context

```typescript
type ScreenshotContext = {
  accountSettingsPage: AccountSettingsPage;
  homePage: HomePage;
  entitiesPage: EntitiesPage;
  projectsPage: ProjectsPage;
  searchPage: SearchPage;
  settingsPage: SettingsPage;
  dataModelPage: DataModelPage;
};
```

#### Diagram Craft Context

```typescript
type DiagramCraftScreenshotContext = {
  page: Page;  // Playwright Page object
};
```

### Helper Functions

Import helper functions from `screenshot-helpers.js`:

```typescript
import {
  loadDiagramCraftSample,
  selectDiagramCraftTool,
  clickDiagramCraftElement,
  createWikiPage,
  openProjectNewDiagramDialog
} from '../../../scripts/screenshot-helpers.js';
```

## Examples

### Basic Screenshot

```typescript
{
  product: 'arch-register',
  category: 'entities',
  name: 'browser-overview',
  fullPage: false,
  setup: async ({ entitiesPage }) => {
    await entitiesPage.goto();
    await entitiesPage.expectLoaded();
  }
}
```

### Screenshot with Selector

```typescript
{
  product: 'arch-register',
  category: 'entities',
  name: 'create-dialog',
  selector: '[role="alertdialog"]',
  setup: async ({ entitiesPage }) => {
    await entitiesPage.goto();
    await entitiesPage.expectLoaded();
    await entitiesPage.openNewEntityDialog();
  }
}
```

### Screenshot with Clip Region

```typescript
{
  product: 'diagram-craft',
  category: 'getting-started',
  name: 'shape-palette-overview',
  clip: { x: 0, y: 72, width: 430, height: 700 },
  setup: async ({ page }) => {
    await loadDiagramCraftSample(page, 'getting-started.json');
    await expect(page.getByRole('tab', { name: 'Shape' })).toHaveAttribute('aria-selected', 'true');
  }
}
```

### Single Theme Screenshot

```typescript
{
  product: 'arch-register',
  category: 'admin',
  name: 'settings-general',
  fullPage: false,
  themes: ['light'],  // Only capture light theme
  setup: async ({ settingsPage }) => {
    await settingsPage.goto('general');
    await settingsPage.expectLoaded();
  }
}
```

## Running Screenshots

### Generate All Screenshots

```bash
pnpm docs:screenshots
```

### Generate Specific Screenshots

Use the `SCREENSHOT_ONLY` environment variable with filters:

```bash
# By full path
SCREENSHOT_ONLY=arch-register/entities/browser-overview pnpm docs:screenshots

# By category and name
SCREENSHOT_ONLY=entities/browser-overview pnpm docs:screenshots

# By name only
SCREENSHOT_ONLY=browser-overview pnpm docs:screenshots

# Multiple screenshots (comma-separated)
SCREENSHOT_ONLY=browser-overview,create-dialog pnpm docs:screenshots
```

### Limiting Manifest Discovery

Use `SCREENSHOT_MANIFEST_PATHS` to only load manifests from specific directories:

```bash
# Load only arch-register/getting-started manifests
SCREENSHOT_MANIFEST_PATHS=arch-register/getting-started pnpm docs:screenshots

# Load multiple manifest directories (comma-separated)
SCREENSHOT_MANIFEST_PATHS=arch-register/getting-started,diagram-craft/use pnpm docs:screenshots

# Combine with SCREENSHOT_ONLY for precise control
SCREENSHOT_MANIFEST_PATHS=arch-register/use SCREENSHOT_ONLY=entities/browser-overview pnpm docs:screenshots
```

### Other Options

- `SCREENSHOT_PIXEL_THRESHOLD`: Pixel difference threshold for updates (default: `5`)
- `SCREENSHOT_SERVER_PORT`: Arch Register server port (default: `5073`)
- `SCREENSHOT_WEB_PORT`: Arch Register web port (default: `5074`)
- `SCREENSHOT_DIAGRAM_CRAFT_PORT`: Diagram Craft port (default: `5175`)

## Output

Screenshots are saved to:
```
docs-site/static/img/{product}/{category}/{name}-{theme}.png
```

For single-theme screenshots, the theme suffix is omitted.

## Best Practices

1. **Keep manifests focused**: Group related screenshots together
2. **Use descriptive names**: Make it clear what the screenshot shows
3. **Minimize setup code**: Use helper functions for common operations
4. **Test locally**: Run screenshots locally before committing
5. **Check diffs**: Review pixel differences to avoid unnecessary updates
6. **Use appropriate capture methods**: 
   - `fullPage` for overview screenshots
   - `selector` for specific UI elements
   - `clip` for precise regions

## Troubleshooting

### Screenshot not updating

- Check pixel threshold with `SCREENSHOT_PIXEL_THRESHOLD=0`
- Verify setup code completes successfully
- Check for timing issues (add waits if needed)

### Import errors

- Ensure correct relative paths to types and helpers
- Check that all required dependencies are imported

### Theme not applying

- Verify theme switching logic in setup
- Check that page has loaded before capturing
- Use `waitForThemeApplied` helper if needed
