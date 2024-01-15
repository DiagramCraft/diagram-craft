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

type EditableSegment = { type: 'cubic' | 'line'; controlPoints?: { p1: Point; p2: Point } };

class EditablePath {
  waypoints: Point[];
  segments: EditableSegment[];

  constructor(
    private readonly path: Path,
    private readonly node: DiagramNode
  ) {
    this.waypoints = this.path.segments.map(s => s.start);
    this.segments = this.path.segments.map(s => {
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
    });
  }

  toLocalCoordinate(coord: Point) {
    return Point.rotateAround(coord, -this.node.bounds.r, Box.center(this.node.bounds));
  }

  getPath() {
    const bounds = this.node.bounds;
    const pb = new PathBuilder(inverseUnitCoordinateSystem(bounds));
    pb.moveTo(this.waypoints[0]);
    for (let i = 0; i < this.segments.length; i++) {
      if (this.segments[i].type === 'line') {
        pb.lineTo(this.waypoints[i + 1] ?? this.waypoints[0]);
      } else {
        const s = this.segments[i];
        pb.cubicTo(
          Point.add(this.waypoints[i], s.controlPoints!.p1),
          Point.add(this.waypoints[i + 1], s.controlPoints!.p2),
          this.waypoints[i + 1] ?? this.waypoints[0]
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
    const rawPath = PathBuilder.fromString(this.node.props.genericPath!.path!).getPath();
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
  private editablePath: EditablePath;

  constructor(
    private readonly diagram: Diagram,
    private readonly node: DiagramNode,
    private readonly waypointIdx: number
  ) {
    super();
    this.editablePath = new EditablePath(
      new GenericPathNodeDefinition().getBoundingPathBuilder(this.node).getPath(),
      this.node
    );
  }

  onDrag(coord: Point, _modifiers: Modifiers) {
    this.editablePath.waypoints[this.waypointIdx] = this.editablePath.toLocalCoordinate(coord);

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
