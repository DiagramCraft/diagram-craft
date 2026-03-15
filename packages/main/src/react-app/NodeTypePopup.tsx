import { PickerCanvas } from './PickerCanvas';
import { assert, mustExist } from '@diagram-craft/utils/assert';
import { useCallback, useEffect, useRef } from 'react';
import { FreeEndpoint } from '@diagram-craft/model/endpoint';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Diagram } from '@diagram-craft/model/diagram';
import { addStencilStylesToDocument, applyStencilToNode } from '@diagram-craft/model/stencilUtils';
import { copyStyles, Stencil, stencilScaleStrokes } from '@diagram-craft/model/stencilRegistry';
import { Popover } from '@diagram-craft/app-components/Popover';
import { useDiagram } from '../application';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import type { DiagramNode } from '@diagram-craft/model/diagramNode';
import { LineEndIcon } from './icons/LineEndIcon';
import styles from './NodeTypePopup.module.css';
import objectPickerStyles from './ObjectPicker.module.css';
import type { Point } from '@diagram-craft/geometry/point';
import { CompoundUndoableAction } from '@diagram-craft/model/undoManager';

// This is here to avoid creating all thumbnails on initial load
// We cannot simply rely on props.isOpen to determine if thumbnails should be created
// as props.isOpen will be false during the closing animation of the popover
let hasBeenOpen = false;

export const NodeTypePopup = ({ position, isOpen, nodeId, edgeId, onClose }: Props) => {
  const diagram = useDiagram();
  const anchorRef = useRef<HTMLDivElement>(null);
  const preferredSide =
    typeof window === 'undefined' || position.y <= window.innerHeight / 2 ? 'bottom' : 'top';

  hasBeenOpen ||= isOpen;

  const addNode = useCallback(
    (stencil: Stencil) => {
      const node = mustExist(diagram.nodeLookup.get(nodeId));
      const layer = node.layer;
      assertRegularLayer(layer);

      UnitOfWork.executeWithUndo(diagram, 'Change shape', uow => {
        applyStencilToNode(diagram, node, layer, stencil, uow);
      });

      const actions = diagram.undoManager.getToMark();
      diagram.undoManager.add(new CompoundUndoableAction(actions));
      diagram.undoManager.setMark();

      diagram.document.props.recentStencils.register(stencil.id);

      onClose();
    },
    [diagram, nodeId, onClose]
  );

  const keepOnlyEdge = useCallback(() => {
    const node = mustExist(diagram.nodeLookup.get(nodeId));
    const edge = mustExist(diagram.edgeLookup.get(edgeId));
    const diagramPoint = diagram.viewBox.toDiagramPoint(position);

    UnitOfWork.executeWithUndo(diagram, 'Keep edge only', uow => {
      edge.setEnd(new FreeEndpoint(diagramPoint), uow);
      node.layer.removeElement(node, uow);
      uow.select(diagram, [edge]);
    });

    const actions = diagram.undoManager.getToMark();
    diagram.undoManager.add(new CompoundUndoableAction(actions));
    diagram.undoManager.setMark();

    onClose();
  }, [diagram, edgeId, nodeId, onClose, position]);

  const size = 30;

  // TODO: Support aspect ratio

  // TODO: Add some smartness to select recent node types and/or node types suggested by the source
  //       node type

  const nodes = diagram.document.registry.stencils.get('default').stencils;
  const diagramsAndNodes: Array<[Stencil, Diagram]> = hasBeenOpen
    ? nodes.map(n => {
        // TODO: Can we use createThumbnail here somehow
        const { elements, diagram: dest } = n.forPicker(diagram.document.registry);
        assert.arrayWithExactlyOneElement(elements);
        const node = elements[0]! as DiagramNode;

        dest.viewBox.dimensions = { w: node.bounds.w + 10, h: node.bounds.h + 10 };
        dest.viewBox.offset = { x: -5, y: -5 };

        UnitOfWork.execute(dest, uow => {
          addStencilStylesToDocument(n, dest.document, uow);
          copyStyles(dest, diagram.document, uow);
        });

        return [n, dest];
      })
    : [];

  // Cleanup documents when they change or component unmounts
  useEffect(() => {
    return () => {
      diagramsAndNodes.forEach(([_, d]) => d.document.release());
    };
  }, [diagramsAndNodes]);

  useEffect(() => {
    if (!isOpen) return;

    const timeoutId = window.setTimeout(() => {
      onClose();
    }, 3000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isOpen, onClose]);

  if (!(diagram.activeLayer instanceof RegularLayer)) return <div></div>;

  return (
    <>
      <div
        ref={anchorRef}
        style={{
          position: 'absolute',
          left: `${position.x}px`,
          top: `${position.y}px`
        }}
      ></div>
      <Popover.Root
        open={isOpen}
        onOpenChange={s => {
          if (!s) {
            onClose();
          }
        }}
      >
        <Popover.Content
          className={styles.icNodeTypePopup}
          sideOffset={5}
          side={preferredSide}
          arrow={false}
          collisionAvoidance={{ side: 'none', align: 'shift', fallbackAxisSide: 'none' }}
          anchor={anchorRef}
        >
          <div
            className={objectPickerStyles.icObjectPicker}
            style={{ marginTop: '0.1rem', border: '1px solid transparent' }}
          >
            <div
              style={{
                background: 'var(--cmp-bg)',
                width: `calc(${size}px + 0.4rem)`,
                height: `calc(${size}px + 0.4rem)`,
                border: '1px solid var(--cmp-fg-dimmed)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--cmp-radius)'
              }}
              onClick={keepOnlyEdge}
            >
              <LineEndIcon />
            </div>
            {diagramsAndNodes.map(([stencil, d]) => (
              <div key={stencil.id} style={{ background: 'transparent' }}>
                <PickerCanvas
                  name={d.name}
                  size={size}
                  diagram={d}
                  onMouseDown={() => addNode(stencil)}
                  scaleStrokes={stencilScaleStrokes(stencil)}
                />
              </div>
            ))}
          </div>
        </Popover.Content>
      </Popover.Root>
    </>
  );
};

NodeTypePopup.INITIAL_STATE = {
  position: { x: 600, y: 200 },
  isOpen: false,
  nodeId: '',
  edgeId: ''
};

export type NodeTypePopupState = {
  position: Point;
  isOpen: boolean;
  nodeId: string;
  edgeId: string;
};

type Props = NodeTypePopupState & {
  onClose: () => void;
};
