import { Path } from '../../../geometry/path.ts';
import { DiagramNode } from '../../../model/diagramNode.ts';
import { Point } from '../../../geometry/point.ts';
import { Box } from '../../../geometry/box.ts';
import { Vector } from '../../../geometry/vector.ts';
import { inverseUnitCoordinateSystem, PathBuilder } from '../../../geometry/pathBuilder.ts';
import { UnitOfWork } from '../../../model/unitOfWork.ts';
import { CubicSegment, LineSegment, PathSegment } from '../../../geometry/pathSegment.ts';
import { VerifyNotReached } from '../../../utils/assert.ts';
import { GenericPathNodeDefinition } from '../../../react-canvas-viewer/node-types/GenericPath.tsx';

export type EditableSegment = { type: 'cubic' | 'line'; controlPoints: { p1: Point; p2: Point } };
export type EditableWaypointType = 'corner' | 'smooth' | 'symmetric';
export type EditableWaypoint = {
  point: Point;
  type: EditableWaypointType;
  controlPoints: { p1: Point; p2: Point };
};

export class EditablePath {
  waypoints: EditableWaypoint[] = [];
  segments: EditableSegment[] = [];
  private originalSvgPath: string;

  constructor(
    path: Path,
    private readonly node: DiagramNode
  ) {
    this.buildFromPath(path.segments);
    this.originalSvgPath = path.asSvgPath();

    const gpProps = node.props.genericPath ?? {};
    if (gpProps.waypointTypes && gpProps.waypointTypes.length === this.waypoints.length) {
      for (let i = 0; i < this.waypoints.length; i++) {
        this.waypoints[i].type = gpProps.waypointTypes[i];
      }
    }
  }

  toLocalCoordinate(coord: Point) {
    return Point.rotateAround(coord, -this.node.bounds.r, Box.center(this.node.bounds));
  }

  deleteWaypoint(idx: number) {
    this.waypoints = this.waypoints.toSpliced(idx, 1);
    this.segments = this.segments.toSpliced(idx, 1);
  }

  updateWaypoint(idx: number, point: Partial<EditableWaypoint>) {
    this.waypoints[idx] = { ...this.waypoints[idx], ...point };
  }

  split(p: Point) {
    const path = this.getPath('as-displayed');
    const [pre, post] = path.split(path.projectPoint(p));

    const all = [...pre.segments, ...post.segments];

    const originalWaypoints = this.waypoints;

    this.buildFromPath(all);

    for (let i = 0; i < this.waypoints.length; i++) {
      for (let j = 0; j < originalWaypoints.length; j++) {
        if (Point.squareDistance(this.waypoints[i].point, originalWaypoints[j].point) < 0.0001) {
          this.waypoints[i].type = originalWaypoints[j].type;
          break;
        }
      }
    }
  }

  updateControlPoint(
    idx: number,
    cp: 'p1' | 'p2',
    absolutePoint: Point,
    type: EditableWaypointType | undefined = undefined
  ) {
    const wp = this.waypoints[idx];
    wp.controlPoints[cp] = Point.subtract(absolutePoint, wp.point);

    // TODO: We don't need to change both segments here - it depends on which control point is
    //       being changed
    const nextSegment = this.segments[idx];
    nextSegment.type = 'cubic';

    const previousSegment = this.segments[idx === 0 ? this.segments.length - 1 : idx - 1];
    previousSegment.type = 'cubic';

    const otherCP = cp === 'p1' ? 'p2' : 'p1';
    const typeInUse = type ?? wp.type;
    if (typeInUse === 'smooth') {
      const otherLength = Vector.length(wp.controlPoints[otherCP]);
      const angle = Vector.angle(wp.controlPoints[cp]);
      const otherAngle = angle + Math.PI;
      wp.controlPoints[otherCP] = Vector.fromPolar(otherAngle, otherLength);
    } else if (typeInUse === 'symmetric') {
      wp.controlPoints[otherCP] = {
        x: -1 * wp.controlPoints[cp].x,
        y: -1 * wp.controlPoints[cp].y
      };
    }
  }

  getPath(type: 'as-stored' | 'as-displayed') {
    const bounds = this.node.bounds;
    const pb =
      type === 'as-displayed'
        ? new PathBuilder()
        : new PathBuilder(inverseUnitCoordinateSystem(bounds));

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

  resizePathToUnitLCS(): { path: Path; bounds: Box } {
    const rot = this.node.bounds.r;

    const nodePath = new GenericPathNodeDefinition().getBoundingPathBuilder(this.node).getPath();
    const nodePathBounds = nodePath.bounds();

    // Raw path and raw bounds represent the path in the original unit coordinate system,
    // but since waypoints have been moved, some points may lie outside the [-1, 1] range
    const rawPath = PathBuilder.fromString(
      this.node.props.genericPath?.path ?? this.originalSvgPath
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

  commit() {
    UnitOfWork.execute(this.node.diagram, uow => {
      this.node.updateProps(p => {
        p.genericPath ??= {};
        p.genericPath.path = this.getPath('as-stored').asSvgPath();
        p.genericPath.waypointTypes = this.waypoints.map(wp => wp.type);
      }, uow);

      // As this reads the genericPath.path, we have to first set the path provisionally -
      // ... see code above
      const { path, bounds } = this.resizePathToUnitLCS();
      this.node.updateProps(p => {
        p.genericPath ??= {};
        p.genericPath.path = path.asSvgPath();
        p.genericPath.waypointTypes = this.waypoints.map(wp => wp.type);
      }, uow);
      this.node.setBounds(bounds, uow);
    });
  }

  private buildFromPath(segments: ReadonlyArray<PathSegment>) {
    this.segments = segments.map(s => {
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
    this.waypoints = segments.map((s, idx) => ({
      point: s.start,
      type: 'corner',
      controlPoints: {
        p1: this.segments[idx === 0 ? segCount - 1 : idx - 1].controlPoints.p2,
        p2: this.segments[idx].controlPoints.p1
      }
    }));
  }
}
