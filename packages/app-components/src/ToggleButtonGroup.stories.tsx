import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { themeDecorator } from '../.storybook/common';
import { ToggleButtonGroup } from './ToggleButtonGroup';
import { TbBold, TbItalic, TbUnderline } from 'react-icons/tb';

const meta = {
  title: 'Components/ToggleButtonGroup',
  component: ToggleButtonGroup.Root,
  parameters: {
    layout: 'centered'
  },
  argTypes: {},
  decorators: [themeDecorator()]
} satisfies Meta<typeof ToggleButtonGroup.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    type: 'single',
    value: 'bold',
    onValueChange: fn(),
    children: [
      <ToggleButtonGroup.Item value={'bold'}>
        <TbBold />
      </ToggleButtonGroup.Item>,
      <ToggleButtonGroup.Item value={'italic'}>
        <TbItalic />
      </ToggleButtonGroup.Item>,
      <ToggleButtonGroup.Item value={'underline'}>
        <TbUnderline />
      </ToggleButtonGroup.Item>
    ]
  }
};

export const Multiple: Story = {
  args: {
    type: 'multiple',
    value: ['bold', 'italic'],
    onValueChange: fn(),
    children: [
      <ToggleButtonGroup.Item value={'bold'}>
        <TbBold />
      </ToggleButtonGroup.Item>,
      <ToggleButtonGroup.Item value={'italic'}>
        <TbItalic />
      </ToggleButtonGroup.Item>,
      <ToggleButtonGroup.Item value={'underline'}>
        <TbUnderline />
      </ToggleButtonGroup.Item>
    ]
  }
};

export const Focus: Story = {
  args: {
    type: 'single',
    value: 'bold',
    onValueChange: fn(),
    children: [
      <ToggleButtonGroup.Item value={'bold'}>
        <TbBold />
      </ToggleButtonGroup.Item>,
      <ToggleButtonGroup.Item value={'italic'} data-focus={'true'}>
        <TbItalic />
      </ToggleButtonGroup.Item>,
      <ToggleButtonGroup.Item value={'underline'}>
        <TbUnderline />
      </ToggleButtonGroup.Item>
    ]
  }
};

export const Hover: Story = {
  args: {
    type: 'single',
    value: 'bold',
    onValueChange: fn(),
    children: [
      <ToggleButtonGroup.Item value={'bold'}>
        <TbBold />
      </ToggleButtonGroup.Item>,
      <ToggleButtonGroup.Item value={'italic'} data-hover={'true'}>
        <TbItalic />
      </ToggleButtonGroup.Item>,
      <ToggleButtonGroup.Item value={'underline'}>
        <TbUnderline />
      </ToggleButtonGroup.Item>
    ]
  }
};

export const Disabled: Story = {
  args: {
    type: 'single',
    value: 'bold',
    onValueChange: fn(),
    children: [
      <ToggleButtonGroup.Item value={'bold'}>
        <TbBold />
      </ToggleButtonGroup.Item>,
      <ToggleButtonGroup.Item value={'italic'} disabled={true}>
        <TbItalic />
      </ToggleButtonGroup.Item>,
      <ToggleButtonGroup.Item value={'underline'}>
        <TbUnderline />
      </ToggleButtonGroup.Item>
    ]
  }
};

export const AllDisabled: Story = {
  args: {
    type: 'single',
    value: 'bold',
    disabled: true,
    onValueChange: fn(),
    children: [
      <ToggleButtonGroup.Item value={'bold'}>
        <TbBold />
      </ToggleButtonGroup.Item>,
      <ToggleButtonGroup.Item value={'italic'}>
        <TbItalic />
      </ToggleButtonGroup.Item>,
      <ToggleButtonGroup.Item value={'underline'}>
        <TbUnderline />
      </ToggleButtonGroup.Item>
    ]
  }
};
