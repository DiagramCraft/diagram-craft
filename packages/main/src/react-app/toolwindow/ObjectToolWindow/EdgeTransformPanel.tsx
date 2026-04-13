import { useState } from 'react';
import { TransformPanelForm } from './TransformPanelForm';
import { useDiagram } from '../../../application';
import { ToolWindowPanel } from '../ToolWindowPanel';
import type { Box } from '@diagram-craft/geometry/box';
import { SnapMarkers } from '@diagram-craft/canvas/snap/snapManager';
import {
  applyEdgeTransform,
  canTransformEdge,
  getEdgeRotation,
  getEdgeTransformBounds
} from '@diagram-craft/model/edgeTransform';
import {
  getBoundsFromTransformedBounds,
  getTransformedBounds,
  type TransformOrigin
} from './transformPanelUtils';
import { useEventListener } from '../../hooks/useEventListener';
import { useRedraw } from '../../hooks/useRedraw';

type Props = {
  mode?: 'accordion' | 'panel';
};

export const EdgeTransformPanel = (props: Props) => {
  const diagram = useDiagram();
  const [lockAspectRatio, setLockAspectRatio] = useState(false);
  const [origin, setOrigin] = useState<TransformOrigin>('tl');
  const redraw = useRedraw();

  useEventListener(diagram.selection, 'change', redraw);
  useEventListener(diagram, 'elementChange', redraw);

  const selection = diagram.selection;
  if (selection.type !== 'single-edge' && selection.type !== 'edges') return null;

  const edge = selection.type === 'single-edge' ? selection.edges[0] : undefined;
  const editable = edge !== undefined && canTransformEdge(edge);
  const baseBounds =
    editable && edge !== undefined
      ? getEdgeTransformBounds(edge)
      : selection.isEdgesOnly()
        ? selection.bounds
        : undefined;

  if (baseBounds === undefined) return null;

  const transformedBounds = {
    ...getTransformedBounds(baseBounds, origin),
    r: edge ? getEdgeRotation(edge) : baseBounds.r
  };

  const updateBounds = (nextBounds: Box) => {
    const selection = diagram.selection;
    if (selection.type !== 'single-edge') return;

    const edge = selection.edges[0];
    if (edge === undefined || !canTransformEdge(edge)) return;

    const currentBounds = getEdgeTransformBounds(edge);
    if (currentBounds === undefined) return;
    const currentTransformedBounds = {
      ...getTransformedBounds(currentBounds, origin),
      r: getEdgeRotation(edge)
    };
    const absoluteBounds = getBoundsFromTransformedBounds(
      nextBounds,
      currentTransformedBounds,
      origin
    );

    diagram.undoManager.execute('Transform edge', uow => {
      applyEdgeTransform(
        edge,
        { ...currentBounds, r: currentTransformedBounds.r },
        absoluteBounds,
        uow
      );
      SnapMarkers.get(diagram).clear();
    });
  };

  return (
    <ToolWindowPanel
      mode={props.mode ?? 'accordion'}
      id="transform"
      title={'Transform'}
      hasCheckbox={false}
    >
      <TransformPanelForm
        bounds={transformedBounds}
        origin={origin}
        setOrigin={setOrigin}
        lockAspectRatio={lockAspectRatio}
        setLockAspectRatio={setLockAspectRatio}
        readOnly={!editable}
        disabled={
          editable
            ? undefined
            : {
                x: true,
                y: true,
                w: true,
                h: true,
                r: true
              }
        }
        onBoundsChange={updateBounds}
      />
    </ToolWindowPanel>
  );
};
