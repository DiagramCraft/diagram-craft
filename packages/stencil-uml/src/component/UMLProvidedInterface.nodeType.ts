import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathBuilderHelper, PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { _p, Point } from '@diagram-craft/geometry/point';
import { Box } from '@diagram-craft/geometry/box';
import { PathList } from '@diagram-craft/geometry/pathList';
import { Anchor } from '@diagram-craft/model/anchor';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { NodeFlags } from '@diagram-craft/model/elementDefinitionRegistry';

export class UMLProvidedInterfaceNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('umlProvidedInterface', 'UML Provided Interface', UMLProvidedInterfaceComponent);

    this.setFlags({
      [NodeFlags.StyleRounding]: false
    });
  }

  protected getShapeAnchors(_node: DiagramNode): Anchor[] {
    return [
      { start: _p(0.5, 0), id: 'n', type: 'point', isPrimary: true, normal: -Math.PI / 2 },
      { start: _p(1, 0.5), id: 'e', type: 'point', isPrimary: true, normal: 0 },
      { start: _p(0.5, 1), id: 's', type: 'point', isPrimary: true, normal: Math.PI / 2 },
      { start: _p(0, 0.5), id: 'w', type: 'point', isPrimary: true, normal: Math.PI },
      { start: _p(0.5, 0.5), clip: true, id: 'c', type: 'center' }
    ];
  }

  getBoundingPathBuilder(node: { bounds: Box }) {
    const { x, y, w, h } = node.bounds;
    const radius = Math.max(0, Math.min(w, h) / 2);
    const center = Point.of(x + w / 2, y + h / 2);

    return PathListBuilder.fromString(
      `M ${center.x - radius} ${center.y} ` +
        `A ${radius} ${radius} 0 1 0 ${center.x + radius} ${center.y} ` +
        `A ${radius} ${radius} 0 1 0 ${center.x - radius} ${center.y}`
    );
  }

  getHitArea(node: { bounds: Box }): PathList {
    const builder = new PathListBuilder();
    PathBuilderHelper.rect(builder, node.bounds);
    return builder.getPaths();
  }
}

export class UMLProvidedInterfaceComponent extends BaseNodeComponent<UMLProvidedInterfaceNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();

    builder.boundaryPath(boundary.all());
    builder.text(this, '1', props.node.getText(), props.nodeProps.text, props.node.bounds);
  }
}
