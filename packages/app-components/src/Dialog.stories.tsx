import type { Meta, StoryObj } from '@storybook/react-vite';
import { Dialog } from './Dialog';
import { fn } from 'storybook/test';
import { PortalContextProvider } from './PortalContext';

const meta = {
  title: 'Components/Dialog',
  component: Dialog,
  parameters: {
    layout: 'centered'
  },
  argTypes: {}
} satisfies Meta<typeof Dialog>;

export default meta;

type Story = StoryObj<typeof meta>;

const renderLight = function Component(args: Story['args']) {
  return (
    <div className={'light-theme'}>
      <PortalContextProvider>
        <Dialog {...args}>{args.children}</Dialog>
      </PortalContextProvider>
    </div>
  );
};

const renderDark = function Component(args: Story['args']) {
  return (
    <div className={'dark-theme'}>
      <PortalContextProvider>
        <Dialog {...args}>{args.children}</Dialog>
      </PortalContextProvider>
    </div>
  );
};

export const Light: Story = {
  render: renderLight,
  args: {
    open: true,
    children: [<div key={1}>Lorem ipsum dolor sit amet</div>],
    title: 'Sample dialog',
    onClose: fn(),
    buttons: [
      { label: 'Delete', type: 'danger', onClick: fn() },
      { label: 'Cancel', type: 'cancel', onClick: fn() },
      { label: 'Ok', type: 'default', onClick: fn() }
    ]
  }
};

export const Dark: Story = {
  render: renderDark,
  args: {
    open: true,
    children: [<div key={1}>Lorem ipsum dolor sit amet</div>],
    title: 'Sample dialog',
    onClose: fn(),
    buttons: [
      { label: 'Delete', type: 'danger', onClick: fn() },
      { label: 'Cancel', type: 'cancel', onClick: fn() },
      { label: 'Ok', type: 'default', onClick: fn() }
    ]
  }
};
