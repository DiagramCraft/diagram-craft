import type { Meta, StoryObj } from '@storybook/react-vite';
import { themeDecorator } from '../.storybook/common';
import { Scrollable } from './Scrollable';

const items = Array.from({ length: 24 }, (_, index) => ({
  id: index + 1,
  title: `Scrollable item ${index + 1}`,
  body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'
}));

const meta = {
  title: 'Components/Scrollable',
  component: Scrollable,
  parameters: {
    layout: 'padded'
  },
  decorators: [themeDecorator()],
  args: {
    maxHeight: 240
  },
  argTypes: {
    maxHeight: {
      control: {
        type: 'number',
        min: 120,
        max: 480,
        step: 20
      }
    }
  }
} satisfies Meta<typeof Scrollable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  render: args => (
    <div style={{ width: '20rem' }}>
      <Scrollable
        {...args}
        style={{
          border: '1px solid var(--cmp-border)',
          background: 'var(--panel-bg)'
        }}
      >
        {items.map(item => (
          <div
            key={item.id}
            style={{
              paddingBottom: '0.75rem',
              borderBottom: '1px solid var(--cmp-border)'
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{item.title}</div>
            <div>{item.body}</div>
          </div>
        ))}
      </Scrollable>
    </div>
  )
};

export const WithoutOverflow: Story = {
  args: {
    maxHeight: 320
  },
  render: args => (
    <div style={{ width: '20rem' }}>
      <Scrollable
        {...args}
        style={{
          border: '1px solid var(--cmp-border)',
          background: 'var(--panel-bg)'
        }}
      >
        {items.slice(0, 4).map(item => (
          <div
            key={item.id}
            style={{
              paddingBottom: '0.75rem',
              borderBottom: '1px solid var(--cmp-border)'
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{item.title}</div>
            <div>{item.body}</div>
          </div>
        ))}
      </Scrollable>
    </div>
  )
};
