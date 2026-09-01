import type { Meta } from '@storybook/react-vite';
import { useState } from 'react';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type {
  WorkspaceLifecycleState,
  WorkspaceOwnerOption
} from '@arch-register/api-types/workspaceContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import { QueryBuilder } from './QueryBuilder';
import { pathStepSummary } from './pathSummary';

const mockSchemas: EntitySchema[] = [
  {
    id: 'component',
    workspace: 'test',
    name: 'Component',
    category: null,
    description: 'Component schema',
    key_prefix: 'CMP',
    icon: 'box',
    color: '#3b82f6',
    entity_count: 0,
    version: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    fields: [
      { id: 'release_cycle', name: 'Release cycle', type: 'text' },
      { id: 'radar_status', name: 'Radar status', type: 'select', enumId: 'radar', options: [] },
      {
        id: 'system',
        name: 'System',
        type: 'reference',
        schemaId: 'system',
        predicate: 'runs on',
        minCount: 0,
        maxCount: 1
      }
    ],
    templates: [],
    groups: []
  },
  {
    id: 'system',
    workspace: 'test',
    name: 'System',
    category: null,
    description: 'System schema',
    key_prefix: 'SYS',
    icon: 'server',
    color: '#8b5cf6',
    entity_count: 0,
    version: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    fields: [
      { id: 'tier', name: 'Tier', type: 'text' },
      {
        id: 'domain',
        name: 'Domain',
        type: 'reference',
        schemaId: 'domain',
        predicate: 'belongs to',
        minCount: 0,
        maxCount: 1
      }
    ],
    templates: [],
    groups: []
  },
  {
    id: 'domain',
    workspace: 'test',
    name: 'Domain',
    category: null,
    description: 'Domain schema',
    key_prefix: 'DOM',
    icon: 'globe',
    color: '#14b8a6',
    entity_count: 0,
    version: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    fields: [{ id: 'portfolio', name: 'Portfolio', type: 'text' }],
    templates: [],
    groups: []
  }
];

const mockLifecycleStates: WorkspaceLifecycleState[] = [
  { id: 'active', label: 'Active', color: '#22c55e', sort_order: 0 },
  { id: 'retired', label: 'Retired', color: '#ef4444', sort_order: 1 }
];

const mockOwners: WorkspaceOwnerOption[] = [
  { id: 'team-a', name: 'Platform Engineering', sort_order: 0 },
  { id: 'team-b', name: 'Payments', sort_order: 1 }
];

