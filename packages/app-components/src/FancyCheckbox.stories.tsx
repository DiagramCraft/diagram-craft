import type { Meta, StoryObj } from '@storybook/react-vite';
import { FancyCheckbox } from './Checkbox';
import { themeDecorator } from '../.storybook/common';

const meta = {
  title: 'Components/FancyCheckbox',
  component: FancyCheckbox,
  parameters: {
    layout: 'centered'
  },
  argTypes: {},
  decorators: [themeDecorator()]
} satisfies Meta<typeof FancyCheckbox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Checked: Story = {
  args: {
    value: true,
    onChange: () => {},
    label: 'Enabled'
  }
};

export const Unchecked: Story = {
  args: {
    value: false,
    onChange: () => {},
    label: 'Disabled'
  }
};

export const Indeterminate: Story = {
  args: {
    value: false,
    onChange: () => {},
    label: 'Mixed state',
    isIndeterminate: true
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
