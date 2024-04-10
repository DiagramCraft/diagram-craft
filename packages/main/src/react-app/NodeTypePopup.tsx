import * as Popover from '@radix-ui/react-popover';
import { TbX } from 'react-icons/tb';
import { Diagram } from '@diagram-craft/model';
import { useDiagram } from './context/DiagramContext';
import { Layer } from '@diagram-craft/model';
import { DiagramNode } from '@diagram-craft/model';
import { UnitOfWork } from '@diagram-craft/model';
import { PickerCanvas } from './PickerCanvas';
import { assert } from '@diagram-craft/utils';
import { useCallback } from 'react';
import { newid } from '@diagram-craft/utils';
import { ConnectedEndpoint } from '@diagram-craft/model';
import { DiagramDocument } from '@diagram-craft/model';
import { Point } from '@diagram-craft/geometry/point';

export const NodeTypePopup = (props: Props) => {
  const diagram = useDiagram();
  const nodes = diagram.nodeDefinitions.getAll();

  const addNode = useCallback(
    (nodeType: string) => {
      const diagramPosition = diagram.viewBox.toDiagramPoint(props.position);

      const dimension = 50;
      const nodePosition = Point.subtract(diagramPosition, Point.of(dimension / 2, dimension / 2));

      UnitOfWork.execute(diagram, uow => {
        const node = new DiagramNode(
          newid(),
          nodeType,
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

  // TODO: Add some smartness to select recent node types and/or node types suggested by the source
  //       node type
  const diagrams = nodes
    .filter(n => n.type !== 'group')
    .map(n => {
      const dest = new Diagram(n.type, n.type, diagram.nodeDefinitions, diagram.edgeDefinitions);
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
          dest.layers.active
        ),
        new UnitOfWork(dest)
      );
      dest.document = new DiagramDocument([dest]);
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
                  onClick={() => addNode(nodes[idx].type)}
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
