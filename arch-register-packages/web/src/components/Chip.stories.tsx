import type { Meta, StoryObj } from '@storybook/react';
import { Chip } from './Chip';
import { TbCheck, TbX } from 'react-icons/tb';

const meta = {
  title: 'Components/Chip',
  component: Chip,
  parameters: {
    layout: 'centered'
  },
  tags: ['autodocs'],
  argTypes: {
    tone: {
      control: 'select',
      options: ['default', 'ghost']
    }
  }
} satisfies Meta<typeof Chip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Default Chip'
  }
};

export const Ghost: Story = {
  args: {
    children: 'Ghost Chip',
    tone: 'ghost'
  }
};

export const WithIcon: Story = {
  args: {
    children: 'Success',
    icon: <TbCheck size={14} />
  }
};

export const WithDot: Story = {
  args: {
    children: 'Active',
    dot: '#22c55e'
  }
};

export const WithIconAndDot: Story = {
  args: {
    children: 'Complete',
    icon: <TbCheck size={14} />,
    dot: '#3b82f6'
  }
};

export const ErrorChip: Story = {
  args: {
    children: 'Error',
    icon: <TbX size={14} />,
    dot: '#ef4444'
  }
};

export const MultipleChips: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      <Chip>Default</Chip>
      <Chip tone="ghost">Ghost</Chip>
      <Chip icon={<TbCheck size={14} />}>With Icon</Chip>
      <Chip dot="#22c55e">With Dot</Chip>
      <Chip icon={<TbCheck size={14} />} dot="#3b82f6">
        Complete
      </Chip>
    </div>
  )
};
