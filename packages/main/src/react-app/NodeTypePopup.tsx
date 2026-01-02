import { PickerCanvas } from './PickerCanvas';
import { assert } from '@diagram-craft/utils/assert';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Point } from '@diagram-craft/geometry/point';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { AnchorEndpoint } from '@diagram-craft/model/endpoint';
import { Diagram, DocumentBuilder } from '@diagram-craft/model/diagram';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { Stencil } from '@diagram-craft/model/elementDefinitionRegistry';
import { SnapshotUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import { CompoundUndoableAction } from '@diagram-craft/model/undoManager';
import { assignNewBounds, cloneElements } from '@diagram-craft/model/diagramElementUtils';
import { Popover } from '@diagram-craft/app-components/Popover';
import { useDiagram } from '../application';
import { NoOpCRDTRoot } from '@diagram-craft/collaboration/noopCrdt';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import type { DiagramNode } from '@diagram-craft/model/diagramNode';
import { UOW } from '@diagram-craft/model/uow';

export const NodeTypePopup = (props: Props) => {
  const diagram = useDiagram();
  const anchorRef = useRef<HTMLDivElement>(null);

  const addNode = useCallback(
    (registration: Stencil) => {
      const diagramPosition = diagram.viewBox.toDiagramPoint(props.position);

      const dimension = 50;
      const nodePosition = Point.subtract(diagramPosition, Point.of(dimension / 2, dimension / 2));

      UOW.execute(diagram, () => {
        assertRegularLayer(diagram.activeLayer);
        const node = cloneElements(
          [registration.node(diagram)],
          diagram.activeLayer
        )[0] as DiagramNode;

        assignNewBounds([node], nodePosition, { x: 1, y: 1 }, UOW.uow());
        node.updateMetadata(meta => {
          meta.style = diagram.document.styles.activeNodeStylesheet.id;
          meta.textStyle = diagram.document.styles.activeTextStylesheet.id;
        }, UOW.uow());

        assertRegularLayer(diagram.activeLayer);
        diagram.activeLayer.addElement(node, UOW.uow());

        const edge = diagram.edgeLookup.get(props.edgeId);
        assert.present(edge);

        edge.setEnd(new AnchorEndpoint(node, 'c'), UOW.uow());

        const snapshots = UOW.uow().commit();

        // The last action on the undo stack is adding the edge, so we need to pop it and
        // add a compound action
        UOW.uow().diagram.undoManager.add(
          new CompoundUndoableAction([
            ...UOW.uow().diagram.undoManager.getToMark(),
            new SnapshotUndoableAction('Add element', UOW.uow().diagram, snapshots)
          ])
        );

        diagram.document.props.recentStencils.register(registration.id);

        props.onClose();
      });
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
  const diagramsAndNodes: Array<[Stencil, Diagram]> = useMemo(() => {
    const nodes = diagram.document.nodeDefinitions.stencilRegistry.get('default').stencils;
    return nodes.map(n => {
      const { diagram: dest, layer } = DocumentBuilder.empty(
        n.id,
        n.name ?? n.id,
        new DiagramDocument(
          diagram.document.nodeDefinitions,
          diagram.document.edgeDefinitions,
          true,
          new NoOpCRDTRoot()
        )
      );

      const node = n.node(dest);
      dest.viewBox.dimensions = { w: node.bounds.w + 10, h: node.bounds.h + 10 };
      dest.viewBox.offset = { x: -5, y: -5 };
      layer.addElement(node, UnitOfWork.immediate(dest));

      return [n, dest];
    });
  }, [diagram]);

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
            {diagramsAndNodes.map(([stencil, d], idx) => (
              <div key={idx} style={{ background: 'transparent' }}>
                <PickerCanvas
                  name={d.name}
                  width={size}
                  height={size}
                  diagramWidth={d.viewBox.dimensions.w}
                  diagramHeight={d.viewBox.dimensions.h}
                  diagram={d}
                  onMouseDown={() => addNode(stencil)}
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
