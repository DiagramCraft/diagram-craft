import { TbLine, TbShape3, TbVectorBezier2, TbVectorSpline } from 'react-icons/tb';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import * as ReactToolbar from '@radix-ui/react-toolbar';
import { ArrowSelector } from './ArrowSelector.tsx';
import { ColorPicker } from '../ColorPicker.tsx';
import { additionalHues, primaryColors } from './palette.ts';
import { DashSelector } from './DashSelector.tsx';
import { useEdgeProperty } from './useProperty.ts';
import { NumberInput } from '../NumberInput.tsx';
import { assertEdgeType } from '../../model-viewer/diagramProps.ts';

export const LineProperties = (props: Props) => {
  const $d = props.diagram;

  const [strokeColor, setStrokeColor] = useEdgeProperty($d, 'stroke.color', 'transparent');
  const [fillColor, setFillColor] = useEdgeProperty($d, 'fill.color', undefined);
  const [pattern, setPattern] = useEdgeProperty($d, 'stroke.pattern', 'SOLID');

  const [strokSize, setStrokeSize] = useEdgeProperty($d, 'stroke.patternSize', 100);
  const [strokeSpacing, setStrokeSpacing] = useEdgeProperty($d, 'stroke.patternSpacing', 100);
  const [strokeWidth, setStrokeWidth] = useEdgeProperty($d, 'stroke.width', 1);

  const [type, setType] = useEdgeProperty($d, 'type', 'straight');

  const [startType, setStartType] = useEdgeProperty($d, 'arrow.start.type', undefined);
  const [startSize, setStartSize] = useEdgeProperty($d, 'arrow.start.size', 100);
  const [endType, setEndType] = useEdgeProperty($d, 'arrow.end.type', undefined);

  const [endSize, setEndSize] = useEdgeProperty($d, 'arrow.end.size', 100);

  return (
    <div>
      <div className={'cmp-labeled-table'}>
        <div className={'cmp-labeled-table__label'}>Type:</div>
        <div className={'cmp-labeled-table__value'}>
          <ReactToolbar.Root className="cmp-toolbar" aria-label="Formatting options">
            <ReactToolbar.ToggleGroup
              type={'single'}
              value={type}
              onValueChange={value => {
                assertEdgeType(value);
                setType(value);
              }}
            >
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'straight'}>
                <TbLine />
              </ReactToolbar.ToggleItem>
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'orthogonal'}>
                <TbShape3 />
              </ReactToolbar.ToggleItem>
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'curved'}>
                <TbVectorSpline />
              </ReactToolbar.ToggleItem>
              <ReactToolbar.ToggleItem className="cmp-toolbar__toggle-item" value={'bezier'}>
                <TbVectorBezier2 />
              </ReactToolbar.ToggleItem>
            </ReactToolbar.ToggleGroup>
          </ReactToolbar.Root>
        </div>

        <div className={'cmp-labeled-table__label'}>Line start:</div>
        <div className={'cmp-labeled-table__value util-vcenter'}>
          <ArrowSelector value={startType} onValueChange={setStartType} />
          &nbsp;
          <NumberInput
            validUnits={['%']}
            defaultUnit={'%'}
            value={startSize ?? ''}
            min={1}
            style={{ width: '50px' }}
            onChange={setStartSize}
          />
        </div>

        <div className={'cmp-labeled-table__label'}>Line end:</div>
        <div className={'cmp-labeled-table__value util-vcenter'}>
          <ArrowSelector value={endType} onValueChange={setEndType} />
          &nbsp;
          <NumberInput
            validUnits={['%']}
            defaultUnit={'%'}
            value={endSize ?? ''}
            min={1}
            style={{ width: '50px' }}
            onChange={setEndSize}
          />
        </div>

        <div className={'cmp-labeled-table__label'}>Color:</div>
        <div className={'cmp-labeled-table__value util-vcenter'}>
          <ColorPicker
            primaryColors={primaryColors}
            additionalHues={additionalHues}
            color={strokeColor ?? 'transparent'}
            onClick={setStrokeColor}
          />
          &nbsp;
          <ColorPicker
            primaryColors={primaryColors}
            additionalHues={additionalHues}
            color={fillColor ?? 'transparent'}
            onClick={setFillColor}
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
            onChange={setStrokeWidth}
          />
        </div>

        <div className={'cmp-labeled-table__label'}>Dash:</div>
        <div className={'cmp-labeled-table__value util-vcenter'}>
          <DashSelector
            value={pattern}
            onValueChange={value => {
              setPattern(value ?? 'SOLID');
            }}
          />
          &nbsp;
          <NumberInput
            validUnits={['%']}
            defaultUnit={'%'}
            value={strokSize ?? 100}
            min={1}
            style={{ width: '45px' }}
            onChange={setStrokeSize}
          />
          &nbsp;
          <NumberInput
            validUnits={['%']}
            defaultUnit={'%'}
            value={strokeSpacing ?? 100}
            min={1}
            style={{ width: '45px' }}
            onChange={setStrokeSpacing}
          />
        </div>
      </div>
    </div>
  );
};

type Props = {
  diagram: EditableDiagram;
};
