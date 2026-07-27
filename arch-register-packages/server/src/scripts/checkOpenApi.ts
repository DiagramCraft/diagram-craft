import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getApplicationOpenAPISpec,
  getDiagramCraftAdapterOpenAPISpec,
  getIntegrationOpenAPISpec,
  getUnifiedOpenAPISpec
} from '../openapi';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const artifacts = [
  { path: resolve(scriptDir, '../../openapi.json'), getSpec: getUnifiedOpenAPISpec },
  {
    path: resolve(scriptDir, '../../openapi/application-v1.json'),
    getSpec: getApplicationOpenAPISpec
  },
  {
    path: resolve(scriptDir, '../../openapi/integrations-v1.json'),
    getSpec: getIntegrationOpenAPISpec
  },
  {
    path: resolve(scriptDir, '../../openapi/adapters/diagram-craft.json'),
    getSpec: getDiagramCraftAdapterOpenAPISpec
  }
];

const main = async () => {
  for (const { path, getSpec } of artifacts) {
    const spec = await getSpec();
    const generated = `${JSON.stringify(spec, null, 2)}\n`;
    const committed = await readFile(path, 'utf8');

    if (generated !== committed) {
      console.error(
        `${path} is out of sync with the oRPC contracts.\n` +
          'Run "pnpm --filter @arch-register/server openapi:generate" and commit the result.'
      );
      process.exit(1);
    }

    console.log(`${path} is up to date.`);
  }
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
