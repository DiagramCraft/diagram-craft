import type { Meta, StoryObj } from '@storybook/react';
import { TextArea } from './TextArea';
import { fn } from '@storybook/test';
import { themeDecorator } from '../.storybook/common';

const meta = {
  title: 'Components/TextArea',
  component: TextArea,
  parameters: {
    layout: 'centered'
  },
  argTypes: {},
  decorators: [themeDecorator()]
} satisfies Meta<typeof TextArea>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    value: 'Lorem',
    onChange: fn(),
    // @ts-ignore
    rows: 5
  }
};

export const Focus: Story = {
  args: {
    'value': 'Lorem',
    'onChange': fn(),
    // @ts-ignore
    'data-focus': true,
    // @ts-ignore
    'rows': 5
  }
};

export const Error: Story = {
  args: {
    'value': 'Lorem',
    'onChange': fn(),
    // @ts-ignore
    'data-error': true,
    // @ts-ignore
    'rows': 5
  }
};

export const WithDefaultValue: Story = {
  args: {
    value: 'Lorem',
    onChange: fn(),
    state: 'unset',
    // @ts-ignore
    rows: 5
  }
};

export const Indeterminate: Story = {
  args: {
    value: 'Lorem ipsum',
    onChange: fn(),
    isIndeterminate: true,
    disabled: true,
    // @ts-ignore
    rows: 5
  }
};

export const Disabled: Story = {
  args: {
    value: 'Lorem',
    onChange: fn(),
    disabled: true,
    // @ts-ignore
    rows: 5
  }
};
