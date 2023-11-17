import { ToolWindowAccordion } from './ToolWindowAccordion.tsx';
import { EditableDiagram } from '../model-editor/editable-diagram.ts';
import { useEffect, useState } from 'react';
import { SelectionStateEvents } from '../model-editor/selectionState.ts';
import { Angle } from '../geometry/angle.ts';
import { round } from '../utils/math.ts';

type State = {
  id?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  rotation?: number;
};

export const InfoToolWindow = (props: Props) => {
  const [state, setState] = useState<State>({});

  useEffect(() => {
    const onSelection = ({ selection }: SelectionStateEvents['change']) => {
      if (selection.elements.length !== 1 || selection.edges.length === 1) {
        setState({});
      }

      if (selection.elements.length > 1) {
        setState({
          id: '<selection>',
          x: round(selection.bounds.pos.x),
          y: round(selection.bounds.pos.y),
          w: round(selection.bounds.size.w),
          h: round(selection.bounds.size.h),
          rotation: round(Angle.toDeg(selection.bounds.rotation))
        });
      } else if (selection.nodes.length === 1) {
        const element = selection.elements[0];
        setState({
          id: element.id,
          x: round(element.bounds.pos.x),
          y: round(element.bounds.pos.y),
          w: round(element.bounds.size.w),
          h: round(element.bounds.size.h),
          rotation: round(Angle.toDeg(element.bounds.rotation))
        });
      } else if (selection.edges.length === 1) {
        const edge = selection.elements[0];
        setState({
          id: edge.id
        });
      }
    };

    props.diagram.selectionState.on('change', onSelection);
    return () => {
      props.diagram.selectionState.off('change', onSelection);
    };
  }, [props.diagram]);

  return (
    <ToolWindowAccordion title={'Info'}>
      <dl>
        <dt>Id:</dt>
        <dd>{state.id ?? '-'}</dd>

        <dt>X:</dt>
        <dd>{state.x ?? '-'}</dd>

        <dt>Y:</dt>
        <dd>{state.y ?? '-'}</dd>

        <dt>W:</dt>
        <dd>{state.w ?? '-'}</dd>

        <dt>H:</dt>
        <dd>{state.h ?? '-'}</dd>

        <dt>Rotation:</dt>
        <dd>{state.rotation ?? '-'}</dd>
      </dl>
    </ToolWindowAccordion>
  );
};

type Props = {
  diagram: EditableDiagram;
};
