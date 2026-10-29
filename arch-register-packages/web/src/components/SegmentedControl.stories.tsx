import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SegmentedControl } from './SegmentedControl';

const meta = {
  title: 'Components/SegmentedControl',
  component: SegmentedControl,
  parameters: { layout: 'centered' },
  tags: ['autodocs']
} satisfies Meta<typeof SegmentedControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { value: 'month', onChange: () => {}, options: [] },
  render: () => {
    const [value, setValue] = useState('month');
    return (
      <SegmentedControl
        value={value}
        onChange={setValue}
        options={[
          { value: 'month', label: 'Mo', title: 'Month' },
          { value: 'quarter', label: 'Qr', title: 'Quarter' },
          { value: 'year', label: 'Yr', title: 'Year' }
        ]}
      />
    );
  }
};
