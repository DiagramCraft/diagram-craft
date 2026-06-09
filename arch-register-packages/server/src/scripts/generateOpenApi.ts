import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getWorkspaceEnumOpenAPISpec } from '../domain/catalog/enumOrpc';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const outputPath = resolve(scriptDir, '../../openapi.orpc-enums.json');

const main = async () => {
  const spec = await getWorkspaceEnumOpenAPISpec();

  await writeFile(outputPath, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');

  console.log(`Wrote ${outputPath}`);
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
