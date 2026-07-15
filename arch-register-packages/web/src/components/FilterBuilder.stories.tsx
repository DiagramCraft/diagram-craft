import type { Meta, StoryObj } from '@storybook/react-vite';
import { FilterBuilder } from './FilterBuilder';
import { useState } from 'react';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type {
  WorkspaceLifecycleState,
  WorkspaceOwnerOption
} from '@arch-register/api-types/workspaceContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';

const mockSchemas: EntitySchema[] = [
  {
    id: 'service',
    workspace: 'test',
    name: 'Service',
    description: 'Service schema',
    key_prefix: 'SVC',
    icon: 'server',
    color: '#3b82f6',
    entity_count: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    fields: [
      { id: 'version', name: 'Version', type: 'text' },
      { id: 'environment', name: 'Environment', type: 'select', enumId: 'env', options: [] },
      { id: 'deployDate', name: 'Deploy Date', type: 'date' },
      { id: 'active', name: 'Active', type: 'boolean' }
    ],
    templates: []
  },
  {
    id: 'database',
    workspace: 'test',
    name: 'Database',
    description: 'Database schema',
    key_prefix: 'DB',
    icon: 'database',
    color: '#8b5cf6',
    entity_count: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    fields: [
      { id: 'engine', name: 'Engine', type: 'select', enumId: 'dbEngine', options: [] },
      { id: 'size', name: 'Size (GB)', type: 'text' }
    ],
    templates: []
  }
];

const mockLifecycleStates: WorkspaceLifecycleState[] = [
  { id: 'active', label: 'Active', color: '#22c55e', sort_order: 0 },
  { id: 'deprecated', label: 'Deprecated', color: '#f59e0b', sort_order: 1 },
  { id: 'retired', label: 'Retired', color: '#ef4444', sort_order: 2 }
];

const mockOwners: WorkspaceOwnerOption[] = [
  { id: 'team-a', name: 'Team A', sort_order: 0 },
  { id: 'team-b', name: 'Team B', sort_order: 1 },
  { id: 'team-c', name: 'Team C', sort_order: 2 }
];

const mockEnums: WorkspaceEnum[] = [
  {
    id: 'env',
    workspace: 'test',
    name: 'Environment',
    options: [
      { value: 'dev', label: 'Development' },
      { value: 'staging', label: 'Staging' },
      { value: 'prod', label: 'Production' }
    ],
    sort_order: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'dbEngine',
    workspace: 'test',
    name: 'Database Engine',
    options: [
      { value: 'postgres', label: 'PostgreSQL' },
      { value: 'mysql', label: 'MySQL' },
      { value: 'mongodb', label: 'MongoDB' }
    ],
    sort_order: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
];

const meta = {
  title: 'Components/FilterBuilder',
  component: FilterBuilder,
  parameters: {
    layout: 'centered'
  },
  tags: ['autodocs']
} satisfies Meta<typeof FilterBuilder>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    conditions: [],
    onChange: () => {},
    schemas: mockSchemas,
    lifecycleStates: mockLifecycleStates,
    owners: mockOwners,
    enums: mockEnums
  }
};

export const SingleTextFilter: Story = {
  args: {
    conditions: [{ fieldId: '_name', op: 'contains', value: 'api' }],
    onChange: () => {},
    schemas: mockSchemas,
    lifecycleStates: mockLifecycleStates,
    owners: mockOwners,
    enums: mockEnums
  }
};

export const MultipleFilters: Story = {
  args: {
    conditions: [
      { fieldId: '_name', op: 'contains', value: 'service' },
      { fieldId: '_owner', op: 'equals', value: 'team-a' },
      { fieldId: '_lifecycle', op: 'equals', value: 'active' }
    ],
    onChange: () => {},
    schemas: mockSchemas,
    lifecycleStates: mockLifecycleStates,
    owners: mockOwners,
    enums: mockEnums
  }
};

export const WithSchemaFields: Story = {
  args: {
    conditions: [
      { fieldId: '_schemaId', op: 'equals', value: 'service' },
      { fieldId: 'environment', op: 'equals', value: 'prod' },
      { fieldId: 'active', op: 'equals', value: 'true' }
    ],
    onChange: () => {},
    schemas: mockSchemas,
    lifecycleStates: mockLifecycleStates,
    owners: mockOwners,
    enums: mockEnums,
    selectedSchemaId: 'service'
  }
};

export const DateFilters: Story = {
  args: {
    conditions: [
      { fieldId: 'deployDate', op: 'after', value: '2024-01-01' },
      { fieldId: 'deployDate', op: 'before', value: '2024-12-31' }
    ],
    onChange: () => {},
    schemas: mockSchemas,
    lifecycleStates: mockLifecycleStates,
    owners: mockOwners,
    enums: mockEnums,
    selectedSchemaId: 'service'
  }
};

export const EmptyOperators: Story = {
  args: {
    conditions: [
      { fieldId: '_description', op: 'empty', value: '' },
      { fieldId: '_namespace', op: 'not_empty', value: '' }
    ],
    onChange: () => {},
    schemas: mockSchemas,
    lifecycleStates: mockLifecycleStates,
    owners: mockOwners,
    enums: mockEnums
  }
};

