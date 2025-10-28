import type { Meta, StoryObj } from '@storybook/react';
import { themeDecorator } from '../.storybook/common';
import { Toolbar } from './Toolbar';
import {
  TbRotate,
  TbAbacus,
  TbBasketCog,
  TbChevronDown,
  TbStrikethrough,
  TbUnderline
} from 'react-icons/tb';

const meta = {
  title: 'Components/Toolbar',
  component: Toolbar.Root,
  parameters: {
    layout: 'centered'
  },
  argTypes: {},
  decorators: [themeDecorator()]
} satisfies Meta<typeof Toolbar.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    children: [
      <Toolbar.Button key={1} value={'bold'}>
        <TbAbacus />
      </Toolbar.Button>,
      <Toolbar.Button key={2} value={'italic'}>
        <TbRotate />
      </Toolbar.Button>,
      <Toolbar.Separator key={'s'} />,
      <Toolbar.Button key={3} value={'cog'}>
        <TbBasketCog />
      </Toolbar.Button>,
      <Toolbar.Button key={5} value={'overflow'} isOverflow>
        <TbChevronDown />
      </Toolbar.Button>,
      <Toolbar.Separator key={6} />,
      <Toolbar.ToggleGroup type={'single'} value="strikethrough" key={7}>
        <Toolbar.ToggleItem value={'underline'}>
          <TbUnderline />
        </Toolbar.ToggleItem>
        <Toolbar.ToggleItem value={'strikethrough'}>
          <TbStrikethrough />
        </Toolbar.ToggleItem>
      </Toolbar.ToggleGroup>
    ]
  }
};

export const Focus: Story = {
  args: {
    children: [
      <Toolbar.Button key={1} value={'bold'}>
        <TbAbacus />
      </Toolbar.Button>,
      <Toolbar.Button key={2} value={'italic'}>
        <TbRotate />
      </Toolbar.Button>,
      <Toolbar.Separator key={'s'} />,
      <Toolbar.Button key={3} value={'cog'} data-focus={'true'}>
        <TbBasketCog />
      </Toolbar.Button>,
      <Toolbar.Button key={5} value={'overflow'} isOverflow>
        <TbChevronDown />
      </Toolbar.Button>,
      <Toolbar.Separator key={6} />,
      <Toolbar.ToggleGroup type={'single'} value="strikethrough" key={7}>
        <Toolbar.ToggleItem value={'underline'} data-focus={'true'}>
          <TbUnderline />
        </Toolbar.ToggleItem>
        <Toolbar.ToggleItem value={'strikethrough'}>
          <TbStrikethrough />
        </Toolbar.ToggleItem>
      </Toolbar.ToggleGroup>
    ]
  }
};

export const Hover: Story = {
  args: {
    children: [
      <Toolbar.Button key={1} value={'bold'}>
        <TbAbacus />
      </Toolbar.Button>,
      <Toolbar.Button key={2} value={'italic'} data-hover={'true'}>
        <TbRotate />
      </Toolbar.Button>,
      <Toolbar.Separator key={'s'} />,
      <Toolbar.Button key={3} value={'cog'}>
        <TbBasketCog />
      </Toolbar.Button>,
      <Toolbar.Button key={5} value={'overflow'} isOverflow>
        <TbChevronDown />
      </Toolbar.Button>,
      <Toolbar.Separator key={6} />,
      <Toolbar.ToggleGroup type={'single'} value="strikethrough" key={7}>
        <Toolbar.ToggleItem value={'underline'} data-hover={'true'}>
          <TbUnderline />
        </Toolbar.ToggleItem>
        <Toolbar.ToggleItem value={'strikethrough'}>
          <TbStrikethrough />
        </Toolbar.ToggleItem>
      </Toolbar.ToggleGroup>
    ]
  }
};

export const Disabled: Story = {
  args: {
    children: [
      <Toolbar.Button key={1} value={'bold'}>
        <TbAbacus />
      </Toolbar.Button>,
      <Toolbar.Button key={2} value={'italic'} disabled={true}>
        <TbRotate />
      </Toolbar.Button>,
      <Toolbar.Separator key={'s'} />,
      <Toolbar.Button key={3} value={'cog'}>
        <TbBasketCog />
      </Toolbar.Button>,
      <Toolbar.Button key={5} value={'overflow'} isOverflow>
        <TbChevronDown />
      </Toolbar.Button>,
      <Toolbar.Separator key={6} />,
      <Toolbar.ToggleGroup type={'single'} value="strikethrough" key={7}>
        <Toolbar.ToggleItem value={'underline'} disabled={true}>
          <TbUnderline />
        </Toolbar.ToggleItem>
        <Toolbar.ToggleItem value={'strikethrough'}>
          <TbStrikethrough />
        </Toolbar.ToggleItem>
      </Toolbar.ToggleGroup>
    ]
  }
};

export const Large: Story = {
  args: {
    size: 'large',
    children: [
      <Toolbar.Button key={1} value={'bold'}>
        <TbAbacus size={'17.5px'} />
      </Toolbar.Button>,
      <Toolbar.Button key={2} value={'italic'} disabled={true}>
        <TbRotate size={'17.5px'} />
      </Toolbar.Button>,
      <Toolbar.Separator key={'s'} />,
      <Toolbar.Button key={3} value={'cog'}>
        <TbBasketCog size={'17.5px'} />
      </Toolbar.Button>,
      <Toolbar.Separator key={6} />,
      <Toolbar.ToggleGroup type={'single'} value="strikethrough" key={7}>
        <Toolbar.ToggleItem value={'underline'} disabled={true}>
          <TbUnderline size={'17.5px'} />
        </Toolbar.ToggleItem>
        <Toolbar.ToggleItem value={'strikethrough'}>
          <TbStrikethrough size={'17.5px'} />
        </Toolbar.ToggleItem>
      </Toolbar.ToggleGroup>
    ]
  }
};

export const Vertical: Story = {
  args: {
    direction: 'vertical',
    children: [
      <Toolbar.Button key={1} value={'bold'}>
        <TbAbacus />
      </Toolbar.Button>,
      <Toolbar.Button key={2} value={'italic'} disabled={true}>
        <TbRotate />
      </Toolbar.Button>,
      <Toolbar.Separator key={'s'} />,
      <Toolbar.Button key={3} value={'cog'}>
        <TbBasketCog />
      </Toolbar.Button>
    ]
  }
};
