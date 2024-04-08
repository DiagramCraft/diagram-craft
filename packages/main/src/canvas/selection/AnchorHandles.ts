import { ApplicationState } from '../../base-ui/ApplicationState.ts';
import { DiagramElement, isNode } from '../../model/diagramElement.ts';
import { DRAG_DROP_MANAGER } from '../DragDropManager.ts';
import { AbstractDrag, Modifiers } from '../../base-ui/drag/dragDropManager.ts';
import { Point } from '../../geometry/point.ts';
import { DiagramNode } from '../../model/diagramNode.ts';
import { DiagramEdge } from '../../model/diagramEdge.ts';
import { newid } from '../../utils/id.ts';
import { ElementAddUndoableAction } from '../../model/diagramUndoActions.ts';
import { EventHelper } from '../../base-ui/eventHelper.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { EdgeEndpointMoveDrag } from '../../base-ui/drag/edgeEndpointMoveDrag.ts';
import { MoveDrag } from '../../base-ui/drag/moveDrag.ts';
import { ApplicationTriggers } from '../EditableCanvas.tsx';
import { VerifyNotReached } from '../../utils/assert.ts';
import { ConnectedEndpoint, FreeEndpoint, isConnected } from '../../model/endpoint.ts';
import { Component, createEffect } from '../../base-ui/component.ts';
import { Diagram } from '../../model/diagram.ts';
import * as svg from '../../base-ui/vdom-svg.ts';
import { VNode } from '../../base-ui/vdom.ts';

class AnchorHandleDrag extends AbstractDrag {
  edge: DiagramEdge;
  private delegate: EdgeEndpointMoveDrag;

  constructor(
    private readonly node: DiagramNode,
    private readonly anchorIndex: number,
    private readonly point: Point,
    private readonly applicationTriggers: ApplicationTriggers
  ) {
    super();

    const diagram = this.node.diagram;

    this.edge = new DiagramEdge(
      newid(),
      new ConnectedEndpoint(this.anchorIndex, this.node),
      new FreeEndpoint(diagram.viewBox.toDiagramPoint(this.point)),
      {},
      [],
      diagram,
      diagram.layers.active
    );

    const uow = new UnitOfWork(diagram);
    diagram.layers.active.addElement(this.edge, uow);

    uow.updateElement(this.node);
    uow.commit();

    diagram.selectionState.setElements([this.edge]);

    // TODO: This is the wrong this.element to use
    this.delegate = new EdgeEndpointMoveDrag(diagram, this.edge, 'end');
  }

  onDragEnd() {
    const diagram = this.node.diagram;

    if (
      this.delegate.coord === undefined ||
      Point.distance(this.delegate.coord!, diagram.viewBox.toDiagramPoint(this.point)) < 5
    ) {
      UnitOfWork.execute(this.node.diagram, uow => {
        this.edge.layer.removeElement(this.edge, uow);
        this.edge.detach(uow);
      });
      diagram.selectionState.setElements([]);
      return;
    }

    this.node.diagram.undoManager.add(new ElementAddUndoableAction([this.edge], this.node.diagram));

    // TODO: Need to prevent undoable action from being added twice
    this.delegate.onDragEnd();

    // In case we have connected to an existing node, we don't need to show the popup
    if (isConnected(this.edge.end)) {
      return;
    }

    const startNode = this.edge.start;
    if (!isConnected(startNode)) throw new VerifyNotReached();
    this.applicationTriggers.showNodeLinkPopup?.(
      this.edge.end.position,
      startNode.node!.id,
      this.edge.id
    );
  }

  onDrag(coord: Point, _modifiers: Modifiers): void {
    this.delegate.onDrag(coord);
  }

  onDragEnter(id: string) {
    this.delegate.onDragEnter(id);
  }

  onDragLeave() {
    this.delegate.onDragLeave();
  }
}

// TODO: All these timeouts are a bit ugly... should find a better way
//       to describe the state machine - or somehow subscribe to mouse move events
//       to trigger the hiding of the handles
//
// TODO: This needs some refactoring :) state in the component, the listeners, state in
//       the render function - all a bit of a mess
export class AnchorHandlesComponent extends Component<Props> {
  private hoverNode: DiagramElement | undefined;
  private state: 'background' | 'node' | 'handle' = 'background';
  private timeout: number | undefined = undefined;
  private shouldScale: boolean = false;

  setHoverNode(node: DiagramElement | undefined) {
    this.hoverNode = node;
    this.redraw();
  }

  render(props: Props) {
    const diagram = props.diagram;

    const selection = diagram.selectionState;
    this.shouldScale = selection.nodes.length === 1 && selection.nodes[0] === this.hoverNode;

    createEffect(() => {
      const cb = ({ element }: { element: string | undefined }) => {
        if (this.timeout) clearTimeout(this.timeout);
        if (element === undefined) {
          this.triggerMouseOut();
        } else {
          this.timeout = undefined;
          this.state = 'node';
          this.setHoverNode(diagram.lookup(element));
        }
      };
      props.applicationState.on('hoverElementChange', cb);
      return () => props.applicationState.off('hoverElementChange', cb);
    }, [props.applicationState]);

    createEffect(() => {
      const cb = () => {
        if (this.timeout) clearTimeout(this.timeout);
        this.redraw();
      };
      diagram.selectionState.on('change', cb);
      return () => diagram.selectionState.off('change', cb);
    }, [diagram.selectionState]);

    createEffect(() => {
      const cb = ({ element }: { element: DiagramElement }) => {
        if (this.timeout) clearTimeout(this.timeout);
        if (element === this.hoverNode) {
          this.state = 'background';
          this.setHoverNode(undefined);
        }
      };
      diagram.on('elementRemove', cb);
      return () => diagram.off('elementRemove', cb);
    }, [diagram]);

    const scale = 4;

    if (
      this.hoverNode === undefined ||
      !isNode(this.hoverNode) ||
      (DRAG_DROP_MANAGER.current() && !(DRAG_DROP_MANAGER.current() instanceof MoveDrag))
    ) {
      return svg.g({});
    }

    const node = this.hoverNode;

    if (this.shouldScale || selection.isDragging()) return svg.g({});

    const scaledBounds = node.bounds;

    const children: VNode[] = [];

    node.anchors.forEach((a, idx) => {
      if (a.clip) return;
      children.push(
        svg.g(
          {
            transform: `translate(${scaledBounds.x + a.point.x * scaledBounds.w} ${
              scaledBounds.y + a.point.y * scaledBounds.h
            })`,
            on: {
              mouseover: () => (this.state = 'handle'),
              mouseout: () => {
                this.state = 'background';
                if (this.timeout) clearTimeout(this.timeout);
                this.triggerMouseOut();
              },
              mousedown: e => {
                DRAG_DROP_MANAGER.initiate(
                  new AnchorHandleDrag(node, idx, EventHelper.point(e), props.applicationTriggers)
                );
                e.preventDefault();
                e.stopPropagation();
              }
            }
          },
          svg.path({
            class: 'svg-anchor-handle',
            d: `M 0 -${scale}, L ${scale} 0, L 0 ${scale}, L -${scale} 0, L 0 -${scale}`
          })
        )
      );
    });

    // TODO: Fix this
    return svg.g({}, ...children);
  }

  private triggerMouseOut() {
    this.timeout = window.setTimeout(
      () => {
        if (this.state === 'handle') return;
        this.state = 'background';
        this.setHoverNode(undefined);
      },
      this.shouldScale ? 400 : 50
    );
  }
}

type Props = {
  diagram: Diagram;
  applicationState: ApplicationState;
  applicationTriggers: ApplicationTriggers;
};
