import { TbChevronDown } from 'react-icons/tb';
import { useDiagram } from '../context/DiagramContext.tsx';
import { ToolWindowPanel } from '../components/ToolWindowPanel.tsx';
import * as Select from '@radix-ui/react-select';
import { useRedraw } from '../../react-canvas-viewer/useRedraw.tsx';
import { useEventListener } from '../hooks/useEventListener.ts';
import { assert } from '../../utils/assert.ts';
import { NumberInput } from '../NumberInput.tsx';
import { round } from '../../utils/math.ts';

const values = {
  independent: 'Independent',
  'parallel-readable': 'Parallel (readable)',
  parallel: 'Parallel',
  'perpendicular-readable': 'Perpendicular (readble)',
  perpendicular: 'Perpendicular',
  horizontal: 'Horizontal',
  vertical: 'Vertical'
};

export const LabelNodePanel = (props: Props) => {
  const redraw = useRedraw();
  const $d = useDiagram();

  useEventListener($d.selectionState, 'change', redraw);

  if ($d.selectionState.getSelectionType() !== 'single-label-node') return null;

  const node = $d.selectionState.nodes[0];
  const edge = $d.edgeLookup[node.props.labelForEgdeId!];
  assert.present(edge);

  const labelNode = edge.labelNodes!.find(n => n.node === node);
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
              onValueChange={v => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                labelNode.type = v as any;
                edge.invalidate();
                $d.updateElement(edge);
              }}
            >
              <Select.Trigger className="cmp-select-trigger" style={{ width: '100%' }}>
                <Select.Value placeholder={values[type]}>{values[type]}</Select.Value>
                <Select.Icon className="cmp-select-trigger__icon">
                  <TbChevronDown />
                </Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content className="cmp-select-content">
                  <Select.Viewport className="cmp-select-content__viewpoint">
                    <Select.Group>
                      <Select.Item className={'cmp-select-content__item'} value={'independent'}>
                        <Select.ItemText>{values['independent']}</Select.ItemText>
                      </Select.Item>
                      <Select.Item
                        className={'cmp-select-content__item'}
                        value={'parallel-readable'}
                      >
                        <Select.ItemText>{values['parallel-readable']}</Select.ItemText>
                      </Select.Item>
                      <Select.Item className={'cmp-select-content__item'} value={'parallel'}>
                        <Select.ItemText>{values['parallel']}</Select.ItemText>
                      </Select.Item>
                      <Select.Item
                        className={'cmp-select-content__item'}
                        value={'perpendicular-readable'}
                      >
                        <Select.ItemText>{values['perpendicular-readable']}</Select.ItemText>
                      </Select.Item>
                      <Select.Item className={'cmp-select-content__item'} value={'perpendicular'}>
                        <Select.ItemText>{values['perpendicular']}</Select.ItemText>
                      </Select.Item>
                      <Select.Item className={'cmp-select-content__item'} value={'horizontal'}>
                        <Select.ItemText>{values['horizontal']}</Select.ItemText>
                      </Select.Item>
                      <Select.Item className={'cmp-select-content__item'} value={'vertical'}>
                        <Select.ItemText>{values['vertical']}</Select.ItemText>
                      </Select.Item>
                    </Select.Group>
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </div>

          <div className={'cmp-labeled-table__label'}>Position:</div>
          <div className={'cmp-labeled-table__value'}>
            <NumberInput
              defaultUnit={'%'}
              value={round(timeOffset * 100)}
              min={0}
              max={100}
              style={{ width: '50px' }}
              onChange={v => {
                labelNode.timeOffset = Number(v) / 100;
                edge.invalidate();
                $d.updateElement(edge);
              }}
            />
          </div>

          <div className={'cmp-labeled-table__label'}>Offset:</div>
          <div className={'cmp-labeled-table__value util-vcenter'}>
            <NumberInput
              defaultUnit={'px'}
              value={round(offset.x)}
              style={{ width: '50px' }}
              onChange={v => {
                labelNode.offset = { x: Number(v), y: offset.y };
                edge.invalidate();
                $d.updateElement(edge);
              }}
            />
            &nbsp;
            {(type === 'independent' || type === 'horizontal' || type === 'vertical') && (
              <NumberInput
                defaultUnit={'px'}
                value={round(offset.y)}
                style={{ width: '50px' }}
                onChange={v => {
                  labelNode.offset = { x: offset.x, y: Number(v) };
                  edge.invalidate();
                  $d.updateElement(edge);
                }}
              />
            )}
          </div>
        </div>
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
