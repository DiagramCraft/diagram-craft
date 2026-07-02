import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getUnifiedOpenAPISpec } from '../openapi';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const committedPath = resolve(scriptDir, '../../openapi.json');

const main = async () => {
  const spec = await getUnifiedOpenAPISpec();
  const generated = `${JSON.stringify(spec, null, 2)}\n`;
  const committed = await readFile(committedPath, 'utf8');

  if (generated !== committed) {
    console.error(
      `${committedPath} is out of sync with the oRPC contracts.\n` +
        'Run "pnpm --filter @arch-register/server openapi:generate" and commit the result.'
    );
    process.exit(1);
  }

  console.log(`${committedPath} is up to date.`);
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
