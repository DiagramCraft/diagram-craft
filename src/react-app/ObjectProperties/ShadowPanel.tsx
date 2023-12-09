import { additionalHues, primaryColors } from './palette.ts';
import { ColorPicker } from '../ColorPicker.tsx';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { useNodeProperty } from './useProperty.ts';
import { NumberInput } from '../NumberInput.tsx';
import { round } from '../../utils/math.ts';
import { ToolWindowPanel } from '../components/ToolWindowPanel.tsx';

export const ShadowPanel = (props: Props) => {
  const $d = props.diagram;

  const color = useNodeProperty($d, 'shadow.color', 'black');
  const opacity = useNodeProperty($d, 'shadow.opacity', 0.5);
  const x = useNodeProperty($d, 'shadow.x', 5);
  const y = useNodeProperty($d, 'shadow.y', 5);
  const blur = useNodeProperty($d, 'shadow.blur', 5);
  const enabled = useNodeProperty($d, 'shadow.enabled', false);

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
        <div className={'cmp-labeled-table__value'}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <ColorPicker
              primaryColors={primaryColors}
              additionalHues={additionalHues}
              color={color.val ?? 'black'}
              onClick={color.set}
            />
            &nbsp;
            <NumberInput
              value={round((1 - (opacity.val ?? 0)) * 100)?.toString() ?? ''}
              onChange={v => opacity.set((100 - (v ?? 100)) / 100)}
              style={{ width: '45px' }}
              min={0}
              max={100}
              validUnits={['%']}
              defaultUnit={'%'}
            />
          </div>
        </div>
        <div className={'cmp-labeled-table__label'}>Position:</div>
        <div className={'cmp-labeled-table__value'}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <NumberInput
              value={x.val?.toString() ?? ''}
              onChange={x.set}
              style={{ width: '45px' }}
              validUnits={['px']}
              defaultUnit={'px'}
            />
            &nbsp;
            <NumberInput
              value={y.val?.toString() ?? ''}
              onChange={y.set}
              style={{ width: '45px' }}
              validUnits={['px']}
              defaultUnit={'px'}
            />
            &nbsp;
            <NumberInput
              value={blur.val?.toString() ?? ''}
              onChange={blur.set}
              min={0}
              style={{ width: '45px' }}
              validUnits={['px']}
              defaultUnit={'px'}
            />
          </div>
        </div>
      </div>
    </ToolWindowPanel>
  );
};

type Props = {
  diagram: EditableDiagram;
  mode?: 'accordion' | 'panel';
};
