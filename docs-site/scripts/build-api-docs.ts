import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const specPath = resolve(scriptDir, '../../arch-register-packages/server/openapi.json');
const outputDir = resolve(scriptDir, '../static/arch-register');
const outputPath = resolve(outputDir, 'api.html');

const main = async () => {
  await mkdir(outputDir, { recursive: true });

  const redoclyBin = resolve(scriptDir, '../node_modules/.bin/redocly');
  execFileSync(redoclyBin, ['build-docs', specPath, '-o', outputPath, '--title', 'Arch Register API'], {
    cwd: resolve(scriptDir, '..'),
    stdio: 'inherit'
  });
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
