import { describe, expect, it } from 'vitest';
import { buildWrappedQueryText, extractTerminalIds } from './useEntityDrawerQueryItem';

describe('buildWrappedQueryText', () => {
  it('wraps the path expression with a root predicate anchored to the entity', () => {
    expect(
      buildWrappedQueryText(
        'Business Capability',
        'cap-1',
        'subtree(parent).->"Business Capability Supports Entity"'
      )
    ).toBe(
      'schema:"Business Capability" _id = "cap-1" columns path subtree(parent).->"Business Capability Supports Entity" as "value"'
    );
  });

  it('escapes quotes and backslashes in the schema name and entity id', () => {
    expect(buildWrappedQueryText('Say "Hi"', 'id\\1', 'parent')).toBe(
      'schema:"Say \\"Hi\\"" _id = "id\\\\1" columns path parent as "value"'
    );
  });
});

describe('extractTerminalIds', () => {
  const hop = (id: string, schemaId: string) => ({ context: 'entity' as const, id, schemaId });

  it('takes the last hop of each chain', () => {
    expect(
      extractTerminalIds([[hop('child-1', 'business_capability'), hop('app-1', 'application')]])
    ).toEqual(['app-1']);
  });

  it('dedupes terminal ids across chains', () => {
    expect(
      extractTerminalIds([[hop('app-1', 'application')], [hop('app-1', 'application')]])
    ).toEqual(['app-1']);
  });

  it('returns an empty array for no chains', () => {
    expect(extractTerminalIds([])).toEqual([]);
  });
});
