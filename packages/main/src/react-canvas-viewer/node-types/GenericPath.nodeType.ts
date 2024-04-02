import {
  EditablePath,
  EditableWaypointType
} from '../../react-canvas-editor/tools/node/editablePath.ts';
import { AbstractReactNodeDefinition } from '../reactNodeDefinition.ts';
import { DiagramNode } from '../../model/diagramNode.ts';
import { PathBuilder, unitCoordinateSystem } from '../../geometry/pathBuilder.ts';
import { BaseShape, BaseShapeProps, ShapeBuilder, toInlineCSS } from '../temp/baseShape.temp.ts';
import { DRAG_DROP_MANAGER } from '../DragDropManager.ts';
import { EventHelper } from '../../base-ui/eventHelper.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { commitWithUndo } from '../../model/diagramUndoActions.ts';
import { s } from '../../base-ui/vdom.ts';
import { ControlPointDrag } from '../../react-canvas-editor/tools/node/controlPointDrag.ts';
import { NodeDrag } from '../../react-canvas-editor/tools/node/nodeDrag.ts';

declare global {
  interface NodeProps {
    genericPath?: {
      path?: string;
      waypointTypes?: EditableWaypointType[];
    };
  }
}

const DEFAULT_PATH = 'M -1 1, L 1 1, L 1 -1, L -1 -1, L -1 1';

const COLORS: Record<EditableWaypointType, string> = {
  corner: 'red',
  smooth: 'blue',
  symmetric: 'green'
};

const NEXT_TYPE: Record<EditableWaypointType, EditableWaypointType> = {
  corner: 'smooth',
  smooth: 'symmetric',
  symmetric: 'corner'
};

export class GenericPathNodeDefinition extends AbstractReactNodeDefinition {
  constructor(name = 'generic-path', displayName = 'Path') {
    super(name, displayName);
  }

  getBoundingPathBuilder(def: DiagramNode) {
    return PathBuilder.fromString(
      def.props.genericPath?.path ?? DEFAULT_PATH,
      unitCoordinateSystem(def.bounds)
    );
  }
}

export class GenericPathComponent extends BaseShape {
  selectedWaypoints: number[] = [];
  private oldProps: BaseShapeProps | undefined;

  setSelectedWaypoints(selectedWaypoints: number[]) {
    this.selectedWaypoints = selectedWaypoints;
    this.update(this.oldProps!);
  }

  build(props: BaseShapeProps, shapeBuilder: ShapeBuilder) {
    this.oldProps = props;

    const drag = DRAG_DROP_MANAGER;
    const pathBuilder = new GenericPathNodeDefinition().getBoundingPathBuilder(props.node);
    const path = pathBuilder.getPath();
    const svgPath = path.asSvgPath();

    const editablePath = new EditablePath(path, props.node);

    const onDoubleClick = (e: MouseEvent) => {
      const domPoint = EventHelper.point(e);
      const dp = props.node.diagram.viewBox.toDiagramPoint(domPoint);
      const idx = editablePath.split(editablePath.toLocalCoordinate(dp));

      const uow = new UnitOfWork(props.node.diagram, true);
      editablePath.commitToNode(uow);
      commitWithUndo(uow, 'Add waypoint');

      this.setSelectedWaypoints([idx]);
    };

    if (props.isSingleSelected && props.tool?.type === 'node') {
      shapeBuilder.add(
        s('path', {
          attrs: {
            d: svgPath,
            x: props.node.bounds.x,
            y: props.node.bounds.y,
            width: props.node.bounds.w,
            height: props.node.bounds.h,
            style: toInlineCSS({
              ...props.style,
              stroke: '#e8e8f8',
              strokeWidth: '20',
              strokeLinejoin: 'miter',
              strokeLinecap: 'square'
            })
          },
          on: {
            dblclick: props.tool?.type === 'node' ? onDoubleClick : undefined
          }
        })
      );
    }
    shapeBuilder.boundaryPath(path, v => {
      v.props.on ??= {};
      v.props.on.dblclick = props.tool?.type === 'node' ? onDoubleClick : undefined;
      v.props.on.mousedown = e =>
        // TODO: This is a massive hack
        // @ts-ignore
        props.onMouseDown({
          button: e.button,
          nativeEvent: e,
          stopPropagation() {
            e.stopPropagation();
          }
        });

      v.props.attrs ??= {};
      v.props.attrs.style ??= '';
      v.props.attrs.style +=
        v.props.attrs.style +
        toInlineCSS({
          pointerEvents: props.isSingleSelected && props.tool?.type === 'node' ? 'none' : undefined
        });
      return v;
    });
    //shapeBuilder.text();

    if (props.isSingleSelected && props.tool?.type === 'node') {
      editablePath.waypoints.map((wp, idx) => {
        if (this.selectedWaypoints.includes(idx)) {
          shapeBuilder.add(
            s('line', {
              attrs: {
                x1: wp.point.x,
                y1: wp.point.y,
                x2: wp.point.x + wp.controlPoints.p1.x,
                y2: wp.point.y + wp.controlPoints.p1.y,
                stroke: 'blue'
              }
            })
          );
          shapeBuilder.add(
            s('circle', {
              attrs: {
                cx: wp.point.x + wp.controlPoints.p1.x,
                cy: wp.point.y + wp.controlPoints.p1.y,
                stroke: 'blue',
                fill: 'white',
                r: '4'
              },
              on: {
                mousedown: e => {
                  if (e.button !== 0) return;
                  drag.initiate(new ControlPointDrag(editablePath, idx, 'p1'));
                  e.stopPropagation();
                }
              }
            })
          );

          shapeBuilder.add(
            s('line', {
              attrs: {
                x1: wp.point.x,
                y1: wp.point.y,
                x2: wp.point.x + wp.controlPoints.p2.x,
                y2: wp.point.y + wp.controlPoints.p2.y,
                stroke: 'green'
              }
            })
          );

          shapeBuilder.add(
            s('circle', {
              attrs: {
                cx: wp.point.x + wp.controlPoints.p2.x,
                cy: wp.point.y + wp.controlPoints.p2.y,
                stroke: 'green',
                fill: 'white',
                r: '4'
              },
              on: {
                mousedown: e => {
                  if (e.button !== 0) return;
                  drag.initiate(new ControlPointDrag(editablePath, idx, 'p2'));
                  e.stopPropagation();
                }
              }
            })
          );
        }

        shapeBuilder.add(
          s('circle', {
            attrs: {
              cx: wp.point.x,
              cy: wp.point.y,
              stroke: COLORS[wp.type],
              fill: this.selectedWaypoints.includes(idx) ? COLORS[wp.type] : 'white',
              r: '4'
            },
            on: {
              mousedown: e => {
                if (e.button !== 0) return;
                drag.initiate(
                  new NodeDrag(
                    editablePath,
                    idx,
                    props.node.diagram.viewBox.toDiagramPoint(EventHelper.point(e))
                  )
                );

                if (e.shiftKey) {
                  this.setSelectedWaypoints([...this.selectedWaypoints, idx]);
                } else {
                  this.setSelectedWaypoints([idx]);
                }
                e.stopPropagation();
              },
              dblclick: e => {
                const uow = new UnitOfWork(props.node.diagram, true);
                if (e.metaKey) {
                  editablePath.deleteWaypoint(idx);
                  editablePath.commitToNode(uow);
                  commitWithUndo(uow, 'Delete waypoint');
                } else {
                  editablePath.updateWaypoint(idx, { type: NEXT_TYPE[wp.type] });
                  editablePath.commitToNode(uow);
                  commitWithUndo(uow, 'Change waypoint type');
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
