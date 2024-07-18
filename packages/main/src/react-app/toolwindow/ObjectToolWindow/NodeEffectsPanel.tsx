import { round } from '@diagram-craft/utils/math';
import { useRedraw } from '../../hooks/useRedraw';
import { useDiagram } from '../../context/DiagramContext';
import { useNodeDefaults } from '../../hooks/useDefaults';
import { useNodeProperty } from '../../hooks/useProperty';
import { useEventListener } from '../../hooks/useEventListener';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { Slider } from '@diagram-craft/app-components/Slider';
import { Select } from '@diagram-craft/app-components/Select';

export const NodeEffectsPanel = (props: Props) => {
  const redraw = useRedraw();
  const $d = useDiagram();
  const defaults = useNodeDefaults();

  const rounding = useNodeProperty($d, 'effects.rounding');
  const roundingAmount = useNodeProperty($d, 'effects.roundingAmount');

  const reflection = useNodeProperty($d, 'effects.reflection', defaults.effects.reflection);
  const reflectionStrength = useNodeProperty(
    $d,
    'effects.reflectionStrength',
    defaults.effects.reflectionStrength
  );
  const blur = useNodeProperty($d, 'effects.blur', defaults.effects.blur);
  const opacity = useNodeProperty($d, 'effects.opacity', defaults.effects.opacity);

  const sketch = useNodeProperty($d, 'effects.sketch', defaults.effects.sketch);
  const sketchStrength = useNodeProperty(
    $d,
    'effects.sketchStrength',
    defaults.effects.sketchStrength
  );
  const sketchFillType = useNodeProperty(
    $d,
    'effects.sketchFillType',
    defaults.effects.sketchFillType
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

          <div className={'cmp-labeled-table__label'}></div>
          <div className={'cmp-labeled-table__value'}>
            <Slider
              value={round(reflectionStrength.val * 100)}
              onChange={v => {
                reflectionStrength.set(Number(v) / 100);
              }}
            />
          </div>

          <div className={'cmp-labeled-table__label'}>Blur:</div>
          <div className={'cmp-labeled-table__value'}>
            <Slider
              value={round(blur.val * 100)}
              onChange={v => {
                blur.set(Number(v) / 100);
              }}
            />
          </div>

          <div className={'cmp-labeled-table__label'}>Opacity:</div>
          <div className={'cmp-labeled-table__value'}>
            <Slider
              value={round(opacity.val * 100)}
              onChange={v => {
                opacity.set(Number(v) / 100);
              }}
            />
          </div>

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
            <Slider
              value={round(sketchStrength.val * 100)}
              onChange={v => {
                sketchStrength.set(Number(v) / 100);
              }}
              max={25}
            />
          </div>

          <div className={'cmp-labeled-table__label'}></div>
          <div className={'cmp-labeled-table__value'}>
            <Select.Root
              onValueChange={v => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                sketchFillType.set(v as any);
              }}
              value={sketchFillType.val}
            >
              <Select.Item value={'fill'}>Solid</Select.Item>
              <Select.Item value={'hachure'}>Hachure</Select.Item>
            </Select.Root>
          </div>

          <div className={'cmp-labeled-table__label'}>Rounding:</div>
          <div className={'cmp-labeled-table__value'}>
            <input
              type="checkbox"
              checked={rounding.val}
              onChange={() => {
                rounding.set(!rounding.val);
              }}
            />
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
