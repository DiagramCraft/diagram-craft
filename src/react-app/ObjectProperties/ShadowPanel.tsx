import { additionalHues, primaryColors } from './palette.ts';
import { ColorPicker } from '../ColorPicker.tsx';
import { useElementProperty } from './useProperty.ts';
import { NumberInput } from '../NumberInput.tsx';
import { round } from '../../utils/math.ts';
import { ToolWindowPanel } from '../components/ToolWindowPanel.tsx';
import { useDiagram } from '../context/DiagramContext.tsx';
import { useNodeDefaults } from '../useDefaults.tsx';

export const ShadowPanel = (props: Props) => {
  const $d = useDiagram();
  const defaults = useNodeDefaults();

  const color = useElementProperty($d, 'shadow.color', defaults.shadow.color);
  const opacity = useElementProperty($d, 'shadow.opacity', defaults.shadow.opacity);
  const x = useElementProperty($d, 'shadow.x', defaults.shadow.x);
  const y = useElementProperty($d, 'shadow.y', defaults.shadow.y);
  const blur = useElementProperty($d, 'shadow.blur', defaults.shadow.blur);
  const enabled = useElementProperty($d, 'shadow.enabled', defaults.shadow.enabled);

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      title={'Shadow'}
      id={'shadow'}
      hasCheckbox={true}
      value={enabled.val}
      onChange={enabled.set}
    >
      <div className={'cmp-labeled-table'}>
        <div className={'cmp-labeled-table__label'}>Color:</div>
        <div className={'cmp-labeled-table__value util-vcenter'}>
          <ColorPicker
            primaryColors={primaryColors}
            additionalHues={additionalHues}
            color={color.val}
            onClick={color.set}
          />
          &nbsp;
          <NumberInput
            value={round((1 - (opacity.val ?? 0)) * 100)?.toString()}
            onChange={v => opacity.set((100 - (v ?? 100)) / 100)}
            style={{ width: '45px' }}
            min={0}
            max={100}
            defaultUnit={'%'}
          />
        </div>
        <div className={'cmp-labeled-table__label'}>Position:</div>
        <div className={'cmp-labeled-table__value util-vcenter'}>
          <NumberInput
            value={x.val}
            onChange={x.set}
            style={{ width: '45px' }}
            defaultUnit={'px'}
          />
          &nbsp;
          <NumberInput
            value={y.val}
            onChange={y.set}
            style={{ width: '45px' }}
            defaultUnit={'px'}
          />
          &nbsp;
          <NumberInput
            value={blur.val}
            onChange={blur.set}
            min={0}
            style={{ width: '45px' }}
            defaultUnit={'px'}
          />
        </div>
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
