import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { markdownFileRoute } from './publicObjectRoutes';

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

describe('markdownFileRoute', () => {
  it('addresses workspace pages by path', () => {
    expect(markdownFileRoute('ws', { id: '1', path: 'a/b.md' })).toMatchObject({
      to: '/$workspaceSlug/content/wiki/$',
      params: { workspaceSlug: 'ws', _splat: 'a/b' }
    });
  });

  it('addresses project and entity pages by path within their scope', () => {
    expect(
      markdownFileRoute('ws', { id: '1', path: 'a', project_id: 'p', project_public_id: 'pp' })
    ).toMatchObject({
      to: '/$workspaceSlug/projects/$projectId/wiki/$',
      params: { projectId: 'pp', _splat: 'a' }
    });
    expect(markdownFileRoute('ws', { id: '1', path: 'a.md', entity_id: 'e' })).toMatchObject({
      to: '/$workspaceSlug/entities/$entityId/wiki/$',
      params: { entityId: 'e', _splat: 'a' }
    });
  });
});
