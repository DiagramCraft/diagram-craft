import type { Meta, StoryObj } from '@storybook/react-vite';
import { themeDecorator } from '../.storybook/common';
import { Button } from './Button';
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
    variant: 'primary',
    children: ['Lorem'],
    onClick: () => {}
  }
};
export const PrimaryHover: Story = {
  args: {
    'variant': 'primary',
    'children': ['Lorem'],
    'onClick': () => {},
    'data-hover': 'true'
  }
};
export const PrimaryFocus: Story = {
  args: {
    'variant': 'primary',
    'children': ['Lorem'],
    'onClick': () => {},
    'data-focus': 'true'
  }
};
export const PrimaryDisabled: Story = {
  args: {
    variant: 'primary',
    children: ['Lorem'],
    onClick: () => {},
    disabled: true
  }
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: ['Lorem'],
    onClick: () => {}
  }
};
export const SecondaryHover: Story = {
  args: {
    'variant': 'secondary',
    'children': ['Lorem'],
    'onClick': () => {},
    'data-hover': 'true'
  }
};
export const SecondaryFocus: Story = {
  args: {
    'variant': 'secondary',
    'children': ['Lorem'],
    'onClick': () => {},
    'data-focus': 'true'
  }
};
export const SecondaryDisabled: Story = {
  args: {
    variant: 'secondary',
    children: ['Lorem'],
    onClick: () => {},
    disabled: true
  }
};

export const Danger: Story = {
  args: {
    variant: 'danger',
    children: ['Lorem'],
    onClick: () => {}
  }
};
export const DangerHover: Story = {
  args: {
    'variant': 'danger',
    'children': ['Lorem'],
    'onClick': () => {},
    'data-hover': 'true'
  }
};
export const DangerFocus: Story = {
  args: {
    'variant': 'danger',
    'children': ['Lorem'],
    'onClick': () => {},
    'data-focus': 'true'
  }
};
export const DangerDisabled: Story = {
  args: {
    variant: 'danger',
    children: ['Lorem'],
    onClick: () => {},
    disabled: true
  }
};

export const IconOnly: Story = {
  args: {
    variant: 'icon-only',
    children: [<TbBold />],
    onClick: () => {}
  }
};
