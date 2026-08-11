import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getApplicationOpenAPISpec,
  getDiagramCraftAdapterOpenAPISpec,
  getIntegrationOpenAPISpec,
  getPublicCatalogOpenAPISpec,
  getUnifiedOpenAPISpec
} from '../openapi';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = resolve(scriptDir, '../../openapi');

const artifacts = [
  { path: resolve(scriptDir, '../../openapi.json'), getSpec: getUnifiedOpenAPISpec },
  { path: resolve(outputDir, 'application-v1.json'), getSpec: getApplicationOpenAPISpec },
  { path: resolve(outputDir, 'public-v1.json'), getSpec: getPublicCatalogOpenAPISpec },
  { path: resolve(outputDir, 'integrations-v1.json'), getSpec: getIntegrationOpenAPISpec },
  {
    path: resolve(outputDir, 'adapters/diagram-craft.json'),
    getSpec: getDiagramCraftAdapterOpenAPISpec
  }
];

const main = async () => {
  await mkdir(resolve(outputDir, 'adapters'), { recursive: true });
  await Promise.all(
    artifacts.map(async ({ path, getSpec }) => {
      const spec = await getSpec();
      await writeFile(path, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');
      console.log(`Wrote ${path}`);
    })
  );
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
