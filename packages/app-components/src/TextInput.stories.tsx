import type { Meta, StoryObj } from '@storybook/react';
import { TextInput } from './TextInput';
import { fn } from '@storybook/test';
import { themeDecorator } from '../.storybook/common';

const meta = {
  title: 'Components/TextInput',
  component: TextInput,
  parameters: {
    layout: 'centered'
  },
  argTypes: {},
  decorators: [themeDecorator()]
} satisfies Meta<typeof TextInput>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    value: 'Lorem',
    onChange: fn()
  }
};

export const Focus: Story = {
  args: {
    'value': 'Lorem',
    'onChange': fn(),
    // @ts-ignore
    'data-focus': true
  }
};

export const Error: Story = {
  args: {
    'value': 'Lorem',
    'onChange': fn(),
    // @ts-ignore
    'data-error': true
  }
};

export const WithDefaultValue: Story = {
  args: {
    value: 'Lorem',
    onChange: fn(),
    state: 'unset'
  }
};

export const Disabled: Story = {
  args: {
    value: 'Lorem',
    onChange: fn(),
    disabled: true
  }
};

export const Indeterminate: Story = {
  args: {
    value: 'Lorem',
    onChange: fn(),
    disabled: true,
    isIndeterminate: true
  }
};

export const WithLabel: Story = {
  args: {
    value: 'Lorem',
    onChange: fn(),
    label: 'x'
  }
};
