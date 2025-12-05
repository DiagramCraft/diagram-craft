import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { MultiSelect, MultiSelectItem } from './MultiSelect';
import { themeDecorator } from '../.storybook/common';

const meta: Meta<typeof MultiSelect> = {
  title: 'Components/MultiSelect',
  component: MultiSelect,
  parameters: {
    layout: 'padded'
  },
  decorators: [themeDecorator()],
  argTypes: {
    selectedValues: {
      control: { type: 'object' },
      description: 'Array of currently selected item values'
    },
    availableItems: {
      control: { type: 'object' },
      description: 'Array of available items for selection'
    },
    onSelectionChange: {
      description: 'Callback when selection changes'
    },
    onInputChange: {
      description: 'Callback when input value changes'
    },
    placeholder: {
      control: { type: 'text' },
      description: 'Placeholder text for the input'
    },
    maxSuggestions: {
      control: { type: 'number' },
      description: 'Maximum number of suggestions to show'
    },
    allowCustomValues: {
      control: { type: 'boolean' },
      description: 'Whether users can add custom values not in the available items'
    },
    disabled: {
      control: { type: 'boolean' },
      description: 'Whether the input is disabled'
    },
    state: {
      control: { type: 'select' },
      options: ['set', 'unset', 'overridden'],
      description: 'Visual state of the field'
    },
    isIndeterminate: {
      control: { type: 'boolean' },
      description: 'Whether the field is in an indeterminate state'
    }
  }
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
  { value: 'remix', label: 'Remix' }
];

const languageItems: MultiSelectItem[] = [
  { value: 'js', label: 'JavaScript' },
  { value: 'ts', label: 'TypeScript' },
  { value: 'py', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'csharp', label: 'C#' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'php', label: 'PHP' }
];

const personItems: MultiSelectItem[] = [
  { value: 'john-doe', label: 'John Doe' },
  { value: 'jane-smith', label: 'Jane Smith' },
  { value: 'bob-wilson', label: 'Bob Wilson' },
  { value: 'alice-johnson', label: 'Alice Johnson' },
  { value: 'charlie-brown', label: 'Charlie Brown' },
  { value: 'diana-prince', label: 'Diana Prince' },
  { value: 'peter-parker', label: 'Peter Parker' },
  { value: 'mary-watson', label: 'Mary Watson' }
];

// Interactive wrapper component for stories
const MultiSelectWrapper = (args: any) => {
  const [selectedValues, setSelectedValues] = useState<string[]>(args.selectedValues || []);

  return (
    <MultiSelect
      {...args}
      selectedValues={selectedValues}
      onSelectionChange={values => {
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
    onSelectionChange: () => {},
    onInputChange: () => {}
  }
};

export const WithPreselectedItems: Story = {
  render: MultiSelectWrapper,
  args: {
    selectedValues: ['react', 'ts', 'nextjs'],
    availableItems: frameworkItems,
    placeholder: 'Add more frameworks...',
    onSelectionChange: () => {},
    onInputChange: () => {}
  }
};

export const LimitedSuggestions: Story = {
  render: MultiSelectWrapper,
  args: {
    selectedValues: [],
    availableItems: frameworkItems,
    placeholder: 'Max 3 suggestions...',
    maxSuggestions: 3,
    onSelectionChange: () => {},
    onInputChange: () => {}
  }
};

export const Disabled: Story = {
  render: MultiSelectWrapper,
  args: {
    selectedValues: ['react', 'vue'],
    availableItems: frameworkItems,
    disabled: true,
    placeholder: 'Disabled input...',
    onSelectionChange: () => {},
    onInputChange: () => {}
  }
};

export const Indeterminate: Story = {
  render: MultiSelectWrapper,
  args: {
    selectedValues: ['angular'],
    availableItems: frameworkItems,
    isIndeterminate: true,
    placeholder: 'Indeterminate state...',
    onSelectionChange: () => {},
    onInputChange: () => {}
  }
};

export const WithSetState: Story = {
  render: MultiSelectWrapper,
  args: {
    selectedValues: ['react'],
    availableItems: frameworkItems,
    state: 'set',
    onSelectionChange: () => {},
    onInputChange: () => {}
  }
};

export const WithUnsetState: Story = {
  render: MultiSelectWrapper,
  args: {
    selectedValues: [],
    availableItems: frameworkItems,
    state: 'unset',
    onSelectionChange: () => {},
    onInputChange: () => {}
  }
};

export const WithOverriddenState: Story = {
  render: MultiSelectWrapper,
  args: {
    selectedValues: ['vue'],
    availableItems: frameworkItems,
    state: 'overridden',
    onSelectionChange: () => {},
    onInputChange: () => {}
  }
};

export const EmptyOptions: Story = {
  render: MultiSelectWrapper,
  args: {
    selectedValues: [],
    availableItems: [],
    placeholder: 'No options available...',
    onSelectionChange: () => {},
    onInputChange: () => {}
  }
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
      { value: 'elasticsearch', label: 'Elasticsearch' }
    ],
    placeholder: 'Search from many options...',
    onSelectionChange: () => {},
    onInputChange: () => {}
  }
};

// Tag Input style stories (using MultiSelectItem format with allowCustomValues)
export const TagInputStyle: Story = {
  render: MultiSelectWrapper,
  args: {
    selectedValues: [],
    availableItems: [
      { value: 'React', label: 'React' },
      { value: 'TypeScript', label: 'TypeScript' },
      { value: 'JavaScript', label: 'JavaScript' },
      { value: 'CSS', label: 'CSS' },
      { value: 'HTML', label: 'HTML' },
      { value: 'Node.js', label: 'Node.js' },
      { value: 'Express', label: 'Express' },
      { value: 'MongoDB', label: 'MongoDB' },
      { value: 'PostgreSQL', label: 'PostgreSQL' },
      { value: 'GraphQL', label: 'GraphQL' }
    ],
    allowCustomValues: true,
    placeholder: 'Add tags...',
    onSelectionChange: () => {},
    onInputChange: () => {}
  }
};

export const TagInputWithPreselected: Story = {
  render: MultiSelectWrapper,
  args: {
    selectedValues: ['React', 'TypeScript', 'CSS'],
    availableItems: [
      { value: 'React', label: 'React' },
      { value: 'TypeScript', label: 'TypeScript' },
      { value: 'JavaScript', label: 'JavaScript' },
      { value: 'CSS', label: 'CSS' },
      { value: 'HTML', label: 'HTML' },
      { value: 'Node.js', label: 'Node.js' },
      { value: 'Express', label: 'Express' },
      { value: 'MongoDB', label: 'MongoDB' },
      { value: 'PostgreSQL', label: 'PostgreSQL' },
      { value: 'GraphQL', label: 'GraphQL' }
    ],
    allowCustomValues: true,
    placeholder: 'Add more tags...',
    onSelectionChange: () => {},
    onInputChange: () => {}
  }
};

export const TagInputCustomOnly: Story = {
  render: MultiSelectWrapper,
  args: {
    selectedValues: [],
    availableItems: [],
    allowCustomValues: true,
    placeholder: 'Type and press Enter to add tags...',
    onSelectionChange: () => {},
    onInputChange: () => {}
  }
};
