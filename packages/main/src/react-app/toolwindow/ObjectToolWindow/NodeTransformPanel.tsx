import { useEffect, useState } from 'react';
import { TbFlipHorizontal, TbFlipVertical } from 'react-icons/tb';
import { Box } from '@diagram-craft/geometry/box';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import { useNodeProperty } from '../../hooks/useProperty';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { ToggleButton } from '@diagram-craft/app-components/ToggleButton';
import { useDiagram } from '../../../application';
import { isNode, transformElements } from '@diagram-craft/model/diagramElement';
import { assert } from '@diagram-craft/utils/assert';
import { SnapMarkers } from '@diagram-craft/canvas/snap/snapManager';
import { KeyValueTable } from '@diagram-craft/app-components/KeyValueTable';
import { TransformPanelForm } from './TransformPanelForm';
import {
  getBoundsFromTransformedBounds,
  getTransformedBounds,
  type TransformOrigin
} from './transformPanelUtils';

export const NodeTransformPanel = (props: Props) => {
  const diagram = useDiagram();

  const [bounds, setBounds] = useState<Box | undefined>(undefined);
  const [lockAspectRatio, setLockAspectRatio] = useState(false);
  const [origin, setOrigin] = useState<TransformOrigin>('tl');

  const flipV = useNodeProperty(diagram, 'geometry.flipV');
  const flipH = useNodeProperty(diagram, 'geometry.flipH');

  const getRelativeCoordinates = () => {
    if (!bounds) return { x: 0, y: 0 };

    const selectedNode = diagram.selection.nodes[0];
    const parent = selectedNode?.parent;

    // If the node has a parent group, calculate relative coordinates
    if (
      parent &&
      isNode(parent) &&
      parent.nodeType === 'group' &&
      diagram.selection.nodes.length === 1
    ) {
      return {
        x: bounds.x - parent.bounds.x,
        y: bounds.y - parent.bounds.y
      };
    }

    // Otherwise, use absolute coordinates
    return { x: bounds.x, y: bounds.y };
  };

  const relativeCoords = getRelativeCoordinates();

  const editableBounds = bounds ? { ...bounds, ...relativeCoords } : undefined;
  const transformedBounds = getTransformedBounds(editableBounds, origin);

  const rotatable = diagram.selection.nodes.every(
    p => p.renderProps.capabilities.rotatable !== false
  );
  const resizeableVertically = diagram.selection.nodes.every(
    p => p.renderProps.capabilities.resizable.vertical !== false
  );
  const resizeableHorizontally = diagram.selection.nodes.every(
    p => p.renderProps.capabilities.resizable.horizontal !== false
  );
  const movable = diagram.selection.nodes.every(p => p.renderProps.capabilities.movable !== false);

  useEffect(() => {
    const callback = () => {
      const selection = diagram.selection;
      if (selection.type === 'single-node') {
        setBounds(selection.nodes[0]!.bounds);
      } else {
        setBounds(undefined);
      }
    };
    callback();

    diagram.selection.on('change', callback);
    return () => {
      diagram.selection.off('change', callback);
    };
  }, [diagram.selection]);

  // TODO: This seems a bit complicated just to move an element
  //       ... especially all of the updating of the selection state
  const updateBounds = (nextBounds: Box) => {
    const selectedElement = diagram.selection.elements[0];
    assert.present(selectedElement);

    const selectedNode = diagram.selection.nodes[0];
    const parent = selectedNode?.parent;
    const currentBounds = selectedElement.bounds;
    const currentRelativeBounds =
      parent && isNode(parent) && parent.nodeType === 'group'
        ? {
            ...currentBounds,
            x: currentBounds.x - parent.bounds.x,
            y: currentBounds.y - parent.bounds.y
          }
        : currentBounds;

    const currentTransformedBounds = getTransformedBounds(currentRelativeBounds, origin);
    const newBounds = {
      ...getBoundsFromTransformedBounds(nextBounds, currentTransformedBounds, origin)
    };

    if (parent && isNode(parent) && parent.nodeType === 'group') {
      newBounds.x += parent.bounds.x;
      newBounds.y += parent.bounds.y;
    }

    diagram.undoManager.execute('Transform node', uow => {
      const transforms = TransformFactory.fromTo(selectedElement.bounds, newBounds);
      transformElements([selectedElement], transforms, uow);
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
        disabled={{
          x: !movable,
          y: !movable,
          w: !resizeableHorizontally,
          h: !resizeableVertically,
          r: !rotatable
        }}
        onBoundsChange={updateBounds}
        extraRows={
          <>
            <KeyValueTable.Label>Flip</KeyValueTable.Label>
            <KeyValueTable.Value stack={'horizontal'}>
              <ToggleButton value={flipV.val} onChange={flipV.set}>
                <TbFlipHorizontal />
              </ToggleButton>
              <ToggleButton value={flipH.val} onChange={flipH.set}>
                <TbFlipVertical />
              </ToggleButton>
            </KeyValueTable.Value>
          </>
        }
      />
    </ToolWindowPanel>
  );
};

type Props = {
  mode?: 'accordion' | 'panel';
};
