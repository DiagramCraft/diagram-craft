import type { Meta, StoryObj } from '@storybook/react-vite';
import { DialogContextProvider } from './Dialog';
import { PortalContextProvider } from './PortalContext';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';

const meta = {
  title: 'Components/DeleteConfirmationDialog',
  component: DeleteConfirmationDialog,
  parameters: {
    layout: 'centered'
  }
} satisfies Meta<typeof DeleteConfirmationDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

const wrap = (theme: 'light-theme' | 'dark-theme') => (args: Story['args']) => (
  <div className={theme}>
    <DialogContextProvider onDialogShow={() => {}} onDialogHide={() => {}}>
      <PortalContextProvider>
        <DeleteConfirmationDialog {...args} />
      </PortalContextProvider>
    </DialogContextProvider>
  </div>
);

const renderLight = wrap('light-theme');
const renderDark = wrap('dark-theme');

export const DeleteDark: Story = {
  name: 'Delete (dark)',
  render: renderDark,
  args: {
    open: true,
    title: 'Delete diagram?',
    message: (
      <>
        The diagram <b>System Context</b> will be permanently deleted.
      </>
    ),
    detail: "This can't be undone.",
    confirmLabel: 'Delete diagram',
    onConfirm: () => {},
    onCancel: () => {}
  }
};

export const DeleteLight: Story = {
  name: 'Delete (light)',
  render: renderLight,
  args: { ...DeleteDark.args }
};
