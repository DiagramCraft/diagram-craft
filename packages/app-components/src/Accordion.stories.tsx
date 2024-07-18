/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Meta, StoryObj } from '@storybook/react';
import { themeDecorator } from '../.storybook/common';
import { Accordion } from './Accordion';
import { useArgs } from '@storybook/preview-api';

const meta = {
  title: 'Components/Accordion',
  component: Accordion.Root,
  parameters: {
    layout: 'centered'
  },
  argTypes: {},
  decorators: [themeDecorator()]
} satisfies Meta<typeof Accordion.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

const render = function Component(args: Story['args']) {
  const [, setArgs] = useArgs();

  // @ts-ignore
  const onValueChange = (value: any) => {
    args.onValueChange?.(value);
    setArgs({ value: value });
  };

  return (
    <Accordion.Root {...args} onValueChange={onValueChange}>
      {args.children}
    </Accordion.Root>
  );
};

const CHILDREN = [
  <Accordion.Item key={1} value={'lorem'}>
    <Accordion.ItemHeader>Lorem</Accordion.ItemHeader>
    <Accordion.ItemContent>Content</Accordion.ItemContent>
  </Accordion.Item>,
  <Accordion.Item key={2} value={'ipsum'}>
    <Accordion.ItemHeader>Ipsum</Accordion.ItemHeader>
    <Accordion.ItemContent>Content</Accordion.ItemContent>
  </Accordion.Item>,
  <Accordion.Item key={3} value={'dolor'}>
    <Accordion.ItemHeader>Dolor</Accordion.ItemHeader>
    <Accordion.ItemContent>Content</Accordion.ItemContent>
  </Accordion.Item>,
  <Accordion.Item key={4} value={'sit'}>
    <Accordion.ItemHeader>Sit</Accordion.ItemHeader>
    <Accordion.ItemContent>Content</Accordion.ItemContent>
  </Accordion.Item>,
  <Accordion.Item key={5} value={'amet'}>
    <Accordion.ItemHeader>Amet</Accordion.ItemHeader>
    <Accordion.ItemContent>Content</Accordion.ItemContent>
  </Accordion.Item>
];

export const Primary: Story = {
  render,
  args: {
    type: 'single',
    value: 'lorem',
    children: CHILDREN
  }
};

export const Disabled: Story = {
  render,
  args: {
    type: 'single',
    value: 'lorem',
    children: CHILDREN,
    disabled: true
  }
};

export const ItemFocus: Story = {
  render,
  args: {
    type: 'single',
    value: 'lorem',
    children: [
      <Accordion.Item key={1} value={'lorem'}>
        <Accordion.ItemHeader data-focus={true}>Lorem</Accordion.ItemHeader>
        <Accordion.ItemContent>Content</Accordion.ItemContent>
      </Accordion.Item>,
      ...CHILDREN.slice(1)
    ]
  }
};

export const ItemHover: Story = {
  render,
  args: {
    type: 'single',
    value: 'lorem',
    children: [
      <Accordion.Item key={1} value={'lorem'}>
        <Accordion.ItemHeader data-hover={true}>Lorem</Accordion.ItemHeader>
        <Accordion.ItemContent>Content</Accordion.ItemContent>
      </Accordion.Item>,
      ...CHILDREN.slice(1)
    ]
  }
};
