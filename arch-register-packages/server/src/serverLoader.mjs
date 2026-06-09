/**
 * Node.js ESM loader that stubs out Vite-specific imports that cannot be
 * resolved in a plain Node.js environment:
 *
 *  - `*.css` / `*.css?inline`  → returns an empty string (CSS is not needed for SSR rendering)
 *  - `*.yaml` / `*.yml`        → returns { stencils: [] } (satisfies YamlStencilLoader validation)
 *  - `*.svg?raw`               → returns an empty string
 *
 * Two hooks are needed:
 *  - `resolve`: intercepts imports before they're resolved to file URLs (catches `?inline` / `?raw`)
 *  - `load`: intercepts after resolution when tsx has already stripped query params from the URL
 */

const CSS_STUB = 'export default ""';
const YAML_STUB = 'export default { stencils: [] }';
const SVG_STUB = 'export default ""';

export async function resolve(specifier, context, nextResolve) {
  if (specifier.includes('?inline') || specifier.includes('?raw')) {
    return {
      shortCircuit: true,
      url: `data:text/javascript,${encodeURIComponent(CSS_STUB)}`
    };
  }

  if (specifier.endsWith('.yaml') || specifier.endsWith('.yml')) {
    return {
      shortCircuit: true,
      url: `data:text/javascript,${encodeURIComponent(YAML_STUB)}`
    };
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  // Handle cases where tsx has already resolved the URL (stripping ?inline / ?raw query params)
  const withoutQuery = url.split('?')[0];

  if (withoutQuery.endsWith('.css')) {
    return { shortCircuit: true, format: 'module', source: CSS_STUB };
  }

  if (withoutQuery.endsWith('.yaml') || withoutQuery.endsWith('.yml')) {
    return { shortCircuit: true, format: 'module', source: YAML_STUB };
  }

  if (withoutQuery.endsWith('.svg')) {
    return { shortCircuit: true, format: 'module', source: SVG_STUB };
  }

  return nextLoad(url, context);
}
