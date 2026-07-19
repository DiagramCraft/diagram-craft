import { execFile } from 'node:child_process';
import { mkdir, stat } from 'node:fs/promises';
import { promisify } from 'node:util';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import type { GitSourceConfig } from './db/externalContentDatabase';
import { assertSafeGitUrl } from './gitUrlSafety';

const execFileAsync = promisify(execFile);
const positiveEnvNumber = (name: string, fallback: number) => {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const MAX_FILE_BYTES = positiveEnvNumber('EXTERNAL_CONTENT_MAX_FILE_BYTES', 50 * 1024 * 1024);
const MAX_FILES = positiveEnvNumber('EXTERNAL_CONTENT_MAX_FILES', 10_000);
const MAX_TOTAL_FILE_BYTES = positiveEnvNumber(
  'EXTERNAL_CONTENT_MAX_TOTAL_FILE_BYTES',
  500 * 1024 * 1024
);
const MAX_REPOSITORY_BYTES = positiveEnvNumber(
  'EXTERNAL_CONTENT_MAX_REPOSITORY_BYTES',
  1 * 1024 * 1024 * 1024
);
const MAX_CONCURRENT_FILE_READS = Math.max(
  1,
  Math.floor(positiveEnvNumber('EXTERNAL_CONTENT_MAX_CONCURRENT_FILE_READS', 8))
);
const GIT_TIMEOUT_MS = positiveEnvNumber('EXTERNAL_CONTENT_GIT_TIMEOUT_MS', 5 * 60 * 1000);

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw signal.reason ?? new Error('Job execution aborted');
};

export type GitSnapshotFile = {
  path: string;
  size: number;
  content: Buffer;
};

export type GitSnapshot = {
  revision: string;
  files: GitSnapshotFile[];
};

const gitHome = () =>
  join(
    process.env['EXTERNAL_CONTENT_CACHE_DIR'] ?? join(tmpdir(), 'arch-register-external-content'),
    'git-home'
  );

const gitEnv = () => ({
  ...process.env,
  GIT_TERMINAL_PROMPT: '0',
  GCM_INTERACTIVE: 'Never',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: join(gitHome(), 'empty-git-config'),
  XDG_CONFIG_HOME: gitHome(),
  HOME: gitHome(),
  USERPROFILE: gitHome()
});

const runGit = async (args: string[], maxBuffer = 2 * 1024 * 1024, signal?: AbortSignal) =>
  execFileAsync('git', ['-c', 'http.followRedirects=false', ...args], {
    env: gitEnv(),
    maxBuffer,
    timeout: GIT_TIMEOUT_MS,
    killSignal: 'SIGKILL',
    signal,
    encoding: 'buffer'
  });

const cachePathFor = (sourceId: string) =>
  join(
    process.env['EXTERNAL_CONTENT_CACHE_DIR'] ?? join(tmpdir(), 'arch-register-external-content'),
    sourceId
  );

const ensureMirror = async (sourceId: string, config: GitSourceConfig, signal?: AbortSignal) => {
  throwIfAborted(signal);
  const root =
    process.env['EXTERNAL_CONTENT_CACHE_DIR'] ?? join(tmpdir(), 'arch-register-external-content');
  await mkdir(root, { recursive: true });
  await mkdir(gitHome(), { recursive: true });
  await assertSafeGitUrl(config.url);
  throwIfAborted(signal);
  const path = cachePathFor(sourceId);
  let exists = true;
  try {
    await stat(path);
  } catch {
    exists = false;
  }
  if (!exists) {
    await runGit(
      ['clone', '--bare', '--single-branch', '--depth=1', '--no-tags', '--', config.url, path],
      16 * 1024 * 1024,
      signal
    );
  } else {
    await runGit(['-C', path, 'remote', 'update', '--prune'], 16 * 1024 * 1024, signal);
  }
  const objectStats = await runGit(['-C', path, 'count-objects', '-v'], 2 * 1024 * 1024, signal);
  const repositoryBytes = objectStats.stdout
    .toString('utf8')
    .split('\n')
    .reduce((total, line) => {
      const match = /^size(?:-pack)?:\s*(\d+)$/.exec(line);
      return match ? total + Number(match[1]) * 1024 : total;
    }, 0);
  if (repositoryBytes > MAX_REPOSITORY_BYTES) {
    throw new Error(`Git repository exceeds the ${MAX_REPOSITORY_BYTES} byte limit`);
  }
  return path;
};

