import { describe, expect, it } from 'vitest';
import { tokenize } from './entityQueryTextTokenizer';

describe('entity query text tokenizer', () => {
  it('emits tokens with source offsets and decoded values', () => {
    const tokens = tokenize('  name >= -2.5 AND title = "quoted"');

    expect(tokens.map(token => [token.kind, token.text])).toEqual([
      ['IDENT', 'name'],
      ['COMPARATOR', '>='],
      ['NUMBER', '-2.5'],
      ['AND', 'AND'],
      ['IDENT', 'title'],
      ['COMPARATOR', '='],
      ['STRING', '"quoted"'],
      ['EOF', '']
    ]);
    expect(tokens[0]?.offset).toBe(2);
    expect(tokens[2]?.value).toBe(-2.5);
    expect(tokens[6]?.value).toBe('quoted');
    expect(tokens.at(-1)?.offset).toBe(35);
  });

  it('keeps assessment field ids together despite the comparator character', () => {
    expect(tokenize('_assessment:riskLevel = 3')[0]).toMatchObject({
      kind: 'IDENT',
      text: '_assessment:riskLevel',
      offset: 0
    });
  });

  it('reports invalid escapes at the offending source position', () => {
    expect(() => tokenize('"bad\\n"')).toThrowError(/Invalid escape sequence/);
  });
});
