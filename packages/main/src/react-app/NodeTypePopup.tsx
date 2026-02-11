import { PickerCanvas } from './PickerCanvas';
import { assert, mustExist } from '@diagram-craft/utils/assert';
import { useCallback, useEffect, useRef } from 'react';
import { Point } from '@diagram-craft/geometry/point';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { AnchorEndpoint } from '@diagram-craft/model/endpoint';
import { Diagram } from '@diagram-craft/model/diagram';
import {
  addStencilStylesToDocument,
  copyStyles,
  Stencil,
  stencilScaleStrokes
} from '@diagram-craft/model/stencilRegistry';
import { assignNewBounds, cloneElements } from '@diagram-craft/model/diagramElementUtils';
import { Popover } from '@diagram-craft/app-components/Popover';
import { useDiagram } from '../application';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import type { DiagramNode } from '@diagram-craft/model/diagramNode';
import { LineEndIcon } from './icons/LineEndIcon';

export const NodeTypePopup = (props: Props) => {
  const diagram = useDiagram();
  const anchorRef = useRef<HTMLDivElement>(null);

  const addNode = useCallback(
    (stencil: Stencil) => {
      const sourceNode = mustExist(diagram.nodeLookup.get(props.nodeId));
      const diagramPosition = diagram.viewBox.toDiagramPoint(props.position);

      const dimension = 50;
      const nodePosition = Point.subtract(diagramPosition, Point.of(dimension / 2, dimension / 2));

      const layer = diagram.activeLayer;
      assertRegularLayer(layer);

      const registry = diagram.document.registry;

      UnitOfWork.executeWithUndo(diagram, 'Add element', uow => {
        const els = cloneElements(stencil.forPicker(registry).elements, layer, uow);
        assert.arrayWithExactlyOneElement(els);
        const node = els[0]! as DiagramNode;

        layer.addElement(node, uow);

        assignNewBounds([node], nodePosition, { x: 1, y: 1 }, uow);
        node.updateMetadata(meta => {
          meta.style = sourceNode.metadata.style ?? diagram.document.styles.activeNodeStylesheet.id;
          meta.textStyle =
            sourceNode.metadata.textStyle ?? diagram.document.styles.activeTextStylesheet.id;
        }, uow);

        const edge = mustExist(diagram.edgeLookup.get(props.edgeId));
        edge.setEnd(new AnchorEndpoint(node, 'c'), uow);

        uow.diagram.undoManager.getToMark().forEach(a => uow.add(a));
      });
      diagram.document.props.recentStencils.register(stencil.id);

      props.onClose();
    },
    [diagram, props]
  );

  const undo = useCallback(() => {
    const edge = diagram.edgeLookup.get(props.edgeId);
    assert.present(edge);
    UnitOfWork.execute(diagram, uow => {
      assertRegularLayer(edge.layer);
      edge.layer.removeElement(edge, uow);
    });
    diagram.selection.clear();
  }, [diagram, props.edgeId]);

  const size = 30;

  // TODO: Support aspect ratio

  // TODO: Add some smartness to select recent node types and/or node types suggested by the source
  //       node type
  const nodes = diagram.document.registry.stencils.get('default').stencils;
  const diagramsAndNodes: Array<[Stencil, Diagram]> = nodes.map(n => {
    // TODO: Can we use createThumbnail here somehow
    const { elements, diagram: dest } = n.forPicker(diagram.document.registry);
    assert.arrayWithExactlyOneElement(elements);
    const node = elements[0]! as DiagramNode;

    dest.viewBox.dimensions = { w: node.bounds.w + 10, h: node.bounds.h + 10 };
    dest.viewBox.offset = { x: -5, y: -5 };

    UnitOfWork.execute(diagram, uow => {
      addStencilStylesToDocument(n, diagram.document, uow);
      copyStyles(dest, diagram.document, uow);
    });

    return [n, dest];
  });

  // Cleanup documents when they change or component unmounts
  useEffect(() => {
    return () => {
      diagramsAndNodes.forEach(([_, d]) => d.document.release());
    };
  }, [diagramsAndNodes]);

  if (!(diagram.activeLayer instanceof RegularLayer)) return <div></div>;

  return (
    <>
      <div
        ref={anchorRef}
        style={{
          position: 'absolute',
          left: `${props.position.x}px`,
          top: `${props.position.y}px`
        }}
      ></div>
      <Popover.Root
        open={props.isOpen}
        onOpenChange={s => {
          if (!s) {
            undo();
            props.onClose();
          }
        }}
      >
        <Popover.Content className="cmp-node-type-popup" sideOffset={5} anchor={anchorRef}>
          <div
            className={'cmp-object-picker'}
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
              onClick={() => props.onClose()}
            >
              <LineEndIcon />
            </div>
            {diagramsAndNodes.map(([stencil, d], idx) => (
              <div key={idx} style={{ background: 'transparent' }}>
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
  edgeId: '',
  nodeId: ''
};

export type NodeTypePopupState = {
  position: Point;
  isOpen: boolean;
  edgeId: string;
  nodeId: string;
};

type Props = NodeTypePopupState & {
  onClose: () => void;
};
