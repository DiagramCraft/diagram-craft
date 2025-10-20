import { round } from '@diagram-craft/utils/math';
import { ConfigurationContextType, useConfiguration } from '../../context/ConfigurationContext';
import { useElementProperty } from '../../hooks/useProperty';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { ColorPicker, ColorPreview } from '../../components/ColorPicker';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { Diagram } from '@diagram-craft/model/diagram';
import { PropertyEditor } from '../../components/PropertyEditor';
import { useDiagram } from '../../../application';
import type { Property } from '@diagram-craft/model/property';

type FormProps = {
  diagram: Diagram;
  config: ConfigurationContextType;
  color: Property<string>;
  opacity: Property<number>;
  x: Property<number>;
  y: Property<number>;
  blur: Property<number>;
};

export const ElementShadowPanelForm = ({
  config: $cfg,
  diagram: $d,
  color,
  opacity,
  x,
  y,
  blur
}: FormProps) => {
  return (
    <div className={'cmp-labeled-table'}>
      <div className={'cmp-labeled-table__label'}>Color:</div>
      <div className={'cmp-labeled-table__value util-vcenter util-hstack'}>
        <PropertyEditor
          property={color}
          render={props => (
            <ColorPicker
              {...props}
              palette={$cfg.palette.primary}
              customPalette={$d.document.customPalette}
              onChangeCustomPalette={(idx, v) => $d.document.customPalette.setColor(idx, v)}
            />
          )}
          renderValue={props => <ColorPreview {...props} />}
        />
        <PropertyEditor
          property={opacity}
          formatValue={v => round((1 - v) * 100)}
          storeValue={v => (100 - v) / 100}
          render={props => (
            <NumberInput {...props} style={{ width: '45px' }} min={0} max={100} defaultUnit={'%'} />
          )}
        />
      </div>
      <div className={'cmp-labeled-table__label'}>Position:</div>
      <div className={'cmp-labeled-table__value util-vcenter util-hstack'}>
        <PropertyEditor
          property={x}
          render={p => <NumberInput {...p} style={{ width: '45px' }} defaultUnit={'px'} />}
        />
        <PropertyEditor
          property={y}
          render={p => <NumberInput {...p} style={{ width: '45px' }} defaultUnit={'px'} />}
        />
        <PropertyEditor
          property={blur}
          render={p => <NumberInput {...p} min={0} style={{ width: '45px' }} defaultUnit={'px'} />}
        />
      </div>
    </div>
  );
};

export const ElementShadowPanel = (props: Props) => {
  const $d = useDiagram();
  const $cfg = useConfiguration();

  const color = useElementProperty($d, 'shadow.color');
  const opacity = useElementProperty($d, 'shadow.opacity');
  const x = useElementProperty($d, 'shadow.x');
  const y = useElementProperty($d, 'shadow.y');
  const blur = useElementProperty($d, 'shadow.blur');
  const enabled = useElementProperty($d, 'shadow.enabled');

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      title={'Shadow'}
      id={'shadow'}
      hasCheckbox={true}
      value={enabled.val}
      onChange={enabled.set}
    >
      <ElementShadowPanelForm
        diagram={$d}
        config={$cfg}
        color={color}
        opacity={opacity}
        x={x}
        y={y}
        blur={blur}
      />
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
