import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fetchGitSnapshot } from './gitSource';

const execFileAsync = promisify(execFile);

describe('fetchGitSnapshot', () => {
  let repository: string;
  let cache: string;

  const git = (...args: string[]) => execFileAsync('git', args, { cwd: repository });

  beforeEach(async () => {
    repository = await mkdtemp(join(tmpdir(), 'external-content-source-'));
    cache = await mkdtemp(join(tmpdir(), 'external-content-cache-'));
    process.env['EXTERNAL_CONTENT_CACHE_DIR'] = cache;
    await git('init', '-q', '-b', 'main');
    await git('config', 'user.email', 'test@example.com');
    await git('config', 'user.name', 'Test User');
    await mkdir(join(repository, 'docs'));
    await writeFile(join(repository, 'docs', 'readme.md'), '# First revision\n');
    await git('add', '.');
    await git('commit', '-q', '-m', 'First revision');
  });

  afterEach(async () => {
    delete process.env['EXTERNAL_CONTENT_CACHE_DIR'];
    await Promise.all([rm(repository, { recursive: true, force: true }), rm(cache, { recursive: true, force: true })]);
  });

  it('clones the source once and reads the default branch tree', async () => {
    const first = await fetchGitSnapshot('source-1', { type: 'git', url: `file://${repository}` }, 'docs');

    expect(first.files).toEqual([
      expect.objectContaining({ path: 'readme.md', content: Buffer.from('# First revision\n') })
    ]);
    expect(first.revision).toMatch(/^[0-9a-f]{40}$/);

    await writeFile(join(repository, 'docs', 'second.txt'), 'second\n');
    await git('add', '.');
    await git('commit', '-q', '-m', 'Second revision');

    const second = await fetchGitSnapshot('source-1', { type: 'git', url: `file://${repository}` }, 'docs');
    expect(second.files.map(file => file.path)).toEqual(['readme.md', 'second.txt']);
    expect(second.revision).not.toBe(first.revision);
  });
});
