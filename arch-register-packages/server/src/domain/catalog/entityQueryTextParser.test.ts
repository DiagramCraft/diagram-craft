import { describe, expect, it } from 'vitest';
import { parseTextQuery } from './entityQueryTextParser';
import { tokenize } from './entityQueryTextTokenizer';

describe('entity query text parser', () => {
  it('parses boolean precedence and records top-level schema references', () => {
    const syntax = parseTextQuery(
      tokenize('schema:Technology category = "library" OR NOT radar_status = "hold"')
    );

    expect(syntax.topLevelSchemaRefs).toEqual([{ value: 'Technology', offset: 7 }]);
    expect(syntax.root).toMatchObject({
      kind: 'or',
      children: [
        {
          kind: 'and',
          children: [
            { kind: 'schema', schemaRef: { value: 'Technology', offset: 7 } },
            {
              kind: 'path',
              steps: [{ kind: 'field', field: { value: 'category', offset: 18 } }],
              comparator: { text: '=', offset: 27 }
            }
          ]
        },
        { kind: 'not', child: { kind: 'path' } }
      ]
    });
  });

  it('parses nested relation filters without needing catalog metadata', () => {
    const syntax = parseTextQuery(tokenize('links[status = "open"].name'));
    expect(syntax.root).toMatchObject({
      kind: 'path',
      steps: [
        {
          kind: 'field',
          field: { value: 'links' },
          filter: {
            kind: 'path',
            steps: [{ kind: 'field', field: { value: 'status' } }],
            comparator: { text: '=' },
            value: { kind: 'literal', value: 'open' }
          }
        },
        { kind: 'field', field: { value: 'name' } }
      ]
    });
  });
});
