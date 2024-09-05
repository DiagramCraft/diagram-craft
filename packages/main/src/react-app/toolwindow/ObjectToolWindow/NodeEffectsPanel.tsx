import { round } from '@diagram-craft/utils/math';
import { useRedraw } from '../../hooks/useRedraw';
import { useDiagram } from '../../context/DiagramContext';
import { useNodeProperty } from '../../hooks/useProperty';
import { useEventListener } from '../../hooks/useEventListener';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { Slider } from '@diagram-craft/app-components/Slider';
import { Select } from '@diagram-craft/app-components/Select';
import { Diagram } from '@diagram-craft/model/diagram';
import { Property } from './types';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { PropertyEditor } from '../../components/PropertyEditor';

type FormProps = {
  diagram: Diagram;
  reflection: Property<boolean>;
  reflectionStrength: Property<number>;
  blur: Property<number>;
  opacity: Property<number>;
  glass: Property<boolean>;
  sketch: Property<boolean>;
  sketchStrength: Property<number>;
  sketchFillType: Property<'fill' | 'hachure'>;
  rounding: Property<boolean>;
  roundingAmount: Property<number>;
};

export const NodeEffectsPanelForm = ({
  diagram: $d,
  reflection,
  reflectionStrength,
  blur,
  opacity,
  glass,
  sketch,
  sketchStrength,
  sketchFillType,
  rounding,
  roundingAmount
}: FormProps) => {
  return (
    <div className={'cmp-labeled-table'}>
      <div className={'cmp-labeled-table__label'}>Reflection:</div>
      <div className={'cmp-labeled-table__value'}>
        <PropertyEditor property={reflection} render={props => <Checkbox {...props} />} />
      </div>

      <div className={'cmp-labeled-table__label'}></div>
      <div className={'cmp-labeled-table__value'}>
        <Slider
          value={round(reflectionStrength.val * 100)}
          onChange={v => {
            reflectionStrength.set(v === undefined ? undefined : Number(v) / 100);
          }}
          defaultValue={reflectionStrength.defaultVal * 100}
          isDefaultValue={!reflectionStrength.isSet}
        />
      </div>

      <div className={'cmp-labeled-table__label'}>Blur:</div>
      <div className={'cmp-labeled-table__value'}>
        <Slider
          value={round(blur.val * 100)}
          onChange={v => {
            blur.set(v === undefined ? undefined : Number(v) / 100);
          }}
          defaultValue={blur.defaultVal * 100}
          isDefaultValue={!blur.isSet}
        />
      </div>

      <div className={'cmp-labeled-table__label'}>Opacity:</div>
      <div className={'cmp-labeled-table__value'}>
        <Slider
          value={round(opacity.val * 100)}
          onChange={v => {
            opacity.set(v === undefined ? undefined : Number(v) / 100);
          }}
          defaultValue={opacity.defaultVal * 100}
          isDefaultValue={!opacity.isSet}
        />
      </div>

      <div className={'cmp-labeled-table__label'}>Glass:</div>
      <div className={'cmp-labeled-table__value'}>
        <PropertyEditor property={glass} render={props => <Checkbox {...props} />} />
      </div>

      <div className={'cmp-labeled-table__label'}>Sketch:</div>
      <div className={'cmp-labeled-table__value'}>
        <PropertyEditor property={sketch} render={props => <Checkbox {...props} />} />
      </div>

      <div className={'cmp-labeled-table__label'}></div>
      <div className={'cmp-labeled-table__value'}>
        <Slider
          value={round(sketchStrength.val * 100)}
          onChange={v => {
            sketchStrength.set(v === undefined ? undefined : Number(v) / 100);
          }}
          max={25}
          defaultValue={round(sketchStrength.defaultVal * 100)}
          isDefaultValue={!sketchStrength.isSet}
        />
      </div>

      <div className={'cmp-labeled-table__label'}></div>
      <div className={'cmp-labeled-table__value'}>
        <PropertyEditor
          property={sketchFillType as Property<string>}
          render={props => (
            <Select.Root {...props}>
              <Select.Item value={'fill'}>Solid</Select.Item>
              <Select.Item value={'hachure'}>Hachure</Select.Item>
            </Select.Root>
          )}
        />
      </div>

      {$d.selectionState.nodes.some(e => e.getDefinition().supports('rounding')) && (
        <>
          <div className={'cmp-labeled-table__label'}>Rounding:</div>
          <div className={'cmp-labeled-table__value'}>
            <PropertyEditor property={rounding} render={props => <Checkbox {...props} />} />
          </div>
          <div className={'cmp-labeled-table__label'}></div>
          <div className={'cmp-labeled-table__value'}>
            <Slider
              value={round(roundingAmount.val)}
              onChange={v => {
                roundingAmount.set(v);
              }}
              unit={'px'}
              max={200}
              defaultValue={round(roundingAmount.defaultVal)}
              isDefaultValue={!roundingAmount.isSet}
            />
          </div>
        </>
      )}
    </div>
  );
};

export const NodeEffectsPanel = (props: Props) => {
  const redraw = useRedraw();
  const $d = useDiagram();

  const rounding = useNodeProperty($d, 'effects.rounding');
  const roundingAmount = useNodeProperty($d, 'effects.roundingAmount');

  const reflection = useNodeProperty($d, 'effects.reflection');
  const reflectionStrength = useNodeProperty($d, 'effects.reflectionStrength');
  const blur = useNodeProperty($d, 'effects.blur');
  const opacity = useNodeProperty($d, 'effects.opacity');

  const glass = useNodeProperty($d, 'effects.glass');

  const sketch = useNodeProperty($d, 'effects.sketch');
  const sketchStrength = useNodeProperty($d, 'effects.sketchStrength');
  const sketchFillType = useNodeProperty($d, 'effects.sketchFillType');

  useEventListener($d.selectionState, 'change', redraw);

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      id="effects"
      title={'Effects'}
      hasCheckbox={false}
    >
      <NodeEffectsPanelForm
        diagram={$d}
        reflection={reflection}
        reflectionStrength={reflectionStrength}
        blur={blur}
        opacity={opacity}
        glass={glass}
        sketch={sketch}
        sketchStrength={sketchStrength}
        sketchFillType={sketchFillType}
        rounding={rounding}
        roundingAmount={roundingAmount}
      />
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
