import { TbLetterA, TbLetterR } from 'react-icons/tb';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { assert } from '@diagram-craft/utils/assert';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { hasSameSign, isSame, round } from '@diagram-craft/utils/math';
import { Slider } from '@diagram-craft/app-components/Slider';
import { Select } from '@diagram-craft/app-components/Select';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { useDiagram } from '../../../application';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { LabelNode } from '@diagram-craft/model/labelNode';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { HAlign } from '@diagram-craft/model/diagramProps';
import { Point } from '@diagram-craft/geometry/point';
import styles from './LabelNodePanel.module.css';
import { ToggleButtonGroup } from '@diagram-craft/app-components/ToggleButtonGroup';

const values = {
  'independent': 'Independent',
  'parallel-readable': 'Parallel (readable)',
  'parallel': 'Parallel',
  'perpendicular-readable': 'Perpendicular (readable)',
  'perpendicular': 'Perpendicular',
  'horizontal': 'Horizontal',
  'vertical': 'Vertical'
};

type Position =
  | 'startAbove'
  | 'startOn'
  | 'startBelow'
  | 'centerAbove'
  | 'centerOn'
  | 'centerBelow'
  | 'endAbove'
  | 'endOn'
  | 'endBelow';

const POSITIONS: Record<
  Position,
  {
    timeOffset: number;
    textAlign: HAlign;
    offset: Point;
  }
> = {
  startAbove: { timeOffset: 0, textAlign: 'left', offset: { x: 1, y: -1 } },
  startOn: { timeOffset: 0, textAlign: 'left', offset: { x: 1, y: 0 } },
  startBelow: { timeOffset: 0, textAlign: 'left', offset: { x: 1, y: 1 } },
  centerAbove: { timeOffset: 0.5, textAlign: 'center', offset: { x: 0, y: -1 } },
  centerOn: { timeOffset: 0.5, textAlign: 'center', offset: { x: 0, y: 0 } },
  centerBelow: { timeOffset: 0.5, textAlign: 'center', offset: { x: 0, y: 1 } },
  endAbove: { timeOffset: 1, textAlign: 'right', offset: { x: -1, y: -1 } },
  endOn: { timeOffset: 1, textAlign: 'right', offset: { x: -1, y: 0 } },
  endBelow: { timeOffset: 1, textAlign: 'right', offset: { x: -1, y: 1 } }
};

const isPosition = (position: keyof typeof POSITIONS, node: LabelNode): boolean => {
  const entry = POSITIONS[position];
  return (
    node.offsetType === 'relative' &&
    isSame(entry.timeOffset, node.timeOffset) &&
    hasSameSign(entry.offset.x, node.offset.x) &&
    hasSameSign(entry.offset.y, node.offset.y)
  );
};

const applyPosition = (position: keyof typeof POSITIONS, edge: DiagramEdge, node: DiagramNode) => {
  const entry = POSITIONS[position];
  UnitOfWork.execute(edge.diagram, uow => {
    node.updateLabelNode(
      {
        timeOffset: entry.timeOffset,
        offsetType: 'relative',
        offset: { x: entry.offset.x * 5, y: entry.offset.y * 5 }
      },
      uow
    );
    node.updateProps(props => {
      props.text ??= {};
      props.text.align = entry.textAlign;
    }, uow);
  });
};

export const LabelNodePanel = (props: Props) => {
  const redraw = useRedraw();
  const $d = useDiagram();

  useEventListener($d.selection, 'change', redraw);

  if ($d.selection.type !== 'single-label-node') return null;

  const node = $d.selection.nodes[0]!;
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
            <Select.Root
              value={type}
              onChange={v => {
                UnitOfWork.execute(edge.diagram, uow => {
                  // biome-ignore lint/suspicious/noExplicitAny: false positive
                  node.updateLabelNode({ type: v as any, offset: { x: 0, y: 0 } }, uow);
                });
              }}
            >
              {Object.entries(values).map(([value, label]) => (
                <Select.Item key={value} value={value}>
                  {label}
                </Select.Item>
              ))}
            </Select.Root>
          </div>

          <div className={'cmp-labeled-table__label util-a-top'}>Quick set:</div>
          <div className={'cmp-labeled-table__value'}>
            <svg
              viewBox={'0 0 100 40'}
              width={'100%'}
              height={'40px'}
              style={{
                border: '1px solid var(--cmp-border)',
                borderRadius: '4px',
                textRendering: 'optimizeLegibility',
                vectorEffect: 'non-scaling-stroke'
              }}
              preserveAspectRatio="none"
            >
              <line
                x1={0}
                y1={20}
                x2={100}
                y2={20}
                stroke={'var(--cmp-fg-disabled)'}
                strokeWidth={'1px'}
              />

              <rect
                x={5}
                y={6}
                width={15}
                height={7}
                className={styles.isPositionRect}
                data-selected={isPosition('startAbove', labelNode)}
                onClick={() => applyPosition('startAbove', edge, node)}
              />
              <rect
                x={5}
                y={16}
                width={15}
                height={7}
                className={styles.isPositionRect}
                data-selected={isPosition('startOn', labelNode)}
                onClick={() => applyPosition('startOn', edge, node)}
              />
              <rect
                x={5}
                y={26}
                width={15}
                height={7}
                className={styles.isPositionRect}
                data-selected={isPosition('startBelow', labelNode)}
                onClick={() => applyPosition('startBelow', edge, node)}
              />

              <rect
                x={42}
                y={6}
                width={15}
                height={7}
                className={styles.isPositionRect}
                data-selected={isPosition('centerAbove', labelNode)}
                onClick={() => applyPosition('centerAbove', edge, node)}
              />
              <rect
                x={42}
                y={16}
                width={15}
                height={7}
                className={styles.isPositionRect}
                data-selected={isPosition('centerOn', labelNode)}
                onClick={() => applyPosition('centerOn', edge, node)}
              />
              <rect
                x={42}
                y={26}
                width={15}
                height={7}
                className={styles.isPositionRect}
                data-selected={isPosition('centerBelow', labelNode)}
                onClick={() => applyPosition('centerBelow', edge, node)}
              />

              <rect
                x={80}
                y={6}
                width={15}
                height={7}
                className={styles.isPositionRect}
                data-selected={isPosition('endAbove', labelNode)}
                onClick={() => applyPosition('endAbove', edge, node)}
              />
              <rect
                x={80}
                y={16}
                width={15}
                height={7}
                className={styles.isPositionRect}
                data-selected={isPosition('endOn', labelNode)}
                onClick={() => applyPosition('endOn', edge, node)}
              />
              <rect
                x={80}
                y={26}
                width={15}
                height={7}
                className={styles.isPositionRect}
                data-selected={isPosition('endBelow', labelNode)}
                onClick={() => applyPosition('endBelow', edge, node)}
              />
            </svg>
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

            <ToggleButtonGroup.Root
              value={labelNode.offsetType}
              onChange={v => {
                UnitOfWork.execute(edge.diagram, uow => {
                  node.updateLabelNode({ offsetType: v as 'absolute' | 'relative' }, uow);
                });
              }}
              aria-label="Offset type"
              type={'single'}
            >
              <ToggleButtonGroup.Item value={'absolute'}>
                <TbLetterA />
              </ToggleButtonGroup.Item>
              <ToggleButtonGroup.Item value={'relative'}>
                <TbLetterR />
              </ToggleButtonGroup.Item>
            </ToggleButtonGroup.Root>
          </div>
        </div>
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
