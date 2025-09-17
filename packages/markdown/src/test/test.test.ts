import { describe, it, expect } from 'vitest';
import { MarkdownEngine, markdownToHTML } from '../index';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const PATH = 'packages/markdown/src/test';

const verifyHtmlFixture = (engine: MarkdownEngine, filename: string): void => {
  const expectedHtml = readFileSync(join(PATH, filename + '.html'), 'utf-8');
  const inputText = readFileSync(join(PATH, filename + '.txt'), 'utf8');
  const parser = engine.parser();
  parser.parse(inputText);
  const actualHtml = markdownToHTML(inputText);

  expect(actualHtml).toBe(expectedHtml);
};

describe('Babelmark', () => {
  const engine = new MarkdownEngine();

  describe('list', () => {
    const files = readdirSync(`${PATH}/babelmark/lists`);
    files.forEach(file => {
      if (file.match(/txt$/)) {
        describe(file, () => {
          it('should match expected output', () => {
            const baseName = file.substring(0, file.length - 4);
            verifyHtmlFixture(engine, 'babelmark/lists/' + baseName);
          });
        });
      }
    });
  });

  describe('links', () => {
    const files = readdirSync(`${PATH}/babelmark/links`);
    files.forEach(file => {
      if (file.match(/txt$/)) {
        describe(file, () => {
          it('should match expected output', () => {
            const baseName = file.substring(0, file.length - 4);
            verifyHtmlFixture(engine, 'babelmark/links/' + baseName);
          });
        });
      }
    });
  });

  describe('inline_markup', () => {
    const files = readdirSync(`${PATH}/babelmark/inline_markup`);
    files.forEach(file => {
      if (file.match(/txt$/)) {
        describe(file, () => {
          it('should match expected output', () => {
            const baseName = file.substring(0, file.length - 4);
            verifyHtmlFixture(engine, 'babelmark/inline_markup/' + baseName);
          });
        });
      }
    });
  });

  describe('raw_html', () => {
    const files = readdirSync(`${PATH}/babelmark/raw_html`);
    files.forEach(file => {
      if (file.match(/txt$/)) {
        describe(file, () => {
          it('should match expected output', () => {
            const baseName = file.substring(0, file.length - 4);
            verifyHtmlFixture(engine, 'babelmark/raw_html/' + baseName);
          });
        });
      }
    });
  });

  describe('other', () => {
    const files = readdirSync(`${PATH}/babelmark/other`);
    files.forEach(file => {
      if (file.match(/txt$/)) {
        describe(file, () => {
          it('should match expected output', () => {
            const baseName = file.substring(0, file.length - 4);
            verifyHtmlFixture(engine, 'babelmark/other/' + baseName);
          });
        });
      }
    });
  });
});
