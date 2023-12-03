import { ColorPicker } from '../ColorPicker.tsx';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { additionalHues, primaryColors } from './palette.ts';
import { DashSelector } from './DashSelector.tsx';
import { useNodeProperty } from './useNodeProperty.ts';

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

        <div className={'cmp-labeled-table__row'}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <DashSelector
              value={pattern}
              onValueChange={value => {
                setPattern(value);
              }}
            />
            &nbsp;
            <input
              type={'number'}
              value={strokSize ?? 100}
              min={1}
              style={{ width: '45px' }}
              onChange={ev => {
                setStrokeSize(ev.target.value);
              }}
            />
            &nbsp;
            <input
              type={'number'}
              value={strokeSpacing ?? 100}
              min={1}
              style={{ width: '45px' }}
              onChange={ev => {
                setStrokeSpacing(ev.target.value);
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
