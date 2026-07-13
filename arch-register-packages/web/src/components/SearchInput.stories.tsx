import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SearchInput } from './SearchInput';

const meta = {
  title: 'Components/SearchInput',
  parameters: {
    layout: 'centered'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Medium: Story = {
  render: () => {
    const [value, setValue] = useState('');
    return (
      <div style={{ width: 320 }}>
        <SearchInput
          size="md"
          value={value}
          onChange={setValue}
          onClear={() => setValue('')}
          placeholder="Search entities, diagrams, projects, schema…"
        />
      </div>
    );
  }
};

export const Small: Story = {
  render: () => {
    const [value, setValue] = useState('');
    return (
      <SearchInput
        size="sm"
        value={value}
        onChange={setValue}
        onClear={() => setValue('')}
        placeholder="Search by name or email…"
      />
    );
  }
};

export const WithValue: Story = {
  render: () => {
    const [value, setValue] = useState('platform');
    return (
      <div style={{ width: 320 }}>
        <SearchInput size="md" value={value} onChange={setValue} onClear={() => setValue('')} />
      </div>
    );
  }
};

export const NoClearButton: Story = {
  render: () => {
    const [value, setValue] = useState('read-only search');
    return (
      <div style={{ width: 320 }}>
        <SearchInput size="md" value={value} onChange={setValue} />
      </div>
    );
  }
};

export const WithTrailingContent: Story = {
  render: () => {
    const [value, setValue] = useState('');
    return (
      <div style={{ width: 400 }}>
        <SearchInput size="md" value={value} onChange={setValue} onClear={() => setValue('')}>
          <span style={{ fontSize: 11, color: 'var(--cmp-fg-disabled)', whiteSpace: 'nowrap' }}>
            ⌘K
          </span>
        </SearchInput>
      </div>
    );
  }
};
