import type { Meta, StoryObj } from '@storybook/react-vite';
import { MatrixTable } from './MatrixTable';

const CONTROLS = [
  { id: 'c1', label: 'C-1 Access review' },
  { id: 'c2', label: 'C-2 Encryption at rest' },
  { id: 'c3', label: 'C-3 Change management' }
];

const RISKS = [
  { id: 'r1', label: 'R-1 Data breach', title: 'R-1 Data breach' },
  { id: 'r2', label: 'R-2 Vendor lock-in', title: 'R-2 Vendor lock-in' },
  { id: 'r3', label: 'R-3 Outage', title: 'R-3 Outage' }
];

const LINKS = new Set(['c1:r1', 'c1:r2', 'c2:r1', 'c3:r3']);

const meta = {
  title: 'Components/MatrixTable',
  component: MatrixTable,
  parameters: { layout: 'padded' }
} satisfies Meta<typeof MatrixTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TraceMatrix: Story = {
  args: {
    cornerLabel: `${CONTROLS.length} controls × ${RISKS.length} risks`,
    rows: CONTROLS,
    columns: RISKS,
    renderCell: (rowId, columnId) => {
      if (!LINKS.has(`${rowId}:${columnId}`)) return null;
      return <span style={{ width: 11, height: 11, borderRadius: 3, background: '#3a5' }} />;
    },
    getCellTitle: (rowId, columnId) =>
      LINKS.has(`${rowId}:${columnId}`) ? `${rowId} → ${columnId}` : undefined,
    rowTotal: {
      label: 'total',
      getValue: rowId => RISKS.filter(risk => LINKS.has(`${rowId}:${risk.id}`)).length
    },
    columnTotal: {
      label: 'controls per risk',
      getValue: columnId =>
        CONTROLS.filter(control => LINKS.has(`${control.id}:${columnId}`)).length
    },
    onOpenRow: () => {},
    onOpenColumn: () => {},
    emptyMessage: 'No controls match these filters.'
  }
};
