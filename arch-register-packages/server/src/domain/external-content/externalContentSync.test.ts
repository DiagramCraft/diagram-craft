import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { expect, it, vi } from 'vitest';

vi.mock('./gitUrlSafety', () => ({
  assertSafeGitUrl: vi.fn()
}));

import { FilesystemStorage } from '../../storage/fs';
import { runContractSuiteAgainstBothDrivers } from '../../db/contract-tests/harness';
import { createFixtureWorkspace } from '../../db/contract-tests/projectFixtures';
import type { DatabaseAdapter } from '../../db/database';
import { syncExternalContentSource } from './externalContentSync';

const execFileAsync = promisify(execFile);

const createRepository = async () => {
  const repository = await mkdtemp(join(tmpdir(), 'external-content-sync-repo-'));
  const git = (...args: string[]) => execFileAsync('git', args, { cwd: repository });
  await git('init', '-q', '-b', 'main');
  await git('config', 'user.email', 'test@example.com');
  await git('config', 'user.name', 'Test User');
  await mkdir(join(repository, 'docs'));
  await writeFile(join(repository, 'docs', 'readme.md'), '# Readme\n');
  await writeFile(join(repository, 'docs', 'guide.mdx'), '# Guide\n\nMDX content\n');
  await writeFile(join(repository, 'data.json'), '{"hello":"world"}\n');
  await git('add', '.');
  await git('commit', '-q', '-m', 'Initial revision');
  return repository;
};

const createSourceAndMount = async (
  db: DatabaseAdapter,
  workspace: string,
  repository: string,
  destinationPath: string,
  sourcePath: string
) => {
  const now = new Date();
  const source = await db.externalContent.createSource({
    id: randomUUID(),
    workspace,
    source_type: 'git',
    source_config: { type: 'git', url: `file://${repository}` },
    identity_key: randomUUID(),
    schedule_id: null,
    enabled: true,
    status: 'pending',
    created_at: now,
    updated_at: now
  });
  const mount = await db.externalContent.createMount({
    id: randomUUID(),
    workspace,
    source_id: source.id,
    project_id: null,
    entity_id: null,
    destination_path: destinationPath,
    source_path: sourcePath,
    status: 'pending',
    last_synced_at: null,
    last_revision: null,
    last_error: null,
    created_at: now,
    updated_at: now
  });
  return { source, mount };
};

