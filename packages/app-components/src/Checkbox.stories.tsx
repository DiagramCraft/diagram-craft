import type { Meta, StoryObj } from '@storybook/react-vite';
import { Checkbox } from './Checkbox';
import { themeDecorator } from '../.storybook/common';

const meta = {
  title: 'Components/Checkbox',
  component: Checkbox,
  parameters: {
    layout: 'centered'
  },
  argTypes: {},
  decorators: [themeDecorator()]
} satisfies Meta<typeof Checkbox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Checked: Story = {
  args: {
    value: true,
    onChange: () => {}
  }
};

export const Unchecked: Story = {
  args: {
    value: false,
    onChange: () => {}
  }
};

export const Indeterminate: Story = {
  args: {
    value: false,
    onChange: () => {},
    isIndeterminate: true
  }
};

export const WithLabel: Story = {
  args: {
    value: true,
    onChange: () => {},
    label: 'Enable feature'
  }
};

export const WithLabelIndeterminate: Story = {
  args: {
    value: false,
    onChange: () => {},
    label: 'Mixed state',
    isIndeterminate: true
  }
};

export const Disabled: Story = {
  args: {
    value: true,
    onChange: () => {},
    label: 'Disabled checkbox',
    disabled: true
  }
};

export const WithDefaultValue: Story = {
  args: {
    value: true,
    onChange: () => {},
    label: 'Has default value',
    state: 'unset'
  }
};

export const Overridden: Story = {
  args: {
    value: true,
    onChange: () => {},
    label: 'Overridden value',
    state: 'overridden'
  }
};
