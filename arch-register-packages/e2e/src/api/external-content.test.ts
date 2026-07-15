import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { createStorage } from '@arch-register/server/storage/storage';
import { syncExternalContentSource } from '@arch-register/server/domain/external-content/externalContentSync';
import { createApiTest, expect } from '../helpers/fixtures';

const execFileAsync = promisify(execFile);

const createRepository = async () => {
  const repository = await mkdtemp(join(tmpdir(), 'external-content-api-repo-'));
  const git = (...args: string[]) => execFileAsync('git', args, { cwd: repository });
  await git('init', '-q', '-b', 'main');
  await git('config', 'user.email', 'test@example.com');
  await git('config', 'user.name', 'Test User');
  await mkdir(join(repository, 'docs'));
  await writeFile(
    join(repository, 'docs', 'architecture.mdx'),
    '# Architecture\n\nThis document comes from Git.\n'
  );
  await git('add', '.');
  await git('commit', '-q', '-m', 'Initial revision');
  return repository;
};

const test = createApiTest();

test('opens an external MDX file through the Markdown API as read-only content', async ({
  orpc,
  server
}) => {
  const repository = await createRepository();
  const cache = await mkdtemp(join(tmpdir(), 'external-content-api-cache-'));
  process.env['EXTERNAL_CONTENT_CACHE_DIR'] = cache;

  try {
    const workspace = await server.db.catalog.resolveWorkspaceSlug('default');
    if (!workspace) throw new Error('Default workspace was not seeded');
    const now = new Date();
    const storage = createStorage();
    const body = '# Architecture\n\nThis document comes from Git.\n';
    const source = await server.db.externalContent.createSource({
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
    const mount = await server.db.externalContent.createMount({
      id: randomUUID(),
      workspace,
      source_id: source.id,
      project_id: null,
      entity_id: null,
      destination_path: 'external-docs',
      source_path: '',
      status: 'pending',
      last_synced_at: null,
      last_revision: null,
      last_error: null,
      created_at: now,
      updated_at: now
    });
    const legacyNode = await server.db.project.upsertContentNode({
      id: randomUUID(),
      workspace,
      path: 'external-docs/docs/architecture.mdx',
      name: 'architecture.mdx',
      type: 'file',
      size_bytes: 0,
      comment_count: 0,
      unresolved_comment_count: 0,
      created_atIfNew: now,
      updated_at: now,
      original_filename: 'architecture.mdx',
      mount_id: mount.id
    });
    await storage.write(workspace, workspace, legacyNode.id, Buffer.from(body));

    const legacyFiles = await orpc.projects.listWorkspaceFiles({
      params: { workspace: 'default' }
    });
    const legacyMdxFile = [
      ...legacyFiles.rootFiles,
      ...legacyFiles.folders.flatMap(folder => folder.files)
    ].find(file => file.path === 'external-docs/docs/architecture.mdx');
    expect(legacyMdxFile).toMatchObject({
      name: 'architecture',
      type: 'markdown',
      original_filename: null,
      read_only: true
    });
    await expect(
      orpc.projects.getMarkdownContent({
        params: { workspace: 'default', nodeId: legacyNode.id }
      })
    ).resolves.toMatchObject({ body, attachments: [] });

    await syncExternalContentSource(server.db, storage, workspace, source.id);

    const files = await orpc.projects.listWorkspaceFiles({
      params: { workspace: 'default' }
    });
    const mdxFile = [
      ...files.rootFiles,
      ...files.folders.flatMap(folder => folder.files)
    ].find(file => file.path === 'external-docs/docs/architecture.mdx');

    expect(mdxFile).toMatchObject({
      path: 'external-docs/docs/architecture.mdx',
      name: 'architecture',
      type: 'markdown',
      read_only: true,
      mount_id: mount.id
    });

    const content = await orpc.projects.getMarkdownContent({
      params: { workspace: 'default', nodeId: mdxFile!.id }
    });
    expect(content).toEqual({
      body,
      attachments: []
    });

    await expect(
      orpc.projects.saveMarkdownContent({
        params: { workspace: 'default', nodeId: mdxFile!.id },
        body: { body: '# Changed' }
      })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Mounted external content is read-only'
    });
  } finally {
    delete process.env['EXTERNAL_CONTENT_CACHE_DIR'];
    await Promise.all([
      rm(repository, { recursive: true, force: true }),
      rm(cache, { recursive: true, force: true })
    ]);
  }
});
