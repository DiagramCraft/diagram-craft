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
import { PropertyEditor } from '../../components/PropertyEditor';

type FormProps = {
  diagram: Diagram;
  config: ConfigurationContextType;
  strokeColor: Property<string>;
  strokeWidth: Property<number>;
  pattern: Property<string>;
  strokeSize: Property<number>;
  strokeSpacing: Property<number>;
  lineCap: Property<LineCap>;
  lineJoin: Property<LineJoin>;
  miterLimit: Property<number>;
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
        <PropertyEditor
          property={strokeWidth}
          render={props => (
            <NumberInput {...props} defaultUnit={'px'} min={1} style={{ width: '35px' }} />
          )}
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
