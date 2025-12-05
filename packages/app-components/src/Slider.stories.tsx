import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { themeDecorator } from '../.storybook/common';
import { Slider } from './Slider';

const meta = {
  title: 'Components/Slider',
  component: Slider,
  parameters: {
    layout: 'centered'
  },
  argTypes: {},
  decorators: [themeDecorator()]
} satisfies Meta<typeof Slider>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    value: 70,
    max: 100,
    unit: 'px',
    onChange: fn()
  }
};

export const ThumbHover: Story = {
  args: {
    'value': 70,
    'max': 100,
    'unit': 'px',
    'onChange': fn(),
    // @ts-ignore
    'data-thumb-hover': true
  }
};

export const ThumbFocus: Story = {
  args: {
    'value': 70,
    'max': 100,
    'unit': 'px',
    'onChange': fn(),
    // @ts-ignore
    'data-thumb-focus': true
  }
};

export const Disabled: Story = {
  args: {
    value: 70,
    max: 100,
    unit: 'px',
    onChange: fn(),
    disabled: true
  }
};

export const Indeterminate: Story = {
  args: {
    value: 70,
    max: 100,
    unit: 'px',
    onChange: fn(),
    isIndeterminate: true
  }
};
