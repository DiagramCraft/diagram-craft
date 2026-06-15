import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemberAvatar } from './MemberAvatar';

const meta = {
  title: 'Components/MemberAvatar',
  component: MemberAvatar,
  parameters: {
    layout: 'centered'
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'range', min: 16, max: 64, step: 4 }
    },
    color: {
      control: 'color'
    }
  }
} satisfies Meta<typeof MemberAvatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    name: 'John Doe',
    email: 'john.doe@example.com',
    userId: 'user-123'
  }
};

export const WithCustomColor: Story = {
  args: {
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    userId: 'user-456',
    color: '#ec4899'
  }
};

export const EmailOnly: Story = {
  args: {
    name: null,
    email: 'admin@example.com',
    userId: 'user-789'
  }
};

export const NoEmail: Story = {
  args: {
    name: 'Bob Johnson',
    email: null,
    userId: 'user-321'
  }
};

export const SmallSize: Story = {
  args: {
    name: 'Alice Brown',
    email: 'alice@example.com',
    userId: 'user-111',
    size: 20
  }
};

export const LargeSize: Story = {
  args: {
    name: 'Charlie Wilson',
    email: 'charlie@example.com',
    userId: 'user-222',
    size: 48
  }
};

export const SingleLetter: Story = {
  args: {
    name: 'X',
    email: null,
    userId: 'user-999'
  }
};

export const MultipleAvatars = {
  render: () => {
    const users = [
      { name: 'Alice Anderson', email: 'alice@example.com', userId: 'user-1' },
      { name: 'Bob Brown', email: 'bob@example.com', userId: 'user-2' },
      { name: 'Charlie Chen', email: 'charlie@example.com', userId: 'user-3' },
      { name: 'Diana Davis', email: 'diana@example.com', userId: 'user-4' },
      { name: 'Eve Evans', email: 'eve@example.com', userId: 'user-5' }
    ];
    
    return (
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        {users.map(user => (
          <MemberAvatar key={user.userId} {...user} />
        ))}
      </div>
    );
  }
};

export const DifferentSizes = {
  render: () => {
    const sizes = [16, 20, 24, 28, 32, 40, 48];
    
    return (
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        {sizes.map(size => (
          <MemberAvatar
            key={size}
            name="John Doe"
            email="john@example.com"
            userId="user-size-demo"
            size={size}
          />
        ))}
      </div>
    );
  }
};

export const CustomColors = {
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
    
    return (
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {colors.map((color, index) => (
          <MemberAvatar
            key={color}
            name={`User ${index + 1}`}
            email={`user${index + 1}@example.com`}
            userId={`user-color-${index}`}
            color={color}
          />
        ))}
      </div>
    );
  }
};

export const StableColors = {
  render: () => {
    const userIds = ['user-a', 'user-b', 'user-c', 'user-d', 'user-e', 'user-f'];
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ fontSize: '12px', marginBottom: '0.5rem' }}>
          Same user IDs generate consistent colors:
        </div>
        {[1, 2].map(row => (
          <div key={row} style={{ display: 'flex', gap: '0.5rem' }}>
            {userIds.map(userId => (
              <MemberAvatar
                key={`${userId}-${row}`}
                name={`User ${userId}`}
                email={`${userId}@example.com`}
                userId={userId}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }
};
