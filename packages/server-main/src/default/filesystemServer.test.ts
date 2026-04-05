import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { CollaborationServer } from '../collaborationServer';
import { LocalFileSystemServer } from './filesystemServer';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

describe('LocalFileSystemServer', () => {
  test('ensures a collaboration room when a file is opened', async () => {
    const root = await mkdtemp(join(tmpdir(), 'diagram-craft-fs-server-'));
    tempDirs.push(root);

    await mkdir(join(root, 'docs'), { recursive: true });
    await writeFile(join(root, 'docs', 'hello.txt'), 'hello world');

    const collaborationServer: CollaborationServer = {
      bind: () => {},
      ensureRoom: vi.fn(),
      close: () => Promise.resolve()
    };

    const server = new LocalFileSystemServer(root, collaborationServer);

    const result = await server.get('docs/hello.txt');

    expect(result.type).toBe('file');
    expect(collaborationServer.ensureRoom).toHaveBeenCalledWith('docs/hello.txt');
  });
});
