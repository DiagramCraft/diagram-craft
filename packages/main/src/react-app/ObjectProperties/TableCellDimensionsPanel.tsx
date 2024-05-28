import { useEventListener } from '../hooks/useEventListener';
import { useRedraw } from '../useRedraw';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { useDiagram } from '../context/DiagramContext';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { NumberInput } from '../components/NumberInput';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { isEdge } from '@diagram-craft/model/diagramElement';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import { useTable } from './useTable';

export const TableCellDimensionsPanel = (props: Props) => {
  const diagram = useDiagram();
  const redraw = useRedraw();

  useEventListener(diagram, 'elementChange', redraw);

  const elements = diagram.selectionState.elements;
  const table = useTable(diagram);

  if (!table || elements.length !== 1 || isEdge(elements[0])) return <div></div>;

  const node = elements[0] as DiagramNode;

  const height = node.bounds.h;
  const width = node.bounds.w;

  const updateHeight = (h: number) => {
    const row = (table.children as DiagramNode[]).find(e => e.children.includes(node));

    const uow = new UnitOfWork(diagram, true);
    for (const child of row!.children) {
      const t = TransformFactory.fromTo(child.bounds, { ...child.bounds, h });
      child.transform(t, uow);
    }

    commitWithUndo(uow, 'Row height');
  };

  const updateWidth = (w: number) => {
    const row = (table.children as DiagramNode[]).find(e => e.children.includes(node));
    const colIdx = row!.children.findIndex(e => e === node);

    const uow = new UnitOfWork(diagram, true);
    for (const r of table.children) {
      const cell = (r as DiagramNode).children![colIdx];
      const t = TransformFactory.fromTo(cell.bounds, { ...cell.bounds, w });
      cell.transform(t, uow);
    }
    commitWithUndo(uow, 'Row height');
  };

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      title={'Row/Column Dimensions'}
      id={'dimensions'}
    >
      <div className={'cmp-labeled-table'}>
        <div className={'cmp-labeled-table__label'}>Height:</div>
        <div className={'cmp-labeled-table__value'}>
          <NumberInput
            defaultUnit={'px'}
            value={Math.round(height)}
            min={1}
            max={1000}
            step={1}
            style={{ width: '50px' }}
            onChange={ev => updateHeight(ev ?? 1)}
          />
        </div>
        <div className={'cmp-labeled-table__label'}>Width:</div>
        <div className={'cmp-labeled-table__value'}>
          <NumberInput
            defaultUnit={'px'}
            value={Math.round(width)}
            min={1}
            max={1000}
            step={1}
            style={{ width: '50px' }}
            onChange={ev => updateWidth(ev ?? 1)}
          />
        </div>
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