const resolveHead = async (repoPath: string, signal?: AbortSignal) => {
  const result = await runGit(
    ['-C', repoPath, 'ls-remote', '--symref', 'origin', 'HEAD'],
    2 * 1024 * 1024,
    signal
  );
  const line = result.stdout
    .toString('utf8')
    .split('\n')
    .find(value => /^[0-9a-f]{40}\tHEAD$/i.test(value));
  if (!line) throw new Error('Git repository does not advertise a default branch');
  const revision = line.split('\t')[0]?.trim();
  if (!revision || !/^[0-9a-f]{40}$/i.test(revision))
    throw new Error('Git repository returned an invalid HEAD revision');
  return revision;
};

const parseTree = (output: string, sourcePath: string) => {
  const prefix = sourcePath ? `${sourcePath}/` : '';
  const entries = output
    .split('\0')
    .filter(Boolean)
    .map(record => {
      const tab = record.indexOf('\t');
      if (tab < 0) throw new Error('Git returned an invalid tree entry');
      const [mode, kind, objectId, sizeText] = record.slice(0, tab).split(/\s+/);
      const path = record.slice(tab + 1);
      if (kind !== 'blob') return null;
      if (!path.startsWith(prefix)) return null;
      const relative = path.slice(prefix.length);
      if (!relative || relative.includes('\0')) return null;
      const size = sizeText === '-' ? MAX_FILE_BYTES + 1 : Number(sizeText);
      if (!Number.isFinite(size) || size > MAX_FILE_BYTES)
        throw new Error(`Git file '${relative}' exceeds the ${MAX_FILE_BYTES} byte limit`);
      if (mode === '120000' || mode === '160000') return null;
      return { path: relative, objectId, size };
    })
    .filter((entry): entry is { path: string; objectId: string; size: number } => entry !== null);
  if (entries.length > MAX_FILES)
    throw new Error(`Git source contains more than the ${MAX_FILES} file limit`);
  const totalBytes = entries.reduce((total, entry) => total + entry.size, 0);
  if (totalBytes > MAX_TOTAL_FILE_BYTES)
    throw new Error(`Git source exceeds the ${MAX_TOTAL_FILE_BYTES} byte content limit`);
  return entries;
};

export const prepareGitRepository = (
  sourceId: string,
  config: GitSourceConfig,
  signal?: AbortSignal
) => ensureMirror(sourceId, config, signal);

export const readGitSnapshot = async (
  repoPath: string,
  sourcePath: string,
  signal?: AbortSignal
): Promise<GitSnapshot> => {
  throwIfAborted(signal);
  const revision = await resolveHead(repoPath, signal);
  const treeArgs = ['-C', repoPath, 'ls-tree', '-r', '-l', '-z', revision];
  if (sourcePath) treeArgs.push('--', sourcePath);
  const tree = await runGit(treeArgs, 2 * 1024 * 1024, signal);
  const entries = parseTree(tree.stdout.toString('utf8'), sourcePath);
  if (entries.length === 0)
    throw new Error(`Git source path '${sourcePath || '/'}' contains no files`);
  const files = new Array<GitSnapshotFile>(entries.length);
  let nextIndex = 0;
  const readNext = async () => {
    while (true) {
      throwIfAborted(signal);
      const index = nextIndex++;
      if (index >= entries.length) return;
      const entry = entries[index]!;
      const result = await runGit(
        [
          '-C',
          repoPath,
          'show',
          `${revision}:${sourcePath ? `${sourcePath}/${entry.path}` : entry.path}`
        ],
        MAX_FILE_BYTES + 1,
        signal
      );
      files[index] = { path: entry.path, size: entry.size, content: Buffer.from(result.stdout) };
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENT_FILE_READS, entries.length) }, () => readNext())
  );
  return { revision, files };
};

export const fetchGitSnapshot = async (
  sourceId: string,
  config: GitSourceConfig,
  sourcePath: string,
  signal?: AbortSignal
): Promise<GitSnapshot> => {
  const repoPath = await ensureMirror(sourceId, config, signal);
  return readGitSnapshot(repoPath, sourcePath, signal);
};

export const gitFileName = (path: string) => basename(path);
