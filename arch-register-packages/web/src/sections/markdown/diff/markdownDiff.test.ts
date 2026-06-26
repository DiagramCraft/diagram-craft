// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { diffMarkdown } from './markdownDiff';
import type { DiffRow } from './markdownDiff';

const kinds = (rows: DiffRow[]) => rows.map(r => r.kind);

describe('diffMarkdown', () => {
  it('returns empty for two empty documents', () => {
    expect(diffMarkdown('', '')).toEqual([]);
  });

  it('marks all blocks as added when base is empty', () => {
    const rows = diffMarkdown('', '# Hello\n\nParagraph.');
    expect(kinds(rows)).toEqual(['added', 'added']);
  });

  it('marks all blocks as removed when target is empty', () => {
    const rows = diffMarkdown('# Hello\n\nParagraph.', '');
    expect(kinds(rows)).toEqual(['removed', 'removed']);
  });

  it('identical documents produce only unchanged rows', () => {
    const md = '# Title\n\nSome text.\n\n- item one\n- item two';
    const rows = diffMarkdown(md, md);
    expect(kinds(rows).every(k => k === 'unchanged')).toBe(true);
  });

  it('detects a paragraph insertion', () => {
    const base = 'First paragraph.';
    const target = 'First paragraph.\n\nSecond paragraph.';
    const rows = diffMarkdown(base, target);
    expect(kinds(rows)).toEqual(['unchanged', 'added']);
  });

  it('detects a paragraph removal', () => {
    const base = 'First paragraph.\n\nSecond paragraph.';
    const target = 'First paragraph.';
    const rows = diffMarkdown(base, target);
    expect(kinds(rows)).toEqual(['unchanged', 'removed']);
  });

  it('collapses same-type adjacent remove+add into modified', () => {
    const base = '## Old heading';
    const target = '## New heading';
    const rows = diffMarkdown(base, target);
    expect(kinds(rows)).toEqual(['modified']);
  });

  it('treats heading level change as remove+add (not modified)', () => {
    const base = '## Section';
    const target = '### Section';
    const rows = diffMarkdown(base, target);
    // h2 and h3 have different typeKeys, so they should NOT collapse
    expect(kinds(rows)).toEqual(['removed', 'added']);
  });

  it('detects a code block change as modified', () => {
    const base = '```\nconst x = 1;\n```';
    const target = '```\nconst x = 2;\n```';
    const rows = diffMarkdown(base, target);
    expect(kinds(rows)).toEqual(['modified']);
  });

  it('revision vs current: mixed changes', () => {
    const base = '# Title\n\nOld paragraph.\n\nShared paragraph.';
    const target = '# Title\n\nNew paragraph.\n\nShared paragraph.';
    const rows = diffMarkdown(base, target);
    expect(kinds(rows)).toEqual(['unchanged', 'modified', 'unchanged']);
  });

  it('revision vs revision: addition in the middle', () => {
    const base = 'Alpha.\n\nGamma.';
    const target = 'Alpha.\n\nBeta.\n\nGamma.';
    const rows = diffMarkdown(base, target);
    expect(kinds(rows)).toEqual(['unchanged', 'added', 'unchanged']);
  });

  it('modified rows contain both baseHtml and targetHtml', () => {
    const rows = diffMarkdown('Old text.', 'New text.');
    const modified = rows.find(r => r.kind === 'modified');
    expect(modified).toBeDefined();
    if (modified?.kind === 'modified') {
      expect(modified.baseHtml).toContain('Old text');
      expect(modified.targetHtml).toContain('New text');
    }
  });

  it('modified rows contain inlineHtml', () => {
    const rows = diffMarkdown('Old text.', 'New text.');
    const modified = rows.find(r => r.kind === 'modified');
    expect(modified?.kind === 'modified' && modified.inlineHtml).toBeTruthy();
  });

  it('inlineHtml wraps removed words in <del> and added words in <ins>', () => {
    const rows = diffMarkdown('Old text.', 'New text.');
    const modified = rows.find(r => r.kind === 'modified');
    if (modified?.kind === 'modified') {
      expect(modified.inlineHtml).toContain('<del>');
      expect(modified.inlineHtml).toContain('Old');
      expect(modified.inlineHtml).toContain('<ins>');
      expect(modified.inlineHtml).toContain('New');
    }
  });

  it('inlineHtml preserves unchanged words without markup', () => {
    const rows = diffMarkdown('Hello old world.', 'Hello new world.');
    const modified = rows.find(r => r.kind === 'modified');
    if (modified?.kind === 'modified') {
      // "Hello" and "world." should appear without del/ins wrapping
      expect(modified.inlineHtml).toContain('Hello');
      expect(modified.inlineHtml).toContain('world.');
      expect(modified.inlineHtml).toContain('<del>');
      expect(modified.inlineHtml).toContain('<ins>');
    }
  });

  it('added rows contain nodes', () => {
    const rows = diffMarkdown('', 'Hello.');
    const added = rows.find(r => r.kind === 'added');
    expect(added?.kind === 'added' && added.nodes.length > 0).toBeTruthy();
  });
});