export const Interactive = {
  render: () => {
    const [conditions, setConditions] = useState<FilterCondition[]>([
      { fieldId: '_name', op: 'contains', value: '' }
    ]);
    const [selectedSchema, setSelectedSchema] = useState<string | null>(null);

    return (
      <div style={{ width: '400px' }}>
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.5rem',
            background: '#f9fafb',
            borderRadius: '4px'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '0.5rem' }}>
            Schema Filter
          </div>
          <select
            value={selectedSchema ?? ''}
            onChange={e => {
              const val = e.target.value || null;
              setSelectedSchema(val);
              if (val) {
                setConditions([{ fieldId: '_schemaId', op: 'equals', value: val }]);
              }
            }}
            style={{
              width: '100%',
              padding: '4px 8px',
              border: '1px solid #e5e7eb',
              borderRadius: '4px'
            }}
          >
            <option value="">All Types</option>
            {mockSchemas.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <FilterBuilder
          conditions={conditions}
          onChange={setConditions}
          schemas={mockSchemas}
          lifecycleStates={mockLifecycleStates}
          owners={mockOwners}
          enums={mockEnums}
          selectedSchemaId={selectedSchema}
        />

        <div
          style={{
            marginTop: '1rem',
            padding: '0.5rem',
            background: '#f9fafb',
            borderRadius: '4px'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '0.5rem' }}>
            Current Filters ({conditions.length})
          </div>
          <pre
            style={{ fontSize: '10px', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
          >
            {JSON.stringify(conditions, null, 2)}
          </pre>
        </div>
      </div>
    );
  }
};

export const ComplexFilters: Story = {
  args: {
    conditions: [
      { fieldId: '_name', op: 'starts_with', value: 'api-' },
      { fieldId: '_owner', op: 'equals', value: 'team-a' },
      { fieldId: '_lifecycle', op: 'not_equals', value: 'retired' },
      { fieldId: '_description', op: 'not_empty', value: '' },
      { fieldId: 'environment', op: 'equals', value: 'prod' },
      { fieldId: 'deployDate', op: 'after', value: '2024-01-01' }
    ],
    onChange: () => {},
    schemas: mockSchemas,
    lifecycleStates: mockLifecycleStates,
    owners: mockOwners,
    enums: mockEnums,
    selectedSchemaId: 'service'
  }
};

export const WithCloseHandler = {
  render: () => {
    const [conditions, setConditions] = useState<FilterCondition[]>([
      { fieldId: '_name', op: 'contains', value: 'test' }
    ]);
    const [isOpen, setIsOpen] = useState(true);

    return (
      <div style={{ width: '400px' }}>
        {!isOpen && (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            style={{
              padding: '8px 16px',
              border: '1px solid #e5e7eb',
              borderRadius: '4px',
              background: 'white',
              cursor: 'pointer'
            }}
          >
            Open Filter Builder
          </button>
        )}

        {isOpen && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '4px' }}>
            <FilterBuilder
              conditions={conditions}
              onChange={setConditions}
              onClose={() => setIsOpen(false)}
              schemas={mockSchemas}
              lifecycleStates={mockLifecycleStates}
              owners={mockOwners}
              enums={mockEnums}
            />
          </div>
        )}

        {isOpen && (
          <div style={{ marginTop: '0.5rem', fontSize: '11px', color: '#666' }}>
            Press Enter or click "Clear all" to close
          </div>
        )}
      </div>
    );
  }
};

export const AllOperatorTypes = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h3 style={{ fontSize: '14px', marginBottom: '0.5rem' }}>Text Operators</h3>
        <FilterBuilder
          conditions={[
            { fieldId: '_name', op: 'equals', value: 'exact-match' },
            { fieldId: '_name', op: 'not_equals', value: 'not-this' },
            { fieldId: '_name', op: 'contains', value: 'partial' },
            { fieldId: '_name', op: 'starts_with', value: 'prefix' },
            { fieldId: '_name', op: 'ends_with', value: 'suffix' },
            { fieldId: '_description', op: 'empty', value: '' },
            { fieldId: '_description', op: 'not_empty', value: '' }
          ]}
          onChange={() => {}}
          schemas={mockSchemas}
          lifecycleStates={mockLifecycleStates}
          owners={mockOwners}
          enums={mockEnums}
        />
      </div>

      <div>
        <h3 style={{ fontSize: '14px', marginBottom: '0.5rem' }}>Date Operators</h3>
        <FilterBuilder
          conditions={[
            { fieldId: 'deployDate', op: 'on', value: '2024-06-15' },
            { fieldId: 'deployDate', op: 'before', value: '2024-12-31' },
            { fieldId: 'deployDate', op: 'after', value: '2024-01-01' }
          ]}
          onChange={() => {}}
          schemas={mockSchemas}
          lifecycleStates={mockLifecycleStates}
          owners={mockOwners}
          enums={mockEnums}
          selectedSchemaId="service"
        />
      </div>

      <div>
        <h3 style={{ fontSize: '14px', marginBottom: '0.5rem' }}>Select Operators</h3>
        <FilterBuilder
          conditions={[
            { fieldId: '_owner', op: 'equals', value: 'team-a' },
            { fieldId: '_lifecycle', op: 'not_equals', value: 'retired' }
          ]}
          onChange={() => {}}
          schemas={mockSchemas}
          lifecycleStates={mockLifecycleStates}
          owners={mockOwners}
          enums={mockEnums}
        />
      </div>
    </div>
  )
};
