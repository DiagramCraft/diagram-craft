import { ColorPicker } from '../../components/ColorPicker';
import { useNodeProperty } from '../../hooks/useProperty';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { TbAdjustmentsHorizontal } from 'react-icons/tb';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { useDiagram } from '../../context/DiagramContext';
import { PopoverButton } from '../../components/PopoverButton';
import { ConfigurationContextType, useConfiguration } from '../../context/ConfigurationContext';
import { Select } from '@diagram-craft/app-components/Select';
import { DashSelector } from './components/DashSelector';
import { Diagram } from '@diagram-craft/model/diagram';
import { Property } from './types';
import { LineCap, LineJoin } from '@diagram-craft/model/diagramProps';

type FormProps = {
  diagram: Diagram;
  config: ConfigurationContextType;
  strokeColor: Property<string | undefined>;
  strokeWidth: Property<number | undefined>;
  pattern: Property<string | undefined>;
  strokeSize: Property<number | undefined>;
  strokeSpacing: Property<number | undefined>;
  lineCap: Property<LineCap | undefined>;
  lineJoin: Property<LineJoin | undefined>;
  miterLimit: Property<number | undefined>;
};

export const NodeStrokePanelForm = ({
  config: $cfg,
  diagram: $d,
  strokeColor,
  strokeWidth,
  pattern,
  strokeSize,
  strokeSpacing,
  lineCap,
  lineJoin,
  miterLimit
}: FormProps) => {
  return (
    <div className={'cmp-labeled-table'}>
      <div className={'cmp-labeled-table__label'}>Color:</div>
      <div className={'cmp-labeled-table__value'}>
        <ColorPicker
          palette={$cfg.palette.primary}
          color={strokeColor.val}
          onChange={strokeColor.set}
          hasMultipleValues={strokeColor.hasMultipleValues}
          customPalette={$d.document.customPalette.colors}
          onChangeCustomPalette={(idx, v) => $d.document.customPalette.setColor(idx, v)}
          isDefaultValue={!strokeColor.isSet}
          defaultValue={strokeColor.defaultVal}
        />
      </div>

      <div className={'cmp-labeled-table__label'}>Style:</div>
      <div className={'cmp-labeled-table__value util-vcenter util-hstack'}>
        <NumberInput
          defaultUnit={'px'}
          defaultValue={strokeWidth.defaultVal}
          isDefaultValue={!strokeWidth.isSet}
          value={strokeWidth.val}
          min={1}
          style={{ width: '35px' }}
          onChange={n => strokeWidth.set(n!)}
          hasMultipleValues={strokeWidth.hasMultipleValues}
        />
        <DashSelector
          value={pattern.val}
          onValueChange={value => {
            pattern.set(value!);
          }}
          hasMultipleValues={pattern.hasMultipleValues}
          defaultValue={pattern.defaultVal}
          isDefaultValue={!pattern.isSet}
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
                onChange={n => strokeSize.set(n!)}
                isDefaultValue={!strokeSize.isSet}
                defaultValue={strokeSize.defaultVal}
              />
              <NumberInput
                defaultUnit={'%'}
                value={strokeSpacing.val}
                min={1}
                style={{ width: '45px' }}
                onChange={n => strokeSpacing.set(n!)}
                isDefaultValue={!strokeSpacing.isSet}
                defaultValue={strokeSpacing.defaultVal}
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
                isDefaultValue={!lineCap.isSet}
                defaultValue={lineCap.defaultVal}
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
                isDefaultValue={!lineJoin.isSet}
                defaultValue={lineJoin.defaultVal}
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
                  onChange={v => miterLimit.set(v === undefined ? undefined : (v ?? 1) / 10)}
                  isDefaultValue={!miterLimit.isSet}
                  defaultValue={miterLimit.defaultVal * 10}
                />
              )}
            </div>
          </div>
        </PopoverButton>
      </div>
    </div>
  );
};

export const NodeStrokePanel = (props: Props) => {
  const $d = useDiagram();
  const $cfg = useConfiguration();

  const strokeColor = useNodeProperty($d, 'stroke.color');
  const pattern = useNodeProperty($d, 'stroke.pattern');

  const strokeSize = useNodeProperty($d, 'stroke.patternSize');
  const strokeSpacing = useNodeProperty($d, 'stroke.patternSpacing');
  const strokeWidth = useNodeProperty($d, 'stroke.width');
  const enabled = useNodeProperty($d, 'stroke.enabled');

  const lineCap = useNodeProperty($d, 'stroke.lineCap');
  const lineJoin = useNodeProperty($d, 'stroke.lineJoin');
  const miterLimit = useNodeProperty($d, 'stroke.miterLimit');

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      id="stroke"
      title={'Stroke'}
      hasCheckbox={true}
      value={enabled.val}
      onChange={enabled.set}
    >
      <NodeStrokePanelForm
        diagram={$d}
        config={$cfg}
        strokeWidth={strokeWidth}
        /* @ts-ignore */
        pattern={pattern}
        strokeSize={strokeSize}
        strokeColor={strokeColor}
        strokeSpacing={strokeSpacing}
        lineCap={lineCap}
        lineJoin={lineJoin}
        miterLimit={miterLimit}
      />
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
