import { EditablePath } from '../editablePath';
import { ShapeNodeDefinition } from '../shape/shapeNodeDefinition';
import { BaseNodeComponent, BaseShapeBuildShapeProps } from '../components/BaseNodeComponent';
import { DRAG_DROP_MANAGER } from '../dragDropManager';
import { toInlineCSS } from '../component/vdom';
import { GenericPathControlPointDrag } from '../drag/genericPathControlPointDrag';
import { NodeDrag } from '../drag/nodeDrag';
import * as svg from '../component/vdom-svg';
import { ShapeBuilder } from '../shape/ShapeBuilder';
import { PathBuilder, unitCoordinateSystem } from '@diagram-craft/geometry/pathBuilder';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { EventHelper } from '@diagram-craft/utils/eventHelper';
import { registerNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { Zoom } from '../components/zoom';

declare global {
  interface NodeProps {
    shapeGenericPath?: {
      path?: string;
    };
  }
}

const DEFAULT_PATH = 'M -1 1, L 1 1, L 1 -1, L -1 -1, L -1 1';

registerNodeDefaults('shapeGenericPath', { path: DEFAULT_PATH });

export class GenericPathNodeDefinition extends ShapeNodeDefinition {
  constructor(name = 'generic-path', displayName = 'Path') {
    super(name, displayName, GenericPathComponent);
  }

  getBoundingPathBuilder(def: DiagramNode) {
    return PathBuilder.fromString(
      def.renderProps.shapeGenericPath.path,
      unitCoordinateSystem(def.bounds)
    );
  }
}

class GenericPathComponent extends BaseNodeComponent {
  selectedWaypoints: number[] = [];

  setSelectedWaypoints(selectedWaypoints: number[]) {
    this.selectedWaypoints = selectedWaypoints;
    this.update(this.currentProps!);
  }

  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    const drag = DRAG_DROP_MANAGER;
    const pathBuilder = new GenericPathNodeDefinition().getBoundingPathBuilder(props.node);
    const paths = pathBuilder.getPaths();

    const svgPath = paths.asSvgPath();

    const editablePath = new EditablePath(paths, props.node);

    const onDoubleClick = (e: MouseEvent) => {
      const domPoint = EventHelper.point(e);
      const dp = props.node.diagram.viewBox.toDiagramPoint(domPoint);

      if (e.metaKey) {
        editablePath.straighten(dp);

        const uow = new UnitOfWork(props.node.diagram, true);
        editablePath.commitToNode(uow);
        commitWithUndo(uow, 'Convert to line');
      } else {
        const idx = editablePath.split(editablePath.toLocalCoordinate(dp));

        const uow = new UnitOfWork(props.node.diagram, true);
        editablePath.commitToNode(uow);
        commitWithUndo(uow, 'Add waypoint');

        this.setSelectedWaypoints([idx]);
      }
    };

    const z = new Zoom(props.node.diagram.viewBox.zoomLevel);

    if (props.isSingleSelected && props.tool?.type === 'node') {
      props.applicationTriggers.pushHelp?.(
        'GenericPathComponent',
        'Edge Dbl-click - add waypoint, Edge Cmd-Dbl-Click - straighten, Waypoint Click - select, Waypoint Shift-Click - multi-select, Waypoint Cmd-Dbl-Click - delete'
      );
      shapeBuilder.add(
        svg.path({
          d: svgPath,
          x: props.node.bounds.x,
          y: props.node.bounds.y,
          width: props.node.bounds.w,
          height: props.node.bounds.h,
          style: toInlineCSS({
            ...props.style,
            stroke: 'var(--accent-3)',
            strokeWidth: z.str(20),
            strokeLinejoin: 'miter',
            strokeLinecap: 'square'
          }),
          on: {
            dblclick: onDoubleClick,
            mousedown: e => e.stopPropagation(),
            mouseup: e => e.stopPropagation()
          }
        })
      );
    } else {
      props.applicationTriggers.popHelp?.('GenericPathComponent');
    }

    shapeBuilder.boundaryPath(paths.all(), undefined, undefined, {
      map: v => {
        v.data.on ??= {};
        v.data.on.dblclick =
          props.tool?.type === 'node' ? onDoubleClick : shapeBuilder.makeOnDblclickHandle();
        v.data.style ??= '';
        return v;
      }
    });
    shapeBuilder.text(this);

    if (props.isSingleSelected && props.tool?.type === 'node') {
      editablePath.waypoints.map((wp, idx) => {
        if (this.selectedWaypoints.includes(idx)) {
          shapeBuilder.add(
            svg.line({
              'x1': wp.point.x,
              'y1': wp.point.y,
              'x2': wp.point.x + wp.controlPoints.p1.x,
              'y2': wp.point.y + wp.controlPoints.p1.y,
              'stroke': 'var(--accent-9)',
              'stroke-width': z.str(1),
              'stroke-dasharray': `2 2`
            })
          );
          shapeBuilder.add(
            svg.circle({
              'cx': wp.point.x + wp.controlPoints.p1.x,
              'cy': wp.point.y + wp.controlPoints.p1.y,
              'stroke': 'var(--accent-9)',
              'stroke-width': z.str(1),
              'fill': 'white',
              'r': z.str(4, 1.5),
              'on': {
                mousedown: e => {
                  if (e.button !== 0) return;
                  drag.initiate(
                    new GenericPathControlPointDrag(
                      editablePath,
                      idx,
                      'p1',
                      props.applicationTriggers
                    )
                  );
                  e.stopPropagation();
                }
              }
            })
          );

          shapeBuilder.add(
            svg.line({
              'x1': wp.point.x,
              'y1': wp.point.y,
              'x2': wp.point.x + wp.controlPoints.p2.x,
              'y2': wp.point.y + wp.controlPoints.p2.y,
              'stroke': 'var(--accent-9)',
              'stroke-width': z.str(1),
              'stroke-dasharray': `2 2`
            })
          );

          shapeBuilder.add(
            svg.circle({
              'cx': wp.point.x + wp.controlPoints.p2.x,
              'cy': wp.point.y + wp.controlPoints.p2.y,
              'stroke': 'var(--accent-9)',
              'stroke-width': z.str(1),
              'fill': 'white',
              'r': z.str(4, 1.5),
              'on': {
                mousedown: e => {
                  if (e.button !== 0) return;
                  drag.initiate(
                    new GenericPathControlPointDrag(
                      editablePath,
                      idx,
                      'p2',
                      props.applicationTriggers
                    )
                  );
                  e.stopPropagation();
                }
              }
            })
          );
        }

        shapeBuilder.add(
          svg.circle({
            'cx': wp.point.x,
            'cy': wp.point.y,
            'stroke': 'var(--accent-9)',
            'stroke-width': z.str(1),
            'fill': this.selectedWaypoints.includes(idx) ? 'var(--accent-9)' : 'white',
            'r': z.str(4, 1.5),
            'on': {
              mousedown: e => {
                if (e.button !== 0) return;

                if (e.shiftKey) {
                  if (this.selectedWaypoints.includes(idx)) {
                    this.setSelectedWaypoints(this.selectedWaypoints.filter(i => i !== idx));
                  } else {
                    this.setSelectedWaypoints([...this.selectedWaypoints, idx]);
                  }
                } else {
                  this.setSelectedWaypoints([idx]);
                }

                drag.initiate(
                  new NodeDrag(editablePath, this.selectedWaypoints, props.applicationTriggers)
                );

                e.stopPropagation();
              },
              dblclick: e => {
                const uow = new UnitOfWork(props.node.diagram, true);

                const wp = editablePath.waypoints[idx];
                if (e.metaKey) {
                  editablePath.deleteWaypoint(wp);
                  editablePath.commitToNode(uow);
                  commitWithUndo(uow, 'Delete waypoint');
                }
                e.stopPropagation();
              }
            }
          })
        );
      });
    }
  }
}
