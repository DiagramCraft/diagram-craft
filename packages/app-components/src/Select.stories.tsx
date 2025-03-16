import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { themeDecorator } from '../.storybook/common';
import { Select } from './Select';

const meta = {
  title: 'Components/Select',
  component: Select.Root,
  parameters: {
    layout: 'centered'
  },
  argTypes: {},
  decorators: [themeDecorator()]
} satisfies Meta<typeof Select.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    value: 'lorem',
    children: [
      <Select.Item key={1} value={'lorem'}>
        Lorem
      </Select.Item>,
      <Select.Item key={2} value={'ipsum'}>
        Ipsum
      </Select.Item>,
      <Select.Item key={3} value={'dolor'}>
        Dolor
      </Select.Item>,
      <Select.Item key={4} value={'sit'}>
        Sit
      </Select.Item>,
      <Select.Item key={5} value={'amet'}>
        Amet
      </Select.Item>
    ],
    onChange: fn()
  }
};

export const Hover: Story = {
  args: {
    'value': 'lorem',
    'children': [
      <Select.Item key={1} value={'lorem'}>
        Lorem
      </Select.Item>,
      <Select.Item key={2} value={'ipsum'}>
        Ipsum
      </Select.Item>,
      <Select.Item key={3} value={'dolor'}>
        Dolor
      </Select.Item>,
      <Select.Item key={4} value={'sit'}>
        Sit
      </Select.Item>,
      <Select.Item key={5} value={'amet'}>
        Amet
      </Select.Item>
    ],
    'onChange': fn(),
    // @ts-ignore
    'data-hover': true
  }
};

export const Focus: Story = {
  args: {
    'value': 'lorem',
    'children': [
      <Select.Item key={1} value={'lorem'}>
        Lorem
      </Select.Item>,
      <Select.Item key={2} value={'ipsum'}>
        Ipsum
      </Select.Item>,
      <Select.Item key={3} value={'dolor'}>
        Dolor
      </Select.Item>,
      <Select.Item key={4} value={'sit'}>
        Sit
      </Select.Item>,
      <Select.Item key={5} value={'amet'}>
        Amet
      </Select.Item>
    ],
    'onChange': fn(),
    // @ts-ignore
    'data-focus': true
  }
};

export const Disabled: Story = {
  args: {
    value: 'lorem',
    children: [
      <Select.Item key={1} value={'lorem'}>
        Lorem
      </Select.Item>,
      <Select.Item key={2} value={'ipsum'}>
        Ipsum
      </Select.Item>,
      <Select.Item key={3} value={'dolor'}>
        Dolor
      </Select.Item>,
      <Select.Item key={4} value={'sit'}>
        Sit
      </Select.Item>,
      <Select.Item key={5} value={'amet'}>
        Amet
      </Select.Item>
    ],
    onChange: fn(),
    disabled: true
  }
};

export const Indeterminate: Story = {
  args: {
    value: 'lorem',
    children: [
      <Select.Item key={1} value={'lorem'}>
        Lorem
      </Select.Item>,
      <Select.Item key={2} value={'ipsum'}>
        Ipsum
      </Select.Item>,
      <Select.Item key={3} value={'dolor'}>
        Dolor
      </Select.Item>,
      <Select.Item key={4} value={'sit'}>
        Sit
      </Select.Item>,
      <Select.Item key={5} value={'amet'}>
        Amet
      </Select.Item>
    ],
    onChange: fn(),
    isIndeterminate: true
  }
};

export const Open: Story = {
  args: {
    'value': 'lorem',
    'children': [
      <Select.Item key={1} value={'lorem'} data-highlighted={true}>
        Lorem
      </Select.Item>,
      <Select.Item key={2} value={'ipsum'}>
        Ipsum
      </Select.Item>
    ],
    'onChange': fn(),
    'open': true,
    // @ts-ignore
    'data-focus': true
  }
};
