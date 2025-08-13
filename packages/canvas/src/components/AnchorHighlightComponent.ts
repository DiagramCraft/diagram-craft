import type { CanvasState } from '../canvas/EditableCanvasComponent';
import { Component, createEffect } from '../component/component';
import * as svg from '../component/vdom-svg';
import { getHighlightValue, hasHighlight, Highlights } from '../highlight';
import { Zoom } from './zoom';
import { DiagramElement, isNode } from '@diagram-craft/model/diagramElement';
import type { DiagramNode } from '@diagram-craft/model/diagramNode';

type Props = CanvasState;

export class AnchorHighlightComponent extends Component<Props> {
  private highlightedElements = new Set<DiagramNode>();

  render(props: Props) {
    const $d = props.diagram;
    const z = new Zoom($d.viewBox.zoomLevel);

    createEffect(() => {
      const cb = (arg: { element: DiagramElement }) => {
        if (!isNode(arg.element)) return;

        if (hasHighlight(arg.element, Highlights.NODE__EDGE_CONNECT)) {
          this.highlightedElements.add(arg.element);
        } else {
          this.highlightedElements.delete(arg.element);
        }
        this.redraw();
      };
      $d.on('elementHighlighted', cb);
      return () => {
        $d.off('elementHighlighted', cb);
      };
    }, [$d]);

    return svg.g(
      {},
      ...[...this.highlightedElements].flatMap(element => {
        return element.anchors.map(anchor => {
          if (anchor.type === 'edge') {
            return svg.line({
              class: 'svg-node__anchor',
              x1: element.bounds.x + anchor.start.x * element.bounds.w,
              y1: element.bounds.y + anchor.start.y * element.bounds.h,
              x2: element.bounds.x + anchor.end!.x * element.bounds.w,
              y2: element.bounds.y + anchor.end!.y * element.bounds.h,
              style: `
                  stroke-width: ${z.str(2, 2)} !important; 
                  pointer-events: none; 
                  fill: ${getHighlightValue(element, Highlights.NODE__ACTIVE_ANCHOR) === anchor.id ? 'var(--accent-9)' : 'transparent'};
                `
            });
          } else {
            return svg.circle({
              class: 'svg-node__anchor',
              cx: element.bounds.x + anchor.start.x * element.bounds.w,
              cy: element.bounds.y + anchor.start.y * element.bounds.h,
              r: z.str(4, 2),
              // TODO: Change this to be a class instead of a fixed color
              style: `pointer-events: none; fill: ${getHighlightValue(element, Highlights.NODE__ACTIVE_ANCHOR) === anchor.id ? 'var(--accent-9)' : 'var(--accent-3)'};`
            });
          }
        });
      })
    );
  }
}
