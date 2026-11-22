import { describe, expect, test } from 'vitest';
import type { ProjectFile } from '@arch-register/api-types/projectContentContract';
import { buildDiagramBrowserRows, diagramBrowserRowId } from './diagramBrowserRows';

const file = (path: string) => ({ path, name: path }) as unknown as ProjectFile;

describe('buildDiagramBrowserRows', () => {
  test('lists folders before files', () => {
    const rows = buildDiagramBrowserRows(
      [{ path: 'a', name: 'a', fileCount: 1 }],
      [{ file: file('x') }, { file: file('y'), folder: 'a' }]
    );
    expect(rows.map(r => r.kind)).toEqual(['folder', 'item', 'item']);
  });

  test('row ids are unique even when a folder and file share a path', () => {
    const rows = buildDiagramBrowserRows(
      [{ path: 'same', name: 'same', fileCount: 0 }],
      [{ file: file('same') }]
    );
    expect(new Set(rows.map(diagramBrowserRowId)).size).toBe(2);
  });
});
