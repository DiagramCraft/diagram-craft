import { useEventListener } from '../../hooks/useEventListener';
import { useRedraw } from '../../hooks/useRedraw';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { isEdge } from '@diagram-craft/model/diagramElement';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import { useTable } from '../../hooks/useTable';
import { useDiagram } from '../../../application';
import { KeyValueTable } from '@diagram-craft/app-components/KeyValueTable';
import { TableHelper } from '@diagram-craft/canvas/node-types/table/tableUtils';

export const NodeTableCellDimensionsPanel = (props: Props) => {
  const diagram = useDiagram();
  const redraw = useRedraw();

  useEventListener(diagram, 'elementChange', redraw);

  const elements = diagram.selection.elements;
  const table = useTable(diagram);

  if (!table || elements.length !== 1 || isEdge(elements[0])) return <div></div>;

  const helper = new TableHelper(elements[0]!);
  const node = helper.getCurrentCell();
  if (!node) return <div></div>;

  const height = node.bounds.h;
  const width = node.bounds.w;

  const updateHeight = (h: number) => {
    const row = helper.getCurrentRow();
    if (!row) return;

    diagram.undoManager.execute('Row height', uow => {
      for (const child of row.children) {
        const t = TransformFactory.fromTo(child.bounds, { ...child.bounds, h });
        child.transform(t, uow);
      }
    });
  };

  const updateWidth = (w: number) => {
    const colIdx = helper.getCellColumnIndex();
    if (colIdx === undefined) return;

    diagram.undoManager.execute('Row height', uow => {
      for (const r of table.children) {
        const cell = (r as DiagramNode).children[colIdx]!;
        const t = TransformFactory.fromTo(cell.bounds, { ...cell.bounds, w });
        cell.transform(t, uow);
      }
    });
  };

  return (
    <ToolWindowPanel mode={props.mode ?? 'accordion'} title={'Cell Dimensions'} id={'dimensions'}>
      <KeyValueTable.Root>
        <KeyValueTable.Label>Height:</KeyValueTable.Label>
        <KeyValueTable.Value>
          <NumberInput
            defaultUnit={'px'}
            value={Math.round(height)}
            min={1}
            max={1000}
            step={1}
            style={{ width: '50px' }}
            onChange={ev => updateHeight(ev ?? 1)}
          />
        </KeyValueTable.Value>

        <KeyValueTable.Label>Width:</KeyValueTable.Label>
        <KeyValueTable.Value>
          <NumberInput
            defaultUnit={'px'}
            value={Math.round(width)}
            min={1}
            max={1000}
            step={1}
            style={{ width: '50px' }}
            onChange={ev => updateWidth(ev ?? 1)}
          />
        </KeyValueTable.Value>
      </KeyValueTable.Root>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