runContractSuiteAgainstBothDrivers('External content sync', getDb => {
  it('continues syncing sibling mounts when one source path is invalid', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const repository = await createRepository();
    const cache = await mkdtemp(join(tmpdir(), 'external-content-sync-cache-'));
    const storageRoot = await mkdtemp(join(tmpdir(), 'external-content-sync-storage-'));
    process.env['EXTERNAL_CONTENT_CACHE_DIR'] = cache;
    try {
      const { source, mount: failedMount } = await createSourceAndMount(
        db,
        workspace,
        repository,
        'missing',
        'missing'
      );
      const { mount: healthyMount } = await createSourceAndMount(
        db,
        workspace,
        repository,
        'docs',
        'docs'
      );
      await db.externalContent.updateMount(healthyMount.id, { source_id: source.id });

      const result = await syncExternalContentSource(
        db,
        new FilesystemStorage(storageRoot),
        workspace,
        source.id
      );

      expect(result.results).toHaveLength(1);
      expect((await db.externalContent.getMount(workspace, failedMount.id))?.status).toBe('failed');
      expect((await db.externalContent.getMount(workspace, healthyMount.id))?.status).toBe(
        'succeeded'
      );
      expect(
        (await db.project.listWorkspaceContentNodes(workspace)).some(
          node => node.path === 'docs/readme.md'
        )
      ).toBe(true);
    } finally {
      delete process.env['EXTERNAL_CONTENT_CACHE_DIR'];
      await Promise.all([
        rm(repository, { recursive: true, force: true }),
        rm(cache, { recursive: true, force: true }),
        rm(storageRoot, { recursive: true, force: true })
      ]);
    }
  });

  it('does not take ownership of an existing content node on sync conflict', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const repository = await createRepository();
    const cache = await mkdtemp(join(tmpdir(), 'external-content-conflict-cache-'));
    const storageRoot = await mkdtemp(join(tmpdir(), 'external-content-conflict-storage-'));
    process.env['EXTERNAL_CONTENT_CACHE_DIR'] = cache;
    try {
      const now = new Date();
      const existing = await db.project.createContentNodeIfAbsent({
        workspace,
        project_id: null,
        entity_id: null,
        parent_id: null,
        path: 'docs',
        name: 'docs',
        type: 'folder',
        size_bytes: 0,
        comment_count: 0,
        unresolved_comment_count: 0,
        created_atIfNew: now,
        updated_at: now,
        created_byIfNew: null,
        updated_by: null,
        mount_id: null
      });
      const { source, mount } = await createSourceAndMount(
        db,
        workspace,
        repository,
        'docs',
        'docs'
      );

      await syncExternalContentSource(db, new FilesystemStorage(storageRoot), workspace, source.id);

      expect((await db.externalContent.getMount(workspace, mount.id))?.status).toBe('failed');
      expect(
        (await db.project.listWorkspaceContentNodes(workspace)).find(
          node => node.id === existing?.id
        )?.mount_id
      ).toBeNull();
    } finally {
      delete process.env['EXTERNAL_CONTENT_CACHE_DIR'];
      await Promise.all([
        rm(repository, { recursive: true, force: true }),
        rm(cache, { recursive: true, force: true }),
        rm(storageRoot, { recursive: true, force: true })
      ]);
    }
  });

  it('keeps ordinary JSON files as generic content', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const repository = await createRepository();
    const cache = await mkdtemp(join(tmpdir(), 'external-content-json-cache-'));
    const storageRoot = await mkdtemp(join(tmpdir(), 'external-content-json-storage-'));
    process.env['EXTERNAL_CONTENT_CACHE_DIR'] = cache;
    try {
      const { source } = await createSourceAndMount(db, workspace, repository, 'repo', '');

      await syncExternalContentSource(db, new FilesystemStorage(storageRoot), workspace, source.id);

      expect(
        (await db.project.listWorkspaceContentNodes(workspace)).find(
          node => node.path === 'repo/data.json'
        )?.type
      ).toBe('file');
    } finally {
      delete process.env['EXTERNAL_CONTENT_CACHE_DIR'];
      await Promise.all([
        rm(repository, { recursive: true, force: true }),
        rm(cache, { recursive: true, force: true }),
        rm(storageRoot, { recursive: true, force: true })
      ]);
    }
  });

  it('updates legacy MDX file nodes to read-only markdown with an extensionless display name', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const repository = await createRepository();
    const cache = await mkdtemp(join(tmpdir(), 'external-content-mdx-cache-'));
    const storageRoot = await mkdtemp(join(tmpdir(), 'external-content-mdx-storage-'));
    process.env['EXTERNAL_CONTENT_CACHE_DIR'] = cache;
    try {
      const { source, mount } = await createSourceAndMount(db, workspace, repository, 'repo', '');
      const storage = new FilesystemStorage(storageRoot);
      const now = new Date();
      await db.project.upsertContentNode({
        id: randomUUID(),
        workspace,
        path: 'repo/docs/guide.mdx',
        name: 'guide.mdx',
        type: 'file',
        size_bytes: 0,
        comment_count: 0,
        unresolved_comment_count: 0,
        created_atIfNew: now,
        updated_at: now,
        original_filename: 'guide.mdx',
        mount_id: mount.id
      });

      await syncExternalContentSource(db, storage, workspace, source.id);

      const node = (await db.project.listWorkspaceContentNodes(workspace)).find(
        contentNode => contentNode.path === 'repo/docs/guide.mdx'
      );
      expect(node).toMatchObject({
        path: 'repo/docs/guide.mdx',
        name: 'guide',
        type: 'markdown',
        original_filename: null,
        mount_id: mount.id
      });
      const stored = JSON.parse(
        (await storage.read(workspace, workspace, node!.id)).toString('utf8')
      ) as { body: string };
      expect(stored.body).toBe('# Guide\n\nMDX content\n');
    } finally {
      delete process.env['EXTERNAL_CONTENT_CACHE_DIR'];
      await Promise.all([
        rm(repository, { recursive: true, force: true }),
        rm(cache, { recursive: true, force: true }),
        rm(storageRoot, { recursive: true, force: true })
      ]);
    }
  });
});
