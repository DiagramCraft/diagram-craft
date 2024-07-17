import { TbRestore } from 'react-icons/tb';
import { useDiagram } from '../../context/DiagramContext';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { assert } from '@diagram-craft/utils/assert';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { round } from '@diagram-craft/utils/math';
import { Slider } from '@diagram-craft/app-components/Slider';
import { Select } from '../../components/Select';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

const values = {
  'independent': 'Independent',
  'parallel-readable': 'Parallel (readable)',
  'parallel': 'Parallel',
  'perpendicular-readable': 'Perpendicular (readble)',
  'perpendicular': 'Perpendicular',
  'horizontal': 'Horizontal',
  'vertical': 'Vertical'
};

export const LabelNodePanel = (props: Props) => {
  const redraw = useRedraw();
  const $d = useDiagram();

  useEventListener($d.selectionState, 'change', redraw);

  if ($d.selectionState.getSelectionType() !== 'single-label-node') return null;

  const node = $d.selectionState.nodes[0];
  const edge = node.labelEdge();
  assert.present(edge);

  const labelNode = node.labelNode();
  assert.present(labelNode);

  const type = labelNode.type;
  const timeOffset = labelNode.timeOffset;
  const offset = labelNode.offset;

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      id="label-node"
      title={'Label'}
      hasCheckbox={false}
    >
      <div>
        <div className={'cmp-labeled-table'}>
          <div className={'cmp-labeled-table__label'}>Type:</div>
          <div className={'cmp-labeled-table__value'}>
            <Select
              value={type}
              onValueChange={v => {
                UnitOfWork.execute(edge.diagram, uow => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  node.updateLabelNode({ type: v as any }, uow);
                });
              }}
              values={Object.entries(values).map(([k, v]) => ({ label: v, value: k }))}
            />
          </div>

          <div className={'cmp-labeled-table__label'}>Position:</div>
          <div className={'cmp-labeled-table__value'}>
            <Slider
              value={round(timeOffset * 100)}
              onChange={v => {
                UnitOfWork.execute(edge.diagram, uow => {
                  node.updateLabelNode({ timeOffset: Number(v) / 100 }, uow);
                });
              }}
            />
          </div>

          <div className={'cmp-labeled-table__label'}>Offset:</div>
          <div className={'cmp-labeled-table__value util-vcenter util-hstack'}>
            <NumberInput
              defaultUnit={'px'}
              value={round(offset.x)}
              style={{ width: '50px' }}
              onChange={v => {
                UnitOfWork.execute(edge.diagram, uow => {
                  node.updateLabelNode({ offset: { x: Number(v), y: offset.y } }, uow);
                });
              }}
            />
            {(type === 'independent' || type === 'horizontal' || type === 'vertical') && (
              <NumberInput
                defaultUnit={'px'}
                value={round(offset.y)}
                style={{ width: '50px' }}
                onChange={v => {
                  UnitOfWork.execute(edge.diagram, uow => {
                    node.updateLabelNode({ offset: { x: offset.x, y: Number(v) } }, uow);
                  });
                }}
              />
            )}
            <button
              className={'cmp-button util-square'}
              onClick={() => {
                UnitOfWork.execute(edge.diagram, uow => {
                  node.updateLabelNode({ offset: { x: 0, y: 0 } }, uow);
                });
              }}
            >
              <TbRestore />
            </button>
          </div>
        </div>
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
