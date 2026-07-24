import type { Meta, StoryObj } from '@storybook/react-vite';
import { themeDecorator } from '../.storybook/common';
import { FormSection } from './FormSection';
import { FormElement } from './FormElement';
import { TextInput } from './TextInput';

const meta = {
  title: 'Components/FormSection',
  component: FormSection,
  parameters: {
    layout: 'centered'
  },
  decorators: [themeDecorator()]
} satisfies Meta<typeof FormSection>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { title: '', children: null },
  render: () => (
    <div style={{ minWidth: 360 }}>
      <FormSection step={1} title="Identity">
        <FormElement label="Name" required>
          <TextInput placeholder="e.g. Acme Platform" value="" onChange={() => {}} />
        </FormElement>
      </FormSection>
    </div>
  )
};

export const NoStep: Story = {
  args: { title: '', children: null },
  render: () => (
    <div style={{ minWidth: 360 }}>
      <FormSection title="Details">
        <FormElement label="Description" required={false}>
          <TextInput placeholder="Optional description" value="" onChange={() => {}} />
        </FormElement>
      </FormSection>
    </div>
  )
};

export const Multiple: Story = {
  args: { title: '', children: null },
  render: () => (
    <div style={{ minWidth: 360 }}>
      <FormSection step={1} title="Identity">
        <FormElement label="Name" required>
          <TextInput placeholder="e.g. Acme Platform" value="" onChange={() => {}} />
        </FormElement>
      </FormSection>
      <FormSection step={2} title="Schema setup">
        <FormElement label="Template" required={false}>
          <TextInput placeholder="Choose a template" value="" onChange={() => {}} />
        </FormElement>
      </FormSection>
    </div>
  )
};
