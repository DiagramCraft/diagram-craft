import 'dotenv/config';
import { readdir, stat, unlink } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { createDatabase } from '../db/factory';
import { storageScope } from '../domain/project/projectOperationHelpers';
import type { ContentNodeDbResult } from '../domain/project/db/projectDatabase';
import { STORAGE_DEFAULTS } from '../constants';

export type StorageFile = {
  key: string;
  fullPath: string;
  size: number;
  mtimeMs: number;
};

export const storageKey = (workspace: string, scope: string, fileId: string) =>
  `${workspace}/${scope}/${fileId}`;

export const collectReferencedKeys = (
  workspace: string,
  nodes: Pick<ContentNodeDbResult, 'id' | 'type' | 'project_id' | 'entity_id'>[]
): string[] =>
  nodes
    .filter(node => node.type !== 'folder')
    .map(node => storageKey(workspace, storageScope(workspace, node), node.id));

export const walkStorageFiles = async (baseDir: string): Promise<StorageFile[]> => {
  const resolvedBase = resolve(baseDir);
  const results: StorageFile[] = [];

  let workspaces: string[];
  try {
    workspaces = await readdir(resolvedBase);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }

  for (const workspace of workspaces) {
    const workspacePath = join(resolvedBase, workspace);
    if (!(await stat(workspacePath)).isDirectory()) continue;

    for (const scope of await readdir(workspacePath)) {
      const scopePath = join(workspacePath, scope);
      if (!(await stat(scopePath)).isDirectory()) continue;

      for (const fileId of await readdir(scopePath)) {
        const filePath = join(scopePath, fileId);
        const stats = await stat(filePath);
        if (!stats.isFile()) continue;

        results.push({
          key: storageKey(workspace, scope, fileId),
          fullPath: filePath,
          size: stats.size,
          mtimeMs: stats.mtimeMs
        });
      }
    }
  }

  return results;
};

export const findOrphans = (
  files: StorageFile[],
  referencedKeys: Set<string>,
  maxAgeMs: number,
  now: number
): StorageFile[] =>
  files.filter(file => !referencedKeys.has(file.key) && now - file.mtimeMs > maxAgeMs);

export type CleanupArgs = {
  maxAgeDays: number;
  apply: boolean;
};

export const parseArgs = (argv: string[]): CleanupArgs => {
  let maxAgeDays = 30;
  let apply = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--max-age-days': {
        const raw = argv[++i];
        const value = Number.parseInt(raw ?? '', 10);
        if (Number.isNaN(value) || value < 0) {
          throw new Error(`Invalid value for --max-age-days: ${raw}`);
        }
        maxAgeDays = value;
        break;
      }
      case '--apply':
        apply = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { maxAgeDays, apply };
};

async function main() {
  const { maxAgeDays, apply } = parseArgs(process.argv.slice(2));
  const resolvedBase = resolve(process.env['STORAGE_FS_BASE'] ?? STORAGE_DEFAULTS.FS_BASE_DIR);

  console.log(`Scanning ${resolvedBase} for files not referenced in the database...`);
  console.log(
    `Age threshold: ${maxAgeDays} day(s). Mode: ${apply ? 'APPLY (will delete)' : 'DRY RUN'}`
  );

  const db = await createDatabase({ initialize: false });

  const referencedKeys = new Set<string>();
  const workspaces = await db.workspace.listWorkspaces();
  for (const workspace of workspaces) {
    const nodes = await db.project.listAllContentNodes(workspace.id);
    for (const key of collectReferencedKeys(workspace.id, nodes)) {
      referencedKeys.add(key);
    }
  }

  const files = await walkStorageFiles(resolvedBase);
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const orphans = findOrphans(files, referencedKeys, maxAgeMs, Date.now());

  const totalBytes = orphans.reduce((sum, orphan) => sum + orphan.size, 0);
  console.log(`Found ${orphans.length} orphaned file(s), ${totalBytes} byte(s) total.`);

  for (const orphan of orphans) {
    console.log(`  ${apply ? 'deleting' : 'would delete'}: ${orphan.key} (${orphan.size} bytes)`);
  }

  if (apply) {
    for (const orphan of orphans) {
      if (!orphan.fullPath.startsWith(resolvedBase + sep)) continue;
      await unlink(orphan.fullPath);
    }
    console.log(`Deleted ${orphans.length} file(s).`);
  } else if (orphans.length > 0) {
    console.log('Dry run — re-run with --apply to delete these files.');
  }

  await db.core.close();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error('Cleanup failed:', err);
    process.exit(1);
  });
}
