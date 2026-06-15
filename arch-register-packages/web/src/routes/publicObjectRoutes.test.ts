import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC_ROOT = new URL('../', import.meta.url).pathname;
const HELPERS_FILE = join(SRC_ROOT, 'routes/publicObjectRoutes.ts');

const ROUTE_PATTERNS = [
  /to:\s*'\/\$workspaceSlug\/projects\/\$projectId'/,
  /to:\s*'\/\$workspaceSlug\/projects\/\$projectId\/diagrams\/\$diagramId'/,
  /to:\s*'\/\$workspaceSlug\/entities\/\$entityId'/,
  /to:\s*'\/\$workspaceSlug\/entities\/\$entityId\/diagrams\/\$diagramId'/,
  /href=\{`\/\$\{workspaceSlug\}\/projects\/\$\{/,
  /href=\{`\/\$\{workspaceSlug\}\/entities\/\$\{/
];

const walkFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap(entry => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return walkFiles(path);
    return path.endsWith('.ts') || path.endsWith('.tsx') ? [path] : [];
  });

const getViolationLines = (source: string): number[] => {
  const lines = source.split('\n');
  return lines.flatMap((line, index) =>
    ROUTE_PATTERNS.some(pattern => pattern.test(line)) ? [index + 1] : []
  );
};

describe('public object route usage', () => {
  it('centralizes project/entity detail route construction in the helper module', () => {
    const violations = walkFiles(SRC_ROOT)
      .filter(file => file !== HELPERS_FILE)
      .map(file => {
        const source = readFileSync(file, 'utf8');
        const lines = getViolationLines(source);
        return lines.length > 0 ? `${relative(SRC_ROOT, file)}:${lines.join(',')}` : null;
      })
      .filter((value): value is string => value !== null);

    expect(violations).toEqual([]);
  });
});
