/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Meta, StoryObj } from '@storybook/react';
import { themeDecorator } from '../.storybook/common';
import { Popover } from './Popover';
import { Button } from './Button';

const meta = {
  title: 'Components/Popover',
  component: Popover.Root,
  parameters: {
    layout: 'centered'
  },
  argTypes: {},
  decorators: [themeDecorator()]
} satisfies Meta<typeof Popover.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

const render = function Component(args: Story['args']) {
  return (
    <div style={{ minWidth: '15rem', marginLeft: '10rem', marginBottom: '5rem' }}>
      <Popover.Root {...args}>{args.children}</Popover.Root>
    </div>
  );
};

export const Primary: Story = {
  render,
  args: {
    open: true,
    children: [
      <Popover.Trigger key={1}>
        <Button>Click</Button>
      </Popover.Trigger>,
      <Popover.Content key={2}>
        <h2>Title</h2>Some content
      </Popover.Content>
    ]
  }
};
