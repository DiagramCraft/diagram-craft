import type { Meta, StoryObj } from '@storybook/react-vite';
import { themeDecorator } from '../.storybook/common';
import { ModeSwitcher } from './ModeSwitcher';
import { TbCopy, TbLayoutGrid, TbSquare } from 'react-icons/tb';

const meta = {
  title: 'Components/ModeSwitcher',
  component: ModeSwitcher,
  parameters: {
    layout: 'centered'
  },
  decorators: [themeDecorator()]
} satisfies Meta<typeof ModeSwitcher>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { modes: [], value: '', onChange: () => {} },
  render: () => (
    <div style={{ minWidth: 300 }}>
      <ModeSwitcher
        modes={[
          { value: 'blank', label: 'Start blank' },
          { value: 'template', label: 'Template' },
          { value: 'copy', label: 'Copy' }
        ]}
        value="template"
        onChange={() => {}}
      />
    </div>
  )
};

export const WithIcons: Story = {
  args: { modes: [], value: '', onChange: () => {} },
  render: () => (
    <div style={{ minWidth: 300 }}>
      <ModeSwitcher
        modes={[
          { value: 'blank', label: 'Start blank', icon: <TbSquare /> },
          { value: 'template', label: 'Template', icon: <TbLayoutGrid /> },
          { value: 'copy', label: 'Copy', icon: <TbCopy /> }
        ]}
        value="blank"
        onChange={() => {}}
      />
    </div>
  )
};

export const TwoModes: Story = {
  args: { modes: [], value: '', onChange: () => {} },
  render: () => (
    <div style={{ minWidth: 240 }}>
      <ModeSwitcher
        modes={[
          { value: 'new', label: 'New' },
          { value: 'existing', label: 'Existing' }
        ]}
        value="new"
        onChange={() => {}}
      />
    </div>
  )
};
