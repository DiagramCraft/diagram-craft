import type { Meta, StoryObj } from '@storybook/react-vite';
import { TextArea } from './TextArea';
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
    onChange: () => {},
    // @ts-ignore
    rows: 5
  }
};

export const Focus: Story = {
  args: {
    'value': 'Lorem',
    'onChange': () => {},
    // @ts-ignore
    'data-focus': true,
    // @ts-ignore
    'rows': 5
  }
};

export const Error: Story = {
  args: {
    'value': 'Lorem',
    'onChange': () => {},
    // @ts-ignore
    'data-error': true,
    // @ts-ignore
    'rows': 5
  }
};

export const WithDefaultValue: Story = {
  args: {
    value: 'Lorem',
    onChange: () => {},
    state: 'unset',
    // @ts-ignore
    rows: 5
  }
};

export const Indeterminate: Story = {
  args: {
    value: 'Lorem ipsum',
    onChange: () => {},
    isIndeterminate: true,
    disabled: true,
    // @ts-ignore
    rows: 5
  }
};

export const Disabled: Story = {
  args: {
    value: 'Lorem',
    onChange: () => {},
    disabled: true,
    // @ts-ignore
    rows: 5
  }
};
