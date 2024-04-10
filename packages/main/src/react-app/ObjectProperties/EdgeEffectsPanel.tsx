import { useDiagram } from '../context/DiagramContext';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { useRedraw } from '../useRedraw';
import { useEventListener } from '../hooks/useEventListener';
import { useEdgeProperty } from './useProperty';
import { useEdgeDefaults } from '../useDefaults';
import { SliderAndNumberInput } from '../SliderAndNumberInput';
import { round } from '@diagram-craft/utils/math';

// TODO: We should merge this with NodeEffectsPanel
//       ... only sketch is common between the two
//       ... but we could also keep blur in both
export const EdgeEffectsPanel = (props: Props) => {
  const redraw = useRedraw();
  const $d = useDiagram();
  const defaults = useEdgeDefaults();

  const sketch = useEdgeProperty($d, 'effects.sketch', defaults.effects.sketch);
  const sketchStrength = useEdgeProperty(
    $d,
    'effects.sketchStrength',
    defaults.effects.sketchStrength
  );

  useEventListener($d.selectionState, 'change', redraw);

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      id="effects"
      title={'Effects'}
      hasCheckbox={false}
    >
      <div>
        <div className={'cmp-labeled-table'}>
          <div className={'cmp-labeled-table__label'}>Sketch:</div>
          <div className={'cmp-labeled-table__value'}>
            <input
              type="checkbox"
              checked={sketch.val}
              onChange={() => {
                sketch.set(!sketch.val);
              }}
            />
          </div>

          <div className={'cmp-labeled-table__label'}></div>
          <div className={'cmp-labeled-table__value'}>
            <SliderAndNumberInput
              value={round(sketchStrength.val * 100)}
              onChange={v => {
                sketchStrength.set(Number(v) / 100);
              }}
              max={25}
            />
          </div>
        </div>
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
