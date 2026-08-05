import { describe, expect, it } from 'vitest';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { RelationSchemaDbResult } from './db/relationDatabase';
import type { SchemaDbResult } from './db/catalogDatabase';
import { validateEntityQueryIR } from './entityQueryIRValidator';
import { compileEntityQueryIR } from './entityQueryIRCompiler';

const now = new Date('2026-06-29T12:00:00.000Z');
const system: SchemaDbResult = {
  id: 'system',
  workspace: 'ws-1',
  name: 'System',
  description: '',
  fields: [
    {
      id: 'data_flows_out',
      name: 'Data flows out',
      type: 'typedRelation',
      relationSchemaId: 'data-flow',
      direction: 'out'
    }
  ],
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'SYS',
  created_at: now,
  updated_at: now
};
const relation: RelationSchemaDbResult = {
  id: 'data-flow',
  workspace: 'ws-1',
  name: 'Data Flow',
  description: '',
  in_schema_ids: ['system'],
  out_schema_ids: ['system'],
  fields: [
    { id: 'status', name: 'Status', type: 'text' },
    { id: 'note', name: 'Note', type: 'text' }
  ],
  groups: [],
  color: null,
  icon: null,
  created_at: now,
  updated_at: now
};

const schemas = new Map([[system.id, system]]);
const relationSchemas = new Map([[relation.id, relation]]);

describe('typed scalar relation query compilation', () => {
  it('compiles a direction-aware relation hop and same-relation scalar filter', () => {
    const query: EntityQuery = {
      root: {
        kind: 'predicate',
        path: [
          {
            kind: 'typedRelation',
            fieldId: 'data_flows_out',
            relationSchemaId: relation.id,
            direction: 'out',
            ownerSchemaIds: [system.id],
            filter: {
              kind: 'predicate',
              path: [],
              fieldId: 'status',
              op: 'equals',
              value: 'active'
            }
          }
        ],
        fieldId: '_name',
        op: 'equals',
        value: 'System B'
      }
    };
    expect(validateEntityQueryIR(query, schemas, null, relationSchemas)).toEqual({ ok: true });

    const compiled = compileEntityQueryIR(
      query,
      schemas,
      'sqlite',
      'ws-1',
      {},
      null,
      relationSchemas
    );
    expect(compiled.sql).toContain('JOIN scoped_relation pb_rel_query_path_0_1');
    expect(compiled.sql).toContain('pb_rel_query_path_0_1.out_record_id = pb_root_query_path_0.id');
    expect(compiled.sql).toContain("json_extract(pb_rel_query_path_0_1.data, '$.status')");
    expect(compiled.params).toContain(relation.id);
    expect(compiled.params).toContain('active');
    expect(compiled.sql).toContain('LEFT JOIN scoped_entity in_relation_source_endpoint');
    expect(compiled.sql).toContain(
      'r.schema_id = ? AND out_relation_source_endpoint.schema_id IN (?)'
    );
  });

  it('projects a scalar relation field through a typed relation path', () => {
    const query: EntityQuery = {
      root: {
        kind: 'relationExists',
        path: [
          {
            kind: 'typedRelation',
            fieldId: 'data_flows_out',
            relationSchemaId: relation.id,
            direction: 'out',
            ownerSchemaIds: [system.id]
          }
        ]
      },
      projections: [
        {
          path: [
            {
              kind: 'typedRelation',
              fieldId: 'data_flows_out',
              relationSchemaId: relation.id,
              direction: 'out',
              ownerSchemaIds: [system.id]
            }
          ],
          fieldId: 'status',
          source: 'relation'
        },
        {
          path: [
            {
              kind: 'typedRelation',
              fieldId: 'data_flows_out',
              relationSchemaId: relation.id,
              direction: 'out',
              ownerSchemaIds: [system.id]
            }
          ],
          fieldId: 'note',
          source: 'relation'
        }
      ]
    };
    expect(validateEntityQueryIR(query, schemas, null, relationSchemas)).toEqual({ ok: true });
    const compiled = compileEntityQueryIR(
      query,
      schemas,
      'postgres',
      'ws-1',
      {},
      null,
      relationSchemas
    );
    expect(compiled.sql).toContain('query_path_0 AS');
    expect(compiled.sql).toContain('pb_rel_query_path_0_1.data AS relation_1_data');
    expect(compiled.sql).toContain("pv_query_path_0.relation_1_data->'status'");
    expect(compiled.sql).toContain("pv_query_path_0.relation_1_data->'note'");
    expect(compiled.sql).not.toContain('JOIN scoped_relation pv_relation_query_path_0');
  });

  it('narrows the relation source for a projection-only typed relation path', () => {
    const path = [
      {
        kind: 'typedRelation' as const,
        fieldId: 'data_flows_out',
        relationSchemaId: relation.id,
        direction: 'out' as const,
        ownerSchemaIds: [system.id]
      }
    ];
    const query: EntityQuery = {
      root: { kind: 'and', children: [] },
      projections: [{ path, fieldId: 'status', source: 'relation' }]
    };
    expect(validateEntityQueryIR(query, schemas, null, relationSchemas)).toEqual({ ok: true });

    const compiled = compileEntityQueryIR(
      query,
      schemas,
      'postgres',
      'ws-1',
      {},
      null,
      relationSchemas
    );
    expect(compiled.sql).toContain('LEFT JOIN scoped_entity in_relation_source_endpoint');
    expect(compiled.sql).toMatch(
      /r\.schema_id = \$\d+ AND out_relation_source_endpoint\.schema_id IN \(\$\d+\)/
    );
  });
});
