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

declare global {
  interface NodeProps {
    genericPath?: {
      path?: string;
    };
  }
}

type Waypoint = {
  waypoints: Point[];
  segments: { type: 'cubic' | 'line'; controlPoints?: { p1: Point; p2: Point } }[];
};

const getWaypoints = (path: Path): Waypoint => {
  const waypoints = path.segments.map(s => s.start);

  return {
    waypoints,
    segments: path.segments.map(s => {
      if (s instanceof LineSegment) {
        return { type: 'line' };
      } else if (s instanceof CubicSegment) {
        return {
          type: 'cubic',
          controlPoints: { p1: Point.subtract(s.p1, s.start), p2: Point.subtract(s.end, s.p2) }
        };
      } else {
        throw new VerifyNotReached();
      }
    })
  };
};

const pathFromWaypoints = (waypoints: Waypoint, bounds: Box) => {
  const pb = new PathBuilder(inverseUnitCoordinateSystem(bounds));
  pb.moveTo(waypoints.waypoints[0]);
  for (let i = 0; i < waypoints.segments.length; i++) {
    if (waypoints.segments[i].type === 'line') {
      pb.lineTo(waypoints.waypoints[i + 1] ?? waypoints.waypoints[0]);
    } else {
      const s = waypoints.segments[i];
      pb.cubicTo(
        Point.add(waypoints.waypoints[i], s.controlPoints!.p1),
        Point.add(waypoints.waypoints[i + 1], s.controlPoints!.p2),
        waypoints.waypoints[i + 1] ?? waypoints.waypoints[0]
      );
    }
  }
  return pb.getPath();
};

class NodeDrag extends AbstractDrag {
  constructor(
    private readonly diagram: Diagram,
    private readonly node: DiagramNode,
    private readonly waypointIdx: number
  ) {
    super();
  }

  onDrag(coord: Point, _modifiers: Modifiers) {
    const pathBuilder = new GenericPathNodeDefinition().getBoundingPathBuilder(this.node);

    const waypoints = getWaypoints(pathBuilder.getPath());
    waypoints.waypoints[this.waypointIdx] = Point.rotateAround(
      coord,
      -this.node.bounds.r,
      Box.center(this.node.bounds)
    );

    const newPath = pathFromWaypoints(waypoints, this.node.bounds);

    UnitOfWork.execute(this.diagram, uow =>
      this.node.updateProps(p => {
        p.genericPath ??= {};
        p.genericPath!.path = newPath.asSvgPath();
      }, uow)
    );
  }

  onDragEnd(): void {
    const actualPath = new GenericPathNodeDefinition().getBoundingPathBuilder(this.node).getPath();
    const actualBounds = actualPath.bounds();

    const rawPath = PathBuilder.fromString(this.node.props.genericPath!.path!).getPath();
    const rawBounds = rawPath.bounds();

    const rescaledPath = PathBuilder.fromString(
      rawPath.asSvgPath(),
      inverseUnitCoordinateSystem(rawBounds, false)
    ).getPath();

    // TODO: Adjusting based on calculating the difference between the start point of the path
    //       and the start point of the rescaled path is a bit of a hack. It would be better to
    //       determine the difference analytically
    const startPoint = Point.rotateAround(
      actualPath.segments[0].start,
      this.node.bounds.r,
      Box.center(this.node.bounds)
    );

    UnitOfWork.execute(this.diagram, uow => {
      this.node.updateProps(p => (p.genericPath!.path = rescaledPath.asSvgPath()), uow);
      this.node.setBounds(
        {
          ...actualBounds,
          r: this.node.bounds.r
        },
        uow
      );
      const p = new GenericPathNodeDefinition().getBoundingPathBuilder(this.node).getPath();
      const startPoint2 = Point.rotateAround(
        p.segments[0].start,
        this.node.bounds.r,
        Box.center(this.node.bounds)
      );

      const diff = Point.subtract(startPoint2, startPoint);
      this.node.setBounds(
        {
          ...this.node.bounds,
          x: this.node.bounds.x - diff.x,
          y: this.node.bounds.y - diff.y
        },
        uow
      );
    });
  }
}

export const GenericPath = (props: Props) => {
  const drag = useDragDrop();
  const pathBuilder = new GenericPathNodeDefinition().getBoundingPathBuilder(props.node);
  const path = pathBuilder.getPath();
  const svgPath = path.asSvgPath();

  const normalizedSegments = path.segments.map(s => {
    if (s instanceof CubicSegment) {
      return s;
    } else if (s instanceof LineSegment) {
      return CubicSegment.fromLine(s);
    } else {
      throw new VerifyNotReached();
    }
  });

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
          <circle
            cx={path.segments[0].start.x}
            cy={path.segments[0].start.y}
            fill={'red'}
            r={4}
            onMouseDown={e => {
              if (e.button !== 0) return;
              drag.initiate(new NodeDrag(props.node.diagram, props.node, 0));
              e.stopPropagation();
            }}
          />

          {normalizedSegments.slice(1).map((s, i) => (
            <circle
              key={i}
              cx={s.start.x}
              cy={s.start.y}
              fill={'green'}
              r={4}
              onMouseDown={e => {
                if (e.button !== 0) return;
                drag.initiate(new NodeDrag(props.node.diagram, props.node, i + 1));
                e.stopPropagation();
              }}
            />
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
      def.props.genericPath?.path ?? 'M -1 1, L 1 1, L 1 -1, L -1 -1, L -1 1',
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
