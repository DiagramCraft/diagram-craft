import { Angle } from '@diagram-craft/geometry/index';
import { $c } from '@diagram-craft/utils/index';
import { LabelNodeSelectionComponent } from '@diagram-craft/canvas/components/LabelNodeSelectionComponent';
import { GroupBoundsComponent } from '@diagram-craft/canvas/components/GroupBoundsComponent';
import { GuidesComponent } from '@diagram-craft/canvas/components/GuidesComponent';
import { RotationHandleComponent } from '@diagram-craft/canvas/components/RotationHandleComponent';
import { ResizeHandlesComponent } from '@diagram-craft/canvas/components/ResizeHandlesComponent';
import { EdgeSelectionComponent } from '@diagram-craft/canvas/components/EdgeSelectionComponent';
import { Component, createEffect } from '../component/component';
import * as svg from '../component/vdom-svg';
import { CanvasState } from '../EditableCanvasComponent';
import { Box } from '@diagram-craft/geometry/index';

export class SelectionComponent extends Component<CanvasState> {
  render(props: CanvasState) {
    const diagram = props.diagram;
    const selection = diagram.selectionState;

    createEffect(() => {
      const cb = () => {
        this.redraw();
      };
      selection.on('change', cb);
      return () => selection.off('change', cb);
    }, [selection]);

    if (selection.isEmpty()) return svg.g({});

    const isOnlyEdges = selection.isEdgesOnly();

    const bounds = selection.bounds;

    const labelNode =
      selection.getSelectionType() === 'single-label-node'
        ? selection.nodes[0].labelNode()!
        : undefined;
    const shouldHaveRotation = !(labelNode && labelNode.type !== 'independent');

    const center = Box.center(bounds);

    return svg.g(
      {},
      !isOnlyEdges &&
        this.subComponent('guides', () => new GuidesComponent(), {
          selection
        }),
      svg.g(
        { class: 'svg-selection' },
        !isOnlyEdges &&
          svg.g(
            {},
            this.subComponent('group-bounds', () => new GroupBoundsComponent(), {
              selection
            }),
            svg.g(
              {
                transform: `rotate(${Angle.toDeg(bounds.r)} ${center.x} ${center.y})`
              },
              svg.rect({
                'x': bounds.x,
                'y': bounds.y,
                'width': bounds.w,
                'height': bounds.h,
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
                    this.subComponent('rotation-handle', () => new RotationHandleComponent(), {
                      diagram
                    }),
                  this.subComponent('resize-handles', () => new ResizeHandlesComponent(), {
                    diagram
                  })
                )
            )
          ),
        ...selection.edges.map(e =>
          this.subComponent(`edge-selection-${e.id}`, () => new EdgeSelectionComponent(), {
            edge: e,
            diagram
          })
        ),
        ...selection.nodes
          .filter(n => !!n.labelEdge())
          .map(n =>
            this.subComponent(
              `label-node-selection-${n.id}`,
              () => new LabelNodeSelectionComponent(),
              { node: n }
            )
          )
      )
    );
  }
}
