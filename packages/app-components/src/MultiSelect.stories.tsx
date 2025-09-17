import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { MultiSelect, MultiSelectItem } from './MultiSelect';
import { fn } from '@storybook/test';
import { themeDecorator } from '../.storybook/common';

const meta: Meta<typeof MultiSelect> = {
  title: 'Components/MultiSelect',
  component: MultiSelect,
  parameters: {
    layout: 'padded',
  },
  decorators: [themeDecorator()],
  argTypes: {
    selectedValues: {
      control: { type: 'object' },
      description: 'Array of currently selected item values',
    },
    availableItems: {
      control: { type: 'object' },
      description: 'Array of available items for selection',
    },
    onSelectionChange: {
      description: 'Callback when selection changes',
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

// Sample data for stories
const frameworkItems: MultiSelectItem[] = [
  { value: 'react', label: 'React' },
  { value: 'vue', label: 'Vue.js' },
  { value: 'angular', label: 'Angular' },
  { value: 'svelte', label: 'Svelte' },
  { value: 'nextjs', label: 'Next.js' },
  { value: 'nuxt', label: 'Nuxt.js' },
  { value: 'gatsby', label: 'Gatsby' },
  { value: 'remix', label: 'Remix' },
];

const languageItems: MultiSelectItem[] = [
  { value: 'js', label: 'JavaScript' },
  { value: 'ts', label: 'TypeScript' },
  { value: 'py', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'csharp', label: 'C#' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'php', label: 'PHP' },
];

const personItems: MultiSelectItem[] = [
  { value: 'john-doe', label: 'John Doe' },
  { value: 'jane-smith', label: 'Jane Smith' },
  { value: 'bob-wilson', label: 'Bob Wilson' },
  { value: 'alice-johnson', label: 'Alice Johnson' },
  { value: 'charlie-brown', label: 'Charlie Brown' },
  { value: 'diana-prince', label: 'Diana Prince' },
  { value: 'peter-parker', label: 'Peter Parker' },
  { value: 'mary-watson', label: 'Mary Watson' },
];

// Interactive wrapper component for stories
const MultiSelectWrapper = (args: any) => {
  const [selectedValues, setSelectedValues] = useState<string[]>(args.selectedValues || []);

  return (
    <MultiSelect
      {...args}
      selectedValues={selectedValues}
      onSelectionChange={(values) => {
        setSelectedValues(values);
        args.onSelectionChange?.(values);
      }}
    />
  );
};

export const Primary: Story = {
  render: MultiSelectWrapper,
  args: {
    selectedValues: [],
    availableItems: frameworkItems,
    placeholder: 'Select frameworks...',
    onSelectionChange: fn(),
    onInputChange: fn(),
  },
};

export const WithPreselectedItems: Story = {
  render: MultiSelectWrapper,
  args: {
    selectedValues: ['react', 'ts', 'nextjs'],
    availableItems: frameworkItems,
    placeholder: 'Add more frameworks...',
    onSelectionChange: fn(),
    onInputChange: fn(),
  },
};

export const ProgrammingLanguages: Story = {
  render: MultiSelectWrapper,
  args: {
    selectedValues: ['js', 'ts'],
    availableItems: languageItems,
    placeholder: 'Select programming languages...',
    onSelectionChange: fn(),
    onInputChange: fn(),
  },
};

export const TeamMembers: Story = {
  render: MultiSelectWrapper,
  args: {
    selectedValues: ['john-doe', 'jane-smith'],
    availableItems: personItems,
    placeholder: 'Search team members...',
    onSelectionChange: fn(),
    onInputChange: fn(),
  },
};

export const LimitedSuggestions: Story = {
  render: MultiSelectWrapper,
  args: {
    selectedValues: [],
    availableItems: frameworkItems,
    placeholder: 'Max 3 suggestions...',
    maxSuggestions: 3,
    onSelectionChange: fn(),
    onInputChange: fn(),
  },
};

export const Disabled: Story = {
  render: MultiSelectWrapper,
  args: {
    selectedValues: ['react', 'vue'],
    availableItems: frameworkItems,
    disabled: true,
    placeholder: 'Disabled input...',
    onSelectionChange: fn(),
    onInputChange: fn(),
  },
};

export const Indeterminate: Story = {
  render: MultiSelectWrapper,
  args: {
    selectedValues: ['angular'],
    availableItems: frameworkItems,
    isIndeterminate: true,
    placeholder: 'Indeterminate state...',
    onSelectionChange: fn(),
    onInputChange: fn(),
  },
};

export const WithSetState: Story = {
  render: MultiSelectWrapper,
  args: {
    selectedValues: ['react'],
    availableItems: frameworkItems,
    state: 'set',
    onSelectionChange: fn(),
    onInputChange: fn(),
  },
};

export const WithUnsetState: Story = {
  render: MultiSelectWrapper,
  args: {
    selectedValues: [],
    availableItems: frameworkItems,
    state: 'unset',
    onSelectionChange: fn(),
    onInputChange: fn(),
  },
};

export const WithOverriddenState: Story = {
  render: MultiSelectWrapper,
  args: {
    selectedValues: ['vue'],
    availableItems: frameworkItems,
    state: 'overridden',
    onSelectionChange: fn(),
    onInputChange: fn(),
  },
};

export const EmptyOptions: Story = {
  render: MultiSelectWrapper,
  args: {
    selectedValues: [],
    availableItems: [],
    placeholder: 'No options available...',
    onSelectionChange: fn(),
    onInputChange: fn(),
  },
};

export const ManyOptions: Story = {
  render: MultiSelectWrapper,
  args: {
    selectedValues: [],
    availableItems: [
      ...frameworkItems,
      ...languageItems,
      ...personItems,
      { value: 'docker', label: 'Docker' },
      { value: 'kubernetes', label: 'Kubernetes' },
      { value: 'aws', label: 'Amazon Web Services' },
      { value: 'gcp', label: 'Google Cloud Platform' },
      { value: 'azure', label: 'Microsoft Azure' },
      { value: 'mongodb', label: 'MongoDB' },
      { value: 'postgresql', label: 'PostgreSQL' },
      { value: 'redis', label: 'Redis' },
      { value: 'elasticsearch', label: 'Elasticsearch' },
    ],
    placeholder: 'Search from many options...',
    onSelectionChange: fn(),
    onInputChange: fn(),
  },
};