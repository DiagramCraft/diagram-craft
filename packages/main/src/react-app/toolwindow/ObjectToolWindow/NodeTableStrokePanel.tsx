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
import { PropertyEditor } from '../../components/PropertyEditor';
import { Property } from './types';

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
            defaultValue={Object.entries({
              outer: outerBorder.defaultVal,
              horizontal: horizontalBorder.defaultVal,
              vertical: verticalBorder.defaultVal
            })
              .filter(([_, value]) => value)
              .map(([key, _]) => key)}
            isDefaultValue={!outerBorder.isSet && !horizontalBorder.isSet && !verticalBorder.isSet}
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
            defaultValue={strokeColor.defaultVal}
            isDefaultValue={!strokeColor.isSet}
          />
        </div>

        <div className={'cmp-labeled-table__label'}>Style:</div>
        <div className={'cmp-labeled-table__value util-vcenter util-hstack'}>
          <PropertyEditor
            property={strokeWidth}
            render={props => (
              <NumberInput {...props} defaultUnit={'px'} min={1} style={{ width: '35px' }} />
            )}
          />
          <DashSelector property={pattern} />
          <PopoverButton label={<TbAdjustmentsHorizontal />}>
            <div className={'cmp-labeled-table'}>
              <div className={'cmp-labeled-table__label'}>Stroke:</div>
              <div className={'cmp-labeled-table__value util-hstack'}>
                <PropertyEditor
                  property={strokeSize}
                  render={props => (
                    <NumberInput {...props} defaultUnit={'%'} min={1} style={{ width: '45px' }} />
                  )}
                />
                <PropertyEditor
                  property={strokeSpacing}
                  render={props => (
                    <NumberInput {...props} defaultUnit={'%'} min={1} style={{ width: '45px' }} />
                  )}
                />
              </div>

              <div className={'cmp-labeled-table__label'}>Line cap:</div>
              <div className={'cmp-labeled-table__value util-hstack'}>
                <PropertyEditor
                  property={lineCap as Property<string>}
                  render={props => (
                    <Select.Root {...props}>
                      <Select.Item value={'butt'}>Butt</Select.Item>
                      <Select.Item value={'round'}>Round</Select.Item>
                      <Select.Item value={'square'}>Square</Select.Item>
                    </Select.Root>
                  )}
                />
              </div>
              <div className={'cmp-labeled-table__label'}>Line join:</div>
              <div className={'cmp-labeled-table__value util-hstack'}>
                <PropertyEditor
                  property={lineJoin as Property<string>}
                  render={props => (
                    <Select.Root {...props}>
                      <Select.Item value={'miter'}>Miter</Select.Item>
                      <Select.Item value={'round'}>Round</Select.Item>
                      <Select.Item value={'bevel'}>Bevel</Select.Item>
                    </Select.Root>
                  )}
                />

                {lineJoin.val === 'miter' && (
                  <PropertyEditor
                    property={miterLimit}
                    formatValue={v => v * 10}
                    storeValue={v => v / 10}
                    render={props => <NumberInput {...props} min={0} style={{ width: '50px' }} />}
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
