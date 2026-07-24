import type { Meta, StoryObj } from '@storybook/react-vite';
import { TypeBadge, ICON_MAP } from './TypeBadge';

const meta = {
  title: 'Components/TypeBadge',
  component: TypeBadge,
  parameters: {
    layout: 'centered'
  },
  tags: ['autodocs'],
  argTypes: {
    color: {
      control: 'color'
    },
    size: {
      control: { type: 'range', min: 12, max: 48, step: 2 }
    },
    icon: {
      control: 'select',
      options: [null, ...Object.keys(ICON_MAP)]
    }
  }
} satisfies Meta<typeof TypeBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    color: '#3b82f6',
    name: 'Service',
    icon: 'server'
  }
};

export const Database: Story = {
  args: {
    color: '#8b5cf6',
    name: 'Database',
    icon: 'database'
  }
};

export const API: Story = {
  args: {
    color: '#22c55e',
    name: 'API',
    icon: 'api'
  }
};

export const Cloud: Story = {
  args: {
    color: '#06b6d4',
    name: 'Cloud Service',
    icon: 'cloud'
  }
};

export const Security: Story = {
  args: {
    color: '#ef4444',
    name: 'Security',
    icon: 'shield'
  }
};

export const SmallSize: Story = {
  args: {
    color: '#f59e0b',
    name: 'Small Badge',
    icon: 'box',
    size: 16
  }
};

export const LargeSize: Story = {
  args: {
    color: '#ec4899',
    name: 'Large Badge',
    icon: 'rocket',
    size: 32
  }
};

export const NoIcon: Story = {
  args: {
    color: '#6366f1',
    name: 'No Icon',
    icon: null
  }
};

export const AllIcons = {
  render: () => {
    const colors = [
      '#3b82f6',
      '#8b5cf6',
      '#22c55e',
      '#06b6d4',
      '#ef4444',
      '#f59e0b',
      '#ec4899',
      '#6366f1'
    ];
    const icons = Object.keys(ICON_MAP);

    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          gap: '1rem',
          padding: '1rem'
        }}
      >
        {icons.map((icon, index) => (
          <div
            key={icon}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.25rem'
            }}
          >
            <TypeBadge color={colors[index % colors.length]!} name={icon} icon={icon} />
            <span
              style={{
                fontSize: '10px',
                textAlign: 'center',
                maxWidth: '60px',
                wordBreak: 'break-word'
              }}
            >
              {icon}
            </span>
          </div>
        ))}
      </div>
    );
  }
};

export const ColorVariations = {
  render: () => {
    const colors = [
      { color: '#3b82f6', name: 'Blue' },
      { color: '#8b5cf6', name: 'Purple' },
      { color: '#22c55e', name: 'Green' },
      { color: '#06b6d4', name: 'Cyan' },
      { color: '#ef4444', name: 'Red' },
      { color: '#f59e0b', name: 'Amber' },
      { color: '#ec4899', name: 'Pink' },
      { color: '#6366f1', name: 'Indigo' }
    ];

    return (
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        {colors.map(({ color, name }) => (
          <div
            key={color}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.25rem'
            }}
          >
            <TypeBadge color={color} name={name} icon="box" />
            <span style={{ fontSize: '11px' }}>{name}</span>
          </div>
        ))}
      </div>
    );
  }
};
