import { DRAG_DROP_MANAGER } from '../dragDropManager';
import { CanvasState } from '../EditableCanvasComponent';
import { Component, createEffect } from '../component/component';
import * as svg from '../component/vdom-svg';
import { VNode } from '../component/vdom';
import { MoveDrag } from '../drag/moveDrag';
import { DiagramElement, isNode } from '@diagram-craft/model/diagramElement';
import { EventHelper } from '@diagram-craft/utils/eventHelper';
import { AnchorHandleDrag } from '../drag/anchorHandleDrag';

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

      const x = node.renderProps.geometry.flipH ? 1 - a.point.x : a.point.x;
      const y = node.renderProps.geometry.flipV ? 1 - a.point.y : a.point.y;
      children.push(
        svg.g(
          {
            transform: `translate(${scaledBounds.x + x * scaledBounds.w} ${
              scaledBounds.y + y * scaledBounds.h
            })
            `,
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
