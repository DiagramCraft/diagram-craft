import { round } from '@diagram-craft/utils/math';
import { useRedraw } from '../../hooks/useRedraw';
import { useNodeProperty } from '../../hooks/useProperty';
import { useEventListener } from '../../hooks/useEventListener';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { Slider } from '@diagram-craft/app-components/Slider';
import { Select } from '@diagram-craft/app-components/Select';
import { Diagram } from '@diagram-craft/model/diagram';
import { Property } from './types';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { PropertyEditor } from '../../components/PropertyEditor';
import { useDiagram } from '../../../application';
import { ColorPicker } from '../../components/ColorPicker';
import { useConfiguration } from '../../context/ConfigurationContext';
import { Collapsible } from '@diagram-craft/app-components/Collapsible';

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

  isometric: Property<boolean>;
  isometricShape: Property<'none' | 'rect'>;
  isometricSize: Property<number>;
  isometricColor: Property<string>;
  isometricStrokeColor: Property<string>;
  isometricStrokeEnabled: Property<boolean>;
  isometricTilt: Property<number>;
  isometricRotation: Property<number>;
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
  roundingAmount,
  isometric,
  isometricShape,
  isometricSize,
  isometricColor,
  isometricStrokeColor,
  isometricStrokeEnabled,
  isometricTilt,
  isometricRotation
}: FormProps) => {
  const $cfg = useConfiguration();
  return (
    <div className={'cmp-labeled-table'}>
      <Collapsible label={'Reflection'} defaultOpen={reflection.isSet && reflection.val}>
        <div className={'cmp-labeled-table'}>
          <div className={'cmp-labeled-table__label util-a-top-center'}>Enabled:</div>
          <div className={'cmp-labeled-table__value'}>
            <PropertyEditor property={reflection} render={props => <Checkbox {...props} />} />
          </div>

          <div className={'cmp-labeled-table__label util-a-top-center'}>Strength:</div>
          <div className={'cmp-labeled-table__value'}>
            <PropertyEditor
              property={reflectionStrength}
              formatValue={v => round(v * 100)}
              storeValue={v => v / 100}
              render={props => <Slider {...props} />}
            />
          </div>
        </div>
      </Collapsible>

      <Collapsible label={'Blur'} defaultOpen={blur.isSet && blur.val > 0}>
        <div className={'cmp-labeled-table'}>
          <div className={'cmp-labeled-table__label util-a-top-center'}>Amount:</div>
          <div className={'cmp-labeled-table__value'}>
            <PropertyEditor
              property={blur}
              formatValue={v => round(v * 100)}
              storeValue={v => v / 100}
              render={props => <Slider {...props} />}
            />
          </div>
        </div>
      </Collapsible>

      <Collapsible label={'Opacity'} defaultOpen={opacity.isSet && opacity.val > 0}>
        <div className={'cmp-labeled-table'}>
          <div className={'cmp-labeled-table__label util-a-top-center'}>Amount:</div>
          <div className={'cmp-labeled-table__value'}>
            <PropertyEditor
              property={opacity}
              formatValue={v => round(v * 100)}
              storeValue={v => v / 100}
              render={props => <Slider {...props} />}
            />
          </div>
        </div>
      </Collapsible>

      <Collapsible label={'Glass'} defaultOpen={glass.isSet && glass.val}>
        <div className={'cmp-labeled-table'}>
          <div className={'cmp-labeled-table__label util-a-top-center'}>Enabled:</div>
          <div className={'cmp-labeled-table__value'}>
            <PropertyEditor property={glass} render={props => <Checkbox {...props} />} />
          </div>
        </div>
      </Collapsible>

      <Collapsible label={'Sketch'} defaultOpen={sketch.isSet && sketch.val}>
        <div className={'cmp-labeled-table'}>
          <div className={'cmp-labeled-table__label util-a-top-center'}>Enabled:</div>
          <div className={'cmp-labeled-table__value'}>
            <PropertyEditor property={sketch} render={props => <Checkbox {...props} />} />
          </div>

          <div className={'cmp-labeled-table__label util-a-top-center'}>Amount:</div>
          <div className={'cmp-labeled-table__value'}>
            <PropertyEditor
              property={sketchStrength}
              formatValue={v => round(v * 100)}
              storeValue={v => v / 100}
              render={props => <Slider {...props} max={25} />}
            />
          </div>

          <div className={'cmp-labeled-table__label util-a-top-center'}>Fill:</div>
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
        </div>
      </Collapsible>

      {$d.selectionState.nodes.some(e => e.getDefinition().supports('rounding')) && (
        <Collapsible label={'Rounding'} defaultOpen={rounding.isSet && rounding.val}>
          <div className={'cmp-labeled-table'}>
            <div className={'cmp-labeled-table__label util-a-top-center'}>Enabled:</div>
            <div className={'cmp-labeled-table__value'}>
              <PropertyEditor property={rounding} render={props => <Checkbox {...props} />} />
            </div>

            <div className={'cmp-labeled-table__label util-a-top-center'}>Amount:</div>
            <div className={'cmp-labeled-table__value'}>
              <PropertyEditor
                property={roundingAmount}
                render={props => <Slider {...props} max={200} unit={'px'} />}
              />
            </div>
          </div>
        </Collapsible>
      )}

      <Collapsible label={'Isometric'} defaultOpen={isometric.isSet && isometric.val}>
        <div className={'cmp-labeled-table'}>
          <div className={'cmp-labeled-table__label'}>Enabled:</div>
          <div className={'cmp-labeled-table__value'}>
            <PropertyEditor property={isometric} render={props => <Checkbox {...props} />} />
          </div>

          <div className={'cmp-labeled-table__label'}>Shape</div>
          <div className={'cmp-labeled-table__value'}>
            <PropertyEditor
              property={isometricShape}
              render={props => (
                <Select.Root {...props} onChange={s => props.onChange(s as 'none' | 'rect')}>
                  <Select.Item value={'none'}>None</Select.Item>
                  <Select.Item value={'rect'}>Rectangle</Select.Item>
                </Select.Root>
              )}
            />
          </div>

          <div className={'cmp-labeled-table__label'}>Color</div>
          <div className={'cmp-labeled-table__value'}>
            <PropertyEditor
              property={isometricColor}
              render={props => (
                <ColorPicker
                  {...props}
                  palette={$cfg.palette.primary}
                  canClearColor={true}
                  customPalette={$d.document.customPalette}
                  onChangeCustomPalette={(idx, v) => $d.document.customPalette.setColor(idx, v)}
                />
              )}
            />
          </div>

          <div className={'cmp-labeled-table__label'}>Stroke</div>
          <div className={'cmp-labeled-table__value util-hstack'}>
            <PropertyEditor
              property={isometricStrokeEnabled}
              render={props => <Checkbox {...props} />}
            />
            <PropertyEditor
              property={isometricStrokeColor}
              render={props => (
                <ColorPicker
                  {...props}
                  palette={$cfg.palette.primary}
                  canClearColor={true}
                  customPalette={$d.document.customPalette}
                  onChangeCustomPalette={(idx, v) => $d.document.customPalette.setColor(idx, v)}
                />
              )}
            />
          </div>

          <div className={'cmp-labeled-table__label'}>Height</div>
          <div className={'cmp-labeled-table__value'}>
            <PropertyEditor
              property={isometricSize}
              formatValue={v => round(v)}
              storeValue={v => v}
              render={props => <Slider {...props} unit={'px'} max={25} />}
            />
          </div>

          <div className={'cmp-labeled-table__label'}>Tilt</div>
          <div className={'cmp-labeled-table__value'}>
            <PropertyEditor
              property={isometricTilt}
              formatValue={v => round(v)}
              storeValue={v => v}
              render={props => <Slider {...props} unit={''} min={0.1} step={0.05} max={1} />}
            />
          </div>

          <div className={'cmp-labeled-table__label'}>Rotation</div>
          <div className={'cmp-labeled-table__value'}>
            <PropertyEditor
              property={isometricRotation}
              formatValue={v => round(v)}
              storeValue={v => v}
              render={props => <Slider {...props} unit={''} min={0} max={60} />}
            />
          </div>
        </div>
      </Collapsible>
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

  const isometric = useNodeProperty($d, 'effects.isometric.enabled');
  const isometricShape = useNodeProperty($d, 'effects.isometric.shape');
  const isometricSize = useNodeProperty($d, 'effects.isometric.size');
  const isometricColor = useNodeProperty($d, 'effects.isometric.color');

  const isometricTilt = useNodeProperty($d, 'effects.isometric.tilt');
  const isometricRotation = useNodeProperty($d, 'effects.isometric.rotation');
  const isometricStrokeEnabled = useNodeProperty($d, 'effects.isometric.strokeEnabled');
  const isometricStrokeColor = useNodeProperty($d, 'effects.isometric.strokeColor');

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
        isometric={isometric}
        isometricShape={isometricShape}
        isometricSize={isometricSize}
        isometricColor={isometricColor}
        isometricTilt={isometricTilt}
        isometricRotation={isometricRotation}
        isometricStrokeEnabled={isometricStrokeEnabled}
        isometricStrokeColor={isometricStrokeColor}
      />
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
