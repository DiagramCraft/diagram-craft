import * as Popover from '@radix-ui/react-popover';
import { TbX } from 'react-icons/tb';
import { useDiagram } from './context/DiagramContext';
import { PickerCanvas } from './PickerCanvas';
import { assert } from '@diagram-craft/utils/assert';
import { useCallback } from 'react';
import { Point } from '@diagram-craft/geometry/point';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { ConnectedEndpoint } from '@diagram-craft/model/endpoint';
import { Diagram } from '@diagram-craft/model/diagram';
import { Layer } from '@diagram-craft/model/diagramLayer';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { newid } from '@diagram-craft/utils/id';
import { Stencil } from '@diagram-craft/model/elementDefinitionRegistry';

export const NodeTypePopup = (props: Props) => {
  const diagram = useDiagram();

  const addNode = useCallback(
    (registration: Stencil) => {
      const diagramPosition = diagram.viewBox.toDiagramPoint(props.position);

      const dimension = 50;
      const nodePosition = Point.subtract(diagramPosition, Point.of(dimension / 2, dimension / 2));

      UnitOfWork.execute(diagram, uow => {
        const node = new DiagramNode(
          newid(),
          registration.node.type,
          {
            x: nodePosition.x,
            y: nodePosition.y,
            w: dimension,
            h: dimension,
            r: 0
          },
          diagram,
          diagram.layers.active
        );
        diagram.layers.active.addElement(node, uow);

        const edge = diagram.edgeLookup.get(props.edgeId);
        assert.present(edge);

        edge.setEnd(new ConnectedEndpoint(0, node), uow);
      });

      props.onClose();
    },
    [diagram, props]
  );

  const undo = useCallback(() => {
    const edge = diagram.edgeLookup.get(props.edgeId);
    assert.present(edge);
    UnitOfWork.execute(diagram, uow => {
      edge.layer.removeElement(edge, uow);
    });
    diagram.selectionState.clear();
  }, [diagram, props.edgeId]);

  const size = 20;

  // TODO: Support aspect ratio

  // TODO: Add some smartness to select recent node types and/or node types suggested by the source
  //       node type
  const nodes = diagram.document.nodeDefinitions.getForGroup(undefined);
  const diagrams = nodes
    .filter(r => !r.hidden)
    .map(r => r.node)
    .map(n => {
      const dest = new Diagram(
        n.type,
        n.type,
        new DiagramDocument(diagram.document.nodeDefinitions, diagram.document.edgeDefinitions)
      );
      dest.layers.add(new Layer('default', 'Default', [], dest), UnitOfWork.throwaway(dest));
      dest.layers.active.addElement(
        new DiagramNode(
          n.type,
          n.type,
          {
            x: 1,
            y: 1,
            w: size - 2,
            h: size - 2,
            r: 0
          },
          dest,
          dest.layers.active,
          n.getDefaultProps('picker')
        ),
        new UnitOfWork(dest)
      );
      return dest;
    });

  return (
    <Popover.Root
      open={props.isOpen}
      onOpenChange={s => {
        if (!s) {
          undo();
          props.onClose();
        }
      }}
    >
      <Popover.Anchor asChild>
        <div
          style={{
            position: 'absolute',
            left: `${props.position.x}px`,
            top: `${props.position.y}px`
          }}
        ></div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          className="cmp-popover cmp-node-type-popup"
          sideOffset={5}
          style={{ maxWidth: '8rem' }}
        >
          <div
            className={'cmp-object-picker'}
            style={{ marginTop: '0.1rem', border: '1px solid transparent' }}
          >
            {diagrams.map((d, idx) => (
              <div key={idx} style={{ background: 'transparent' }}>
                <PickerCanvas
                  width={size}
                  height={size}
                  diagram={d}
                  onClick={() => addNode(nodes[idx])}
                />
              </div>
            ))}
          </div>
          <Popover.Close className="cmp-popover__close" aria-label="Close" onClick={props.onClose}>
            <TbX />
          </Popover.Close>
          <Popover.Arrow className="cmp-popover__arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
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
