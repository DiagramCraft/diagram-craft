import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { IconPicker } from './IconPicker';

const meta = {
  title: 'Components/IconPicker',
  component: IconPicker,
  parameters: {
    layout: 'centered'
  },
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' }
  },
  decorators: [
    Story => (
      <div style={{ width: 360 }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof IconPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

const Stateful = ({
  initial,
  ...rest
}: { initial?: string } & Omit<React.ComponentProps<typeof IconPicker>, 'value' | 'onChange'>) => {
  const [value, setValue] = useState<string | undefined>(initial);
  return <IconPicker {...rest} value={value} onChange={setValue} />;
};

export const Default: Story = {
  args: { value: 'server', onChange: () => {} },
  render: () => <Stateful initial="server" />
};

export const NoSelection: Story = {
  args: { value: undefined, onChange: () => {} },
  render: () => <Stateful />
};

export const WithNoneOption: Story = {
  args: { value: undefined, onChange: () => {} },
  render: () => <Stateful noneLabel="Default" />
};

export const Disabled: Story = {
  args: { value: 'database', onChange: () => {}, disabled: true }
};
