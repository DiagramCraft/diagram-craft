import { DRAG_DROP_MANAGER, type Modifiers } from '../dragDropManager';
import type { CanvasState } from '../canvas/EditableCanvasComponent';
import { Component, Observable, onEvent } from '../component/component';
import * as svg from '../component/vdom-svg';
import { Transforms } from '../component/vdom-svg';
import { VNode } from '../component/vdom';
import { MoveDrag } from '../drag/moveDrag';
import { DiagramElement, isNode } from '@diagram-craft/model/diagramElement';
import { EventHelper } from '@diagram-craft/utils/eventHelper';
import { AnchorHandleDrag } from '../drag/anchorHandleDrag';
import { projectToPointHandle } from '../drag/anchorHandleDragSource';
import { Zoom } from './zoom';
import { Vector } from '@diagram-craft/geometry/vector';
import { Point } from '@diagram-craft/geometry/point';

type State = 'background' | 'node' | 'handle';

const ANCHOR_SIZE = 4;
const SCALE = 10;
const ANCHOR_MOUSEOUT_DISTANCE = 20;

type Props = CanvasState & {
  hoverElement: Observable<string | undefined>;
  point: Observable<Point>;
  modifiers: Observable<Modifiers>;
};

export class AnchorHandlesComponent extends Component<Props> {
  private hoverNode: DiagramElement | undefined;
  private state: State = 'background';

