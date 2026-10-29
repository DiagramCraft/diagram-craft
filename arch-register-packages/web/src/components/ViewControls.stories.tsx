import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { LabeledSelect } from './LabeledSelect';
import { ToolbarButton } from './ToolbarButton';
import { LabeledDateInput } from './LabeledDateInput';
import { ViewControls, ViewControlsSeparator, ViewControlsSpacer } from './ViewControls';

const meta = {
  title: 'Components/ViewControls',
  component: ViewControls,
  tags: ['autodocs']
} satisfies Meta<typeof ViewControls>;

export default meta;
type Story = StoryObj<typeof meta>;

const options = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' }
];

const Controls = () => {
  const [status, setStatus] = useState('all');
  const [date, setDate] = useState('2026-01-01');
  return (
    <>
      <LabeledSelect label="Status" value={status} onChange={setStatus} options={options} />
      <LabeledDateInput label="From" value={date} onChange={setDate} />
      <ViewControlsSeparator />
      <ToolbarButton>Reset</ToolbarButton>
      <ViewControlsSpacer />
      <ToolbarButton>Export</ToolbarButton>
    </>
  );
};

export const Page: Story = {
  args: { children: null, variant: 'page' },
  render: () => (
    <ViewControls variant="page">
      <Controls />
    </ViewControls>
  )
};

export const Tab: Story = {
  args: { children: null, variant: 'tab' },
  render: () => (
    <ViewControls variant="tab">
      <Controls />
    </ViewControls>
  )
};

export const View: Story = {
  args: { children: null, variant: 'view' },
  render: () => (
    <ViewControls variant="view">
      <Controls />
    </ViewControls>
  )
};
