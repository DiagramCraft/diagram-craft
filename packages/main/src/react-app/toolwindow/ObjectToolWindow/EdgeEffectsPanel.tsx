import { round } from '@diagram-craft/utils/math';
import { useRedraw } from '../../hooks/useRedraw';
import { useDiagram } from '../../context/DiagramContext';
import { useEdgeProperty } from '../../hooks/useProperty';
import { useEventListener } from '../../hooks/useEventListener';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { Slider } from '@diagram-craft/app-components/Slider';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { PropertyEditor } from '../../components/PropertyEditor';

// TODO: We should merge this with NodeEffectsPanel
//       ... only sketch is common between the two
//       ... but we could also keep blur in both
export const EdgeEffectsPanel = (props: Props) => {
  const redraw = useRedraw();
  const $d = useDiagram();

  const opacity = useEdgeProperty($d, 'effects.opacity');

  const sketch = useEdgeProperty($d, 'effects.sketch');
  const sketchStrength = useEdgeProperty($d, 'effects.sketchStrength');

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
          <div className={'cmp-labeled-table__label'}>Opacity:</div>
          <div className={'cmp-labeled-table__value'}>
            <PropertyEditor
              property={opacity}
              formatValue={v => round(v * 100)}
              storeValue={v => v / 100}
              render={props => <Slider {...props} />}
            />
          </div>

          <div className={'cmp-labeled-table__label'}>Sketch:</div>
          <div className={'cmp-labeled-table__value'}>
            <PropertyEditor property={sketch} render={props => <Checkbox {...props} />} />
          </div>

          <div className={'cmp-labeled-table__label'}></div>
          <div className={'cmp-labeled-table__value'}>
            <PropertyEditor
              property={sketchStrength}
              formatValue={v => round(v * 100)}
              storeValue={v => v / 100}
              render={props => <Slider {...props} max={25} />}
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
