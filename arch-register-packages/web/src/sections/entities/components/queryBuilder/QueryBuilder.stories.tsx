import type { Meta } from '@storybook/react-vite';
import { useState } from 'react';
import type {
  EntityQuery,
  FilterOp,
  PathStep,
  QueryNode
} from '@arch-register/api-types/entityQueryIR';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type {
  WorkspaceLifecycleState,
  WorkspaceOwnerOption
} from '@arch-register/api-types/workspaceContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { FieldGroupAccess, FieldGroupAccessControl } from '@arch-register/permissions';
import { QueryBuilder } from './QueryBuilder';
import { pathStepSummary } from './pathSummary';

// ─────────────────────────────────────────────────────────────────────────────
// Mock workspace catalog
// ─────────────────────────────────────────────────────────────────────────────

const ref = (id: string, name: string, schemaId: string, maxCount = 1) =>
  ({ id, name, type: 'reference', schemaId, minCount: 0, maxCount, predicate: name }) as never;

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
      { id: 'eol_date', name: 'EOL date', type: 'date' },
      { id: 'instance_count', name: 'Instance count', type: 'number' },
      { id: 'is_critical', name: 'Business critical', type: 'boolean' },
      { id: 'internal_note', name: 'Internal note', type: 'text', groupId: 'restricted' },
      ref('system', 'System', 'system'),
      ref('technology_releases', 'Technology releases', 'technology_release', 50)
    ],
    templates: [],
    groups: [
      {
        id: 'restricted',
        name: 'Restricted',
        accessControl: { teamIds: ['secops'] }
      } as never
    ]
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
      { id: 'tier', name: 'Tier', type: 'select', enumId: 'tier', options: [] },
      { id: 'owner_email', name: 'Owner email', type: 'text' },
      ref('domain', 'Domain', 'domain')
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
    fields: [
      { id: 'portfolio', name: 'Portfolio', type: 'text' },
      ref('parent', 'Parent', 'domain')
    ],
    templates: [],
    groups: []
  },
  {
    id: 'technology_release',
    workspace: 'test',
    name: 'Technology Release',
    category: null,
    description: '',
    key_prefix: 'TR',
    icon: 'package',
    color: '#f59e0b',
    entity_count: 0,
    version: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    fields: [
      { id: 'eol_date', name: 'EOL date', type: 'date' },
      { id: 'release_cycle', name: 'Release cycle', type: 'number' },
      ref('technology', 'Technology', 'technology')
    ],
    templates: [],
    groups: []
  },
  {
    id: 'technology',
    workspace: 'test',
    name: 'Technology',
    category: null,
    description: '',
    key_prefix: 'TECH',
    icon: 'cpu',
    color: '#ec4899',
    entity_count: 0,
    version: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    fields: [{ id: 'vendor', name: 'Vendor', type: 'text' }],
    templates: [],
    groups: []
  },
  {
    id: 'data_entity',
    workspace: 'test',
    name: 'Data Entity',
    category: null,
    description: '',
    key_prefix: 'DE',
    icon: 'database',
    color: '#0ea5e9',
    entity_count: 0,
    version: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    fields: [
      {
        id: 'classification',
        name: 'Classification',
        type: 'select',
        enumId: 'classification',
        options: []
      }
    ],
    templates: [],
    groups: []
  }
];

const mockLifecycleStates: WorkspaceLifecycleState[] = [
  { id: 'active', label: 'Active', color: '#22c55e', sort_order: 0 },
  { id: 'deprecated', label: 'Deprecated', color: '#f59e0b', sort_order: 1 },
  { id: 'retired', label: 'Retired', color: '#ef4444', sort_order: 2 }
];

const mockOwners: WorkspaceOwnerOption[] = [
  { id: 'team-a', name: 'Platform Engineering', sort_order: 0 },
  { id: 'team-b', name: 'Payments', sort_order: 1 },
  { id: 'team-c', name: 'Data Platform', sort_order: 2 }
];

