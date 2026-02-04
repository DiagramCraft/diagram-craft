import type { Meta, StoryObj } from '@storybook/react-vite';
import { NumberInput } from './NumberInput';
import { themeDecorator } from '../.storybook/common';

const meta = {
  title: 'Components/NumberInput',
  component: NumberInput,
  parameters: {
    layout: 'centered'
  },
  argTypes: {},
  decorators: [themeDecorator()]
} satisfies Meta<typeof NumberInput>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    value: '77 px',
    onChange: () => {}
  }
};

export const Focus: Story = {
  args: {
    'value': '77 px',
    'onChange': () => {},
    // @ts-ignore
    'data-focus': true
  }
};

export const Error: Story = {
  args: {
    'value': '77 px',
    'onChange': () => {},
    // @ts-ignore
    'data-error': true
  }
};

export const WithDefaultValue: Story = {
  args: {
    value: '77 px',
    onChange: () => {},
    state: 'unset'
  }
};

export const Indeterminate: Story = {
  args: {
    value: '77 px',
    onChange: () => {},
    isIndeterminate: true
  }
};

export const Disabled: Story = {
  args: {
    value: '77 px',
    onChange: () => {},
    disabled: true
  }
};

export const WithLabel: Story = {
  args: {
    value: '77 px',
    onChange: () => {},
    label: 'x'
  }
};
