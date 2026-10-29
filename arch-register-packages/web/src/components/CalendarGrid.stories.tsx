import type { Meta, StoryObj } from '@storybook/react-vite';
import { CalendarGrid } from './CalendarGrid';

const meta = {
  title: 'Components/CalendarGrid',
  component: CalendarGrid,
  parameters: { layout: 'padded' }
} satisfies Meta<typeof CalendarGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SixWeekGrid: Story = {
  args: {
    columns: 6,
    collapseColumns: 3,
    collapseBreakpoint: 1420,
    cells: [
      { key: 'w0', label: 'This week', headerRight: 2, emphasized: true, children: 'Review A' },
      { key: 'w1', label: 'w/c 6 Oct', headerRight: 0, children: 'No reviews due' },
      { key: 'w2', label: 'w/c 13 Oct', headerRight: 1, children: 'Review B' },
      { key: 'w3', label: 'w/c 20 Oct', headerRight: 0, children: 'No reviews due' },
      { key: 'w4', label: 'w/c 27 Oct', headerRight: 0, children: 'No reviews due' },
      { key: 'w5', label: 'w/c 3 Nov', headerRight: 0, children: 'No reviews due' }
    ]
  }
};

export const TwelveMonthGrid: Story = {
  args: {
    columns: 4,
    collapseColumns: 2,
    collapseBreakpoint: 1100,
    cells: Array.from({ length: 12 }, (_, i) => ({
      key: `m${i}`,
      label: `Month ${i + 1}`,
      headerRight: i === 2 ? '$12,000' : '—',
      children: i === 2 ? 'Contract A' : 'No renewals'
    }))
  }
};
