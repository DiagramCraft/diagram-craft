import { ColorPicker } from '../../components/ColorPicker';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import {
  TbAdjustmentsHorizontal,
  TbBorderHorizontal,
  TbBorderOuter,
  TbBorderVertical
} from 'react-icons/tb';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { useDiagram } from '../../context/DiagramContext';
import { PopoverButton } from '../../components/PopoverButton';
import { useConfiguration } from '../../context/ConfigurationContext';
import { Select } from '@diagram-craft/app-components/Select';
import { useTableProperty } from '../../hooks/useTable';
import { DashSelector } from './components/DashSelector';
import { ToggleButtonGroup } from '@diagram-craft/app-components/ToggleButtonGroup';

export const NodeTableStrokePanel = (props: Props) => {
  const $d = useDiagram();
  const $cfg = useConfiguration();

  const strokeColor = useTableProperty($d, 'stroke.color');
  const pattern = useTableProperty($d, 'stroke.pattern');

  const strokeSize = useTableProperty($d, 'stroke.patternSize');
  const strokeSpacing = useTableProperty($d, 'stroke.patternSpacing');
  const strokeWidth = useTableProperty($d, 'stroke.width');
  const enabled = useTableProperty($d, 'stroke.enabled');

  const lineCap = useTableProperty($d, 'stroke.lineCap');
  const lineJoin = useTableProperty($d, 'stroke.lineJoin');
  const miterLimit = useTableProperty($d, 'stroke.miterLimit');

  const horizontalBorder = useTableProperty($d, 'custom.table.horizontalBorder');
  const verticalBorder = useTableProperty($d, 'custom.table.verticalBorder');

  const outerBorder = useTableProperty($d, 'custom.table.outerBorder');

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
          <ToggleButtonGroup.Root
            type={'multiple'}
            value={Object.entries({
              outer: outerBorder.val,
              horizontal: horizontalBorder.val,
              vertical: verticalBorder.val
            })
              .filter(([_, value]) => value)
              .map(([key, _]) => key)}
            onValueChange={value => {
              if (!!outerBorder.val !== value?.includes('outer'))
                outerBorder.set(value?.includes('outer'));
              if (!!horizontalBorder.val !== value?.includes('horizontal'))
                horizontalBorder.set(value?.includes('horizontal'));
              if (!!verticalBorder.val !== value?.includes('vertical'))
                verticalBorder.set(value?.includes('vertical'));
            }}
          >
            <ToggleButtonGroup.Item value={'outer'}>
              <TbBorderOuter />
            </ToggleButtonGroup.Item>
            <ToggleButtonGroup.Item value={'horizontal'}>
              <TbBorderHorizontal />
            </ToggleButtonGroup.Item>
            <ToggleButtonGroup.Item value={'vertical'}>
              <TbBorderVertical />
            </ToggleButtonGroup.Item>
          </ToggleButtonGroup.Root>
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
            isDefaultValue={!pattern.isSet}
            defaultValue={pattern.defaultVal}
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
                <Select.Root
                  onValueChange={v => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    lineCap.set(v as any);
                  }}
                  value={lineCap.val}
                >
                  <Select.Item value={'butt'}>Butt</Select.Item>
                  <Select.Item value={'round'}>Round</Select.Item>
                  <Select.Item value={'square'}>Square</Select.Item>
                </Select.Root>
              </div>
              <div className={'cmp-labeled-table__label'}>Line join:</div>
              <div className={'cmp-labeled-table__value util-hstack'}>
                <Select.Root
                  onValueChange={v => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    lineJoin.set(v as any);
                  }}
                  value={lineJoin.val}
                >
                  <Select.Item value={'miter'}>Miter</Select.Item>
                  <Select.Item value={'round'}>Round</Select.Item>
                  <Select.Item value={'bevel'}>Bevel</Select.Item>
                </Select.Root>

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
