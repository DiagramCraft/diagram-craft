import { DRAG_DROP_MANAGER } from '../dragDropManager';
import { CanvasState } from '../EditableCanvasComponent';
import { Component, createEffect, Observable } from '../component/component';
import * as svg from '../component/vdom-svg';
import { VNode } from '../component/vdom';
import { MoveDrag } from '../drag/moveDrag';
import { DiagramElement, isNode } from '@diagram-craft/model/diagramElement';
import { EventHelper } from '@diagram-craft/utils/eventHelper';
import { AnchorHandleDrag } from '../drag/anchorHandleDrag';
import { Transforms } from '../component/vdom-svg';
import { Zoom } from './zoom';
import { ViewboxEvents } from '@diagram-craft/model/viewBox';
import { Vector } from '@diagram-craft/geometry/vector';

type State = 'background' | 'node' | 'handle';

const ANCHOR_SIZE = 4;
const SCALE = 10;

type Props = CanvasState & { hoverElement: Observable<string | undefined> };

// TODO: All these timeouts are a bit ugly... should find a better way
//       to describe the state machine - or somehow subscribe to mouse move events
//       to trigger the hiding of the handles
//
export class AnchorHandlesComponent extends Component<Props> {
  private hoverNode: DiagramElement | undefined;
  private state: State = 'background';
  private timeout: number | undefined = undefined;

  render(props: Props) {
    const diagram = props.diagram;

    createEffect(() => {
      const cb = ({ type }: ViewboxEvents['viewbox']) => {
        if (type === 'pan') return;
        this.redraw();
      };
      diagram.viewBox.on('viewbox', cb);
      return () => diagram.viewBox.off('viewbox', cb);
    }, [diagram]);

    const selection = diagram.selectionState;
    const shouldScale = selection.nodes.length === 1 && selection.nodes[0] === this.hoverNode;

    // Whenever an element is hovered, we capture the element (and reset any previous state)
    createEffect(() => {
      const cb = (p: { newValue: string | undefined }) => {
        const element = p.newValue;
        this.clearTimeout();

        if (element === undefined) {
          this.triggerMouseOut(shouldScale);
        } else {
          const el = diagram.lookup(element);
          if (isNode(el) && el.isLabelNode()) return;

          this.setState(el, 'node');
        }
      };
      props.hoverElement.on('change', cb);
      return () => props.hoverElement.off('change', cb);
    }, [props.hoverElement]);

    // When the selection is changes, we reset the state
    createEffect(() => {
      const cb = () => {
        this.clearTimeout();
        this.setState(undefined, 'background');
      };
      diagram.selectionState.on('change', cb);
      return () => diagram.selectionState.off('change', cb);
    }, [diagram.selectionState]);

    createEffect(() => {
      const cb = ({ element }: { element: DiagramElement }) => {
        this.clearTimeout();
        if (element === this.hoverNode) {
          this.setState(undefined, 'background');
        }
      };
      diagram.on('elementRemove', cb);
      return () => diagram.off('elementRemove', cb);
    }, [diagram]);

    if (
      this.hoverNode === undefined ||
      !isNode(this.hoverNode) ||
      (DRAG_DROP_MANAGER.current() && !(DRAG_DROP_MANAGER.current() instanceof MoveDrag))
    ) {
      return svg.g({});
    }

    const node = this.hoverNode;

    if (selection.isDragging()) return svg.g({});

    const z = new Zoom(diagram.viewBox.zoomLevel);
    const anchorSizeInEffect = z.num(ANCHOR_SIZE, 2);

    const sBounds = shouldScale
      ? {
          x: node.bounds.x - z.num(SCALE),
          y: node.bounds.y - z.num(SCALE),
          w: node.bounds.w + z.num(2 * SCALE),
          h: node.bounds.h + z.num(2 * SCALE),
          r: node.bounds.r
        }
      : node.bounds;

    if (diagram.activeLayer.type !== 'regular') {
      return svg.g({});
    }

    const children: VNode[] = [];

    node.anchors.forEach(a => {
      if (a.clip) return;
      if (!a.isPrimary) return;

      const normal = Vector.fromPolar(a.normal ?? 0, z.num(10, 7));

      const x = a.start.x;
      const y = a.start.y;
      children.push(
        svg.g(
          {
            transform: `translate(${sBounds.x + x * sBounds.w} ${sBounds.y + y * sBounds.h})`,
            on: {
              mouseover: () => (this.state = 'handle'),
              mouseout: () => {
                this.state = 'background';
                this.clearTimeout();
                this.triggerMouseOut(shouldScale);
              },
              mousedown: e => {
                if (diagram.activeLayer.type !== 'regular') return;

                DRAG_DROP_MANAGER.initiate(
                  new AnchorHandleDrag(node, a.id, EventHelper.point(e), props.context)
                );
                this.clearTimeout();
                this.setState(undefined, 'background');
                e.preventDefault();
                e.stopPropagation();
              }
            }
          },
          svg.line({
            'x1': 0,
            'y1': 0,
            'x2': normal.x,
            'y2': normal.y,
            'stroke': 'var(--accent-9)',
            'stroke-width': z.num(1)
          }),
          svg.circle({
            class: 'svg-handle svg-anchor-handle',
            cx: 0,
            cy: 0,
            r: anchorSizeInEffect
          })
        )
      );
    });

    const transform = `${Transforms.rotate(node.bounds)} ${node.renderProps.geometry.flipH ? Transforms.flipH(node.bounds) : ''} ${node.renderProps.geometry.flipV ? Transforms.flipV(node.bounds) : ''}`;
    return svg.g(
      {
        transform: transform.trim()
      },
      ...children
    );
  }

  private setState(node: DiagramElement | undefined, state: State) {
    this.state = state;
    this.hoverNode = node;
    this.redraw();
  }

  private clearTimeout() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }
  }

  private triggerMouseOut(shouldScale: boolean) {
    this.timeout = window.setTimeout(
      () => {
        if (this.state === 'handle') return;
        this.setState(undefined, 'background');
      },
      shouldScale ? 400 : 50
    );
  }
}
