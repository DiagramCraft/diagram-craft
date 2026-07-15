import type { Meta, StoryObj } from '@storybook/react-vite';
import { themeDecorator } from '../.storybook/common';
import { FormElement } from './FormElement';
import { TextInput } from './TextInput';
import { TextArea } from './TextArea';
import { Select } from './Select';
import { useState } from 'react';

const meta = {
  title: 'Components/FormElement',
  component: FormElement,
  parameters: {
    layout: 'centered'
  },
  decorators: [themeDecorator()]
} satisfies Meta<typeof FormElement>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithTextInput: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [value, setValue] = useState('');
    return (
      <div style={{ width: '300px' }}>
        <FormElement label="Email">
          <TextInput
            value={value}
            onChange={v => setValue(v ?? '')}
            placeholder="user@example.com"
            type="email"
          />
        </FormElement>
      </div>
    );
  },
  args: {
    label: 'Email',
    children: null
  }
};

export const WithRequired: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [value, setValue] = useState('');
    return (
      <div style={{ width: '300px' }}>
        <FormElement label="Name" required>
          <TextInput
            value={value}
            onChange={v => setValue(v ?? '')}
            placeholder="Enter your name"
          />
        </FormElement>
      </div>
    );
  },
  args: {
    label: 'Name',
    required: true,
    children: null
  }
};

export const WithHint: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [value, setValue] = useState('');
    return (
      <div style={{ width: '300px' }}>
        <FormElement label="Password" required hint="Must be at least 8 characters">
          <TextInput
            value={value}
            onChange={v => setValue(v ?? '')}
            placeholder="Enter password"
            type="password"
          />
        </FormElement>
      </div>
    );
  },
  args: {
    label: 'Password',
    required: true,
    hint: 'Must be at least 8 characters',
    children: null
  }
};

export const WithError: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [value, setValue] = useState('invalid-email');
    return (
      <div style={{ width: '300px' }}>
        <FormElement label="Email" required error="Please enter a valid email address">
          <TextInput
            value={value}
            onChange={v => setValue(v ?? '')}
            placeholder="user@example.com"
            type="email"
          />
        </FormElement>
      </div>
    );
  },
  args: {
    label: 'Email',
    required: true,
    error: 'Please enter a valid email address',
    children: null
  }
};

export const WithTextArea: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [value, setValue] = useState('');
    return (
      <div style={{ width: '300px' }}>
        <FormElement label="Description" hint="Provide a brief description">
          <TextArea
            value={value}
            onChange={v => setValue(v ?? '')}
            placeholder="Enter description"
            rows={4}
          />
        </FormElement>
      </div>
    );
  },
  args: {
    label: 'Description',
    hint: 'Provide a brief description',
    children: null
  }
};

export const WithSelect: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [value, setValue] = useState<string | undefined>(undefined);
    return (
      <div style={{ width: '300px' }}>
        <FormElement label="Type" required>
          <Select.Root value={value} onChange={setValue}>
            <Select.Item value="option1">Option 1</Select.Item>
            <Select.Item value="option2">Option 2</Select.Item>
            <Select.Item value="option3">Option 3</Select.Item>
          </Select.Root>
        </FormElement>
      </div>
    );
  },
  args: {
    label: 'Type',
    required: true,
    children: null
  }
};

export const MultipleFields: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [name, setName] = useState('');
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [email, setEmail] = useState('');
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [type, setType] = useState<string | undefined>(undefined);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [description, setDescription] = useState('');

    return (
      <div style={{ width: '400px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <FormElement label="Name" required>
          <TextInput value={name} onChange={v => setName(v ?? '')} placeholder="Enter your name" />
        </FormElement>

        <FormElement label="Email" required hint="We'll never share your email">
          <TextInput
            value={email}
            onChange={v => setEmail(v ?? '')}
            placeholder="user@example.com"
            type="email"
          />
        </FormElement>

        <FormElement label="Account Type" required>
          <Select.Root value={type} onChange={setType}>
            <Select.Item value="personal">Personal</Select.Item>
            <Select.Item value="business">Business</Select.Item>
            <Select.Item value="enterprise">Enterprise</Select.Item>
          </Select.Root>
        </FormElement>

        <FormElement label="Bio">
          <TextArea
            value={description}
            onChange={v => setDescription(v ?? '')}
            placeholder="Tell us about yourself"
            rows={4}
          />
        </FormElement>
      </div>
    );
  },
  args: {
    label: 'Form',
    children: null
  }
};
