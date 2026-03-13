import { round } from '@diagram-craft/utils/math';
import { useRedraw } from '../../hooks/useRedraw';
import { useEdgeProperty } from '../../hooks/useProperty';
import { useEventListener } from '../../hooks/useEventListener';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { Slider } from '@diagram-craft/app-components/Slider';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { PropertyEditor } from '../../components/PropertyEditor';
import { useDiagram } from '../../../application';
import { Collapsible } from '@diagram-craft/app-components/Collapsible';
import type { Property } from '@diagram-craft/model/property';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { KeyValueTable } from '@diagram-craft/app-components/KeyValueTable';

type FormProps = {
  opacity: Property<number>;
  sketch: Property<boolean>;
  sketchStrength: Property<number>;
  marchingAnts: Property<boolean>;
  marchingAntsSpeed: Property<number>;
  rounding: Property<boolean>;
  roundingAmount: Property<number>;
  dashOffset: Property<number>;
};

export const EdgeEffectsPanelForm = ({
  opacity,
  sketch,
  sketchStrength,
  marchingAnts,
  marchingAntsSpeed,
  rounding,
  roundingAmount,
  dashOffset
}: FormProps) => {
  return (
    <KeyValueTable.Root>
      <KeyValueTable.FullRow>
        <Collapsible label={'Opacity'} defaultOpen={opacity.isSet && opacity.val > 0}>
          <KeyValueTable.Root>
            <KeyValueTable.Label>Opacity:</KeyValueTable.Label>
            <KeyValueTable.Value>
              <PropertyEditor
                property={opacity}
                formatValue={v => round(v * 100)}
                storeValue={v => v / 100}
                render={props => <Slider {...props} />}
              />
            </KeyValueTable.Value>
          </KeyValueTable.Root>
        </Collapsible>
      </KeyValueTable.FullRow>

      <KeyValueTable.FullRow>
        <Collapsible label={'Sketch'} defaultOpen={sketch.isSet && sketch.val}>
          <KeyValueTable.Root>
            <KeyValueTable.Label>Enabled:</KeyValueTable.Label>
            <KeyValueTable.Value>
              <PropertyEditor property={sketch} render={props => <Checkbox {...props} />} />
            </KeyValueTable.Value>

            <KeyValueTable.Label></KeyValueTable.Label>
            <KeyValueTable.Value>
              <PropertyEditor
                property={sketchStrength}
                formatValue={v => round(v * 100)}
                storeValue={v => v / 100}
                render={props => <Slider {...props} max={25} />}
              />
            </KeyValueTable.Value>
          </KeyValueTable.Root>
        </Collapsible>
      </KeyValueTable.FullRow>

      <KeyValueTable.FullRow>
        <Collapsible label={'Marching Ants'} defaultOpen={marchingAnts.isSet && marchingAnts.val}>
          <KeyValueTable.Root>
            <KeyValueTable.Label>Enabled:</KeyValueTable.Label>
            <KeyValueTable.Value>
              <PropertyEditor property={marchingAnts} render={props => <Checkbox {...props} />} />
            </KeyValueTable.Value>

            <KeyValueTable.Label></KeyValueTable.Label>
            <KeyValueTable.Value>
              <PropertyEditor
                property={marchingAntsSpeed}
                formatValue={v => round(v * 100)}
                storeValue={v => v / 100}
                render={props => <Slider {...props} max={100} />}
              />
            </KeyValueTable.Value>
          </KeyValueTable.Root>
        </Collapsible>
      </KeyValueTable.FullRow>

      <KeyValueTable.FullRow>
        <Collapsible label={'Rounding'} defaultOpen={rounding.isSet && rounding.val}>
          <KeyValueTable.Root>
            <KeyValueTable.Label>Enabled:</KeyValueTable.Label>
            <KeyValueTable.Value>
              <PropertyEditor property={rounding} render={props => <Checkbox {...props} />} />
            </KeyValueTable.Value>

            <KeyValueTable.Label></KeyValueTable.Label>
            <KeyValueTable.Value>
              <PropertyEditor
                property={roundingAmount}
                render={props => <Slider {...props} max={100} unit={'px'} />}
              />
            </KeyValueTable.Value>
          </KeyValueTable.Root>
        </Collapsible>
      </KeyValueTable.FullRow>

      <KeyValueTable.FullRow>
        <Collapsible label={'Dash Offset'} defaultOpen={dashOffset.isSet && dashOffset.val !== 0}>
          <KeyValueTable.Root>
            <KeyValueTable.Label>Offset:</KeyValueTable.Label>
            <KeyValueTable.Value>
              <PropertyEditor
                property={dashOffset}
                render={props => <NumberInput {...props} numberOfDecimals={0} min={-10} max={10} />}
              />
            </KeyValueTable.Value>
          </KeyValueTable.Root>
        </Collapsible>
      </KeyValueTable.FullRow>
    </KeyValueTable.Root>
  );
};

// TODO: We should merge this with NodeEffectsPanel
//       ... only sketch is common between the two
//       ... but we could also keep blur in both
export const EdgeEffectsPanel = (props: Props) => {
  const redraw = useRedraw();
  const $d = useDiagram();

  const opacity = useEdgeProperty($d, 'effects.opacity');

  const sketch = useEdgeProperty($d, 'effects.sketch');
  const sketchStrength = useEdgeProperty($d, 'effects.sketchStrength');

  const marchingAnts = useEdgeProperty($d, 'effects.marchingAnts');
  const marchingAntsSpeed = useEdgeProperty($d, 'effects.marchingAntsSpeed');

  const rounding = useEdgeProperty($d, 'effects.rounding');
  const roundingAmount = useEdgeProperty($d, 'effects.roundingAmount');

  const dashOffset = useEdgeProperty($d, 'effects.dashOffset');

  useEventListener($d.selection, 'change', redraw);

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      id="effects"
      title={'Effects'}
      hasCheckbox={false}
    >
      <EdgeEffectsPanelForm
        opacity={opacity}
        sketch={sketch}
        sketchStrength={sketchStrength}
        marchingAnts={marchingAnts}
        marchingAntsSpeed={marchingAntsSpeed}
        rounding={rounding}
        roundingAmount={roundingAmount}
        dashOffset={dashOffset}
      />
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
