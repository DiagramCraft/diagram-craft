import { describe, expect, it } from 'vitest';
import {
  createTextAnchor,
  isTextAnchorStale,
  reanchorText
} from '@arch-register/api-types/textAnchor';

describe('createTextAnchor', () => {
  it('captures quote and surrounding context', () => {
    const body = 'The quick brown fox jumps over the lazy dog.';
    const start = body.indexOf('brown fox');
    const end = start + 'brown fox'.length;
    const anchor = createTextAnchor(body, start, end, 6);
    expect(anchor.quote).toBe('brown fox');
    expect(anchor.prefix).toBe('quick ');
    expect(anchor.suffix).toBe(' jumps');
    expect(anchor.start).toBe(start);
    expect(anchor.end).toBe(end);
  });
});

describe('reanchorText', () => {
  it('returns exact when the document is unchanged', () => {
    const body = 'The quick brown fox jumps over the lazy dog.';
    const anchor = createTextAnchor(body, 10, 19); // "brown fox"
    const result = reanchorText(body, anchor);
    expect(result).toEqual({ status: 'exact', start: 10, end: 19 });
  });

  it('relocates the quote when unrelated text shifts offsets', () => {
    const body = 'The quick brown fox jumps over the lazy dog.';
    const anchor = createTextAnchor(body, body.indexOf('brown fox'), body.indexOf('brown fox') + 9);

    const edited = 'Once upon a time, ' + body; // insert text before the quote
    const result = reanchorText(edited, anchor);

    expect(result.status).toBe('exact');
    if (result.status === 'exact') {
      expect(edited.slice(result.start, result.end)).toBe('brown fox');
    }
  });

  it('disambiguates duplicate quotes using prefix/suffix context', () => {
    const body = 'Section A: the answer is yes. Section B: the answer is no.';
    const start = body.indexOf('the answer is yes');
    const anchor = createTextAnchor(body, start, start + 'the answer is yes'.length, 12);

    const result = reanchorText(body, anchor);
    expect(result.status).toBe('exact');
    if (result.status === 'exact') {
      expect(body.slice(result.start, result.end)).toBe('the answer is yes');
      expect(body.slice(Math.max(0, result.start - 12), result.start)).toContain('Section A');
    }
  });

  it('fuzzy-matches through minor nearby edits', () => {
    const body = 'Please review the quarterly report before Friday.';
    const start = body.indexOf('quarterly report');
    const anchor = createTextAnchor(body, start, start + 'quarterly report'.length);

    const edited = 'Please kindly review the quarterly report before next Friday please.';
    const result = reanchorText(edited, anchor);

    expect(result.status === 'exact' || result.status === 'fuzzy').toBe(true);
    if (result.status !== 'orphaned') {
      expect(edited.slice(result.start, result.end)).toContain('quarterly report');
    }
  });

  it('marks the anchor orphaned when the quoted text is deleted', () => {
    const body = 'Please review the quarterly report before Friday.';
    const start = body.indexOf('quarterly report');
    const anchor = createTextAnchor(body, start, start + 'quarterly report'.length);

    const edited = 'Please review the document before Friday.';
    const result = reanchorText(edited, anchor);

    expect(result.status).toBe('orphaned');
  });

  it('handles MDX source content with markdown syntax around the quote', () => {
    const body = [
      '# Heading',
      '',
      'This is a **bold claim** about the system, followed by more prose.',
      '',
      '```ts',
      'const x = 1;',
      '```'
    ].join('\n');
    const start = body.indexOf('**bold claim**');
    const anchor = createTextAnchor(body, start, start + '**bold claim**'.length);

    const result = reanchorText(body, anchor);
    expect(result).toEqual({ status: 'exact', start, end: start + '**bold claim**'.length });
  });
});

describe('isTextAnchorStale', () => {
  it('is false when the anchor still resolves', () => {
    const body = 'Please review the quarterly report before Friday.';
    const start = body.indexOf('quarterly report');
    const anchor = createTextAnchor(body, start, start + 'quarterly report'.length);
    expect(isTextAnchorStale(body, anchor)).toBe(false);
  });

  it('is true once the quoted text is gone', () => {
    const body = 'Please review the quarterly report before Friday.';
    const start = body.indexOf('quarterly report');
    const anchor = createTextAnchor(body, start, start + 'quarterly report'.length);
    expect(isTextAnchorStale('Please review the document before Friday.', anchor)).toBe(true);
  });
});
