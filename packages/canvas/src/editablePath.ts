import { GenericPathNodeDefinition } from './node-types/GenericPath.nodeType';
import { Point } from '@diagram-craft/geometry/point';
import { Box } from '@diagram-craft/geometry/box';
import { Vector } from '@diagram-craft/geometry/vector';
import {
  inverseUnitCoordinateSystem,
  PathListBuilder
} from '@diagram-craft/geometry/pathListBuilder';
import { CubicSegment, LineSegment, PathSegment } from '@diagram-craft/geometry/pathSegment';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { assert, VERIFY_NOT_REACHED, VerifyNotReached } from '@diagram-craft/utils/assert';
import { PathList } from '@diagram-craft/geometry/pathList';

export type EditableSegment = {
  type: 'cubic' | 'line' | 'move';
  start: Point;
  end: Point;
  controlPoints: { p1: Point; p2: Point };
};

export type EditableWaypointType = 'corner' | 'smooth' | 'symmetric';

export class EditableWaypoint {
  #point: Point;
  #controlPoints: { p1: Point; p2: Point };
  #preSegment: EditableSegment | undefined;
  #postSegment: EditableSegment | undefined;

  constructor(point: Point) {
    this.#point = point;
    this.#controlPoints = { p1: Point.ORIGIN, p2: Point.ORIGIN };
  }

  get point() {
    return this.#point;
  }

  set point(p: Point) {
    this.#point = p;
    this.#preSegment!.end = p;
    this.#postSegment!.start = p;
  }

  get controlPoints() {
    return this.#controlPoints;
  }

  get preSegment() {
    return this.#preSegment;
  }

  set preSegment(segment: EditableSegment | undefined) {
    this.#preSegment = segment;
    if (segment) this.#controlPoints.p1 = segment.controlPoints.p2;
  }

  get postSegment() {
    return this.#postSegment;
  }

  set postSegment(segment: EditableSegment | undefined) {
    this.#postSegment = segment;
    if (segment) this.#controlPoints.p2 = segment.controlPoints.p1;
  }

