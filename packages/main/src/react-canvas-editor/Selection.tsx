import { forwardRef, useImperativeHandle } from 'react';
import { useRedraw } from '../react-canvas-viewer/useRedraw.tsx';
import { Angle } from '../geometry/angle.ts';
import { $c } from '../utils/classname.ts';
import { LabelNodeSelection } from './selection/LabelNodeSelection.tsx';
import { useEventListener } from '../react-app/hooks/useEventListener.ts';
import { GroupBounds } from './selection/GroupBounds.tsx';
import { Guides } from './selection/Guides.tsx';
import { RotationHandle } from './selection/RotationHandle.tsx';
import { ResizeHandles } from './selection/ResizeHandles.tsx';
import { EdgeSelection } from './selection/EdgeSelection.tsx';
import { Box } from '../geometry/box.ts';
import { useDiagram } from '../react-app/context/DiagramContext.ts';

export type SelectionApi = {
  repaint: () => void;
};

export const Selection = forwardRef<SelectionApi, unknown>((_props, ref) => {
  const redraw = useRedraw();
  const diagram = useDiagram();
  const selection = diagram.selectionState;

  useImperativeHandle(ref, () => {
    return { repaint: redraw };
  });

  useEventListener(selection, 'change', redraw);

  if (selection.isEmpty()) return null;

  const isOnlyEdges = selection.isEdgesOnly();

  const bounds = selection.bounds;

  const labelNode =
    selection.getSelectionType() === 'single-label-node'
      ? selection.nodes[0].labelNode()!
      : undefined;
  const shouldHaveRotation = !(labelNode && labelNode.type !== 'independent');

  const center = Box.center(bounds);

  return (
    <>
      {!isOnlyEdges && <Guides selection={selection} />}

      <g className={'svg-selection'}>
        {!isOnlyEdges && (
          <>
            <GroupBounds selection={selection} />
            <g transform={`rotate(${Angle.toDeg(bounds.r)} ${center.x} ${center.y})`}>
              <rect
                x={bounds.x}
                y={bounds.y}
                width={bounds.w}
                height={bounds.h}
                className={$c('svg-selection__bb', {
                  'only-edges': isOnlyEdges,
                  dragging: selection.isDragging()
                })}
                pointerEvents={'none'}
              />
              {!selection.isDragging() && (
                <>
                  {shouldHaveRotation && <RotationHandle />}
                  <ResizeHandles />
                </>
              )}
            </g>
          </>
        )}

        {selection.edges.map(e => (
          <EdgeSelection key={e.id} edge={e} />
        ))}

        {selection.nodes
          .filter(n => !!n.labelEdge())
          .map(n => (
            <LabelNodeSelection key={n.id} node={n} />
          ))}
      </g>
    </>
  );
});
