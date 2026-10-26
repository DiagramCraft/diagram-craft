import type { Meta, StoryObj } from '@storybook/react-vite';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { FormGroup } from './FormGroup';
import { TbInfoCircle, TbUsers } from 'react-icons/tb';

const meta = {
  title: 'Components/FormGroup',
  component: FormGroup,
  parameters: {
    layout: 'centered'
  },
  argTypes: {
    variant: {
      control: { type: 'inline-radio' },
      options: ['border', 'section', 'simple']
    }
  }
} satisfies Meta<typeof FormGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

const borderArgs = { variant: 'border', label: '', children: null } as const;
const sectionArgs = { variant: 'section', label: '', children: null } as const;

const action = (
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
);

export const Default: Story = {
  args: borderArgs,
  render: ({ variant }) => (
    <div style={{ minWidth: 360 }}>
      <FormGroup variant={variant} label="Properties">
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
  args: borderArgs,
  render: ({ variant }) => (
    <div style={{ minWidth: 360 }}>
      <FormGroup variant={variant} label="Metadata" icon={<TbInfoCircle size={12} />}>
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
  args: borderArgs,
  render: ({ variant }) => (
    <div style={{ minWidth: 360 }}>
      <FormGroup variant={variant} label="People" icon={<TbUsers size={12} />} action={action}>
        <FormElement label="Member" required>
          <TextInput placeholder="username" value="" onChange={() => {}} />
        </FormElement>
      </FormGroup>
    </div>
  )
};

export const SectionWithStep: Story = {
  args: sectionArgs,
  render: ({ variant }) => (
    <div style={{ minWidth: 360 }}>
      <FormGroup variant={variant} label="Identity" icon={1}>
        <FormElement label="Name" required>
          <TextInput placeholder="e.g. Acme Platform" value="" onChange={() => {}} />
        </FormElement>
      </FormGroup>
    </div>
  )
};

export const SectionWithIconAndAction: Story = {
  args: sectionArgs,
  render: ({ variant }) => (
    <div style={{ minWidth: 360 }}>
      <FormGroup variant={variant} label="People" icon={<TbUsers size={12} />} action={action}>
        <FormElement label="Member" required>
          <TextInput placeholder="username" value="" onChange={() => {}} />
        </FormElement>
      </FormGroup>
    </div>
  )
};
