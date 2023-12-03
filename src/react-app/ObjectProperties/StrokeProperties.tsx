import { ColorPicker } from '../ColorPicker.tsx';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { useState } from 'react';
import { useEventListener } from '../hooks/useEventListener.ts';
import { unique } from '../../utils/array.ts';
import { additionalHues, primaryColors } from './palette.ts';
import { DashSelector } from './DashSelector.tsx';

export const StrokeProperties = (props: Props) => {
  const [strokeColor, setStrokeColor] = useState<string>('transparent');
  const [pattern, setPattern] = useState<string>('SOLID');

  useEventListener(
    'change',
    () => {
      const strokeArray = unique(
        props.diagram.selectionState.elements.map(n => n.props.stroke?.color),
        e => e
      ).filter(Boolean);

      if (strokeArray.length === 0) setStrokeColor('transparent');
      else if (strokeArray.length === 1) setStrokeColor(strokeArray[0]!);
      else setStrokeColor('transparent');

      // TODO: Handle mixed state
      setPattern(props.diagram.selectionState.elements?.[0]?.props?.stroke?.pattern ?? 'SOLID');
    },
    props.diagram.selectionState
  );

  const changeStroke = (c: string) => {
    props.diagram.selectionState.elements.forEach(n => {
      n.props.stroke ??= {};
      n.props.stroke.color = c;
      props.diagram.updateElement(n);
    });
    setStrokeColor(c);
  };

  return (
    <>
      <div className={'cmp-labeled-table'}>
        <div className={'cmp-labeled-table__label'}>Color:</div>
        <div className={'cmp-labeled-table__value'}>
          <ColorPicker
            primaryColors={primaryColors}
            additionalHues={additionalHues}
            color={strokeColor ?? 'transparent'}
            onClick={changeStroke}
          />
        </div>

        <div className={'cmp-labeled-table__row'}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <DashSelector
              value={pattern}
              onValueChange={value => {
                props.diagram.selectionState.elements.forEach(n => {
                  n.props.stroke ??= {};
                  n.props.stroke.pattern = value;
                  props.diagram.updateElement(n);
                });

                setPattern(value!);
              }}
            />
            &nbsp;
            <input
              type={'number'}
              value={100}
              min={1}
              style={{ width: '45px' }}
              onChange={ev => {
                props.diagram.selectionState.edges.forEach(e => {
                  e.props.arrow ??= {};
                  e.props.arrow.end ??= {};
                  e.props.arrow.end.size = ev.target.valueAsNumber;
                  props.diagram.updateElement(e);
                });
              }}
            />
            &nbsp;
            <input
              type={'number'}
              value={100}
              min={1}
              style={{ width: '45px' }}
              onChange={ev => {
                props.diagram.selectionState.edges.forEach(e => {
                  e.props.arrow ??= {};
                  e.props.arrow.end ??= {};
                  e.props.arrow.end.size = ev.target.valueAsNumber;
                  props.diagram.updateElement(e);
                });
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
