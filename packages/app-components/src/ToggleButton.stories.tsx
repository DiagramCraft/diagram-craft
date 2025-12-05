import type { Meta, StoryObj } from '@storybook/react-vite';
import { themeDecorator } from '../.storybook/common';
import { ToggleButton } from './ToggleButton';
import { TbBold } from 'react-icons/tb';

const meta = {
  title: 'Components/ToggleButton',
  component: ToggleButton,
  parameters: {
    layout: 'centered'
  },
  argTypes: {},
  decorators: [themeDecorator()]
} satisfies Meta<typeof ToggleButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    value: false,
    onChange: () => {},
    children: [<TbBold />]
  }
};

export const Selected: Story = {
  args: {
    value: true,
    onChange: () => {},
    children: [<TbBold />]
  }
};

export const Focus: Story = {
  args: {
    'value': true,
    'onChange': () => {},
    'children': [<TbBold />],
    // @ts-ignore
    'data-focus': true
  }
};

export const Hover: Story = {
  args: {
    'value': true,
    'onChange': () => {},
    'children': [<TbBold />],
    // @ts-ignore
    'data-hover': true
  }
};

export const Disabled: Story = {
  args: {
    value: true,
    onChange: () => {},
    children: [<TbBold />],
    disabled: true
  }
};
