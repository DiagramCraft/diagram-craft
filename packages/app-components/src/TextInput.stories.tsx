import type { Meta, StoryObj } from '@storybook/react-vite';
import { TextInput } from './TextInput';
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
    onChange: () => {}
  }
};

export const Focus: Story = {
  args: {
    'value': 'Lorem',
    'onChange': () => {},
    // @ts-ignore
    'data-focus': true
  }
};

export const Error: Story = {
  args: {
    'value': 'Lorem',
    'onChange': () => {},
    // @ts-ignore
    'data-error': true
  }
};

export const WithDefaultValue: Story = {
  args: {
    value: 'Lorem',
    onChange: () => {},
    state: 'unset'
  }
};

export const Disabled: Story = {
  args: {
    value: 'Lorem',
    onChange: () => {},
    disabled: true
  }
};

export const Indeterminate: Story = {
  args: {
    value: 'Lorem',
    onChange: () => {},
    disabled: true,
    isIndeterminate: true
  }
};

export const WithLabel: Story = {
  args: {
    value: 'Lorem',
    onChange: () => {},
    label: 'x'
  }
};
