import { describe, it, expect } from 'vitest';
import { MarkdownEngine } from '../index';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const PATH = 'packages/markdown/src/test';

const verifyHtmlFixture = (engine: MarkdownEngine, filename: string): void => {
  const expectedHtml = readFileSync(join(PATH, filename + '.out'), 'utf8').trim();
  const inputText = readFileSync(join(PATH, filename + '.md'), 'utf8');
  const parser = engine.parser();
  const ast = parser.parse(inputText);
  const actualHtml = engine.toHTML(ast).trim();

  expect(actualHtml).toBe(expectedHtml);
};

describe('Markdown Testsuite', () => {
  const engine = new MarkdownEngine();

  const files = readdirSync(`${PATH}/markdown-testsuite/tests`);
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
