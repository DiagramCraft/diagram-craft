import { additionalHues, primaryColors } from './palette.ts';
import { ColorPicker } from '../ColorPicker.tsx';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { useNodeProperty } from './useProperty.ts';
import { NumberInput } from '../NumberInput.tsx';
import { round } from '../../utils/math.ts';
import { ToolWindowPanel } from '../components/ToolWindowPanel.tsx';

export const ShadowPanel = (props: Props) => {
  const $d = props.diagram;

  const [color, setColor] = useNodeProperty('shadow.color', $d, 'black');
  const [opacity, setOpacity] = useNodeProperty('shadow.opacity', $d, 0.5);
  const [x, setX] = useNodeProperty('shadow.x', $d, 5);
  const [y, setY] = useNodeProperty('shadow.y', $d, 5);
  const [blur, setBlur] = useNodeProperty('shadow.blur', $d, 5);
  const [enabled, setEnabled] = useNodeProperty('shadow.enabled', $d, false);

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      title={'Shadow'}
      id={'shadow'}
      hasCheckbox={true}
      value={enabled}
      onChange={setEnabled}
    >
      <div className={'cmp-labeled-table'}>
        <div className={'cmp-labeled-table__label'}>Color:</div>
        <div className={'cmp-labeled-table__value'}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <ColorPicker
              primaryColors={primaryColors}
              additionalHues={additionalHues}
              color={color ?? 'black'}
              onClick={setColor}
            />
            &nbsp;
            <NumberInput
              value={round((1 - (opacity ?? 0)) * 100)?.toString() ?? ''}
              onChange={v => setOpacity((100 - (v ?? 100)) / 100)}
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
              value={x?.toString() ?? ''}
              onChange={setX}
              style={{ width: '45px' }}
              validUnits={['px']}
              defaultUnit={'px'}
            />
            &nbsp;
            <NumberInput
              value={y?.toString() ?? ''}
              onChange={setY}
              style={{ width: '45px' }}
              validUnits={['px']}
              defaultUnit={'px'}
            />
            &nbsp;
            <NumberInput
              value={blur?.toString() ?? ''}
              onChange={setBlur}
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
