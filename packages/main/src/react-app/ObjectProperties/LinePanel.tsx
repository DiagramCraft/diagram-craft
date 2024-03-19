import { TbLine, TbShape3, TbVectorBezier2, TbVectorSpline } from 'react-icons/tb';
import * as ReactToolbar from '@radix-ui/react-toolbar';
import { ArrowSelector } from './ArrowSelector.tsx';
import { ColorPicker } from '../components/ColorPicker.tsx';
import { DashSelector } from './DashSelector.tsx';
import { useEdgeProperty } from './useProperty.ts';
import { NumberInput } from '../components/NumberInput.tsx';
import { assertEdgeType } from '../../model/diagramProps.ts';
import { useDiagram } from '../context/DiagramContext.tsx';
import { ToolWindowPanel } from '../ToolWindowPanel.tsx';
import { useEdgeDefaults } from '../useDefaults.tsx';
import { Select } from '../components/Select.tsx';
import { useConfiguration } from '../context/ConfigurationContext.tsx';

export const LinePanel = (props: Props) => {
  const $d = useDiagram();
  const $cfg = useConfiguration();

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
          <div className={'cmp-labeled-table__value util-vcenter util-hstack'}>
            <ArrowSelector value={startType.val} onValueChange={startType.set} />
            <NumberInput
              defaultUnit={'%'}
              value={startSize.val}
              min={1}
              style={{ width: '50px' }}
              onChange={startSize.set}
            />
          </div>

          <div className={'cmp-labeled-table__label'}>Line end:</div>
          <div className={'cmp-labeled-table__value util-vcenter util-hstack'}>
            <ArrowSelector value={endType.val} onValueChange={endType.set} />
            <NumberInput
              defaultUnit={'%'}
              value={endSize.val}
              min={1}
              style={{ width: '50px' }}
              onChange={endSize.set}
            />
          </div>

          <div className={'cmp-labeled-table__label'}>Color:</div>
          <div className={'cmp-labeled-table__value util-vcenter util-hstack'}>
            <ColorPicker
              palette={$cfg.palette.primary}
              color={strokeColor.val}
              onChange={strokeColor.set}
              customPalette={$d.document.customPalette.colors}
              onChangeCustomPalette={(idx, v) => $d.document.customPalette.setColor(idx, v)}
            />
            <ColorPicker
              palette={$cfg.palette.primary}
              color={fillColor.val}
              onChange={fillColor.set}
              customPalette={$d.document.customPalette.colors}
              onChangeCustomPalette={(idx, v) => $d.document.customPalette.setColor(idx, v)}
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
          <div className={'cmp-labeled-table__value util-vcenter util-hstack'}>
            <DashSelector value={pattern.val} onValueChange={pattern.set} />
            <NumberInput
              defaultUnit={'%'}
              value={strokSize.val}
              min={1}
              style={{ width: '45px' }}
              onChange={strokSize.set}
            />
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
              <Select
                onValueChange={v => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  lineHopsType.set(v as any);
                }}
                value={lineHopsType.val}
                values={[
                  { label: 'None', value: 'none' },
                  { label: 'Gap when below', value: 'below-hide' },
                  { label: 'Gap with line when below', value: 'below-line' },
                  { label: 'Arc when below', value: 'below-arc' },
                  { label: 'Arc when above', value: 'above-arc' }
                ]}
              />

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
