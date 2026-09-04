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

  it('parses a columns sub-clause alongside a scoped filter', () => {
    const syntax = parseTextQuery(
      tokenize('releases[eol_date < date("2026-06-30") columns eol_date as "EOL", latest_version]')
    );
    expect(syntax.root).toMatchObject({
      kind: 'path',
      steps: [
        {
          kind: 'field',
          field: { value: 'releases' },
          filter: { kind: 'path', steps: [{ kind: 'field', field: { value: 'eol_date' } }] },
          captures: [
            {
              includePath: false,
              steps: [{ kind: 'field', field: { value: 'eol_date' } }],
              alias: 'EOL'
            },
            {
              includePath: false,
              steps: [{ kind: 'field', field: { value: 'latest_version' } }]
            }
          ]
        }
      ]
    });
  });

  it('parses a capture-only bracket and a path marker', () => {
    const syntax = parseTextQuery(tokenize('releases[columns path technology as "Path"]'));
    expect(syntax.root).toMatchObject({
      kind: 'path',
      steps: [
        {
          kind: 'field',
          field: { value: 'releases' },
          captures: [
            { includePath: true, steps: [{ kind: 'field', field: { value: 'technology' } }] }
          ]
        }
      ]
    });
    expect((syntax.root as { steps: { filter?: unknown }[] }).steps[0]!.filter).toBeUndefined();
  });

  it('treats `columns` before a comparator as a field, not the clause', () => {
    const syntax = parseTextQuery(tokenize('releases[columns = "x"]'));
    expect(syntax.root).toMatchObject({
      kind: 'path',
      steps: [
        {
          kind: 'field',
          field: { value: 'releases' },
          filter: {
            kind: 'path',
            steps: [{ kind: 'field', field: { value: 'columns' } }],
            comparator: { text: '=' }
          }
        }
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
