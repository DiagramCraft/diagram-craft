import { useEventListener } from '../../hooks/useEventListener';
import { useRedraw } from '../../hooks/useRedraw';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { useTable } from '../../hooks/useTable';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { useDiagram } from '../../../application';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';

export const NodeTableDimensionsPanel = (props: Props) => {
  const diagram = useDiagram();
  const redraw = useRedraw();

  useEventListener(diagram, 'elementChange', redraw);

  const table = useTable(diagram);

  if (!table) return <div></div>;

  const rows = table.children.length;
  const columns = (table.children as DiagramNode[])[0]?.children?.length ?? 0;

  const updateRows = (r: number) => {
    if (r > rows) {
      UnitOfWork.executeWithUndo(diagram, 'Adding row', uow => {
        for (let n = 0; n < r - rows; n++) {
          const row = (table.children.at(-1) as DiagramNode).duplicate();
          uow.snapshot(row);
          table.addChild(row, uow);
          assertRegularLayer(table.layer);
          table.layer.addElement(row, uow);
        }
      });
    } else if (r < rows) {
      UnitOfWork.executeWithUndo(diagram, 'Delete row', uow => {
        for (let n = 0; n < rows - r; n++) {
          const row = table.children.at(-1) as DiagramNode;
          uow.snapshot(row);
          table.removeChild(row, uow);
          assertRegularLayer(row.layer);
          row.layer.removeElement(row, uow);
        }
      });
    }
  };

  const updateColumns = (c: number) => {
    if (c > columns) {
      UnitOfWork.executeWithUndo(diagram, 'Adding column', uow => {
        for (let n = 0; n < c - columns; n++) {
          for (let i = 0; i < rows; i++) {
            const row = table.children[i] as DiagramNode;
            for (let j = columns; j < c; j++) {
              const child = (row.children.at(-1) as DiagramNode).duplicate();
              uow.snapshot(child);
              row.addChild(child, uow);
              assertRegularLayer(table.layer);
              table.layer.addElement(child, uow);
            }
          }
        }
      });
    } else if (c < columns) {
      UnitOfWork.executeWithUndo(diagram, 'Delete column', uow => {
        for (let n = 0; n < columns - c; n++) {
          for (let i = 0; i < rows; i++) {
            const row = table.children[i] as DiagramNode;
            const child = row.children.at(-1) as DiagramNode;
            uow.snapshot(child);
            row.removeChild(child, uow);
            assertRegularLayer(table.layer);
            table.layer.removeElement(child, uow);
          }
        }
      });
    }
  };

  return (
    <ToolWindowPanel mode={props.mode ?? 'accordion'} title={'Dimensions'} id={'dimensions'}>
      <div className={'cmp-labeled-table'}>
        <div className={'cmp-labeled-table__label'}>Rows:</div>
        <div className={'cmp-labeled-table__value'}>
          <NumberInput
            value={rows}
            min={1}
            max={100}
            step={1}
            style={{ width: '50px' }}
            onChange={ev => updateRows(ev ?? 1)}
          />
        </div>
        <div className={'cmp-labeled-table__label'}>Columns:</div>
        <div className={'cmp-labeled-table__value'}>
          <NumberInput
            value={columns}
            min={1}
            max={100}
            step={1}
            style={{ width: '50px' }}
            onChange={ev => updateColumns(ev ?? 1)}
          />
        </div>
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
