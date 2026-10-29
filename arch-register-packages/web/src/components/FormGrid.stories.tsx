import type { Meta, StoryObj } from '@storybook/react-vite';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { FormGrid } from './FormGrid';

const meta = {
  title: 'Components/FormGrid',
  component: FormGrid,
  parameters: {
    layout: 'centered'
  }
} satisfies Meta<typeof FormGrid>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: null },
  render: () => (
    <div style={{ minWidth: 360 }}>
      <FormGrid>
        <FormGrid.Row label="Item limit">
          <NumberInput value={20} min={1} max={50} step={1} onChange={() => {}} />
        </FormGrid.Row>
        <FormGrid.Row label="Title">
          <TextInput value="Activity feed" onChange={() => {}} />
        </FormGrid.Row>
      </FormGrid>
    </div>
  )
};
