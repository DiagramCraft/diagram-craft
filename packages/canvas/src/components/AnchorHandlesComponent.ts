import { AbstractDrag, DRAG_DROP_MANAGER, Modifiers } from '../dragDropManager';
import { EventHelper, newid, VerifyNotReached } from '@diagram-craft/utils';
import { ApplicationTriggers, CanvasState } from '../EditableCanvasComponent';
import { Component, createEffect } from '../component/component';
import * as svg from '../component/vdom-svg';
import { VNode } from '../component/vdom';
import { Point } from '@diagram-craft/geometry/point';
import { EdgeEndpointMoveDrag } from '../drag/edgeEndpointMoveDrag';
import { MoveDrag } from '../drag/moveDrag';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { ConnectedEndpoint, FreeEndpoint, isConnected } from '@diagram-craft/model/endpoint';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { ElementAddUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import { DiagramElement, isNode } from '@diagram-craft/model/diagramElement';

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
export class AnchorHandlesComponent extends Component<CanvasState> {
  private hoverNode: DiagramElement | undefined;
  private state: 'background' | 'node' | 'handle' = 'background';
  private timeout: number | undefined = undefined;
  private shouldScale: boolean = false;

  setHoverNode(node: DiagramElement | undefined) {
    this.hoverNode = node;
    this.redraw();
  }

  render(props: CanvasState) {
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
