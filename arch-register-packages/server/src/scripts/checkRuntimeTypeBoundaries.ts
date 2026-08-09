import { readFile } from 'node:fs/promises';

const boundaryFiles = [
  '../domain/ai/aiOrpc.ts',
  '../domain/ai/tanstackAiAdapter.ts',
  '../domain/workspace/workspaceOrpc.ts',
  '../domain/workspace/exportSchemas.ts',
  '../domain/workspace/importParseOperations.ts',
  '../domain/workspace/importAppliers.ts',
  '../utils/zipBuilder.ts'
];

const forbiddenAssertions = /\bas\s+(?:any|unknown\s+as)\b/g;
const baseUrl = new URL('./', import.meta.url);

const violations: string[] = [];
for (const relativePath of boundaryFiles) {
  const filename = new URL(relativePath, baseUrl);
  const source = await readFile(filename, 'utf8');
  for (const [lineIndex, line] of source.split('\n').entries()) {
    if (forbiddenAssertions.test(line)) {
      violations.push(`${relativePath}:${lineIndex + 1}: ${line.trim()}`);
    }
    forbiddenAssertions.lastIndex = 0;
  }
}

if (violations.length > 0) {
  console.error('Unsafe assertions found in runtime boundary files:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
}
