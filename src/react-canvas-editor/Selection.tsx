import { forwardRef, useImperativeHandle } from 'react';
import { useRedraw } from '../react-canvas-viewer/useRedraw.tsx';
import { Angle } from '../geometry/angle.ts';
import { SelectionState } from '../model/selectionState.ts';
import { $c } from '../utils/classname.ts';
import { Diagram } from '../model/diagram.ts';
import { LabelNodeSelection } from './selection/LabelNodeSelection.tsx';
import { useEventListener } from '../react-app/hooks/useEventListener.ts';
import { GroupBounds } from './selection/GroupBounds.tsx';
import { Guides } from './selection/Guides.tsx';
import { RotationHandle } from './selection/RotationHandle.tsx';
import { ResizeHandles } from './selection/ResizeHandles.tsx';
import { EdgeSelection } from './selection/EdgeSelection.tsx';
import { Box } from '../geometry/box.ts';

export type SelectionApi = {
  repaint: () => void;
};

export const Selection = forwardRef<SelectionApi, Props>((props, ref) => {
  const redraw = useRedraw();

  useImperativeHandle(ref, () => {
    return { repaint: redraw };
  });

  useEventListener(props.selection, 'change', redraw);

  if (props.selection.isEmpty()) return null;

  const isOnlyEdges = props.selection.isEdgesOnly();

  const bounds = props.selection.bounds;

  const labelNode =
    props.selection.getSelectionType() === 'single-label-node'
      ? props.selection.nodes[0].labelNode()!
      : undefined;
  const shouldHaveRotation = !(labelNode && labelNode.type !== 'independent');

  const center = Box.center(bounds);

  return (
    <>
      {!isOnlyEdges && <Guides selection={props.selection} />}

      <g className={'svg-selection'}>
        {!isOnlyEdges && (
          <>
            <GroupBounds selection={props.selection} />
            <g transform={`rotate(${Angle.toDeg(bounds.rotation)} ${center.x} ${center.y})`}>
              <rect
                x={bounds.pos.x}
                y={bounds.pos.y}
                width={bounds.size.w}
                height={bounds.size.h}
                className={$c('svg-selection__bb', { 'only-edges': isOnlyEdges })}
                pointerEvents={'none'}
              />
              {shouldHaveRotation && (
                <RotationHandle diagram={props.diagram} selection={props.selection} />
              )}
              <ResizeHandles diagram={props.diagram} selection={props.selection} />
            </g>
          </>
        )}

        {props.selection.edges.map(e => (
          <EdgeSelection key={e.id} diagram={props.diagram} edge={e} />
        ))}

        {props.selection.nodes
          .filter(n => !!n.labelEdge())
          .map(n => (
            <LabelNodeSelection key={n.id} node={n} />
          ))}
      </g>
    </>
  );
});

type Props = {
  selection: SelectionState;
  diagram: Diagram;
};
