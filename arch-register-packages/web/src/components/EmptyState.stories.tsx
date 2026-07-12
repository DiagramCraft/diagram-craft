import type { Meta, StoryObj } from '@storybook/react-vite';
import { TbFolders, TbSearch } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { EmptyState } from './EmptyState';

const meta = {
  title: 'Components/EmptyState',
  component: EmptyState,
  parameters: {
    layout: 'centered'
  },
  tags: ['autodocs'],
  argTypes: {
    compact: {
      control: 'boolean'
    },
    framed: {
      control: 'boolean'
    }
  }
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Bubble chart not configured',
    subtitle: 'Map fields to the X, Y, size and colour axes above.'
  }
};

export const WithIcon: Story = {
  args: {
    icon: <TbSearch size={18} />,
    title: 'Start searching',
    subtitle: 'Search across entities, projects, diagrams, and schemas.'
  }
};

export const TitleOnly: Story = {
  args: {
    title: 'No discussion yet'
  }
};

export const Compact: Story = {
  args: {
    compact: true,
    title: 'No schemas are available for this workspace.'
  }
};

export const Framed: Story = {
  args: {
    framed: true,
    icon: <TbFolders size={22} />,
    title: 'Select a project',
    subtitle: 'Choose a project from the sidebar to view diagrams, entities, and details.'
  }
};

export const FramedWithAction: Story = {
  args: {
    framed: true,
    icon: <TbFolders size={22} />,
    title: 'No projects yet',
    subtitle: 'Create a project to start tracking diagrams and entities.',
    action: (
      <Button variant="primary" onClick={() => alert('New project clicked')}>
        New project
      </Button>
    )
  }
};
