import { Angle } from '../geometry/angle.ts';
import { $c } from '../utils/classname.ts';
import { LabelNodeSelectionComponent } from './selection/LabelNodeSelection.tsx';
import { GroupBoundsComponent } from './selection/GroupBounds.tsx';
import { GuidesComponent } from './selection/Guides.tsx';
import { RotationHandleComponent } from './selection/RotationHandle.tsx';
import { ResizeHandlesComponent } from './selection/ResizeHandles.tsx';
import { EdgeSelectionComponent } from './selection/EdgeSelection.tsx';
import { Box } from '../geometry/box.ts';
import { useDiagram } from '../react-app/context/DiagramContext.ts';
import { Diagram } from '../model/diagram.ts';
import { Component, PropChangeManager } from '../base-ui/component.ts';
import * as svg from '../base-ui/vdom-svg.ts';
import { useComponent } from '../react-canvas-viewer/temp/useComponent.temp.ts';

type Props = {
  diagram: Diagram;
};

class SelectionComponent extends Component<Props> {
  private propChangeManager = new PropChangeManager();

  onDetach() {
    this.propChangeManager.cleanup();
  }

  render(props: Props) {
    const diagram = props.diagram;
    const selection = diagram.selectionState;

    this.propChangeManager.when([selection], 'selection-change-redraw', () => {
      const cb = this.redraw.bind(this);
      selection.on('change', cb);
      return () => selection.off('change', cb);
    });

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
        {
          class: 'svg-selection'
        },
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

export const Selection = () => {
  const diagram = useDiagram();
  const ref = useComponent<Props, SelectionComponent, SVGGElement>(() => new SelectionComponent(), {
    diagram
  });

  return <g ref={ref}></g>;

  /*
  const redraw = useRedraw();
  const diagram = useDiagram();
  const selection = diagram.selectionState;

  useEventListener(selection, 'change', redraw);

  if (selection.isEmpty()) return null;

  const isOnlyEdges = selection.isEdgesOnly();

  const bounds = selection.bounds;

  const labelNode =
    selection.getSelectionType() === 'single-label-node'
      ? selection.nodes[0].labelNode()!
      : undefined;
  const shouldHaveRotation = !(labelNode && labelNode.type !== 'independent');

  const center = Box.center(bounds);

  return (
    <>
      {!isOnlyEdges && <Guides selection={selection} />}

      <g className={'svg-selection'}>
        {!isOnlyEdges && (
          <>
            <GroupBounds selection={selection} />
            <g transform={`rotate(${Angle.toDeg(bounds.r)} ${center.x} ${center.y})`}>
              <rect
                x={bounds.x}
                y={bounds.y}
                width={bounds.w}
                height={bounds.h}
                className={$c('svg-selection__bb', {
                  'only-edges': isOnlyEdges,
                  'dragging': selection.isDragging()
                })}
                pointerEvents={'none'}
              />
              {!selection.isDragging() && (
                <>
                  {shouldHaveRotation && <RotationHandle />}
                  <ResizeHandles />
                </>
              )}
            </g>
          </>
        )}

        {selection.edges.map(e => (
          <EdgeSelection key={e.id} edge={e} />
        ))}

        {selection.nodes
          .filter(n => !!n.labelEdge())
          .map(n => (
            <LabelNodeSelection key={n.id} node={n} />
          ))}
      </g>
    </>
  );*/
};
