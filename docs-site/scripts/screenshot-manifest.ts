import { glob } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { ScreenshotConfig } from './screenshot-types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsRoot = resolve(__dirname, '../docs');
const manifestPaths =
  process.env['SCREENSHOT_MANIFEST_PATHS']
    ?.split(',')
    .map(p => p.trim())
    .filter(Boolean) ?? [];

export type ScreenshotManifest = {
  screenshots: ScreenshotConfig[];
};

const isValidManifest = (module: unknown): module is ScreenshotManifest => {
  if (module == null || typeof module !== 'object') return false;
  if (!('screenshots' in module)) return false;
  if (!Array.isArray(module.screenshots)) return false;
  return module.screenshots.every(isValidScreenshotConfig);
};

const isValidScreenshotConfig = (config: unknown): config is ScreenshotConfig => {
  if (config == null || typeof config !== 'object') return false;
  const c = config as Record<string, unknown>;

  return (
    typeof c.product === 'string' &&
    (c.product === 'arch-register' || c.product === 'diagram-craft') &&
    typeof c.category === 'string' &&
    typeof c.name === 'string' &&
    typeof c.setup === 'function'
  );
};

export const discoverManifests = async (): Promise<ScreenshotConfig[]> => {
  const discoveredPaths: string[] = [];

  for await (const entry of glob('**/screenshots.ts', {
    cwd: docsRoot
  })) {
    discoveredPaths.push(resolve(docsRoot, entry));
  }

  // Filter by manifest paths if specified
  const filteredPaths =
    manifestPaths.length === 0
      ? discoveredPaths
      : discoveredPaths.filter(path => {
          const relativePath = path.replace(docsRoot + '/', '');
          return manifestPaths.some(filter => relativePath.startsWith(filter));
        });

  const allConfigs: ScreenshotConfig[] = [];

  for (const manifestPath of filteredPaths) {
    try {
      const manifestUrl = pathToFileURL(manifestPath).href;
      const module = await import(manifestUrl);

      if (!isValidManifest(module)) {
        console.warn(
          `Invalid manifest at ${manifestPath.replace(docsRoot + '/', '')}: missing or invalid 'screenshots' export`
        );
        continue;
      }

      const relativePath = manifestPath.replace(docsRoot + '/', '');
      console.log(`Loaded ${module.screenshots.length} screenshot(s) from ${relativePath}`);

      // Add manifest source to each config for logging
      const configsWithSource = module.screenshots.map(config => ({
        ...config,
        _manifestSource: relativePath
      }));

      allConfigs.push(...configsWithSource);
    } catch (error) {
      const relativePath = manifestPath.replace(docsRoot + '/', '');
      console.error(`Failed to load manifest at ${relativePath}:`, error);
    }
  }

  return allConfigs;
};
