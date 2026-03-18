import { useState } from 'react';
import { TransformPanelForm } from './TransformPanelForm';
import { useDiagram } from '../../../application';
import { ToolWindowPanel } from '../ToolWindowPanel';
import type { Box } from '@diagram-craft/geometry/box';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { SnapMarkers } from '@diagram-craft/canvas/snap/snapManager';
import {
  applyEdgeTransform,
  canTransformEdge,
  getEdgeRotation,
  getEdgeTransformBounds
} from './edgeTransform';
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

  if (diagram.selection.type !== 'single-edge') return null;
  const edge = diagram.selection.edges[0];
  if (edge === undefined || !canTransformEdge(edge)) return null;

  const currentBounds = getEdgeTransformBounds(edge);
  if (currentBounds === undefined) return null;

  const transformedBounds = {
    ...getTransformedBounds(currentBounds, origin),
    r: getEdgeRotation(edge)
  };

  const updateBounds = (nextBounds: Box) => {
    const selection = diagram.selection;
    if (selection.type !== 'single-edge') return;

    const edge = selection.edges[0];
    if (edge === undefined) return;

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

    UnitOfWork.executeWithUndo(diagram, 'Transform edge', uow => {
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
        onBoundsChange={updateBounds}
      />
    </ToolWindowPanel>
  );
};
