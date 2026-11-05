import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { ListEditor } from './ListEditor';

type Item = { label: string };

const meta = {
  title: 'Components/ListEditor',
  parameters: { layout: 'padded' },
  decorators: [
    Story => (
      <DndProvider backend={HTML5Backend}>
        <div style={{ width: 420 }}>
          <Story />
        </div>
      </DndProvider>
    )
  ]
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const Demo = (props: {
  layout: 'row' | 'card';
  reorder: 'drag' | 'none';
  labelled: boolean;
  disabled?: boolean;
  initial?: Item[];
}) => {
  const [items, setItems] = useState<Item[]>(
    props.initial ?? [{ label: 'First' }, { label: 'Second' }]
  );
  return (
    <ListEditor<Item>
      label={props.labelled ? 'Items' : undefined}
      items={items}
      onChange={setItems}
      createItem={() => ({ label: 'New item' })}
      addLabel="Add item"
      emptyMessage="No items yet"
      layout={props.layout}
      reorder={props.reorder}
      disabled={props.disabled}
      renderItem={(item, ctx) => (
        <TextInput value={item.label} onChange={v => ctx.update({ label: v ?? '' })} />
      )}
    />
  );
};

export const Row: Story = {
  render: () => <Demo layout="row" reorder="drag" labelled={false} />
};

export const Card: Story = {
  render: () => <Demo layout="card" reorder="drag" labelled />
};

export const NoReorder: Story = {
  render: () => <Demo layout="row" reorder="none" labelled={false} />
};

export const Empty: Story = {
  render: () => <Demo layout="row" reorder="drag" labelled={false} initial={[]} />
};

export const Disabled: Story = {
  render: () => <Demo layout="row" reorder="drag" labelled={false} disabled />
};
