import { execFile } from 'node:child_process';
import { mkdir, stat } from 'node:fs/promises';
import { promisify } from 'node:util';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import type { GitSourceConfig } from './db/externalContentDatabase';

const execFileAsync = promisify(execFile);
const MAX_FILE_BYTES = Number(process.env['EXTERNAL_CONTENT_MAX_FILE_BYTES'] ?? 50 * 1024 * 1024);

export type GitSnapshotFile = {
  path: string;
  size: number;
  content: Buffer;
};

export type GitSnapshot = {
  revision: string;
  files: GitSnapshotFile[];
};

const gitEnv = () => ({
  ...process.env,
  GIT_TERMINAL_PROMPT: '0',
  GCM_INTERACTIVE: 'Never',
  GIT_CONFIG_NOSYSTEM: '1'
});

const runGit = async (args: string[], maxBuffer = 2 * 1024 * 1024) =>
  execFileAsync('git', args, { env: gitEnv(), maxBuffer, encoding: 'buffer' });

const cachePathFor = (sourceId: string) =>
  join(process.env['EXTERNAL_CONTENT_CACHE_DIR'] ?? join(tmpdir(), 'arch-register-external-content'), sourceId);

const ensureMirror = async (sourceId: string, config: GitSourceConfig) => {
  const root = process.env['EXTERNAL_CONTENT_CACHE_DIR'] ?? join(tmpdir(), 'arch-register-external-content');
  await mkdir(root, { recursive: true });
  const path = cachePathFor(sourceId);
  let exists = true;
  try { await stat(path); } catch { exists = false; }
  if (!exists) {
    await runGit(['clone', '--mirror', '--no-tags', '--', config.url, path], 16 * 1024 * 1024);
  } else {
    await runGit(['-C', path, 'remote', 'update', '--prune'], 16 * 1024 * 1024);
  }
  return path;
};

const resolveHead = async (repoPath: string) => {
  const result = await runGit(['-C', repoPath, 'ls-remote', '--symref', 'origin', 'HEAD']);
  const line = result.stdout
    .toString('utf8')
    .split('\n')
    .find(value => /^[0-9a-f]{40}\tHEAD$/i.test(value));
  if (!line) throw new Error('Git repository does not advertise a default branch');
  const revision = line.split('\t')[0]?.trim();
  if (!revision || !/^[0-9a-f]{40}$/i.test(revision)) throw new Error('Git repository returned an invalid HEAD revision');
  return revision;
};

const parseTree = (output: string, sourcePath: string) => {
  const prefix = sourcePath ? `${sourcePath}/` : '';
  return output.split('\0').filter(Boolean).map(record => {
    const tab = record.indexOf('\t');
    if (tab < 0) throw new Error('Git returned an invalid tree entry');
    const [mode, kind, objectId, sizeText] = record.slice(0, tab).split(/\s+/);
    const path = record.slice(tab + 1);
    if (kind !== 'blob') return null;
    if (!path.startsWith(prefix)) return null;
    const relative = path.slice(prefix.length);
    if (!relative || relative.includes('\0')) return null;
    const size = sizeText === '-' ? MAX_FILE_BYTES + 1 : Number(sizeText);
    if (size > MAX_FILE_BYTES) throw new Error(`Git file '${relative}' exceeds the ${MAX_FILE_BYTES} byte limit`);
    if (mode === '120000' || mode === '160000') return null;
    return { path: relative, objectId, size };
  }).filter((entry): entry is { path: string; objectId: string; size: number } => entry !== null);
};

export const prepareGitRepository = (sourceId: string, config: GitSourceConfig) =>
  ensureMirror(sourceId, config);

export const readGitSnapshot = async (repoPath: string, sourcePath: string): Promise<GitSnapshot> => {
  const revision = await resolveHead(repoPath);
  const tree = await runGit(['-C', repoPath, 'ls-tree', '-r', '-l', '-z', revision, '--', sourcePath]);
  const entries = parseTree(tree.stdout.toString('utf8'), sourcePath);
  if (entries.length === 0) throw new Error(`Git source path '${sourcePath || '/'}' contains no files`);
  const files = await Promise.all(entries.map(async entry => {
    const result = await runGit(['-C', repoPath, 'show', `${revision}:${sourcePath ? `${sourcePath}/${entry.path}` : entry.path}`], MAX_FILE_BYTES + 1);
    return { path: entry.path, size: entry.size, content: Buffer.from(result.stdout) };
  }));
  return { revision, files };
};

export const fetchGitSnapshot = async (sourceId: string, config: GitSourceConfig, sourcePath: string): Promise<GitSnapshot> => {
  const repoPath = await prepareGitRepository(sourceId, config);
  return readGitSnapshot(repoPath, sourcePath);
};

export const gitFileName = (path: string) => basename(path);
