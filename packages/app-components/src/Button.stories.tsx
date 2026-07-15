import type { Meta, StoryObj } from '@storybook/react-vite';
import { themeDecorator } from '../.storybook/common';
import { Button } from './Button';
import { TbBold, TbPlus, TbTrash, TbChevronDown } from 'react-icons/tb';

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

// ---- Default -----------------------------------------------------------

export const Default: Story = {
  args: { children: 'Edit', onClick: () => {} }
};
export const DefaultHover: Story = {
  args: { 'children': 'Edit', 'onClick': () => {}, 'data-hover': 'true' }
};
export const DefaultFocus: Story = {
  args: { 'children': 'Edit', 'onClick': () => {}, 'data-focus': 'true' }
};
export const DefaultDisabled: Story = {
  args: { children: 'Edit', onClick: () => {}, disabled: true }
};

// ---- Primary -----------------------------------------------------------

export const Primary: Story = {
  args: { variant: 'primary', children: 'Save', onClick: () => {} }
};
export const PrimaryHover: Story = {
  args: { 'variant': 'primary', 'children': 'Save', 'onClick': () => {}, 'data-hover': 'true' }
};
export const PrimaryFocus: Story = {
  args: { 'variant': 'primary', 'children': 'Save', 'onClick': () => {}, 'data-focus': 'true' }
};
export const PrimaryDisabled: Story = {
  args: { variant: 'primary', children: 'Save', onClick: () => {}, disabled: true }
};

// ---- Ghost -------------------------------------------------------------

export const Ghost: Story = {
  args: { variant: 'ghost', children: 'Cancel', onClick: () => {} }
};
export const GhostHover: Story = {
  args: { 'variant': 'ghost', 'children': 'Cancel', 'onClick': () => {}, 'data-hover': 'true' }
};
export const GhostFocus: Story = {
  args: { 'variant': 'ghost', 'children': 'Cancel', 'onClick': () => {}, 'data-focus': 'true' }
};
export const GhostDisabled: Story = {
  args: { variant: 'ghost', children: 'Cancel', onClick: () => {}, disabled: true }
};

// ---- Danger ------------------------------------------------------------

export const Danger: Story = {
  args: { variant: 'danger', children: 'Delete', onClick: () => {} }
};
export const DangerHover: Story = {
  args: { 'variant': 'danger', 'children': 'Delete', 'onClick': () => {}, 'data-hover': 'true' }
};
export const DangerFocus: Story = {
  args: { 'variant': 'danger', 'children': 'Delete', 'onClick': () => {}, 'data-focus': 'true' }
};
export const DangerDisabled: Story = {
  args: { variant: 'danger', children: 'Delete', onClick: () => {}, disabled: true }
};

// ---- DangerSolid -------------------------------------------------------

export const DangerSolid: Story = {
  args: {
    variant: 'danger-solid',
    icon: <TbTrash />,
    children: 'Delete permanently',
    onClick: () => {}
  }
};
export const DangerSolidHover: Story = {
  args: {
    'variant': 'danger-solid',
    'icon': <TbTrash />,
    'children': 'Delete permanently',
    'onClick': () => {},
    'data-hover': 'true'
  }
};
export const DangerSolidFocus: Story = {
  args: {
    'variant': 'danger-solid',
    'icon': <TbTrash />,
    'children': 'Delete permanently',
    'onClick': () => {},
    'data-focus': 'true'
  }
};

// ---- Sizes -------------------------------------------------------------

export const Small: Story = {
  args: { variant: 'primary', size: 'sm', children: 'Small', onClick: () => {} }
};
export const Medium: Story = {
  args: { variant: 'primary', size: 'md', children: 'Medium', onClick: () => {} }
};
export const Large: Story = {
  args: { variant: 'primary', size: 'lg', children: 'Large', onClick: () => {} }
};

// ---- Icons -------------------------------------------------------------

export const WithLeadingIcon: Story = {
  args: { variant: 'primary', icon: <TbPlus />, children: 'New entity', onClick: () => {} }
};
export const WithTrailingIcon: Story = {
  args: { children: 'Options', iconRight: <TbChevronDown />, onClick: () => {} }
};
export const IconOnly: Story = {
  args: { variant: 'icon-only', icon: <TbBold />, onClick: () => {} }
};
export const IconOnlyFocus: Story = {
  args: { 'variant': 'icon-only', 'icon': <TbBold />, 'onClick': () => {}, 'data-focus': 'true' }
};
export const IconOnlySmall: Story = {
  args: { variant: 'icon-only', size: 'sm', icon: <TbBold />, onClick: () => {} }
};
