import { describe, it, expect } from 'vitest';
import { MarkdownEngine, markdownToHTML } from '../markdown';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

function verifyFixture(engine: MarkdownEngine, filename: string): void {
	const expectedJson = readFileSync(join("src/test", filename + ".json"), "utf8");
	const inputText = readFileSync(join("src/test", filename + ".txt"), "utf8");
	const parser = engine.parser();
	const result = parser.parse(inputText);

	expect(JSON.stringify(result, null, 2)).toBe(expectedJson);
}

function verifyHtmlFixture(engine: MarkdownEngine, filename: string): void {
	const expectedHtml = readFileSync(join("src/test", filename + ".html"), "ascii");
	const inputText = readFileSync(join("src/test", filename + ".txt"), "utf8");
	const parser = engine.parser();
	const ast = parser.parse(inputText);
	const actualHtml = markdownToHTML(inputText);

	expect(actualHtml).toBe(expectedHtml);
}

describe('Babelmark', () => {
	const engine = new MarkdownEngine();

	describe('list', () => {
		const files = readdirSync("src/test/babelmark/lists");
		files.forEach(file => {
			if (file.match(/txt$/)) {
				describe(file, () => {
					it("should match expected output", () => {
						const baseName = file.substring(0, file.length - 4);
						verifyHtmlFixture(engine, "babelmark/lists/" + baseName);
					});
				});
			}
		});
	});

	describe('links', () => {
		const files = readdirSync("src/test/babelmark/links");
		files.forEach(file => {
			if (file.match(/txt$/)) {
				describe(file, () => {
					it("should match expected output", () => {
						const baseName = file.substring(0, file.length - 4);
						verifyHtmlFixture(engine, "babelmark/links/" + baseName);
					});
				});
			}
		});
	});

	describe('inline_markup', () => {
		const files = readdirSync("src/test/babelmark/inline_markup");
		files.forEach(file => {
			if (file.match(/txt$/)) {
				describe(file, () => {
					it("should match expected output", () => {
						const baseName = file.substring(0, file.length - 4);
						verifyHtmlFixture(engine, "babelmark/inline_markup/" + baseName);
					});
				});
			}
		});
	});

	describe('raw_html', () => {
		const files = readdirSync("src/test/babelmark/raw_html");
		files.forEach(file => {
			if (file.match(/txt$/)) {
				describe(file, () => {
					it("should match expected output", () => {
						const baseName = file.substring(0, file.length - 4);
						verifyHtmlFixture(engine, "babelmark/raw_html/" + baseName);
					});
				});
			}
		});
	});

	describe('other', () => {
		const files = readdirSync("src/test/babelmark/other");
		files.forEach(file => {
			if (file.match(/txt$/)) {
				describe(file, () => {
					it("should match expected output", () => {
						const baseName = file.substring(0, file.length - 4);
						verifyHtmlFixture(engine, "babelmark/other/" + baseName);
					});
				});
			}
		});
	});
});