import type { Meta, StoryObj } from '@storybook/react-vite';
import { MatrixGrid, matrixCellKey } from './MatrixGrid';

const LEVELS = [1, 2, 3, 4, 5];

const meta = {
  title: 'Components/MatrixGrid',
  component: MatrixGrid,
  parameters: { layout: 'padded' }
} satisfies Meta<typeof MatrixGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RiskMatrix: Story = {
  args: {
    cornerLabel: 'Impact ↑ / Likelihood →',
    columns: LEVELS.map(level => ({ key: level, label: `L${level}` })),
    rows: [...LEVELS].reverse().map(level => ({ key: level, label: `I${level}` })),
    cells: new Map([
      [matrixCellKey(5, 4), [{ id: 'R-1', label: 'R-1', title: 'Data breach' }]],
      [matrixCellKey(2, 2), [{ id: 'R-2', label: 'R-2', title: 'Vendor lock-in' }]]
    ]),
    getCellStyle: (row, column) => {
      const score = Number(row) * Number(column);
      return {
        color: score >= 15 ? '#d33' : score >= 8 ? '#e90' : '#3a5',
        emphasized: score >= 15,
        score
      };
    },
    onOpenItem: () => {},
    legend: [
      { label: 'Low', color: '#3a5' },
      { label: 'Medium', color: '#e90' },
      { label: 'High', color: '#d33' }
    ],
    footNote: 'Outlined cells are outside risk appetite.'
  }
};
