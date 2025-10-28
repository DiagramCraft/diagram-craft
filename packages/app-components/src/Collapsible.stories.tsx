import type { Meta, StoryObj } from '@storybook/react';
import { themeDecorator } from '../.storybook/common';
import { Collapsible } from './Collapsible';

const meta = {
  title: 'Components/Collapsible',
  component: Collapsible,
  parameters: {
    layout: 'centered'
  },
  argTypes: {},
  decorators: [themeDecorator()]
} satisfies Meta<typeof Collapsible>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    label: 'Collapsible',
    defaultOpen: false,
    children: [<div key={1}>Lorem ipsum dolor sit amet</div>]
  }
};

export const Open: Story = {
  args: {
    label: 'Collapsible',
    defaultOpen: true,
    children: [<div key={1}>Lorem ipsum dolor sit amet</div>]
  }
};
