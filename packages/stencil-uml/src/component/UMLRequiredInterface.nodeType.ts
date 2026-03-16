import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { Box } from '@diagram-craft/geometry/box';
import { PathList } from '@diagram-craft/geometry/pathList';
import { PathBuilderHelper, PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { _p, Point } from '@diagram-craft/geometry/point';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { Anchor } from '@diagram-craft/model/anchor';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import {
  CustomPropertyDefinition,
  NodeFlags
} from '@diagram-craft/model/elementDefinitionRegistry';
import { TransformFactory } from '@diagram-craft/geometry/transform';

type RequiredInterfaceDirection = 'e' | 'se' | 's' | 'sw' | 'w' | 'nw' | 'n' | 'ne';

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      umlRequiredInterface?: {
        direction?: RequiredInterfaceDirection;
      };
    }
  }
}

registerCustomNodeDefaults('umlRequiredInterface', {
  direction: 'e'
});

export class UMLRequiredInterfaceNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('umlRequiredInterface', 'UML Required Interface', UMLRequiredInterfaceComponent);

    this.setFlags({
      [NodeFlags.StyleFill]: false,
      [NodeFlags.StyleRounding]: false
    });
  }

  getCustomPropertyDefinitions(node: DiagramNode): CustomPropertyDefinition {
    return new CustomPropertyDefinition(p => [
      p.select(node, 'Orientation', 'custom.umlRequiredInterface.direction', [
        { value: 'n', label: 'North' },
        { value: 'ne', label: 'North East' },
        { value: 'e', label: 'East' },
        { value: 'se', label: 'South East' },
        { value: 's', label: 'South' },
        { value: 'sw', label: 'South West' },
        { value: 'w', label: 'West' },
        { value: 'nw', label: 'North West' }
      ])
    ]);
  }

  protected getShapeAnchors(node: DiagramNode): Anchor[] {
    const direction = node.renderProps.custom.umlRequiredInterface.direction ?? 'e';
    const rotation = this.getRotation(direction);
    const { x, y, w, h } = node.bounds;
    const radius = Math.min(w, h) / 2;
    const center = Box.center(node.bounds);

    const anchors: Anchor[] = [
      { id: 'm', type: 'point', isPrimary: true, normal: 0, start: _p(0, 0) },
      { start: _p(0.5, 0.5), clip: true, id: 'c', type: 'center' }
    ];

    return anchors.map(anchor => ({
      ...anchor,
      start:
        anchor.id === 'c'
          ? anchor.start
          : (() => {
              const absolute = Point.rotateAround(
                Point.of(
                  center.x + radius * Math.cos(anchor.normal!),
                  center.y + radius * Math.sin(anchor.normal!)
                ),
                rotation,
                center
              );

              return Point.of((absolute.x - x) / w, (absolute.y - y) / h);
            })(),
      normal: anchor.normal === undefined ? undefined : anchor.normal + rotation
    }));
  }

  getBoundingPathBuilder(node: DiagramNode) {
    const { x, y, w, h } = node.bounds;
    const radius = Math.min(w, h) / 2;
    const center = Point.of(x + w / 2, y + h / 2);
    return new PathListBuilder()
      .moveTo(Point.of(center.x, center.y - radius))
      .arcTo(Point.of(center.x, center.y + radius), radius, radius, 0, 0, 1)
      .addTransform(
        TransformFactory.rotateAround(
          this.getRotation(node.renderProps.custom.umlRequiredInterface.direction ?? 'e'),
          Box.center(node.bounds)
        )
      );
  }

  getHitArea(node: { bounds: Box }): PathList {
    const builder = new PathListBuilder();
    PathBuilderHelper.rect(builder, node.bounds);
    return builder.getPaths();
  }

  private getRotation(direction: RequiredInterfaceDirection): number {
    const directions = {
      e: 0,
      se: Math.PI / 4,
      s: Math.PI / 2,
      sw: (3 * Math.PI) / 4,
      w: Math.PI,
      nw: (-3 * Math.PI) / 4,
      n: -Math.PI / 2,
      ne: -Math.PI / 4
    } satisfies Record<RequiredInterfaceDirection, number>;

    return directions[direction];
  }
}

export class UMLRequiredInterfaceComponent extends BaseNodeComponent<UMLRequiredInterfaceNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();
    builder.boundaryPath(boundary.all());
    builder.text(this, '1', props.node.getText(), props.nodeProps.text, props.node.bounds);
  }
}
