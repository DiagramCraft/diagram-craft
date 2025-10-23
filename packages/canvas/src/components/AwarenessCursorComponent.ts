import { Component, createEffect } from '../component/component';
import * as svg from '../component/vdom-svg';
import type { CanvasState } from '../canvas/EditableCanvasComponent';
import { CollaborationConfig } from '@diagram-craft/collaboration/collaborationConfig';
import * as html from '../component/vdom-html';
import { text } from '../component/vdom';

export class AwarenessCursorComponent extends Component<CanvasState> {
  render(props: CanvasState) {
    const diagram = props.diagram;

    createEffect(() => {
      const cb = () => this.redraw();
      diagram.viewBox.on('viewbox', cb);
      return () => diagram.viewBox.off('viewbox', cb);
    }, [diagram]);

    createEffect(() => {
      const awareness = CollaborationConfig.Backend.awareness;

      const cb = () => {
        this.redraw();
      };

      awareness?.on('changeCursor', cb);
      return () => awareness?.off('changeCursor', cb);
    }, [CollaborationConfig.Backend.awareness]);

    const zoom = diagram.viewBox.zoomLevel;

    return svg.g(
      {},
      ...(CollaborationConfig.Backend.awareness?.getCursorStates() ?? []).map(c => {
        if (Number.isNaN(c.x) || Number.isNaN(c.y)) return svg.g({});
        if (c.activeDiagramId !== diagram.id) return svg.g({});
        return svg.g(
          {
            transform: `translate(${c.x}, ${c.y})`
          },
          svg.foreignObject(
            {
              x: 15 * zoom,
              y: 15 * zoom,
              width: 200 * zoom,
              height: 20 * zoom
            },
            html.div(
              {
                style: `display: flex; `
              },
              [
                html.span(
                  {
                    style: `
                  color: white;
                  font-size: calc(10px * var(--zoom));
                  background: ${c.color};
                  border-radius: calc(3px * var(--zoom));
                  padding: calc(2px * var(--zoom)) calc(6px * var(--zoom));
                `
                  },
                  [text(c.name)]
                )
              ]
            )
          ),
          svg.path({
            d: `M 0 0 L ${9 * zoom} ${9 * zoom} L ${3 * zoom} ${8 * zoom} L 0 ${12 * zoom} z`,
            style: `stroke: ${c.color}; stroke-width: calc(1px * var(--zoom)); fill: white;`
          })
        );
      })
    );
  }
}
