import { describe, expect, it } from 'vitest';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import {
  buildEntityQueryPlanInputs,
  buildQueryFragments,
  renderEntityQueryCount,
  renderEntityQueryRows
} from './entityQueryIRSqlAssembly';
import type { RelationSchemaCatalog, SchemaCatalog } from './entityQueryIRResolution';

describe('entity query SQL assembly', () => {
  it('shares semantic and permission plans while keeping row/count allocators independent', () => {
    const query: EntityQuery = {
      root: { kind: 'and', children: [] }
    };
    const schemas: SchemaCatalog = new Map();
    const relationSchemas: RelationSchemaCatalog = new Map();
    const options = { limit: 25, offset: 5 };
    const prepared = buildEntityQueryPlanInputs(query, schemas, relationSchemas, options, null);
    const rowFragments = buildQueryFragments(
      query,
      schemas,
      'sqlite',
      'ws-1',
      options,
      null,
      relationSchemas,
      true,
      prepared
    );
    const countFragments = buildQueryFragments(
      query,
      schemas,
      'sqlite',
      'ws-1',
      options,
      null,
      relationSchemas,
      false,
      prepared
    );

    expect(rowFragments.state.semanticPlan).toBe(prepared.semanticPlan);
    expect(countFragments.state.semanticPlan).toBe(prepared.semanticPlan);
    expect(rowFragments.state.permissionPlan).toBe(prepared.permissionPlan);
    expect(countFragments.state.permissionPlan).toBe(prepared.permissionPlan);

    const rows = renderEntityQueryRows(rowFragments);
    const count = renderEntityQueryCount(countFragments);

    expect(rows.params.slice(0, count.params.length)).toEqual(count.params);
    expect(rows.params.slice(-2)).toEqual([25, 5]);
    expect(rows.sql).toContain('LIMIT ? OFFSET ?');
    expect(count.sql).not.toContain('LIMIT ?');
  });
});
