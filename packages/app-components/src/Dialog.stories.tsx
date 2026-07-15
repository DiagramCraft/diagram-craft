import type { Meta, StoryObj } from '@storybook/react-vite';
import { Dialog, DialogContextProvider } from './Dialog';
import { PortalContextProvider } from './PortalContext';
import { TextInput } from './TextInput';
import { TextArea } from './TextArea';
import { useState } from 'react';

const meta = {
  title: 'Components/Dialog',
  component: Dialog,
  parameters: {
    layout: 'centered'
  }
} satisfies Meta<typeof Dialog>;

export default meta;

type Story = StoryObj<typeof meta>;

const wrap = (theme: 'light-theme' | 'dark-theme') => (args: Story['args']) => (
  <div className={theme}>
    <DialogContextProvider onDialogShow={() => {}} onDialogHide={() => {}}>
      <PortalContextProvider>
        <Dialog {...args}>{args!.children}</Dialog>
      </PortalContextProvider>
    </DialogContextProvider>
  </div>
);

const renderLight = wrap('light-theme');
const renderDark = wrap('dark-theme');

// ── Basic ───────────────────────────────────────────────────────────────────

export const Basic: Story = {
  name: 'Basic (dark)',
  render: renderDark,
  args: {
    open: true,
    title: 'Delete workspace?',
    children:
      'This will permanently remove the workspace and all its diagrams. This action cannot be undone.',
    onClose: () => {},
    buttons: [
      { label: 'Cancel', type: 'cancel', onClick: () => {} },
      { label: 'Delete', type: 'danger', onClick: () => {} }
    ]
  }
};

export const BasicLight: Story = {
  name: 'Basic (light)',
  render: renderLight,
  args: { ...Basic.args }
};

// ── With sup and sub ────────────────────────────────────────────────────────

const WithSupAndSubContent = () => {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const labelStyle = { fontSize: 11, color: 'var(--base-fg-dim)', marginBottom: 4 };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '6px 0' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={labelStyle}>Project name</div>
        <TextInput
          value={name}
          placeholder="e.g. Checkout redesign"
          onChange={v => setName(v ?? '')}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={labelStyle}>Description</div>
        <TextArea
          value={desc}
          placeholder="What is this project about?"
          onChange={v => setDesc(v ?? '')}
        />
      </div>
    </div>
  );
};

export const WithSupAndSub: Story = {
  name: 'Sup + sub (dark)',
  render: args => (
    <div className="dark-theme">
      <DialogContextProvider onDialogShow={() => {}} onDialogHide={() => {}}>
        <PortalContextProvider>
          <Dialog {...args}>
            <WithSupAndSubContent />
          </Dialog>
        </PortalContextProvider>
      </DialogContextProvider>
    </div>
  ),
  args: {
    open: true,
    sup: 'New project',
    title: 'Create a project',
    sub: 'Projects group diagrams and the entities they affect.',
    children: undefined,
    onClose: () => {},
    buttons: [
      { label: 'Cancel', type: 'cancel', onClick: () => {} },
      { label: 'Create project', type: 'default', onClick: () => {} }
    ]
  }
};

export const WithSupAndSubLight: Story = {
  name: 'Sup + sub (light)',
  render: args => (
    <div className="light-theme">
      <DialogContextProvider onDialogShow={() => {}} onDialogHide={() => {}}>
        <PortalContextProvider>
          <Dialog {...args}>
            <WithSupAndSubContent />
          </Dialog>
        </PortalContextProvider>
      </DialogContextProvider>
    </div>
  ),
  args: { ...WithSupAndSub.args, children: undefined }
};

// ── With footer hints ───────────────────────────────────────────────────────

export const WithFooterLeft: Story = {
  name: 'Footer hints (dark)',
  render: renderDark,
  args: {
    open: true,
    sup: 'Sync',
    title: 'Workspace is up to date',
    sub: 'All diagrams and entities are synced with the main branch.',
    children: 'Last pull was 4 minutes ago. No conflicts detected.',
    onClose: () => {},
    footerLeft: <span style={{ fontFamily: 'monospace', fontSize: 11 }}>Esc to close</span>,
    buttons: [{ label: 'Got it', type: 'default', onClick: () => {} }]
  }
};

// ── All button types ────────────────────────────────────────────────────────

export const AllButtonTypes: Story = {
  name: 'All button types (dark)',
  render: renderDark,
  args: {
    open: true,
    title: 'Button variants',
    children: 'Shows all four button type variants side by side.',
    onClose: () => {},
    buttons: [
      { label: 'Danger', type: 'danger', onClick: () => {} },
      { label: 'Secondary', type: 'secondary', onClick: () => {} },
      { label: 'Cancel', type: 'cancel', onClick: () => {} },
      { label: 'Default', type: 'default', onClick: () => {} }
    ]
  }
};

// ── Confirmation (no danger) ────────────────────────────────────────────────

export const Confirm: Story = {
  name: 'Confirm (dark)',
  render: renderDark,
  args: {
    open: true,
    title: 'Archive this project?',
    children:
      'Archived projects move out of the sidebar but keep all diagrams and history. You can restore it at any time.',
    onClose: () => {},
    footerLeft: <span style={{ fontFamily: 'monospace', fontSize: 11 }}>Esc to cancel</span>,
    buttons: [
      { label: 'Cancel', type: 'cancel', onClick: () => {} },
      { label: 'Archive', type: 'default', onClick: () => {} }
    ]
  }
};
