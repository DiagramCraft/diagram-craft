import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Anchor } from '@diagram-craft/model/anchor';
import { Point } from '@diagram-craft/geometry/point';
import {
  CustomPropertyDefinition,
  NodeFlags
} from '@diagram-craft/model/elementDefinitionRegistry';

export class UMLDestroyNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('umlDestroy', 'UML Destroy', UMLDestroyComponent);
    this.setFlags({ [NodeFlags.AnchorsConfigurable]: false });
  }

  override getAnchors(_node: DiagramNode): Anchor[] {
    return [{ id: 'c', type: 'center', start: Point.of(0.5, 0.5) }];
  }

  getCustomPropertyDefinitions(_def: DiagramNode) {
    return new CustomPropertyDefinition(() => []);
  }
}

class UMLDestroyComponent extends BaseNodeComponent<UMLDestroyNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder): void {
    const { h, w } = props.node.bounds;

    const b = shapeBuilder.buildBoundary();
    b.path(w, 0).line(0, h).move(0, 0).line(w, h);
    b.stroke(props.nodeProps.stroke, true);
  }
}
