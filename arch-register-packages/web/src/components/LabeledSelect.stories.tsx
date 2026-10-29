import type { Meta, StoryObj } from '@storybook/react-vite';
import { LabeledSelect } from './LabeledSelect';
import { useState } from 'react';

const meta = {
  title: 'Components/LabeledSelect',
  component: LabeledSelect,
  parameters: {
    layout: 'centered'
  },
  tags: ['autodocs']
} satisfies Meta<typeof LabeledSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

const statusOptions = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'pending', label: 'Pending' }
];

const typeOptions = [
  { value: 'all', label: 'All Types' },
  { value: 'service', label: 'Service' },
  { value: 'database', label: 'Database' },
  { value: 'api', label: 'API' },
  { value: 'frontend', label: 'Frontend' }
];

const sortOptions = [
  { value: 'name-asc', label: 'Name (A-Z)' },
  { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'date-asc', label: 'Date (Oldest)' },
  { value: 'date-desc', label: 'Date (Newest)' }
];

export const Default: Story = {
  args: {
    label: 'Status',
    value: 'all',
    onChange: (value: string) => console.log('Selected:', value),
    options: statusOptions
  }
};

export const WithSelection: Story = {
  args: {
    label: 'Type',
    value: 'service',
    onChange: value => console.log('Selected:', value),
    options: typeOptions
  }
};

export const SortDropdown: Story = {
  args: {
    label: 'Sort by',
    value: 'name-asc',
    onChange: value => console.log('Selected:', value),
    options: sortOptions
  }
};

export const GroupedOptions: Story = {
  args: {
    label: 'View',
    value: 'table',
    onChange: value => console.log('Selected:', value),
    groups: [
      {
        label: 'Lists',
        options: [
          { value: 'table', label: 'Table' },
          { value: 'cards', label: 'Cards' }
        ]
      },
      {
        label: 'Charts',
        options: [
          { value: 'radar', label: 'Radar' },
          { value: 'heatmap', label: 'Heat map' }
        ]
      }
    ]
  }
};

export const Interactive = {
  render: () => {
    const [status, setStatus] = useState('all');
    const [type, setType] = useState('all');
    const [sort, setSort] = useState('name-asc');

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '300px' }}>
        <div>
          <LabeledSelect
            label="Status"
            value={status}
            onChange={setStatus}
            options={statusOptions}
          />
        </div>

        <div>
          <LabeledSelect label="Type" value={type} onChange={setType} options={typeOptions} />
        </div>

        <div>
          <LabeledSelect label="Sort by" value={sort} onChange={setSort} options={sortOptions} />
        </div>

        <div
          style={{ padding: '1rem', background: '#f9fafb', borderRadius: '4px', fontSize: '12px' }}
        >
          <div>
            <strong>Current Selection:</strong>
          </div>
          <div>Status: {statusOptions.find(o => o.value === status)?.label}</div>
          <div>Type: {typeOptions.find(o => o.value === type)?.label}</div>
          <div>Sort: {sortOptions.find(o => o.value === sort)?.label}</div>
        </div>
      </div>
    );
  }
};

export const MultipleInRow = {
  render: () => {
    const [filter1, setFilter1] = useState('all');
    const [filter2, setFilter2] = useState('all');
    const [filter3, setFilter3] = useState('name-asc');

    return (
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <LabeledSelect
          label="Status"
          value={filter1}
          onChange={setFilter1}
          options={statusOptions}
        />
        <LabeledSelect label="Type" value={filter2} onChange={setFilter2} options={typeOptions} />
        <LabeledSelect label="Sort" value={filter3} onChange={setFilter3} options={sortOptions} />
      </div>
    );
  }
};

export const LongLabels: Story = {
  args: {
    label: 'Environment',
    value: 'prod',
    onChange: value => console.log('Selected:', value),
    options: [
      { value: 'dev', label: 'Development Environment' },
      { value: 'staging', label: 'Staging Environment' },
      { value: 'prod', label: 'Production Environment' },
      { value: 'test', label: 'Testing Environment' }
    ]
  }
};

export const ManyOptions: Story = {
  args: {
    label: 'Region',
    value: 'us-east-1',
    onChange: value => console.log('Selected:', value),
    options: [
      { value: 'us-east-1', label: 'US East (N. Virginia)' },
      { value: 'us-east-2', label: 'US East (Ohio)' },
      { value: 'us-west-1', label: 'US West (N. California)' },
      { value: 'us-west-2', label: 'US West (Oregon)' },
      { value: 'eu-west-1', label: 'EU (Ireland)' },
      { value: 'eu-central-1', label: 'EU (Frankfurt)' },
      { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
      { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' }
    ]
  }
};

export const SingleOption: Story = {
  args: {
    label: 'Mode',
    value: 'readonly',
    onChange: value => console.log('Selected:', value),
    options: [{ value: 'readonly', label: 'Read Only' }]
  }
};

export const WithCallback = {
  render: () => {
    const [value, setValue] = useState('all');
    const [lastChanged, setLastChanged] = useState<string | null>(null);

    const handleChange = (newValue: string) => {
      setValue(newValue);
      setLastChanged(new Date().toLocaleTimeString());
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <LabeledSelect
          label="Status"
          value={value}
          onChange={handleChange}
          options={statusOptions}
        />

        {lastChanged && (
          <div style={{ fontSize: '12px', color: '#666' }}>Last changed at: {lastChanged}</div>
        )}
      </div>
    );
  }
};

export const Disabled: Story = {
  args: {
    label: 'Status',
    value: 'active',
    options: statusOptions,
    disabled: true,
    onChange: () => {}
  }
};

export const Secondary: Story = {
  args: {
    label: 'Page Size',
    value: 'active',
    options: statusOptions,
    variant: 'secondary',
    onChange: () => {}
  }
};
