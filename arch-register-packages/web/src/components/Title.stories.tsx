import type { Meta, StoryObj } from '@storybook/react-vite';
import { Title } from './Title';
import { TbSettings, TbDots, TbPlus, TbDownload } from 'react-icons/tb';
import { Chip } from './Chip';
import { TypeBadge } from './TypeBadge';
import { Button } from '@diagram-craft/app-components/Button';

const meta = {
  title: 'Components/Title',
  component: Title,
  parameters: {
    layout: 'padded'
  },
  tags: ['autodocs']
} satisfies Meta<typeof Title>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  args: {
    title: 'My Workspace'
  }
};

export const WithBreadcrumb: Story = {
  args: {
    breadcrumb: [
      { label: 'Home', onClick: () => alert('Home clicked') },
      { label: 'Projects', onClick: () => alert('Projects clicked') },
      { label: 'Current Project' }
    ],
    title: 'Project Details'
  }
};


export const WithEyebrow: Story = {
  args: {
    eyebrow: 'Architecture',
    title: 'System Overview'
  }
};

export const WithIconAndEyebrow: Story = {
  args: {
    icon: <TypeBadge color="#3b82f6" icon="server" />,
    eyebrow: 'Service',
    title: 'API Gateway'
  }
};

export const WithChips: Story = {
  args: {
    title: 'Production Environment',
    chips: (
      <>
        <Chip dot="#22c55e">Active</Chip>
        <Chip tone="ghost">v2.1.0</Chip>
      </>
    )
  }
};

export const WithDescription: Story = {
  args: {
    title: 'User Management Service',
    description: 'Handles user authentication, authorization, and profile management across all applications.'
  }
};

export const WithButtons: Story = {
  args: {
    title: 'My Dashboard',
    buttons: (
      <>
        <Button>
          <TbDownload size={14} />
          Export
        </Button>
        <Button variant="primary">
          <TbPlus size={14} />
          New Item
        </Button>
      </>
    )
  }
};


export const WithMenu: Story = {
  args: {
    title: 'Settings',
    menu: (
      <Button variant="secondary">
        <TbDots size={16} />
      </Button>
    )
  }
};

export const FullFeatured: Story = {
  args: {
    breadcrumb: [
      { label: 'Workspaces', onClick: () => alert('Workspaces') },
      { label: 'Production', onClick: () => alert('Production') },
      { label: 'Services' }
    ],
    icon: <TypeBadge color="#3b82f6" icon="server" size={32} />,
    eyebrow: 'Microservice',
    title: 'Payment Processing Service',
    titleTestId: 'payment-service-title',
    chips: (
      <>
        <Chip dot="#22c55e">Active</Chip>
        <Chip tone="ghost">v3.2.1</Chip>
        <Chip icon={<TbSettings size={12} />}>Configured</Chip>
      </>
    ),
    description: 'Handles all payment transactions, refunds, and billing operations. Integrates with Stripe, PayPal, and internal accounting systems.',
    buttons: (
      <>
        <Button>
          <TbDownload size={14} />
          Export
        </Button>
        <Button variant="primary">
          <TbSettings size={14} />
          Configure
        </Button>
      </>
    ),
    menu: (
      <Button variant="secondary">
        <TbDots size={16} />
      </Button>
    )
  }
};

export const LongTitle: Story = {
  args: {
    title: 'This is a very long title that might wrap to multiple lines depending on the viewport width and container size'
  }
};

export const LongDescription: Story = {
  args: {
    title: 'Complex System',
    description: 'This is a comprehensive description that provides detailed information about the system architecture, its components, dependencies, and operational characteristics. It may span multiple lines and should be properly formatted for readability.'
  }
};

export const MultipleChips: Story = {
  args: {
    title: 'Feature Flags Service',
    chips: (
      <>
        <Chip dot="#22c55e">Active</Chip>
        <Chip dot="#3b82f6">Monitored</Chip>
        <Chip tone="ghost">v1.5.2</Chip>
        <Chip tone="ghost">High Priority</Chip>
        <Chip>Team A</Chip>
      </>
    )
  }
};

export const WithTestId: Story = {
  args: {
    title: 'Test Component',
    titleTestId: 'test-title-id',
    description: 'This title has a test ID for automated testing'
  }
};

export const MinimalWithActions: Story = {
  args: {
    title: 'Quick Actions',
    buttons: (
      <Button variant="primary">
        Action
      </Button>
    )
  }
};

export const BreadcrumbOnly: Story = {
  args: {
    breadcrumb: [
      { label: 'Level 1', onClick: () => {} },
      { label: 'Level 2', onClick: () => {} },
      { label: 'Level 3', onClick: () => {} },
      { label: 'Current Page' }
    ],
    title: 'Deep Navigation Example'
  }
};


