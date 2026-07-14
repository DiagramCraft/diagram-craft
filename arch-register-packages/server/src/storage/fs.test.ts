import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { FilesystemStorage } from './fs';

const roots: string[] = [];
const makeStorage = async () => {
  const root = await mkdtemp(join(tmpdir(), 'arch-register-storage-'));
  roots.push(root);
  return { root, storage: new FilesystemStorage(root) };
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

describe('FilesystemStorage staged mutations', () => {
  it('restores the previous content when a replacement rolls back', async () => {
    const { storage } = await makeStorage();
    await storage.write('ws', 'project', 'node', Buffer.from('old'));
    const staged = await storage.stageWrite('ws', 'project', 'node', Buffer.from('new'));
    await staged.commit();
    expect((await storage.read('ws', 'project', 'node')).toString()).toBe('new');
    await staged.rollback();
    expect((await storage.read('ws', 'project', 'node')).toString()).toBe('old');
  });

  it('restores quarantined content when a delete rolls back', async () => {
    const { storage } = await makeStorage();
    await storage.write('ws', 'project', 'node', Buffer.from('content'));
    const staged = await storage.stageDelete('ws', 'project', 'node');
    await staged.commit();
    await expect(storage.read('ws', 'project', 'node')).rejects.toMatchObject({ code: 'ENOENT' });
    await staged.rollback();
    expect((await storage.read('ws', 'project', 'node')).toString()).toBe('content');
  });

  it('removes the quarantine only after finalization', async () => {
    const { root, storage } = await makeStorage();
    await storage.write('ws', 'project', 'node', Buffer.from('content'));
    const staged = await storage.stageDelete('ws', 'project', 'node');
    await staged.commit();
    await staged.finalize();
    await expect(readFile(join(root, 'ws', 'project', 'node'))).rejects.toMatchObject({
      code: 'ENOENT'
    });
  });

  it('reads from a fallback directory when content has not been migrated', async () => {
    const primaryRoot = await mkdtemp(join(tmpdir(), 'arch-register-storage-primary-'));
    const fallbackRoot = await mkdtemp(join(tmpdir(), 'arch-register-storage-fallback-'));
    roots.push(primaryRoot, fallbackRoot);
    const storage = new FilesystemStorage(primaryRoot, [fallbackRoot]);
    await mkdir(join(fallbackRoot, 'ws', 'project'), { recursive: true });
    await writeFile(join(fallbackRoot, 'ws', 'project', 'node'), 'legacy content');

    await expect(storage.read('ws', 'project', 'node')).resolves.toEqual(
      Buffer.from('legacy content')
    );
  });
});