  render(props: Props) {
    const diagram = props.diagram;
    const selection = diagram.selection;
    const shouldScale = selection.nodes.length === 1 && selection.nodes[0] === this.hoverNode;

    onEvent(diagram.viewBox, 'viewbox', ({ type }) => {
      if (type === 'pan') return;
      this.redraw();
    });

    // Whenever an element is hovered, we capture the element (and reset any previous state)
    onEvent(props.hoverElement, 'change', p => {
      if (this.state === 'handle') return;

      const element = p.newValue;

      if (element === undefined) {
        this.state = 'background';
      } else {
        const el = diagram.lookup(element);
        if (isNode(el) && el.isLabelNode()) return;
        this.setState(el, 'node');
      }
    });

    // Whenever the mouse moves, we check if the mouse has moved away from the anchors
    // of the hovered element. If so, we reset the state.
    onEvent(props.point, 'change', () => {
      if (!this.hoverNode || !isNode(this.hoverNode)) return;

      // While directly hovering the node, keep redrawing so projected handles track the cursor.
      if (this.hoverNode.id === props.hoverElement.get()) {
        this.redraw();
        return;
      }

      let minDistance = Infinity;
      const node = this.hoverNode;
      node.anchors.forEach(a => {
        if (a.clip || !a.isPrimary) return;

        const p1 = node._getPositionInBounds(a.start, false);
        minDistance = Math.min(minDistance, Point.distance(p1, props.point.get()));
      });

      if (minDistance > ANCHOR_MOUSEOUT_DISTANCE) {
        this.setState(undefined, 'background');
      }
    });

    onEvent(props.modifiers, 'change', () => this.redraw());

    // When the selection is changes, we reset the state
    onEvent(diagram.selection, 'change', () => {
      // If we are hovering over an element that is selected, we don't reset the state - instead
      // we redraw in order to show the handles offset from the edges
      if (this.hoverNode && diagram.selection.elements.includes(this.hoverNode)) {
        this.redraw();
        return;
      }
      this.setState(undefined, 'background');
    });

    onEvent(diagram, 'elementRemove', ({ element }) => {
      if (element === this.hoverNode) {
        this.setState(undefined, 'background');
      }
    });

    const isMove =
      DRAG_DROP_MANAGER.current() && !(DRAG_DROP_MANAGER.current() instanceof MoveDrag);
    if (!this.hoverNode || !isNode(this.hoverNode) || isMove || selection.isDragging()) {
      return svg.g({});
    }

    const node = this.hoverNode;
    if (node.layer.type !== 'regular' || node.layer.isLocked()) {
      return svg.g({});
    }

    const z = new Zoom(diagram.viewBox.zoomLevel);
    const anchorSizeInEffect = z.num(ANCHOR_SIZE, 2);

    const children: VNode[] = [];
    const transformedChildren: VNode[] = [];

    node.anchors.forEach(a => {
      if (a.clip || !a.isPrimary) return;

      const p1 = node._getPositionInBounds(a.start, false);

      // Need to calculate a new normal, by creating a vector in the unit coordinate system along the normal
      // Then, calculating the angle of the vector between the two projected points
      const p2 = node._getPositionInBounds(
        Point.add(a.start, Vector.fromPolar(a.normal ?? 0, 1)),
        false
      );
      const normalInEffect = Vector.angle(Vector.from(p1, p2));

      const p =
        shouldScale && a.type !== 'center'
          ? Point.add(p1, Vector.fromPolar(normalInEffect ?? 0, z.num(SCALE)))
          : p1;
      const normalEndpoint = Point.add(p, Vector.fromPolar(normalInEffect ?? 0, z.num(15, 7)));

      if (a.type !== 'center') {
        transformedChildren.push(
          svg.line({
            'x1': p.x,
            'y1': p.y,
            'x2': normalEndpoint.x,
            'y2': normalEndpoint.y,
            'stroke': 'var(--accent-9)',
            'stroke-width': z.num(1)
          })
        );
      }
      transformedChildren.push(
        svg.circle({
          class: 'svg-handle svg-anchor-handle',
          cx: p.x,
          cy: p.y,
          r: anchorSizeInEffect,
          on: {
            mouseover: () => (this.state = 'handle'),
            mouseout: () => (this.state = 'background'),
            mousedown: e => {
              if (diagram.activeLayer.type !== 'regular') return;

              DRAG_DROP_MANAGER.initiate(
                new AnchorHandleDrag(
                  node,
                  {
                    type: 'anchor',
                    anchorId: a.id,
                    normal: a.normal,
                    point: p1
                  },
                  EventHelper.point(e),
                  props.context
                ),
                () => {},
                true
              );
              this.setState(undefined, 'background');
              e.preventDefault();
              e.stopPropagation();
            }
          }
        })
      );
    });

    const isDirectlyHoveringNode = props.hoverElement.get() === node.id;
    const projectedHandle = isDirectlyHoveringNode
      ? projectToPointHandle(node, props.point.get(), props.modifiers.get())
      : undefined;

    if (projectedHandle) {
      if (projectedHandle.type === 'edge-anchor') {
        const halfSpan = z.num(15, 10);
        const markerAngle = projectedHandle.normal ?? 0;
        const from = Point.add(projectedHandle.point, Vector.fromPolar(markerAngle, -halfSpan));
        const to = Point.add(projectedHandle.point, Vector.fromPolar(markerAngle, halfSpan));

        children.push(
          svg.line({
            'x1': from.x,
            'y1': from.y,
            'x2': to.x,
            'y2': to.y,
            'stroke': 'var(--accent-9)',
            'stroke-width': z.num(1),
            'stroke-linecap': 'round'
          })
        );
      }

      const normalEndpoint = Point.add(
        projectedHandle.point,
        Vector.fromPolar(projectedHandle.normal ?? 0, z.num(15, 7))
      );

      children.push(
        svg.line({
          'x1': projectedHandle.point.x,
          'y1': projectedHandle.point.y,
          'x2': normalEndpoint.x,
          'y2': normalEndpoint.y,
          'stroke': 'var(--accent-9)',
          'stroke-width': z.num(1)
        })
      );

      children.push(
        svg.circle({
          class: 'svg-handle svg-anchor-handle',
          cx: projectedHandle.point.x,
          cy: projectedHandle.point.y,
          r: anchorSizeInEffect,
          on: {
            mousedown: e => {
              if (diagram.activeLayer.type !== 'regular') return;

              DRAG_DROP_MANAGER.initiate(
                new AnchorHandleDrag(node, projectedHandle, EventHelper.point(e), props.context),
                () => {},
                true
              );
              this.setState(undefined, 'background');
              e.preventDefault();
              e.stopPropagation();
            }
          }
        })
      );
    }

    const transform = `${Transforms.rotate(node.bounds)} ${node.renderProps.geometry.flipH ? Transforms.flipH(node.bounds) : ''} ${node.renderProps.geometry.flipV ? Transforms.flipV(node.bounds) : ''}`;
    return svg.g({}, svg.g({ transform: transform.trim() }, ...transformedChildren), ...children);
  }

  private setState(node: DiagramElement | undefined, state: State) {
    this.state = state;
    this.hoverNode = node;
    this.redraw();
  }
}
