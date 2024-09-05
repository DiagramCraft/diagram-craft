import type { Meta, StoryObj } from '@storybook/react';
import { NumberInput } from './NumberInput';
import { fn } from '@storybook/test';
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
    onChange: fn()
  }
};

export const Focus: Story = {
  args: {
    'value': '77 px',
    'onChange': fn(),
    // @ts-ignore
    'data-focus': true
  }
};

export const Error: Story = {
  args: {
    'value': '77 px',
    'onChange': fn(),
    // @ts-ignore
    'data-error': true
  }
};

export const WithDefaultValue: Story = {
  args: {
    value: '77 px',
    onChange: fn(),
    state: 'unset'
  }
};

export const Disabled: Story = {
  args: {
    value: '77 px',
    onChange: fn(),
    disabled: true
  }
};

export const WithLabel: Story = {
  args: {
    value: '77 px',
    onChange: fn(),
    label: 'x'
  }
};
