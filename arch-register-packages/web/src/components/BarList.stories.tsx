import type { Meta, StoryObj } from '@storybook/react-vite';
import { BarList } from './BarList';

const ratioColor = (effective: number, total: number): string => {
  if (total === 0) return 'var(--base-fg-more-dim)';
  const ratio = effective / total;
  return ratio < 0.5 ? '#e05252' : ratio < 1 ? '#e0a020' : '#3a5';
};

const meta = {
  title: 'Components/BarList',
  component: BarList,
  parameters: { layout: 'padded' }
} satisfies Meta<typeof BarList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RatioBanded: Story = {
  args: {
    rows: [
      { id: 'preventive', label: 'Preventive', effective: 8, total: 10 },
      { id: 'detective', label: 'Detective', effective: 3, total: 9 },
      { id: 'corrective', label: 'Corrective', effective: 0, total: 0 }
    ],
    getColor: row => ratioColor(row.effective, row.total)
  }
};

export const FixedColorWithClickThrough: Story = {
  args: {
    rows: [
      {
        id: 'r-1',
        label: 'Vendor lock-in',
        sublabel: 'RC-1 · residual 12 · Contract review',
        effective: 82,
        total: 100,
        valueLabel: '82%'
      },
      {
        id: 'r-2',
        label: 'Data breach',
        sublabel: 'RC-2 · residual 20 · no control',
        effective: 0,
        total: 100,
        valueLabel: '—'
      }
    ],
    getColor: () => '#3b82f6',
    onOpenItem: () => {}
  }
};

export const Empty: Story = {
  args: {
    rows: [],
    getColor: () => '#3a5',
    emptyMessage: 'No controls bound.'
  }
};