  updateControlPoint(cp: 'p1' | 'p2', absolutePoint: Point, type: EditableWaypointType) {
    this.#controlPoints[cp] = Point.subtract(absolutePoint, this.#point);

    assert.present(this.#postSegment);
    assert.present(this.#preSegment);

    assert.present(this.#controlPoints.p1);
    assert.present(this.#controlPoints.p2);

    // TODO: We don't need to change both segments here - it depends on which control point is
    //       being changed
    this.#postSegment.type = 'cubic';
    this.#preSegment.type = 'cubic';

    const otherCP = cp === 'p1' ? 'p2' : 'p1';
    const typeInUse = type;
    if (typeInUse === 'smooth') {
      const otherLength = Vector.length(this.#controlPoints[otherCP]);
      const angle = Vector.angle(this.#controlPoints[cp]);
      const otherAngle = angle + Math.PI;
      this.#controlPoints[otherCP] = Vector.fromPolar(otherAngle, otherLength);
    } else if (typeInUse === 'symmetric') {
      this.#controlPoints[otherCP] = {
        x: -1 * this.#controlPoints[cp].x,
        y: -1 * this.#controlPoints[cp].y
      };
    }

    this.#preSegment!.controlPoints.p2 = this.#controlPoints.p1;
    this.#postSegment!.controlPoints.p1 = this.#controlPoints.p2;
  }
}

export class EditablePath {
  waypoints: EditableWaypoint[] = [];
  private segments: EditableSegment[] = [];
  private originalSvgPath: string;

  constructor(
    path: PathList,
    public readonly node: DiagramNode
  ) {
    this.buildFromPath(path.segments());
    this.originalSvgPath = path.asSvgPath();
  }

  toLocalCoordinate(coord: Point) {
    return Point.rotateAround(coord, -this.node.bounds.r, Box.center(this.node.bounds));
  }

  deleteWaypoint(wp: EditableWaypoint) {
    const idx = this.waypoints.indexOf(wp);
    this.waypoints = this.waypoints.toSpliced(idx, 1);
    this.segments = this.segments.toSpliced(idx, 1);
  }

  project(p: Point) {
    const path = this.getPath('as-displayed');
    return path.projectPoint(p);
  }

  straighten(p: Point) {
    const path = this.getPath('as-displayed');
    const projection = path.projectPoint(p);

    const segment = this.segments[projection.pathIdx];
    segment.type = 'line';

    const startWp = this.waypoints.find(wp => wp.postSegment === segment);
    const endWp = this.waypoints.find(wp => wp.preSegment === segment);

    assert.present(startWp);
    assert.present(endWp);

    startWp.updateControlPoint(
      'p2',
      Point.add(segment.start, Vector.scale(Vector.from(segment.start, segment.end), 0.25)),
      'corner'
    );
    endWp.updateControlPoint(
      'p1',
      Point.add(segment.end, Vector.scale(Vector.from(segment.end, segment.start), 0.25)),
      'corner'
    );
  }

  split(p: Point): number {
    const path = this.getPath('as-displayed');
    const [pre, post] = path.split(path.projectPoint(p));

    const all = [...pre.segments(), ...post.segments()];

    this.buildFromPath(all);

    return pre.segments().length;
  }

  private getPath(type: 'as-stored' | 'as-displayed') {
    const bounds = this.node.bounds;
    const pb = new PathListBuilder();
    if (type === 'as-stored') {
      pb.setTransform(inverseUnitCoordinateSystem(bounds));
    }

    pb.moveTo(this.waypoints[0].point);

    const segCount = this.segments.length;
    for (let i = 0; i < segCount; i++) {
      const segment = this.segments[i];

      switch (segment.type) {
        case 'line':
          pb.lineTo(segment.end);
          break;
        case 'cubic': {
          const startWp = this.waypoints.find(wp => wp.postSegment === segment);
          const endWp = this.waypoints.find(wp => wp.preSegment === segment);

          assert.present(startWp);

          if (!endWp) {
            pb.quadTo(segment.end, Point.add(startWp.point, startWp.controlPoints.p2!));
          } else {
            pb.cubicTo(
              segment.end,
              Point.add(startWp.point, startWp.controlPoints.p2!),
              Point.add(endWp.point, endWp.controlPoints.p1!)
            );
          }
          break;
        }
        case 'move':
          pb.moveTo(segment.end);
          break;
        default:
          VERIFY_NOT_REACHED();
      }
    }

    return pb.getPaths();
  }

  private resizePathToUnitLCS(): { path: PathList; bounds: Box } {
    const rot = this.node.bounds.r;

    const nodePath = new GenericPathNodeDefinition().getBoundingPathBuilder(this.node).getPaths();
    const nodePathBounds = nodePath.bounds();

    // Raw path and raw bounds represent the path in the original unit coordinate system,
    // but since waypoints have been moved, some points may lie outside the [0, 1] range
    const rawPath = PathListBuilder.fromString(
      this.node.renderProps.custom.genericPath?.path ?? this.originalSvgPath
    ).getPaths();
    const rawBounds = rawPath.bounds();

    // Need to adjust the position of the bounds to account for the rotation and the shifted
    // center of rotation. could probably be done analytically, but this works for now
    const startPointBefore = Point.rotateAround(nodePathBounds, rot, Box.center(this.node.bounds));
    const startPointAfter = Point.rotateAround(nodePathBounds, rot, Box.center(nodePathBounds));
    const diff = Point.subtract(startPointAfter, startPointBefore);

    return {
      path: PathListBuilder.fromString(rawPath.asSvgPath(), p => ({
        x: p.x * (1 / rawBounds.w) - rawBounds.x,
        y: p.y * (1 / rawBounds.h) - rawBounds.y
      })).getPaths(),
      bounds: {
        ...nodePathBounds,
        x: nodePathBounds.x - diff.x,
        y: nodePathBounds.y - diff.y,
        r: rot
      }
    };
  }

  public commitToNode(uow: UnitOfWork) {
    this.node.updateCustomProps(
      'genericPath',
      p => (p.path = this.getPath('as-stored').asSvgPath()),
      uow
    );

    // As this reads the genericPath.path, we have to first set the path provisionally -
    // ... see code above
    const { path, bounds } = this.resizePathToUnitLCS();
    this.node.updateCustomProps('genericPath', p => (p.path = path.asSvgPath()), uow);
    this.node.setBounds(bounds, uow);
  }

  private buildFromPath(segments: ReadonlyArray<PathSegment>) {
    this.segments = [];
    this.waypoints = [];

    const isClosed =
      segments.length === 0 || Point.isEqual(segments[0].start, segments.at(-1)!.end);

    let waypointsInSegment: EditableWaypoint[] = [];

    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      if (s instanceof LineSegment) {
        this.segments.push({
          type: 'line',
          start: s.start,
          end: s.end,
          controlPoints: {
            p1: Vector.scale(Vector.from(s.start, s.end), 0.25),
            p2: Vector.scale(Vector.from(s.end, s.start), 0.25)
          }
        });
      } else if (s instanceof CubicSegment) {
        this.segments.push({
          type: 'cubic',
          start: s.start,
          end: s.end,
          controlPoints: { p1: Point.subtract(s.p1, s.start), p2: Point.subtract(s.p2, s.end) }
        });
      } else {
        throw new VerifyNotReached(`Unknown type ${typeof s}`);
      }

      const wp = new EditableWaypoint(this.segments.at(-1)!.start);
      wp.postSegment = this.segments.at(-1)!;
      if (this.segments.length >= 2) {
        wp.preSegment = this.segments.at(-2)!;
      }

      waypointsInSegment.push(wp);

      if (i < segments.length - 1 && !Point.isEqual(s.end, segments[i + 1].start)) {
        // TODO: We should only do this if the segments connect
        if (isClosed) waypointsInSegment[0].preSegment = this.segments.at(-1)!;
        this.waypoints.push(...waypointsInSegment);

        waypointsInSegment = [];

        this.segments.push({
          type: 'move',
          start: segments[i].end,
          end: segments[i + 1].start,
          controlPoints: { p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 } }
        });
      }
    }

    if (waypointsInSegment.length > 0) {
      // TODO: We should only do this if the segments connect
      if (isClosed) waypointsInSegment[0].preSegment = this.segments.at(-1)!;
      this.waypoints.push(...waypointsInSegment);
    }
  }
}
