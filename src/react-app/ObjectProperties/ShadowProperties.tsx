import { additionalHues, primaryColors } from './palette.ts';
import { ColorPicker } from '../ColorPicker.tsx';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { useNodeProperty } from './useNodeProperty.ts';
import * as ReactToolbar from '@radix-ui/react-toolbar';
import { TbAspectRatio } from 'react-icons/tb';
import { NumberInput } from '../NumberInput.tsx';
import { round } from '../../utils/math.ts';

export const ShadowProperties = (props: Props) => {
  const [color, setColor] = useNodeProperty<string | undefined>(
    'shadow.color',
    props.diagram,
    'black'
  );
  const [opacity, setOpacity] = useNodeProperty<number | undefined>(
    'shadow.opacity',
    props.diagram,
    0.5
  );
  const [x, setX] = useNodeProperty<number | undefined>('shadow.x', props.diagram, 5);
  const [y, setY] = useNodeProperty<number | undefined>('shadow.y', props.diagram, 5);
  const [blur, setBlur] = useNodeProperty<number | undefined>('shadow.blur', props.diagram, 5);
  const [enabled, setEnabled] = useNodeProperty<boolean | undefined>(
    'shadow.enabled',
    props.diagram,
    false
  );

  console.log(blur);

  return (
    <div className={'cmp-labeled-table'}>
      <div className={'cmp-labeled-table__label'}>Enabled:</div>
      <div className={'cmp-labeled-table__value'}>
        <ReactToolbar.Root className="cmp-toolbar" aria-label="Formatting options">
          <ReactToolbar.ToggleGroup
            type={'single'}
            value={enabled ? 'enabled' : 'disabled'}
            onValueChange={value => {
              setEnabled(value === 'enabled');
            }}
          >
            <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'enabled'}>
              <TbAspectRatio />
            </ReactToolbar.ToggleItem>
          </ReactToolbar.ToggleGroup>
        </ReactToolbar.Root>
      </div>

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
            min={1}
            style={{ width: '45px' }}
            validUnits={['px']}
            defaultUnit={'px'}
          />
          &nbsp;
          <NumberInput
            value={y?.toString() ?? ''}
            onChange={setY}
            min={1}
            style={{ width: '45px' }}
            validUnits={['px']}
            defaultUnit={'px'}
          />
          &nbsp;
          <NumberInput
            value={blur?.toString() ?? ''}
            onChange={setBlur}
            min={1}
            style={{ width: '45px' }}
            validUnits={['px']}
            defaultUnit={'px'}
          />
        </div>
      </div>
    </div>
  );
};

type Props = {
  diagram: EditableDiagram;
};
