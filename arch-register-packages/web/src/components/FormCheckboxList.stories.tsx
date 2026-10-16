import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { FormCheckboxList } from './FormCheckboxList';

const meta = {
  title: 'Components/FormCheckboxList',
  component: FormCheckboxList,
  parameters: {
    layout: 'centered'
  }
} satisfies Meta<typeof FormCheckboxList>;

export default meta;

type Story = StoryObj<typeof meta>;

const options = [
  { id: 'name', label: 'Name' },
  { id: 'owner', label: 'Owner' },
  { id: 'lifecycle', label: 'Lifecycle' },
  { id: 'tags', label: 'Tags' }
];

const FormCheckboxListExample = () => {
  const [selectedIds, setSelectedIds] = useState(() => new Set(['owner', 'tags']));

  return (
    <FormCheckboxList>
      {options.map(option => (
        <FormCheckboxList.Row key={option.id} label={option.label}>
          <input
            type="checkbox"
            checked={selectedIds.has(option.id)}
            onChange={event => {
              const checked = event.currentTarget.checked;
              setSelectedIds(current => {
                const next = new Set(current);
                if (checked) next.add(option.id);
                else next.delete(option.id);
                return next;
              });
            }}
          />
        </FormCheckboxList.Row>
      ))}
    </FormCheckboxList>
  );
};

export const Default: Story = {
  args: { children: null },
  render: () => (
    <div style={{ minWidth: 360 }}>
      <FormCheckboxListExample />
    </div>
  )
};
