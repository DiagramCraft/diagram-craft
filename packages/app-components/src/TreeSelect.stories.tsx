import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { themeDecorator } from '../.storybook/common';
import { TreeSelect } from './TreeSelect';

const meta = {
  title: 'Components/TreeSelect',
  component: TreeSelect.Root,
  parameters: {
    layout: 'centered'
  },
  argTypes: {},
  decorators: [themeDecorator()]
} satisfies Meta<typeof TreeSelect.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    value: 'lorem',
    items: [
      {
        value: 'lorem',
        label: 'Lorem',
        items: [
          { value: 'lorem1', label: 'Lorem 1' },
          { value: 'lorem2', label: 'Lorem 2' },
          { value: 'lorem3', label: 'Lorem 3' }
        ]
      },
      { value: 'ipsum', label: 'Ipsum' },
      { value: 'dolor', label: 'Dolor' },
      { value: 'sit', label: 'Sit' },
      { value: 'amet', label: 'Amet' }
    ],
    onValueChange: fn()
  }
};

export const Hover: Story = {
  args: {
    'value': 'lorem',
    'items': [
      { value: 'lorem', label: 'Lorem' },
      { value: 'ipsum', label: 'Ipsum' },
      { value: 'dolor', label: 'Dolor' },
      { value: 'sit', label: 'Sit' },
      { value: 'amet', label: 'Amet' }
    ],
    'onValueChange': fn(),
    // @ts-ignore
    'data-hover': true
  }
};

export const Focus: Story = {
  args: {
    'value': 'lorem',
    'items': [
      { value: 'lorem', label: 'Lorem' },
      { value: 'ipsum', label: 'Ipsum' },
      { value: 'dolor', label: 'Dolor' },
      { value: 'sit', label: 'Sit' },
      { value: 'amet', label: 'Amet' }
    ],
    'onValueChange': fn(),
    // @ts-ignore
    'data-focus': true
  }
};

export const Disabled: Story = {
  args: {
    value: 'lorem',
    items: [
      { value: 'lorem', label: 'Lorem' },
      { value: 'ipsum', label: 'Ipsum' },
      { value: 'dolor', label: 'Dolor' },
      { value: 'sit', label: 'Sit' },
      { value: 'amet', label: 'Amet' }
    ],
    onValueChange: fn(),
    disabled: true
  }
};

export const Open: Story = {
  args: {
    'value': 'lorem',
    'items': [
      { value: 'lorem', label: 'Lorem' },
      { value: 'ipsum', label: 'Ipsum' }
    ],
    'onValueChange': fn(),
    'open': true,
    // @ts-ignore
    'data-focus': true
  }
};
