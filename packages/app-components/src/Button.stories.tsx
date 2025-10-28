import type { Meta, StoryObj } from '@storybook/react-vite';
import { themeDecorator } from '../.storybook/common';
import { Button } from './Button';
import { fn } from 'storybook/test';
import { TbBold } from 'react-icons/tb';

const meta = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    layout: 'centered'
  },
  argTypes: {},
  decorators: [themeDecorator()]
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    type: 'primary',
    children: ['Lorem'],
    onClick: fn()
  }
};
export const PrimaryHover: Story = {
  args: {
    'type': 'primary',
    'children': ['Lorem'],
    'onClick': fn(),
    'data-hover': 'true'
  }
};
export const PrimaryFocus: Story = {
  args: {
    'type': 'primary',
    'children': ['Lorem'],
    'onClick': fn(),
    'data-focus': 'true'
  }
};
export const PrimaryDisabled: Story = {
  args: {
    type: 'primary',
    children: ['Lorem'],
    onClick: fn(),
    disabled: true
  }
};

export const Secondary: Story = {
  args: {
    type: 'secondary',
    children: ['Lorem'],
    onClick: fn()
  }
};
export const SecondaryHover: Story = {
  args: {
    'type': 'secondary',
    'children': ['Lorem'],
    'onClick': fn(),
    'data-hover': 'true'
  }
};
export const SecondaryFocus: Story = {
  args: {
    'type': 'secondary',
    'children': ['Lorem'],
    'onClick': fn(),
    'data-focus': 'true'
  }
};
export const SecondaryDisabled: Story = {
  args: {
    type: 'secondary',
    children: ['Lorem'],
    onClick: fn(),
    disabled: true
  }
};

export const Danger: Story = {
  args: {
    type: 'danger',
    children: ['Lorem'],
    onClick: fn()
  }
};
export const DangerHover: Story = {
  args: {
    'type': 'danger',
    'children': ['Lorem'],
    'onClick': fn(),
    'data-hover': 'true'
  }
};
export const DangerFocus: Story = {
  args: {
    'type': 'danger',
    'children': ['Lorem'],
    'onClick': fn(),
    'data-focus': 'true'
  }
};
export const DangerDisabled: Story = {
  args: {
    type: 'danger',
    children: ['Lorem'],
    onClick: fn(),
    disabled: true
  }
};

export const IconOnly: Story = {
  args: {
    type: 'icon-only',
    children: [<TbBold />],
    onClick: fn()
  }
};
