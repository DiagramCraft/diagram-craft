import { ApplicationState } from '../../base-ui/ApplicationState.ts';
import { DiagramElement, isNode } from '../../model/diagramElement.ts';
import { DRAG_DROP_MANAGER } from '../../react-canvas-viewer/DragDropManager.ts';
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
import { useDiagram } from '../../react-app/context/DiagramContext.ts';
import { ConnectedEndpoint, FreeEndpoint, isConnected } from '../../model/endpoint.ts';
import { Component } from '../../base-ui/component.ts';
import { Diagram } from '../../model/diagram.ts';
import * as svg from '../../base-ui/vdom-svg.ts';
import { VNode } from '../../base-ui/vdom.ts';
import { useComponent } from '../../react-canvas-viewer/temp/useComponent.temp.ts';

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

type ComponentProps = Props & {
  diagram: Diagram;
};

// TODO: All these timeouts are a bit ugly... should find a better way
//       to describe the state machine - or somehow subscribe to mouse move events
//       to trigger the hiding of the handles
//
// TODO: This needs some refactoring :) state in the component, the listeners, state in
//       the render function - all a bit of a mess
export class AnchorHandlesComponent extends Component<ComponentProps> {
  private hoverNode: DiagramElement | undefined;
  private state: 'background' | 'node' | 'handle' = 'background';
  // eslint-disable-next-line
  private timeout: any | undefined = undefined;
  private shouldScale: boolean = false;
  private diagram: Diagram | undefined = undefined;

  setHoverNode(node: DiagramElement | undefined) {
    this.hoverNode = node;
    this.redraw();
  }

  render(props: ComponentProps) {
    // TODO: Can we pass this in the constructor instead
    this.diagram = props.diagram;

    const drag = DRAG_DROP_MANAGER;

    const selection = this.diagram.selectionState;
    this.shouldScale = selection.nodes.length === 1 && selection.nodes[0] === this.hoverNode;

    this.effectManager.add(() => {
      const cb = this.hoverElementChange.bind(this);
      props.applicationState.on('hoverElementChange', cb);
      return () => props.applicationState.off('hoverElementChange', cb);
    }, [props.applicationState]);

    this.effectManager.add(() => {
      const cb = this.selectionStateChange.bind(this);
      this.diagram!.selectionState.on('change', cb);
      return () => this.diagram!.selectionState.off('change', cb);
    }, [this.diagram.selectionState]);

    this.effectManager.add(() => {
      const cb = this.elementRemove.bind(this);
      this.diagram!.on('elementRemove', cb);
      return () => this.diagram!.off('elementRemove', cb);
    }, [this.diagram]);

    const scale = 4;

    if (
      this.hoverNode === undefined ||
      !isNode(this.hoverNode) ||
      (drag.current() && !(drag.current() instanceof MoveDrag))
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
                drag.initiate(
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

  private hoverElementChange({ element }: { element: string | undefined }) {
    if (this.timeout) clearTimeout(this.timeout);
    if (element === undefined) {
      this.triggerMouseOut();
    } else {
      this.timeout = undefined;
      this.state = 'node';
      this.setHoverNode(this.diagram!.lookup(element));
    }
  }

  private selectionStateChange() {
    if (this.timeout) clearTimeout(this.timeout);
    this.redraw();
  }

  private elementRemove({ element }: { element: DiagramElement }) {
    if (this.timeout) clearTimeout(this.timeout);
    if (element === this.hoverNode) {
      this.state = 'background';
      this.setHoverNode(undefined);
    }
  }

  private triggerMouseOut() {
    this.timeout = setTimeout(
      () => {
        if (this.state === 'handle') return;
        this.state = 'background';
        this.setHoverNode(undefined);
      },
      this.shouldScale ? 400 : 50
    );
  }
}

// TODO: All these timeouts are a bit ugly... should find a better way
//       to describe the state machine - or somehow subscribe to mouse move events
//       to trigger the hiding of the handles
export const AnchorHandles = (props: Props) => {
  const diagram = useDiagram();
  const ref = useComponent<ComponentProps, AnchorHandlesComponent, SVGGElement>(
    () => new AnchorHandlesComponent(),
    {
      ...props,
      diagram
    }
  );

  return <g ref={ref}></g>;

  /*
  const diagram = useDiagram();
  const drag = DRAG_DROP_MANAGER;
  const [hoverNode, setHoverNode] = useState<DiagramElement | undefined>(undefined);
  const redraw = useRedraw();
  const state = useRef<'background' | 'node' | 'handle'>('background');

  const selection = diagram.selectionState;
  const shouldScale = selection.nodes.length === 1 && selection.nodes[0] === hoverNode;

  // eslint-disable-next-line
  let timeout: any | undefined;

  const triggerMouseOut = () => {
    timeout = setTimeout(
      () => {
        if (state.current === 'handle') return;
        setHoverNode(undefined);
        state.current = 'background';
      },
      shouldScale ? 400 : 50
    );
  };

  useEventListener(props.applicationState, 'hoverElementChange', ({ element }) => {
    if (timeout) clearTimeout(timeout);
    if (element === undefined) {
      triggerMouseOut();
    } else {
      timeout = undefined;
      setHoverNode(diagram.lookup(element));
      state.current = 'node';
    }
  });

  useEventListener(diagram.selectionState, 'change', () => {
    if (timeout) clearTimeout(timeout);
    redraw();
  });

  useEventListener(diagram, 'elementRemove', ({ element }) => {
    if (timeout) clearTimeout(timeout);
    if (element === hoverNode) {
      setHoverNode(undefined);
      state.current = 'background';
    }
  });

  const scale = 4;

  if (
    hoverNode === undefined ||
    !isNode(hoverNode) ||
    (drag.current() && !(drag.current() instanceof MoveDrag))
  ) {
    return null;
  }

  const node = hoverNode;

  if (shouldScale || selection.isDragging()) return null;

  const scaledBounds = node.bounds;

  return (
    <>
      {node.anchors.map((a, idx) =>
        a.clip ? null : (
          <g
            key={`${node.id}_${idx}`}
            transform={`translate(${scaledBounds.x + a.point.x * scaledBounds.w} ${
              scaledBounds.y + a.point.y * scaledBounds.h
            })`}
            onMouseOver={() => (state.current = 'handle')}
            onMouseOut={() => {
              state.current = 'background';
              if (timeout) clearTimeout(timeout);
              triggerMouseOut();
            }}
            onMouseDown={e => {
              drag.initiate(
                new AnchorHandleDrag(
                  node,
                  idx,
                  EventHelper.point(e.nativeEvent),
                  props.applicationTriggers
                )
              );
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <path
              className={'svg-anchor-handle'}
              d={`M 0 -${scale}, L ${scale} 0, L 0 ${scale}, L -${scale} 0, L 0 -${scale}`}
            />
          </g>
        )
      )}
    </>
  );

   */
};

type Props = {
  applicationState: ApplicationState;
  applicationTriggers: ApplicationTriggers;
};
