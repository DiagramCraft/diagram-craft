import React from 'react';
import { propsUtils } from '../utils/propsUtils.ts';
import { DiagramNode } from '../../model/diagramNode.ts';
import {
  inverseUnitCoordinateSystem,
  PathBuilder,
  unitCoordinateSystem
} from '../../geometry/pathBuilder.ts';
import { AbstractReactNodeDefinition } from '../reactNodeDefinition.ts';
import { Tool } from '../../react-canvas-editor/tools/types.ts';
import { CubicSegment, LineSegment } from '../../geometry/pathSegment.ts';
import { VerifyNotReached } from '../../utils/assert.ts';
import { useDragDrop } from '../DragDropManager.ts';
import { AbstractDrag, Modifiers } from '../../base-ui/drag/dragDropManager.ts';
import { Point } from '../../geometry/point.ts';
import { Diagram } from '../../model/diagram.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { Path } from '../../geometry/path.ts';
import { Box } from '../../geometry/box.ts';
import { Vector } from '../../geometry/vector.ts';

declare global {
  interface NodeProps {
    genericPath?: {
      path?: string;
    };
  }
}

type EditableSegment = { type: 'cubic' | 'line'; controlPoints: { p1: Point; p2: Point } };
type EditableWaypointType = 'corner' | 'smooth' | 'symmetric';
type EditableWaypoint = {
  point: Point;
  type: EditableWaypointType;
  controlPoints: { p1: Point; p2: Point };
};

const DEFAULT_PATH = 'M -1 1, L 1 1, L 1 -1, L -1 -1, L -1 1';

class EditablePath {
  waypoints: EditableWaypoint[];
  segments: EditableSegment[];

  constructor(
    private readonly path: Path,
    private readonly node: DiagramNode
  ) {
    this.segments = this.path.segments.map(s => {
      if (s instanceof LineSegment) {
        return {
          type: 'line',
          controlPoints: {
            p1: Vector.scale(Vector.from(s.start, s.end), 0.25),
            p2: Vector.scale(Vector.from(s.end, s.start), 0.25)
          }
        };
      } else if (s instanceof CubicSegment) {
        return {
          type: 'cubic',
          controlPoints: { p1: Point.subtract(s.p1, s.start), p2: Point.subtract(s.p2, s.end) }
        };
      } else {
        throw new VerifyNotReached();
      }
    });

    const segCount = this.segments.length;
    this.waypoints = this.path.segments.map((s, idx) => ({
      point: s.start,
      type: 'corner',
      controlPoints: {
        p1: this.segments[idx === 0 ? segCount - 1 : idx - 1].controlPoints.p2,
        p2: this.segments[idx].controlPoints.p1
      }
    }));
  }

  toLocalCoordinate(coord: Point) {
    return Point.rotateAround(coord, -this.node.bounds.r, Box.center(this.node.bounds));
  }

  updateWaypoint(idx: number, point: Partial<EditableWaypoint>) {
    this.waypoints[idx] = { ...this.waypoints[idx], ...point };
    // TODO: Update control points of adjacent segments
  }

  updateControlPoint(idx: number, controlPoint: 'p1' | 'p2', absolutePoint: Point) {
    this.waypoints[idx].controlPoints[controlPoint] = Point.subtract(
      absolutePoint,
      this.waypoints[idx].point
    );

    const nextSegment = this.segments[idx];
    nextSegment.type = 'cubic';

    const previousSegment = this.segments[idx === 0 ? this.segments.length - 1 : idx - 1];
    previousSegment.type = 'cubic';

    // TODO: Update control points of adjacent segments
  }

  getPath() {
    const bounds = this.node.bounds;
    const pb = new PathBuilder(inverseUnitCoordinateSystem(bounds));
    pb.moveTo(this.waypoints[0].point);

    const segCount = this.segments.length;
    for (let i = 0; i < segCount; i++) {
      const nextWp = this.waypoints[(i + 1) % segCount];
      if (this.segments[i].type === 'line') {
        pb.lineTo(nextWp.point);
      } else {
        pb.cubicTo(
          nextWp.point,
          Point.add(this.waypoints[i].point, this.waypoints[i].controlPoints.p2),
          Point.add(nextWp.point, nextWp.controlPoints.p1)
        );
      }
    }
    return pb.getPath();
  }

  getUnitPath(): { path: Path; bounds: Box } {
    const rot = this.node.bounds.r;

    const nodePath = new GenericPathNodeDefinition().getBoundingPathBuilder(this.node).getPath();
    const nodePathBounds = nodePath.bounds();

    // Raw path and raw bounds represent the path in the original unit coordinate system,
    // but since waypoints have been moved, some points may lie outside the [-1, 1] range
    const rawPath = PathBuilder.fromString(
      this.node.props.genericPath?.path ?? DEFAULT_PATH
    ).getPath();
    const rawBounds = rawPath.bounds();

    // Need to adjust the position of the bounds to account for the rotation and the shifted
    // center of rotation
    // Could probably be done analytically, but this works for now
    const startPointBefore = Point.rotateAround(nodePath.start, rot, Box.center(this.node.bounds));
    const startPointAfter = Point.rotateAround(nodePath.start, rot, Box.center(nodePathBounds));
    const diff = Point.subtract(startPointAfter, startPointBefore);

    return {
      path: PathBuilder.fromString(
        rawPath.asSvgPath(),
        inverseUnitCoordinateSystem(rawBounds, false)
      ).getPath(),
      bounds: {
        ...nodePathBounds,
        x: nodePathBounds.x - diff.x,
        y: nodePathBounds.y - diff.y,
        r: rot
      }
    };
  }
}

