import type { Meta, StoryObj } from '@storybook/react-vite';
import { themeDecorator } from '../.storybook/common';
import { FormGroup } from './FormGroup';
import { FormElement } from './FormElement';
import { TextInput } from './TextInput';
import { TbAdjustments, TbDatabase, TbInfoCircle, TbUsers } from 'react-icons/tb';

const meta = {
  title: 'Components/FormGroup',
  component: FormGroup,
  parameters: {
    layout: 'centered'
  },
  decorators: [themeDecorator()]
} satisfies Meta<typeof FormGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { label: '' },
  render: () => (
    <div style={{ minWidth: 360 }}>
      <FormGroup label="Properties">
        <FormElement label="Name" required>
          <TextInput placeholder="e.g. my-service" value="" onChange={() => {}} />
        </FormElement>
        <FormElement label="Description" required={false}>
          <TextInput placeholder="Optional description" value="" onChange={() => {}} />
        </FormElement>
      </FormGroup>
    </div>
  )
};

export const WithIcon: Story = {
  args: { label: '' },
  render: () => (
    <div style={{ minWidth: 360 }}>
      <FormGroup label="Metadata" icon={<TbInfoCircle size={12} />}>
        <FormElement label="Owner" required={false}>
          <TextInput placeholder="team-platform" value="" onChange={() => {}} />
        </FormElement>
        <FormElement label="Tags" required={false}>
          <TextInput placeholder="comma-separated" value="" onChange={() => {}} />
        </FormElement>
      </FormGroup>
    </div>
  )
};

export const WithAction: Story = {
  args: { label: '' },
  render: () => (
    <div style={{ minWidth: 360 }}>
      <FormGroup
        label="People"
        icon={<TbUsers size={12} />}
        action={
          <button
            type="button"
            style={{
              fontSize: '10.5px',
              color: 'var(--base-fg-more-dim)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 4px',
              borderRadius: '4px'
            }}
          >
            Select all
          </button>
        }
      >
        <FormElement label="Member" required>
          <TextInput placeholder="username" value="" onChange={() => {}} />
        </FormElement>
      </FormGroup>
    </div>
  )
};

export const Multiple: Story = {
  args: { label: '' },
  render: () => (
    <div style={{ minWidth: 360, display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <FormGroup label="Properties" icon={<TbAdjustments size={12} />}>
        <FormElement label="Name" required>
          <TextInput placeholder="e.g. my-service" value="" onChange={() => {}} />
        </FormElement>
      </FormGroup>
      <FormGroup label="Schema" icon={<TbDatabase size={12} />}>
        <FormElement label="Type" required>
          <TextInput placeholder="Select a type" value="" onChange={() => {}} />
        </FormElement>
        <FormElement label="Version" required={false}>
          <TextInput placeholder="1.0.0" value="" onChange={() => {}} />
        </FormElement>
      </FormGroup>
    </div>
  )
};
