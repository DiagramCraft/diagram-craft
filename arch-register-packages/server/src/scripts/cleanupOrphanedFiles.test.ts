import { mkdir, mkdtemp, rm, writeFile, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  collectReferencedKeys,
  findOrphans,
  parseArgs,
  storageKey,
  walkStorageFiles
} from './cleanupOrphanedFiles';

describe('storageKey', () => {
  it('joins workspace, scope and file id', () => {
    expect(storageKey('ws1', 'proj1', 'file1')).toBe('ws1/proj1/file1');
  });
});

describe('collectReferencedKeys', () => {
  it('includes diagram, markdown and file nodes scoped by project', () => {
    const keys = collectReferencedKeys('ws1', [
      { id: 'a', type: 'diagram', project_id: 'proj1', entity_id: null },
      { id: 'b', type: 'markdown', project_id: 'proj1', entity_id: null }
    ]);
    expect(keys).toEqual(['ws1/proj1/a', 'ws1/proj1/b']);
  });

  it('scopes by entity when project_id is null', () => {
    const keys = collectReferencedKeys('ws1', [
      { id: 'a', type: 'file', project_id: null, entity_id: 'ent1' }
    ]);
    expect(keys).toEqual(['ws1/ent1/a']);
  });

  it('falls back to workspace scope when neither project nor entity is set', () => {
    const keys = collectReferencedKeys('ws1', [
      { id: 'a', type: 'file', project_id: null, entity_id: null }
    ]);
    expect(keys).toEqual(['ws1/ws1/a']);
  });

  it('excludes folder nodes, which have no backing file', () => {
    const keys = collectReferencedKeys('ws1', [
      { id: 'a', type: 'folder', project_id: 'proj1', entity_id: null }
    ]);
    expect(keys).toEqual([]);
  });
});

describe('findOrphans', () => {
  const now = Date.now();
  const oldEnough = now - 40 * 24 * 60 * 60 * 1000;
  const tooRecent = now - 1 * 24 * 60 * 60 * 1000;
  const maxAgeMs = 30 * 24 * 60 * 60 * 1000;

  it('flags files that are old and not referenced', () => {
    const orphans = findOrphans(
      [{ key: 'ws1/proj1/a', fullPath: '/base/ws1/proj1/a', size: 10, mtimeMs: oldEnough }],
      new Set(),
      maxAgeMs,
      now
    );
    expect(orphans).toHaveLength(1);
  });

  it('does not flag referenced files even if old', () => {
    const orphans = findOrphans(
      [{ key: 'ws1/proj1/a', fullPath: '/base/ws1/proj1/a', size: 10, mtimeMs: oldEnough }],
      new Set(['ws1/proj1/a']),
      maxAgeMs,
      now
    );
    expect(orphans).toHaveLength(0);
  });

  it('does not flag unreferenced files that are too recent', () => {
    const orphans = findOrphans(
      [{ key: 'ws1/proj1/a', fullPath: '/base/ws1/proj1/a', size: 10, mtimeMs: tooRecent }],
      new Set(),
      maxAgeMs,
      now
    );
    expect(orphans).toHaveLength(0);
  });
});

describe('parseArgs', () => {
  it('defaults to a 30 day threshold and dry-run', () => {
    expect(parseArgs([])).toEqual({ maxAgeDays: 30, apply: false });
  });

  it('parses --max-age-days and --apply', () => {
    expect(parseArgs(['--max-age-days', '7', '--apply'])).toEqual({
      maxAgeDays: 7,
      apply: true
    });
  });

  it('rejects an invalid --max-age-days value', () => {
    expect(() => parseArgs(['--max-age-days', 'abc'])).toThrow();
  });

  it('rejects unknown arguments', () => {
    expect(() => parseArgs(['--bogus'])).toThrow();
  });
});

describe('walkStorageFiles', () => {
  let baseDir: string;

  beforeEach(async () => {
    baseDir = await mkdtemp(join(tmpdir(), 'cleanup-orphaned-files-'));
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  it('returns an empty list when the base directory does not exist', async () => {
    const files = await walkStorageFiles(join(baseDir, 'missing'));
    expect(files).toEqual([]);
  });

  it('walks workspace/scope/fileId and reports size and mtime', async () => {
    const scopeDir = join(baseDir, 'ws1', 'proj1');
    await mkdir(scopeDir, { recursive: true });
    await writeFile(join(scopeDir, 'file1'), 'hello');

    const past = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    await utimes(join(scopeDir, 'file1'), past, past);

    const files = await walkStorageFiles(baseDir);
    expect(files).toHaveLength(1);
    const file = files[0];
    if (!file) throw new Error('expected a file');
    expect(file.key).toBe('ws1/proj1/file1');
    expect(file.size).toBe(5);
    expect(file.mtimeMs).toBeLessThan(Date.now() - 59 * 24 * 60 * 60 * 1000);
  });
});