const mockEnums: WorkspaceEnum[] = [
  {
    id: 'radar',
    workspace: 'test',
    name: 'Radar status',
    category: null,
    options: [
      { value: 'hold', label: 'Hold', description: null, retired: false, restricted: false },
      { value: 'assess', label: 'Assess', description: null, retired: false, restricted: false }
    ],
    sort_order: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
];

const meta = {
  title: 'Sections/Entities/QueryBuilder',
  component: QueryBuilder,
  parameters: { layout: 'centered' }
} satisfies Meta<typeof QueryBuilder>;

export default meta;

const Harness = ({ initial }: { initial: EntityQuery }) => {
  const [query, setQuery] = useState<EntityQuery>(initial);
  return (
    <div style={{ width: 560, border: '1px solid var(--panel-border, #ddd)', borderRadius: 6 }}>
      <QueryBuilder
        query={query}
        onChange={setQuery}
        schemas={mockSchemas}
        lifecycleStates={mockLifecycleStates}
        owners={mockOwners}
        enums={mockEnums}
        textPreview={describe(query)}
      />
      <pre style={{ fontSize: 10, padding: 12, margin: 0, whiteSpace: 'pre-wrap' }}>
        {JSON.stringify(query, null, 2)}
      </pre>
    </div>
  );
};

// A stand-in for the real `printText` endpoint, good enough for the story's preview line.
const describe = (query: EntityQuery): string => {
  const node = (n: EntityQuery['root']): string => {
    switch (n.kind) {
      case 'and':
        return n.children.map(node).join(' AND ');
      case 'or':
        return `(${n.children.map(node).join(' OR ')})`;
      case 'not':
        return `NOT ${node(n.child)}`;
      case 'freeText':
        return `text:"${n.value}"`;
      case 'relationExists':
        return pathStepSummary(n.path);
      case 'predicate': {
        const prefix = n.path.length ? `${pathStepSummary(n.path)}.` : '';
        return `${prefix}${n.fieldId} ${n.op} ${JSON.stringify(n.value)}`;
      }
      default:
        return '?';
    }
  };
  const schema = query.schemaId ? `schema:${query.schemaId} ` : '';
  return schema + node(query.root);
};

export const Empty = () => <Harness initial={{ root: { kind: 'and', children: [] } }} />;

export const FlatConditions = () => (
  <Harness
    initial={{
      schemaId: 'component',
      root: {
        kind: 'and',
        children: [
          { kind: 'predicate', path: [], fieldId: '_name', op: 'contains', value: 'api' },
          { kind: 'predicate', path: [], fieldId: '_owner', op: 'equals', value: 'team-a' }
        ]
      }
    }}
  />
);

export const NestedGroupWithNot = () => (
  <Harness
    initial={{
      schemaId: 'component',
      root: {
        kind: 'and',
        children: [
          {
            kind: 'or',
            children: [
              { kind: 'predicate', path: [], fieldId: 'radar_status', op: 'equals', value: 'hold' },
              {
                kind: 'predicate',
                path: [],
                fieldId: 'radar_status',
                op: 'equals',
                value: 'assess'
              }
            ]
          },
          {
            kind: 'not',
            child: {
              kind: 'predicate',
              path: [],
              fieldId: '_lifecycle',
              op: 'equals',
              value: 'retired'
            }
          }
        ]
      }
    }}
  />
);

export const DeeplyNestedGroups = () => (
  <Harness
    initial={{
      schemaId: 'component',
      root: {
        kind: 'and',
        children: [
          { kind: 'predicate', path: [], fieldId: '_name', op: 'contains', value: 'api' },
          {
            kind: 'or',
            children: [
              { kind: 'predicate', path: [], fieldId: '_owner', op: 'equals', value: 'team-a' },
              {
                kind: 'and',
                children: [
                  {
                    kind: 'predicate',
                    path: [],
                    fieldId: 'radar_status',
                    op: 'equals',
                    value: 'hold'
                  },
                  {
                    kind: 'not',
                    child: {
                      kind: 'or',
                      children: [
                        {
                          kind: 'predicate',
                          path: [],
                          fieldId: '_lifecycle',
                          op: 'equals',
                          value: 'retired'
                        }
                      ]
                    }
                  }
                ]
              }
            ]
          }
        ]
      }
    }}
  />
);

export const WithTraversalPredicate = () => (
  <Harness
    initial={{
      schemaId: 'component',
      root: {
        kind: 'and',
        children: [
          {
            kind: 'predicate',
            path: [
              { kind: 'forward', fieldId: 'system' },
              { kind: 'forward', fieldId: 'domain' }
            ],
            fieldId: '_name',
            op: 'equals',
            value: 'Platform Engineering'
          }
        ]
      }
    }}
  />
);

const mockRelationSchemas: RelationSchema[] = [
  {
    id: 'runs_on',
    workspace: 'test',
    name: 'Runs on',
    category: null,
    description: '',
    in: { schemaIds: ['component'] },
    out: { schemaIds: ['system'] },
    fields: [
      { id: 'criticality', name: 'Criticality', type: 'select', enumId: 'radar' } as never
    ],
    groups: [],
    color: null,
    icon: null,
    relation_count: 0,
    version: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  } as RelationSchema
];

const RelationHarness = ({ initial }: { initial: EntityQuery }) => {
  const [query, setQuery] = useState<EntityQuery>(initial);
  return (
    <div style={{ width: 560, border: '1px solid var(--panel-border, #ddd)', borderRadius: 6 }}>
      <QueryBuilder
        rootKind="relation"
        query={query}
        onChange={setQuery}
        schemas={mockSchemas}
        relationSchemas={mockRelationSchemas}
        lifecycleStates={mockLifecycleStates}
        owners={mockOwners}
        enums={mockEnums}
        showFreeText={false}
        textPreview={describe(query)}
      />
      <pre style={{ fontSize: 10, padding: 12, margin: 0, whiteSpace: 'pre-wrap' }}>
        {JSON.stringify(query, null, 2)}
      </pre>
    </div>
  );
};

export const RelationRooted = () => (
  <RelationHarness
    initial={{
      root_kind: 'relation',
      root: {
        kind: 'and',
        children: [
          { kind: 'predicate', path: [], fieldId: 'criticality', op: 'equals', value: 'hold' },
          {
            kind: 'predicate',
            path: [{ kind: 'endpoint', direction: 'out' }],
            fieldId: 'tier',
            op: 'equals',
            value: '1'
          }
        ]
      }
    }}
  />
);

export const WithScopedHopFilter = () => (
  <Harness
    initial={{
      schemaId: 'component',
      root: {
        kind: 'and',
        children: [
          {
            kind: 'relationExists',
            path: [
              {
                kind: 'forward',
                fieldId: 'system',
                filter: {
                  kind: 'and',
                  children: [
                    { kind: 'predicate', path: [], fieldId: 'tier', op: 'equals', value: '1' }
                  ]
                }
              }
            ]
          }
        ]
      }
    }}
  />
);
