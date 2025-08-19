import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { TagInput } from './TagInput';
import { fn } from '@storybook/test';
import { themeDecorator } from '../.storybook/common';

const meta: Meta<typeof TagInput> = {
  title: 'Components/TagInput',
  component: TagInput,
  parameters: {
    layout: 'padded',
  },
  decorators: [themeDecorator()],
  argTypes: {
    selectedTags: {
      control: { type: 'object' },
      description: 'Array of currently selected tags',
    },
    availableTags: {
      control: { type: 'object' },
      description: 'Array of available tags for autocomplete',
    },
    onTagsChange: {
      description: 'Callback when tags are added or removed',
    },
    onInputChange: {
      description: 'Callback when input value changes',
    },
    placeholder: {
      control: { type: 'text' },
      description: 'Placeholder text for the input',
    },
    maxSuggestions: {
      control: { type: 'number' },
      description: 'Maximum number of suggestions to show',
    },
    disabled: {
      control: { type: 'boolean' },
      description: 'Whether the input is disabled',
    },
    state: {
      control: { type: 'select' },
      options: ['set', 'unset', 'overridden'],
      description: 'Visual state of the field',
    },
    isIndeterminate: {
      control: { type: 'boolean' },
      description: 'Whether the field is in an indeterminate state',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Interactive wrapper component for stories
const TagInputWrapper = (args: any) => {
  const [selectedTags, setSelectedTags] = useState<string[]>(args.selectedTags || []);

  return (
    <TagInput
      {...args}
      selectedTags={selectedTags}
      onTagsChange={(tags) => {
        setSelectedTags(tags);
        args.onTagsChange?.(tags);
      }}
    />
  );
};

export const Primary: Story = {
  render: TagInputWrapper,
  args: {
    selectedTags: [],
    availableTags: [
      'React',
      'TypeScript',
      'JavaScript',
      'CSS',
      'HTML',
      'Node.js',
      'Express',
      'MongoDB',
      'PostgreSQL',
      'GraphQL',
    ],
    placeholder: 'Add tags...',
    onTagsChange: fn(),
    onInputChange: fn(),
  },
};

export const WithPreselectedTags: Story = {
  render: TagInputWrapper,
  args: {
    selectedTags: ['React', 'TypeScript', 'CSS'],
    availableTags: [
      'React',
      'TypeScript',
      'JavaScript',
      'CSS',
      'HTML',
      'Node.js',
      'Express',
      'MongoDB',
      'PostgreSQL',
      'GraphQL',
    ],
    placeholder: 'Add more tags...',
    onTagsChange: fn(),
    onInputChange: fn(),
  },
};

export const Disabled: Story = {
  render: TagInputWrapper,
  args: {
    selectedTags: ['React', 'TypeScript'],
    availableTags: ['React', 'TypeScript', 'JavaScript'],
    disabled: true,
    placeholder: 'Disabled input...',
    onTagsChange: fn(),
    onInputChange: fn(),
  },
};

export const Indeterminate: Story = {
  render: TagInputWrapper,
  args: {
    selectedTags: ['Angular'],
    availableTags: ['React', 'Vue', 'Angular'],
    isIndeterminate: true,
    placeholder: 'Indeterminate state...',
    onTagsChange: fn(),
    onInputChange: fn(),
  },
};

export const WithSetState: Story = {
  render: TagInputWrapper,
  args: {
    selectedTags: ['React'],
    availableTags: ['React', 'Vue', 'Angular'],
    state: 'set',
    onTagsChange: fn(),
    onInputChange: fn(),
  },
};

export const WithUnsetState: Story = {
  render: TagInputWrapper,
  args: {
    selectedTags: [],
    availableTags: ['React', 'Vue', 'Angular'],
    state: 'unset',
    onTagsChange: fn(),
    onInputChange: fn(),
  },
};

export const WithOverriddenState: Story = {
  render: TagInputWrapper,
  args: {
    selectedTags: ['Vue'],
    availableTags: ['React', 'Vue', 'Angular'],
    state: 'overridden',
    onTagsChange: fn(),
    onInputChange: fn(),
  },
};