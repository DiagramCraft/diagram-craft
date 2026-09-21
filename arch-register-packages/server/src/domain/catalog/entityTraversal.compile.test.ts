import { describe, expect, it } from 'vitest';
import { buildAuthorizationContext } from '@arch-register/permissions';
import { buildMetricTraversalPlan } from '../metrics/metricTraversalPlan';
import { compileEntityTraversal } from './entityTraversal';

describe('metric traversal compilation', () => {
  it('compiles a capability leaf-count request', () => {
    const schemas = [
      {
        id: 'business-capability',
        workspace: 'workspace-1',
        name: 'Business Capability',
        fields: [
          {
            id: 'parent',
            name: 'Parent',
            type: 'containment',
            schemaId: 'business-capability',
            minCount: 0,
            maxCount: 1
          },
          { id: 'maturity', name: 'Maturity', type: 'number' }
        ]
      }
    ] as any;
    const metric = {
      sourceSchemaId: 'business-capability',
      source: { kind: 'field', fieldId: 'maturity' },
      aggregation: 'leafCount'
    } as any;
    const plan = buildMetricTraversalPlan(
      ['00000000-0000-0000-001f-000000000227'],
      metric,
      schemas,
      null,
      { projectScope: 'all' }
    );
    const authCtx = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      schemas: [],
      entities: [],
      grants: []
    });
    const compiled = compileEntityTraversal(plan, schemas, [], 'postgres', 'workspace-1', authCtx);

    expect(compiled.params).not.toContain(null);
    expect(compiled.params).not.toContain(undefined);
    expect(compiled.sql).toMatch(/schema_id = \$\d+::uuid/);
    for (let index = 1; index <= compiled.params.length; index++) {
      expect(compiled.sql).toMatch(new RegExp(`\\$${index}(?!\\d)`));
    }
  });
});