const mockEnums: WorkspaceEnum[] = [
  {
    id: 'radar',
    workspace: 'test',
    name: 'Radar status',
    category: null,
    options: [
      { value: 'hold', label: 'Hold', description: null, retired: false, restricted: false },
      { value: 'assess', label: 'Assess', description: null, retired: false, restricted: false },
      { value: 'adopt', label: 'Adopt', description: null, retired: false, restricted: false }
    ],
    sort_order: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'tier',
    workspace: 'test',
    name: 'Tier',
    category: null,
    options: [
      { value: '1', label: 'Tier 1', description: null, retired: false, restricted: false },
      { value: '2', label: 'Tier 2', description: null, retired: false, restricted: false },
      { value: '3', label: 'Tier 3', description: null, retired: false, restricted: false }
    ],
    sort_order: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'classification',
    workspace: 'test',
    name: 'Classification',
    category: null,
    options: [
      { value: 'public', label: 'Public', description: null, retired: false, restricted: false },
      {
        value: 'sensitive',
        label: 'Sensitive',
        description: null,
        retired: false,
        restricted: false
      }
    ],
    sort_order: 2,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
];

const mockRelationSchemas: RelationSchema[] = [
  {
    id: 'runs_on',
    workspace: 'test',
    name: 'Runs on',
    category: null,
    description: '',
    in: { schemaIds: ['component'] },
    out: { schemaIds: ['system'] },
    fields: [{ id: 'criticality', name: 'Criticality', type: 'select', enumId: 'radar' } as never],
    groups: [],
    color: null,
    icon: null,
    relation_count: 0,
    version: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  } as RelationSchema,
  // Mirrors the seeded "Data Flow" relation schema (server/src/db/seedData/schemaTemplates.ts) - a
  // Data Flow's own scalar field plus its `data_entities` entityRelation field (#2670), the shape
  // #3120's relationForward stories below exercise.
  {
    id: 'data_flow',
    workspace: 'test',
    name: 'Data Flow',
    category: null,
    description: '',
    in: { schemaIds: ['system'], label: 'Source' },
    out: { schemaIds: ['system'], label: 'Destination' },
    fields: [
      {
        id: 'data_classification',
        name: 'Data classification',
        type: 'select',
        enumId: 'classification'
      } as never,
      {
        id: 'data_entities',
        name: 'Data',
        type: 'entityRelation',
        predicate: 'carries',
        schemaId: 'data_entity',
        minCount: 0,
        maxCount: -1
      } as never
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

const mockAssessment = {
  id: 'assessment-1',
  name: 'Security Review',
  fields: [
    { id: 'risk', label: 'Risk score', type: 'rating' },
    { id: 'posture', label: 'Security posture', type: 'enum', enumId: 'radar' }
  ]
} as unknown as Assessment;

const denyRestricted = (accessControl: FieldGroupAccessControl | undefined): FieldGroupAccess =>
  accessControl?.teamIds?.includes('secops') ? 'none' : 'edit';

// ─────────────────────────────────────────────────────────────────────────────
// Harness
// ─────────────────────────────────────────────────────────────────────────────

type HarnessProps = {
  initial: EntityQuery;
  rootKind?: 'entity' | 'relation';
  showFreeText?: boolean;
  joinedAssessment?: Assessment | null;
  getFieldGroupAccess?: (accessControl: FieldGroupAccessControl | undefined) => FieldGroupAccess;
};

const Harness = ({
  initial,
  rootKind = 'entity',
  showFreeText = rootKind === 'entity',
  joinedAssessment,
  getFieldGroupAccess
}: HarnessProps) => {
  const [query, setQuery] = useState<EntityQuery>(initial);
  // Mirrors the real popover container: the builder renders inside `Popover.Content`
  // (`.filterPopover`, padding zeroed), which is what `.container`'s own 520px width assumes.
  return (
    <div
      style={{
        border: '1px solid var(--panel-border, #d4d4d8)',
        borderRadius: 8,
        boxShadow: '0 4px 20px rgb(0 0 0 / 12%)',
        overflow: 'hidden',
        background: 'var(--panel-bg, #fff)'
      }}
    >
      <QueryBuilder
        rootKind={rootKind}
        query={query}
        onChange={setQuery}
        schemas={mockSchemas}
        relationSchemas={mockRelationSchemas}
        lifecycleStates={mockLifecycleStates}
        owners={mockOwners}
        enums={mockEnums}
        joinedAssessment={joinedAssessment}
        getFieldGroupAccess={getFieldGroupAccess}
        showFreeText={showFreeText}
        textPreview={describe(query)}
      />
    </div>
  );
};

// A stand-in for the real `printText` endpoint - enough for the preview line.
const describe = (query: EntityQuery): string => {
  const pathStr = (path: PathStep[]): string =>
    path
      .map(step => {
        const base = pathStepSummary([step]);
        return 'filter' in step && step.filter ? `${base}[${node(step.filter)}]` : base;
      })
      .join('.');
  const node = (n: QueryNode): string => {
    switch (n.kind) {
      case 'and':
        return n.children.map(node).join(' AND ') || 'ALL';
      case 'or':
        return `(${n.children.map(node).join(' OR ')})`;
      case 'not':
        return `NOT ${node(n.child)}`;
      case 'freeText':
        return `text:"${n.value}"`;
      case 'relationExists':
        return `${pathStr(n.path)} exists`;
      case 'predicate': {
        const prefix = n.path.length ? `${pathStr(n.path)}.` : '';
        return `${prefix}${n.fieldId} ${n.op} ${JSON.stringify(n.value)}`;
      }
      default:
        return '?';
    }
  };
  const scope =
    query.root_kind === 'relation'
      ? 'relation '
      : query.schemaId
        ? `schema:${query.schemaId} `
        : '';
  const cols = query.projections?.length
    ? `  ·  columns ${query.projections
        .map(
          p =>
            `${p.chain ? 'chain ' : ''}${pathStepSummary(p.path)}.${p.fieldId}${p.alias ? ` as ${p.alias}` : ''}`
        )
        .join(', ')}`
    : '';
  return scope + node(query.root) + cols;
};

const meta = {
  title: 'Sections/Entities/QueryBuilder',
  component: QueryBuilder,
  parameters: { layout: 'centered' }
} satisfies Meta<typeof QueryBuilder>;

export default meta;

// convenience builders
const p = (fieldId: string, op: FilterOp, value: unknown): QueryNode => ({
  kind: 'predicate',
  path: [],
  fieldId,
  op,
  value
});
const fwd = (fieldId: string): PathStep => ({ kind: 'forward', fieldId });

// ─────────────────────────────────────────────────────────────────────────────
// Basics
// ─────────────────────────────────────────────────────────────────────────────

export const Empty = () => <Harness initial={{ root: { kind: 'and', children: [] } }} />;

export const SingleCondition = () => (
  <Harness
    initial={{
      schemaId: 'component',
      root: { kind: 'and', children: [p('_name', 'contains', 'gateway')] }
    }}
  />
);

export const FlatConditions = () => (
  <Harness
    initial={{
      schemaId: 'component',
      root: {
        kind: 'and',
        children: [
          p('_name', 'contains', 'api'),
          p('_owner', 'equals', 'team-a'),
          p('_lifecycle', 'not_equals', 'retired')
        ]
      }
    }}
  />
);

export const AllValueEditors = () => (
  <Harness
    joinedAssessment={mockAssessment}
    initial={{
      schemaId: 'component',
      root: {
        kind: 'and',
        children: [
          p('release_cycle', 'contains', '2.'),
          p('radar_status', 'equals', 'hold'),
          p('eol_date', 'before', '2026-06-30'),
          p('eol_date', 'after', { $now: true, offsetDays: 30 }),
          p('instance_count', 'gte', 3),
          p('is_critical', 'equals', 'true'),
          p('_assessment:risk', 'gte', 4),
          p('_assessment', 'not_empty', null)
        ]
      }
    }}
  />
);

// `showFreeText` (default for entity root): the free-text clause is owned by the top-bar
// "Search text…" box; the builder strips it from the boolean tree so it isn't shown twice.
export const WithFreeText = () => (
  <Harness
    initial={{
      schemaId: 'component',
      root: {
        kind: 'and',
        children: [
          { kind: 'freeText', value: 'payment gateway' },
          p('radar_status', 'equals', 'hold')
        ]
      }
    }}
  />
);

// `showFreeText={false}` (how the entity browser embeds it — a separate live-search box owns `q`):
// a `freeText` node in the query renders as a condition row whose field is "Free text"; every
// condition row's field dropdown also offers "Free text" to convert into / out of one.
export const FreeTextInTree = () => (
  <Harness
    showFreeText={false}
    initial={{
      schemaId: 'component',
      root: {
        kind: 'and',
        children: [
          { kind: 'freeText', value: 'payment gateway' },
          p('radar_status', 'equals', 'hold')
        ]
      }
    }}
  />
);

// Free text combined with a field predicate under OR - only expressible in the tree, not via the
// top-bar box (which is always root-level AND). "Free text" is in every row's field dropdown here
// (root OR + nested groups); it's hidden only on a root AND that the top-bar box owns.
export const FreeTextInOrGroup = () => (
  <Harness
    initial={{
      schemaId: 'component',
      root: {
        kind: 'or',
        children: [{ kind: 'freeText', value: 'gateway' }, p('_owner', 'equals', 'team-a')]
      }
    }}
  />
);

// ─────────────────────────────────────────────────────────────────────────────
// Boolean structure
// ─────────────────────────────────────────────────────────────────────────────

export const AnyGroupAtRoot = () => (
  <Harness
    initial={{
      schemaId: 'component',
      root: {
        kind: 'or',
        children: [p('radar_status', 'equals', 'hold'), p('_lifecycle', 'equals', 'deprecated')]
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
            children: [p('radar_status', 'equals', 'hold'), p('radar_status', 'equals', 'assess')]
          },
          { kind: 'not', child: p('_lifecycle', 'equals', 'retired') }
        ]
      }
    }}
  />
);

export const NegatedGroup = () => (
  <Harness
    initial={{
      schemaId: 'component',
      root: {
        kind: 'and',
        children: [
          p('_owner', 'equals', 'team-a'),
          {
            kind: 'not',
            child: {
              kind: 'or',
              children: [
                p('_lifecycle', 'equals', 'retired'),
                p('_lifecycle', 'equals', 'deprecated')
              ]
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
          p('_name', 'contains', 'api'),
          {
            kind: 'or',
            children: [
              p('_owner', 'equals', 'team-a'),
              {
                kind: 'and',
                children: [
                  p('radar_status', 'equals', 'hold'),
                  {
                    kind: 'not',
                    child: {
                      kind: 'or',
                      children: [
                        p('_lifecycle', 'equals', 'retired'),
                        {
                          kind: 'and',
                          children: [
                            p('is_critical', 'equals', 'true'),
                            p('instance_count', 'lt', 2)
                          ]
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

export const EmptyNestedGroup = () => (
  <Harness
    initial={{
      schemaId: 'component',
      root: {
        kind: 'and',
        children: [p('_name', 'contains', 'api'), { kind: 'or', children: [] }]
      }
    }}
  />
);

// ─────────────────────────────────────────────────────────────────────────────
// Type scope
// ─────────────────────────────────────────────────────────────────────────────

export const AnyType = () => (
  <Harness initial={{ root: { kind: 'and', children: [p('_name', 'contains', 'api')] } }} />
);

export const TypeScoped = () => (
  <Harness
    initial={{
      schemaId: 'system',
      root: {
        kind: 'and',
        children: [p('tier', 'equals', '1'), p('owner_email', 'ends_with', '@acme.com')]
      }
    }}
  />
);

// ─────────────────────────────────────────────────────────────────────────────
// Relation traversal
// ─────────────────────────────────────────────────────────────────────────────

export const SingleHopTraversal = () => (
  <Harness
    initial={{
      schemaId: 'component',
      root: {
        kind: 'and',
        children: [
          { kind: 'predicate', path: [fwd('system')], fieldId: 'tier', op: 'equals', value: '1' }
        ]
      }
    }}
  />
);

export const MultiHopTraversal = () => (
  <Harness
    initial={{
      schemaId: 'component',
      root: {
        kind: 'and',
        children: [
          {
            kind: 'predicate',
            path: [fwd('system'), fwd('domain')],
            fieldId: '_name',
            op: 'equals',
            value: 'Payments'
          }
        ]
      }
    }}
  />
);

export const DeepTraversal = () => (
  <Harness
    initial={{
      schemaId: 'component',
      root: {
        kind: 'and',
        children: [
          {
            kind: 'predicate',
            path: [fwd('system'), fwd('domain'), fwd('parent'), fwd('parent')],
            fieldId: 'portfolio',
            op: 'equals',
            value: 'Consumer'
          }
        ]
      }
    }}
  />
);

export const RelationExistsLeaf = () => (
  <Harness
    initial={{
      schemaId: 'component',
      root: {
        kind: 'and',
        children: [{ kind: 'relationExists', path: [fwd('technology_releases')] }]
      }
    }}
  />
);

export const TraversalWithScopedFilter = () => (
  <Harness
    initial={{
      schemaId: 'component',
      root: {
        kind: 'and',
        children: [
          {
            kind: 'predicate',
            path: [
              {
                kind: 'forward',
                fieldId: 'technology_releases',
                filter: {
                  kind: 'and',
                  children: [
                    {
                      kind: 'predicate',
                      path: [fwd('technology')],
                      fieldId: '_slug',
                      op: 'equals',
                      value: 'go'
                    },
                    p('release_cycle', 'lt', 2)
                  ]
                }
              }
            ],
            fieldId: 'eol_date',
            op: 'before',
            value: '2026-06-30'
          }
        ]
      }
    }}
  />
);

// The layout case the "where" panels were reworked for: a 3-hop path with scoped
// filters on the 1st and 3rd hops - each panel should read directly under its hop.
export const MultipleScopedFilters = () => (
  <Harness
    initial={{
      schemaId: 'component',
      root: {
        kind: 'and',
        children: [
          {
            kind: 'predicate',
            path: [
              {
                kind: 'forward',
                fieldId: 'system',
                filter: { kind: 'and', children: [p('tier', 'equals', '1')] }
              },
              fwd('domain'),
              {
                kind: 'forward',
                fieldId: 'parent',
                filter: { kind: 'and', children: [p('portfolio', 'contains', 'Core')] }
              }
            ],
            fieldId: '_name',
            op: 'contains',
            value: 'Platform'
          }
        ]
      }
    }}
  />
);

export const HopBudgetExceeded = () => (
  <Harness
    initial={{
      schemaId: 'domain',
      root: {
        kind: 'and',
        children: [
          {
            kind: 'predicate',
            path: [
              fwd('parent'),
              fwd('parent'),
              fwd('parent'),
              fwd('parent'),
              fwd('parent'),
              fwd('parent'),
              fwd('parent')
            ],
            fieldId: 'portfolio',
            op: 'equals',
            value: 'Top'
          }
        ]
      }
    }}
  />
);

// A relation-context step at an entity root - not visually editable, renders read-only.
export const ReadOnlyTraversal = () => (
  <Harness
    initial={{
      schemaId: 'component',
      root: {
        kind: 'and',
        children: [
          {
            kind: 'predicate',
            path: [{ kind: 'endpoint', direction: 'out' }],
            fieldId: '_name',
            op: 'equals',
            value: 'x'
          }
        ]
      }
    }}
  />
);

// ─────────────────────────────────────────────────────────────────────────────
// Projections
// ─────────────────────────────────────────────────────────────────────────────

export const ProjectionColumns = () => (
  <Harness
    initial={{
      schemaId: 'component',
      root: { kind: 'and', children: [p('_name', 'contains', 'api')] },
      projections: [
        { path: [fwd('system')], fieldId: 'tier', alias: 'System tier' },
        { path: [fwd('technology_releases')], fieldId: 'eol_date' },
        { path: [fwd('system'), fwd('domain')], fieldId: '_id', chain: true },
        {
          path: [fwd('system')],
          fieldId: 'criticality',
          source: 'relation',
          alias: 'Runs-on criticality'
        }
      ]
    }}
  />
);

// ─────────────────────────────────────────────────────────────────────────────
// Relation-rooted
// ─────────────────────────────────────────────────────────────────────────────

export const RelationRooted = () => (
  <Harness
    rootKind="relation"
    initial={{
      root_kind: 'relation',
      root: {
        kind: 'and',
        children: [
          p('_schemaId', 'equals', 'runs_on'),
          p('criticality', 'equals', 'hold'),
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

export const RelationWithGroups = () => (
  <Harness
    rootKind="relation"
    initial={{
      root_kind: 'relation',
      root: {
        kind: 'and',
        children: [
          p('_schemaId', 'equals', 'runs_on'),
          {
            kind: 'or',
            children: [
              p('criticality', 'equals', 'hold'),
              {
                kind: 'predicate',
                path: [{ kind: 'endpoint', direction: 'in' }],
                fieldId: 'is_critical',
                op: 'equals',
                value: 'true'
              }
            ]
          }
        ]
      }
    }}
  />
);

// A relationForward hop through a relation's own entityRelation field (#3120) - editable, same as
// the seeded "Restricted Data Flows" view's own OR-branch (server/src/db/seedData/views.ts).
export const RelationForwardTraversal = () => (
  <Harness
    rootKind="relation"
    initial={{
      root_kind: 'relation',
      root: {
        kind: 'and',
        children: [
          p('_schemaId', 'equals', 'data_flow'),
          {
            kind: 'or',
            children: [
              p('data_classification', 'in', ['sensitive']),
              {
                kind: 'predicate',
                path: [{ kind: 'relationForward', fieldId: 'data_entities' }],
                fieldId: 'classification',
                op: 'in',
                value: ['sensitive']
              }
            ]
          }
        ]
      },
      projections: [
        {
          path: [{ kind: 'relationForward', fieldId: 'data_entities' }],
          fieldId: 'classification',
          alias: 'Carried entity classification'
        }
      ]
    }}
  />
);

// A relation's fixed In/Out endpoint, traversed past the single-hop case the flat FilterRow
// handles - editable, chained into ordinary entity-side traversal.
export const EndpointTraversal = () => (
  <Harness
    rootKind="relation"
    initial={{
      root_kind: 'relation',
      root: {
        kind: 'and',
        children: [
          {
            kind: 'predicate',
            path: [{ kind: 'endpoint', direction: 'out' }, fwd('domain')],
            fieldId: 'portfolio',
            op: 'equals',
            value: 'Platform'
          }
        ]
      }
    }}
  />
);

// A scoped `[...]` "where" filter on a relation-context hop isn't visually editable yet (#3120) -
// stays read-only, unlike the same hop with no filter (RelationForwardTraversal above).
export const RelationForwardWithScopedFilterReadOnly = () => (
  <Harness
    rootKind="relation"
    initial={{
      root_kind: 'relation',
      root: {
        kind: 'and',
        children: [
          {
            kind: 'predicate',
            path: [
              {
                kind: 'relationForward',
                fieldId: 'data_entities',
                filter: {
                  kind: 'predicate',
                  path: [],
                  fieldId: '_name',
                  op: 'contains',
                  value: 'x'
                }
              }
            ],
            fieldId: 'classification',
            op: 'in',
            value: ['sensitive']
          }
        ]
      }
    }}
  />
);

// ─────────────────────────────────────────────────────────────────────────────
// Permissions
// ─────────────────────────────────────────────────────────────────────────────

// `internal_note` is in the `restricted` field group; with this access resolver it's
// dropped from every field picker.
export const RestrictedFieldGroup = () => (
  <Harness
    getFieldGroupAccess={denyRestricted}
    initial={{
      schemaId: 'component',
      root: { kind: 'and', children: [p('_name', 'contains', 'api')] }
    }}
  />
);

// ─────────────────────────────────────────────────────────────────────────────
// Everything at once
// ─────────────────────────────────────────────────────────────────────────────

export const KitchenSink = () => (
  <Harness
    joinedAssessment={mockAssessment}
    initial={{
      schemaId: 'component',
      root: {
        kind: 'and',
        children: [
          { kind: 'freeText', value: 'gateway' },
          p('radar_status', 'equals', 'hold'),
          {
            kind: 'or',
            children: [
              p('_owner', 'equals', 'team-a'),
              { kind: 'not', child: p('_lifecycle', 'equals', 'retired') }
            ]
          },
          {
            kind: 'predicate',
            path: [
              {
                kind: 'forward',
                fieldId: 'system',
                filter: { kind: 'and', children: [p('tier', 'equals', '1')] }
              },
              fwd('domain')
            ],
            fieldId: '_name',
            op: 'equals',
            value: 'Payments'
          },
          { kind: 'relationExists', path: [fwd('technology_releases')] }
        ]
      },
      projections: [
        { path: [fwd('system')], fieldId: 'tier', alias: 'System tier' },
        { path: [fwd('system'), fwd('domain')], fieldId: '_id', chain: true }
      ]
    }}
  />
);
