import { ColorPicker } from '../ColorPicker.tsx';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { additionalHues, primaryColors } from './palette.ts';
import { DashSelector } from './DashSelector.tsx';
import { useNodeProperty } from './useNodeProperty.ts';
import { NumberInput } from '../NumberInput.tsx';

export const StrokeProperties = (props: Props) => {
  const [strokeColor, setStrokeColor] = useNodeProperty(
    'stroke.color',
    props.diagram,
    'transparent'
  );
  const [pattern, setPattern] = useNodeProperty('stroke.pattern', props.diagram, 'SOLID');

  const [strokSize, setStrokeSize] = useNodeProperty('stroke.patternSize', props.diagram, '100');
  const [strokeSpacing, setStrokeSpacing] = useNodeProperty(
    'stroke.patternSpacing',
    props.diagram,
    '100'
  );
  const [strokeWidth, setStrokeWidth] = useNodeProperty('stroke.width', props.diagram, '1');

  return (
    <>
      <div className={'cmp-labeled-table'}>
        <div className={'cmp-labeled-table__label'}>Color:</div>
        <div className={'cmp-labeled-table__value'}>
          <ColorPicker
            primaryColors={primaryColors}
            additionalHues={additionalHues}
            color={strokeColor ?? 'transparent'}
            onClick={setStrokeColor}
          />
        </div>

        <div className={'cmp-labeled-table__label'}>Width:</div>
        <div className={'cmp-labeled-table__value'}>
          <NumberInput
            validUnits={['px']}
            defaultUnit={'px'}
            value={strokeWidth ?? 1}
            min={1}
            style={{ width: '45px' }}
            onChange={ev => {
              setStrokeWidth(ev?.toString());
            }}
          />
        </div>

        <div className={'cmp-labeled-table__label'}>Dash:</div>
        <div className={'cmp-labeled-table__value'}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <DashSelector
              value={pattern}
              onValueChange={value => {
                setPattern(value);
              }}
            />
            &nbsp;
            <NumberInput
              validUnits={['%']}
              defaultUnit={'%'}
              value={strokSize ?? 100}
              min={1}
              style={{ width: '45px' }}
              onChange={ev => {
                setStrokeSize(ev?.toString());
              }}
            />
            &nbsp;
            <NumberInput
              validUnits={['%']}
              defaultUnit={'%'}
              value={strokeSpacing ?? 100}
              min={1}
              style={{ width: '45px' }}
              onChange={ev => {
                setStrokeSpacing(ev?.toString());
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
};

type Props = {
  diagram: EditableDiagram;
};
