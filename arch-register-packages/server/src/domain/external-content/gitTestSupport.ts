import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Runs git in a fixture repository without the developer's global/system git config, so local
 * commit hooks (e.g. secret scanners via core.hooksPath), signing, or templates cannot slow down
 * or alter test setup.
 */
export const runFixtureGit = (cwd: string, ...args: string[]) =>
  execFileAsync('git', args, {
    cwd,
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' }
  });
