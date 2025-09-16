import { describe, it, expect } from 'vitest';
import { MarkdownEngine } from '../markdown';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const verifyHtmlFixture = (engine: MarkdownEngine, filename: string): void => {
  const expectedHtml = readFileSync(
    join('packages/markdown/src/test', filename + '.out'),
    'utf8'
  ).trim();
  const inputText = readFileSync(join('packages/markdown/src/test', filename + '.md'), 'utf8');
  const parser = engine.parser();
  const ast = parser.parse(inputText);
  const actualHtml = engine.toHTML(ast).trim();

  expect(actualHtml).toBe(expectedHtml);
};

describe('Markdown Testsuite', () => {
  const engine = new MarkdownEngine();

  const files = readdirSync('packages/markdown/src/test/markdown-testsuite/tests');
  files.forEach(file => {
    if (file.match(/md$/) && !file.match(/link-automatic-email/) && !file.match(/EOL-CR/)) {
      describe(file, () => {
        it('should match expected output', () => {
          const baseName = file.substring(0, file.length - 3);
          verifyHtmlFixture(engine, 'markdown-testsuite/tests/' + baseName);
        });
      });
    }
  });
});
