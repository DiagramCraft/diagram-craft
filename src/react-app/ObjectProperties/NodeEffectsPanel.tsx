import { useDiagram } from '../context/DiagramContext.tsx';
import { ToolWindowPanel } from '../components/ToolWindowPanel.tsx';
import { useRedraw } from '../../react-canvas-viewer/useRedraw.tsx';
import { useEventListener } from '../hooks/useEventListener.ts';
import { NumberInput } from '../NumberInput.tsx';
import { round } from '../../utils/math.ts';
import { useNodeProperty } from './useProperty.ts';
import { useNodeDefaults } from '../useDefaults.tsx';

export const NodeEffectsPanel = (props: Props) => {
  const redraw = useRedraw();
  const $d = useDiagram();
  const defaults = useNodeDefaults();

  const reflection = useNodeProperty($d, 'effects.reflection', defaults.effects.reflection);
  const blur = useNodeProperty($d, 'effects.blur', defaults.effects.blur);
  const opacity = useNodeProperty($d, 'effects.opacity', defaults.effects.opacity);

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
          <div className={'cmp-labeled-table__label'}>Reflection:</div>
          <div className={'cmp-labeled-table__value'}>
            <input
              type="checkbox"
              checked={reflection.val}
              onChange={() => {
                reflection.set(!reflection.val);
              }}
            />
          </div>

          <div className={'cmp-labeled-table__label'}>Blur:</div>
          <div className={'cmp-labeled-table__value'}>
            <NumberInput
              defaultUnit={'%'}
              value={round(blur.val * 100)}
              min={0}
              max={100}
              style={{ width: '50px' }}
              onChange={v => {
                blur.set(Number(v) / 100);
              }}
            />
          </div>

          <div className={'cmp-labeled-table__label'}>Opacity:</div>
          <div className={'cmp-labeled-table__value'}>
            <NumberInput
              defaultUnit={'%'}
              value={round(opacity.val * 100)}
              min={0}
              max={100}
              style={{ width: '50px' }}
              onChange={v => {
                opacity.set(Number(v) / 100);
              }}
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
