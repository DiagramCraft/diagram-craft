import { LabelNodeSelectionComponent } from '@diagram-craft/canvas/components/LabelNodeSelectionComponent';
import { GroupBoundsComponent } from '@diagram-craft/canvas/components/GroupBoundsComponent';
import { SnapMarkersComponent } from './SnapMarkersComponent';
import { RotationHandleComponent } from '@diagram-craft/canvas/components/RotationHandleComponent';
import { ResizeHandlesComponent } from '@diagram-craft/canvas/components/ResizeHandlesComponent';
import { EdgeSelectionComponent } from '@diagram-craft/canvas/components/EdgeSelectionComponent';
import { $cmp, Component, createEffect } from '../component/component';
import * as svg from '../component/vdom-svg';
import { Transforms } from '../component/vdom-svg';
import type { CanvasState } from '../canvas/EditableCanvasComponent';
import { $c } from '@diagram-craft/utils/classname';
import { ViewboxEvents } from '@diagram-craft/model/viewBox';
import { SnapMarkers } from '../snap/snapManager';

export class SelectionComponent extends Component<CanvasState> {
  render(props: CanvasState) {
    const diagram = props.diagram;
    const selection = diagram.selection;

    createEffect(() => {
      const cb = ({ type }: ViewboxEvents['viewbox']) => {
        if (type === 'pan') return;
        this.redraw();
      };
      diagram.viewBox.on('viewbox', cb);
      return () => {
        diagram.viewBox.off('viewbox', cb);
      };
    }, [diagram]);

    createEffect(() => {
      const cb = () => this.redraw();

      selection.on('change', cb);
      return () => selection.off('change', cb);
    }, [selection]);

    if (selection.isEmpty()) return svg.g({});

    const isOnlyEdges = selection.isEdgesOnly();

    const bounds = selection.bounds;

    const labelNode =
      selection.type === 'single-label-node' ? selection.nodes[0]!.labelNode()! : undefined;
    const shouldHaveRotation = !(labelNode && labelNode.type !== 'independent');

    return svg.g(
      {},
      !isOnlyEdges &&
        this.subComponent($cmp(SnapMarkersComponent), {
          diagram,
          markers: SnapMarkers.get(diagram)
        }),
      svg.g(
        { class: 'svg-selection' },
        !isOnlyEdges &&
          svg.g(
            {},
            this.subComponent(() => new GroupBoundsComponent(), { selection }),
            svg.g(
              {
                transform: Transforms.rotate(bounds)
              },
              svg.rectFromBox(bounds, {
                'class': $c('svg-selection__bb', {
                  'only-edges': isOnlyEdges,
                  'dragging': selection.isDragging()
                }),
                'pointer-events': 'none'
              }),
              !selection.isDragging() &&
                svg.g(
                  {},
                  shouldHaveRotation &&
                    this.subComponent($cmp(RotationHandleComponent), { diagram }),
                  this.subComponent($cmp(ResizeHandlesComponent), { diagram })
                )
            )
          ),
        ...selection.edges.map(e =>
          this.subComponent($cmp(EdgeSelectionComponent), {
            key: `edge-selection-${e.id}`,
            edge: e,
            diagram,
            context: props.context
          })
        ),
        ...selection.nodes
          .filter(n => !!n.labelEdge())
          .map(n =>
            this.subComponent($cmp(LabelNodeSelectionComponent), {
              key: `label-node-selection-${n.id}`,
              node: n
            })
          )
      )
    );
  }
}
