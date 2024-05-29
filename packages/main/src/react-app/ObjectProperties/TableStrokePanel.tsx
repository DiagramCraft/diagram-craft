import { ColorPicker } from '../components/ColorPicker';
import { DashSelector } from './DashSelector';
import { NumberInput } from '../components/NumberInput';
import {
  TbAdjustmentsHorizontal,
  TbBorderHorizontal,
  TbBorderOuter,
  TbBorderVertical
} from 'react-icons/tb';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { useDiagram } from '../context/DiagramContext';
import { useNodeDefaults } from '../useDefaults';
import { PopoverButton } from '../components/PopoverButton';
import { useConfiguration } from '../context/ConfigurationContext';
import { Select } from '../components/Select';
import { useTableProperty } from './useTable';
import * as ReactToolbar from '@radix-ui/react-toolbar';

export const TableStrokePanel = (props: Props) => {
  const $d = useDiagram();
  const $cfg = useConfiguration();
  const defaults = useNodeDefaults();

  const strokeColor = useTableProperty($d, 'stroke.color', defaults.stroke.color);
  const pattern = useTableProperty($d, 'stroke.pattern', defaults.stroke.pattern);

  const strokeSize = useTableProperty($d, 'stroke.patternSize', defaults.stroke.patternSize);
  const strokeSpacing = useTableProperty($d, 'stroke.patternSpacing', defaults.stroke.patternSize);
  const strokeWidth = useTableProperty($d, 'stroke.width', defaults.stroke.width);
  const enabled = useTableProperty($d, 'stroke.enabled', defaults.stroke.enabled);

  const lineCap = useTableProperty($d, 'stroke.lineCap', defaults.stroke.lineCap);
  const lineJoin = useTableProperty($d, 'stroke.lineJoin', defaults.stroke.lineJoin);
  const miterLimit = useTableProperty($d, 'stroke.miterLimit', defaults.stroke.miterLimit);

  const horizontalBorder = useTableProperty(
    $d,
    'table.horizontalBorder',
    defaults.table.horizontalBorder
  );
  const verticalBorder = useTableProperty(
    $d,
    'table.verticalBorder',
    defaults.table.verticalBorder
  );
  const outerBorder = useTableProperty($d, 'table.outerBorder', defaults.table.outerBorder);

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      id="stroke"
      title={'Stroke'}
      hasCheckbox={true}
      value={enabled.val}
      onChange={enabled.set}
    >
      <div className={'cmp-labeled-table'}>
        <div className={'cmp-labeled-table__label'}>Border:</div>
        <div className={'cmp-labeled-table__value util-vcenter util-hstack'}>
          <ReactToolbar.Root className="cmp-toolbar">
            <ReactToolbar.ToggleGroup
              type={'multiple'}
              value={Object.entries({
                outer: outerBorder.val,
                horizontal: horizontalBorder.val,
                vertical: verticalBorder.val
              })
                .filter(([_, value]) => value)
                .map(([key, _]) => key)}
              onValueChange={value => {
                if (!!outerBorder.val !== value.includes('outer'))
                  outerBorder.set(value.includes('outer'));
                if (!!horizontalBorder.val !== value.includes('horizontal'))
                  horizontalBorder.set(value.includes('horizontal'));
                if (!!verticalBorder.val !== value.includes('vertical'))
                  verticalBorder.set(value.includes('vertical'));
              }}
            >
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'outer'}>
                <TbBorderOuter />
              </ReactToolbar.ToggleItem>
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'horizontal'}>
                <TbBorderHorizontal />
              </ReactToolbar.ToggleItem>
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'vertical'}>
                <TbBorderVertical />
              </ReactToolbar.ToggleItem>
            </ReactToolbar.ToggleGroup>
          </ReactToolbar.Root>
        </div>

        <div className={'cmp-labeled-table__label'}>Color:</div>
        <div className={'cmp-labeled-table__value'}>
          <ColorPicker
            palette={$cfg.palette.primary}
            color={strokeColor.val}
            onChange={strokeColor.set}
            hasMultipleValues={strokeColor.hasMultipleValues}
            customPalette={$d.document.customPalette.colors}
            onChangeCustomPalette={(idx, v) => $d.document.customPalette.setColor(idx, v)}
          />
        </div>

        <div className={'cmp-labeled-table__label'}>Style:</div>
        <div className={'cmp-labeled-table__value util-vcenter util-hstack'}>
          <NumberInput
            defaultUnit={'px'}
            value={strokeWidth.val}
            min={1}
            style={{ width: '35px' }}
            onChange={strokeWidth.set}
            hasMultipleValues={strokeWidth.hasMultipleValues}
          />
          <DashSelector
            value={pattern.val}
            onValueChange={value => {
              pattern.set(value);
            }}
            hasMultipleValues={pattern.hasMultipleValues}
          />
          <PopoverButton label={<TbAdjustmentsHorizontal />}>
            <div className={'cmp-labeled-table'}>
              <div className={'cmp-labeled-table__label'}>Stroke:</div>
              <div className={'cmp-labeled-table__value util-hstack'}>
                <NumberInput
                  defaultUnit={'%'}
                  value={strokeSize.val}
                  min={1}
                  style={{ width: '45px' }}
                  onChange={strokeSize.set}
                />
                <NumberInput
                  defaultUnit={'%'}
                  value={strokeSpacing.val}
                  min={1}
                  style={{ width: '45px' }}
                  onChange={strokeSpacing.set}
                />
              </div>

              <div className={'cmp-labeled-table__label'}>Line cap:</div>
              <div className={'cmp-labeled-table__value util-hstack'}>
                <Select
                  onValueChange={v => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    lineCap.set(v as any);
                  }}
                  value={lineCap.val}
                  values={[
                    { label: 'Butt', value: 'butt' },
                    { label: 'Round', value: 'round' },
                    { label: 'Square', value: 'square' }
                  ]}
                />
              </div>
              <div className={'cmp-labeled-table__label'}>Line join:</div>
              <div className={'cmp-labeled-table__value util-hstack'}>
                <Select
                  onValueChange={v => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    lineJoin.set(v as any);
                  }}
                  value={lineJoin.val}
                  values={[
                    { label: 'Miter', value: 'miter' },
                    { label: 'Round', value: 'round' },
                    { label: 'Bevel', value: 'bevel' }
                  ]}
                />

                {lineJoin.val === 'miter' && (
                  <NumberInput
                    value={miterLimit.val * 10}
                    min={0}
                    style={{ width: '50px' }}
                    onChange={v => miterLimit.set((v ?? 1) / 10)}
                  />
                )}
              </div>
            </div>
          </PopoverButton>
        </div>
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
