import { TbChevronDown, TbLine, TbShape3, TbVectorBezier2, TbVectorSpline } from 'react-icons/tb';
import * as ReactToolbar from '@radix-ui/react-toolbar';
import { ArrowSelector } from './ArrowSelector.tsx';
import { ColorPicker } from '../ColorPicker.tsx';
import { additionalHues, primaryColors } from './palette.ts';
import { DashSelector } from './DashSelector.tsx';
import { useEdgeProperty } from './useProperty.ts';
import { NumberInput } from '../NumberInput.tsx';
import { assertEdgeType } from '../../model/diagramProps.ts';
import { useDiagram } from '../context/DiagramContext.tsx';
import { ToolWindowPanel } from '../components/ToolWindowPanel.tsx';
import { useEdgeDefaults } from '../useDefaults.tsx';
import * as Select from '@radix-ui/react-select';

export const LinePanel = (props: Props) => {
  const $d = useDiagram();

  const defaults = useEdgeDefaults();

  const strokeColor = useEdgeProperty($d, 'stroke.color', defaults.stroke.color);
  const fillColor = useEdgeProperty($d, 'fill.color', defaults.fill.color);
  const pattern = useEdgeProperty($d, 'stroke.pattern', defaults.stroke.pattern);

  const strokSize = useEdgeProperty($d, 'stroke.patternSize', defaults.stroke.patternSize);
  const strokeSpacing = useEdgeProperty($d, 'stroke.patternSpacing', defaults.stroke.patternSize);
  const strokeWidth = useEdgeProperty($d, 'stroke.width', defaults.stroke.width);

  const type = useEdgeProperty($d, 'type', 'straight');

  const startType = useEdgeProperty($d, 'arrow.start.type', defaults.arrow.start.type);
  const startSize = useEdgeProperty($d, 'arrow.start.size', defaults.arrow.start.size);
  const endType = useEdgeProperty($d, 'arrow.end.type', defaults.arrow.end.type);
  const endSize = useEdgeProperty($d, 'arrow.end.size', defaults.arrow.end.size);

  const rounding = useEdgeProperty($d, 'routing.rounding', defaults.routing.rounding);

  const lineHopsSize = useEdgeProperty($d, 'lineHops.size', defaults.lineHops.size);
  const lineHopsType = useEdgeProperty($d, 'lineHops.type', defaults.lineHops.type);

  return (
    <ToolWindowPanel mode={props.mode ?? 'accordion'} id="line" title={'Line'} hasCheckbox={false}>
      <div>
        <div className={'cmp-labeled-table'}>
          <div className={'cmp-labeled-table__label'}>Type:</div>
          <div className={'cmp-labeled-table__value'}>
            <ReactToolbar.Root className="cmp-toolbar" aria-label="Formatting options">
              <ReactToolbar.ToggleGroup
                type={'single'}
                value={type.val}
                onValueChange={value => {
                  assertEdgeType(value);
                  type.set(value);
                }}
              >
                <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'straight'}>
                  <TbLine />
                </ReactToolbar.ToggleItem>
                <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'orthogonal'}>
                  <TbShape3 />
                </ReactToolbar.ToggleItem>
                <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'curved'}>
                  <TbVectorSpline />
                </ReactToolbar.ToggleItem>
                <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'bezier'}>
                  <TbVectorBezier2 />
                </ReactToolbar.ToggleItem>
              </ReactToolbar.ToggleGroup>
            </ReactToolbar.Root>
          </div>

          <div className={'cmp-labeled-table__label'}>Line start:</div>
          <div className={'cmp-labeled-table__value util-vcenter'}>
            <ArrowSelector value={startType.val} onValueChange={startType.set} />
            &nbsp;
            <NumberInput
              defaultUnit={'%'}
              value={startSize.val}
              min={1}
              style={{ width: '50px' }}
              onChange={startSize.set}
            />
          </div>

          <div className={'cmp-labeled-table__label'}>Line end:</div>
          <div className={'cmp-labeled-table__value util-vcenter'}>
            <ArrowSelector value={endType.val} onValueChange={endType.set} />
            &nbsp;
            <NumberInput
              defaultUnit={'%'}
              value={endSize.val}
              min={1}
              style={{ width: '50px' }}
              onChange={endSize.set}
            />
          </div>

          <div className={'cmp-labeled-table__label'}>Color:</div>
          <div className={'cmp-labeled-table__value util-vcenter'}>
            <ColorPicker
              primaryColors={primaryColors}
              additionalHues={additionalHues}
              color={strokeColor.val}
              onClick={strokeColor.set}
            />
            &nbsp;
            <ColorPicker
              primaryColors={primaryColors}
              additionalHues={additionalHues}
              color={fillColor.val}
              onClick={fillColor.set}
            />
          </div>

          <div className={'cmp-labeled-table__label'}>Width:</div>
          <div className={'cmp-labeled-table__value'}>
            <NumberInput
              defaultUnit={'px'}
              value={strokeWidth.val}
              min={1}
              style={{ width: '45px' }}
              onChange={strokeWidth.set}
            />
          </div>

          <div className={'cmp-labeled-table__label'}>Dash:</div>
          <div className={'cmp-labeled-table__value util-vcenter'}>
            <DashSelector value={pattern.val} onValueChange={pattern.set} />
            &nbsp;
            <NumberInput
              defaultUnit={'%'}
              value={strokSize.val}
              min={1}
              style={{ width: '45px' }}
              onChange={strokSize.set}
            />
            &nbsp;
            <NumberInput
              defaultUnit={'%'}
              value={strokeSpacing.val}
              min={1}
              style={{ width: '45px' }}
              onChange={strokeSpacing.set}
            />
          </div>

          <div className={'cmp-labeled-table__label'}>Rounding:</div>
          <div className={'cmp-labeled-table__value'}>
            <NumberInput
              defaultUnit={'px'}
              value={rounding.val}
              min={0}
              style={{ width: '50px' }}
              onChange={rounding.set}
            />
          </div>

          <div className={'cmp-labeled-table__label util-a-top-center'}>Line hops:</div>
          <div className={'cmp-labeled-table__value util-vcenter'}>
            <div className={'util-vstack'} style={{ width: '100%' }}>
              <Select.Root
                onValueChange={v => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  lineHopsType.set(v as any);
                }}
                value={lineHopsType.val}
              >
                <Select.Trigger className="cmp-select-trigger" style={{ width: '100%' }}>
                  <Select.Value placeholder={'Select'} />
                  <Select.Icon className="cmp-select-trigger__icon">
                    <TbChevronDown />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="cmp-select-content">
                    <Select.Viewport className="cmp-select-content__viewpoint">
                      <Select.Group>
                        <Select.Item className={'cmp-select-content__item'} value={'none'}>
                          <Select.ItemText>None</Select.ItemText>
                        </Select.Item>
                        <Select.Item className={'cmp-select-content__item'} value={'below-hide'}>
                          <Select.ItemText>Gap when below</Select.ItemText>
                        </Select.Item>
                        <Select.Item className={'cmp-select-content__item'} value={'below-line'}>
                          <Select.ItemText>Gap with line when below</Select.ItemText>
                        </Select.Item>
                        <Select.Item className={'cmp-select-content__item'} value={'below-arc'}>
                          <Select.ItemText>Arc when below</Select.ItemText>
                        </Select.Item>
                        <Select.Item className={'cmp-select-content__item'} value={'above-arc'}>
                          <Select.ItemText>Arc when above</Select.ItemText>
                        </Select.Item>
                      </Select.Group>
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
              <NumberInput
                defaultUnit={'px'}
                value={lineHopsSize.val}
                min={0}
                style={{ width: '50px' }}
                onChange={lineHopsSize.set}
              />
            </div>
          </div>
        </div>
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