class NodeDrag extends AbstractDrag {
  constructor(
    private readonly editablePath: EditablePath,
    private readonly diagram: Diagram,
    private readonly node: DiagramNode,
    private readonly waypointIdx: number
  ) {
    super();
  }

  onDrag(coord: Point, _modifiers: Modifiers) {
    this.editablePath.updateWaypoint(this.waypointIdx, {
      point: this.editablePath.toLocalCoordinate(coord)
    });

    UnitOfWork.execute(this.diagram, uow =>
      this.node.updateProps(p => {
        p.genericPath ??= {};
        p.genericPath!.path = this.editablePath.getPath().asSvgPath();
      }, uow)
    );
  }

  onDragEnd(): void {
    const { path, bounds } = this.editablePath.getUnitPath();

    UnitOfWork.execute(this.diagram, uow => {
      this.node.updateProps(p => (p.genericPath!.path = path.asSvgPath()), uow);
      this.node.setBounds(bounds, uow);
    });
  }
}

class ControlPointDrag extends AbstractDrag {
  constructor(
    private readonly editablePath: EditablePath,
    private readonly diagram: Diagram,
    private readonly node: DiagramNode,
    private readonly waypointIdx: number,
    private readonly controlPoint: 'p1' | 'p2'
  ) {
    super();
  }

  onDrag(coord: Point, _modifiers: Modifiers) {
    this.editablePath.updateControlPoint(
      this.waypointIdx,
      this.controlPoint,
      this.editablePath.toLocalCoordinate(coord)
    );

    UnitOfWork.execute(this.diagram, uow =>
      this.node.updateProps(p => {
        p.genericPath ??= {};
        p.genericPath!.path = this.editablePath.getPath().asSvgPath();
      }, uow)
    );
  }

  onDragEnd(): void {}
}

const COLORS: Record<EditableWaypointType, string> = {
  corner: 'red',
  smooth: 'blue',
  symmetric: 'green'
};

export const GenericPath = (props: Props) => {
  const drag = useDragDrop();
  const pathBuilder = new GenericPathNodeDefinition().getBoundingPathBuilder(props.node);
  const path = pathBuilder.getPath();
  const svgPath = path.asSvgPath();

  const editablePath = new EditablePath(path, props.node);

  return (
    <>
      <path
        d={svgPath}
        x={props.node.bounds.x}
        y={props.node.bounds.y}
        width={props.node.bounds.w}
        height={props.node.bounds.h}
        {...propsUtils.filterSvgProperties(props)}
      />

      {props.isSingleSelected && props.tool?.type === 'node' && (
        <>
          {editablePath.waypoints.map((s, i) => (
            <React.Fragment key={i}>
              <circle
                cx={s.point.x}
                cy={s.point.y}
                fill={COLORS[s.type]}
                r={4}
                onMouseDown={e => {
                  if (e.button !== 0) return;
                  drag.initiate(new NodeDrag(editablePath, props.node.diagram, props.node, i));
                  e.stopPropagation();
                }}
              />
              <line
                x1={s.point.x}
                y1={s.point.y}
                x2={s.point.x + s.controlPoints.p1.x}
                y2={s.point.y + s.controlPoints.p1.y}
                stroke={'blue'}
              />
              <circle
                cx={s.point.x + s.controlPoints.p1.x}
                cy={s.point.y + s.controlPoints.p1.y}
                stroke={'blue'}
                fill={'white'}
                r={4}
                onMouseDown={e => {
                  if (e.button !== 0) return;
                  drag.initiate(
                    new ControlPointDrag(editablePath, props.node.diagram, props.node, i, 'p1')
                  );
                  e.stopPropagation();
                }}
              />

              <line
                x1={s.point.x}
                y1={s.point.y}
                x2={s.point.x + s.controlPoints.p2.x}
                y2={s.point.y + s.controlPoints.p2.y}
                stroke={'green'}
              />
              <circle
                cx={s.point.x + s.controlPoints.p2.x}
                cy={s.point.y + s.controlPoints.p2.y}
                stroke={'green'}
                fill={'white'}
                r={4}
                onMouseDown={e => {
                  if (e.button !== 0) return;
                  drag.initiate(
                    new ControlPointDrag(editablePath, props.node.diagram, props.node, i, 'p2')
                  );
                  e.stopPropagation();
                }}
              />
            </React.Fragment>
          ))}
        </>
      )}
    </>
  );
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

type Props = {
  node: DiagramNode;
  tool: Tool | undefined;
  isSelected: boolean;
  isSingleSelected: boolean;
  nodeProps: NodeProps;
} & React.SVGProps<SVGRectElement>;
