import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { _p } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { Anchor } from '@diagram-craft/model/anchor';

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      dataModellingIDEF1XCategoryDiscriminator?: {
        complete?: boolean;
      };
    }
  }
}

registerCustomNodeDefaults('dataModellingIDEF1XCategoryDiscriminator', { complete: false });

export class IDEF1XCategoryDiscriminatorNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super(
      'dataModellingIDEF1XCategoryDiscriminator',
      'IDEF1X Category Discriminator',
      IDEF1XCategoryDiscriminatorComponent
    );
  }

  getBoundingPathBuilder(node: DiagramNode) {
    const bounds = node.bounds;
    const complete = node.renderProps.custom.dataModellingIDEF1XCategoryDiscriminator.complete;

    // Circle radius is half the width
    const radius = bounds.w / 2;

    // The circle's vertical space depends on whether complete or not
    // If complete, we need 5px extra below the tangent for the second line
    const extraHeight = complete ? 5 : 0;
    const circleBottom = bounds.h - extraHeight;
    const centerY = circleBottom - radius;

    // Build circle path centered horizontally, positioned with bottom at circleBottom
    return new PathListBuilder()
      .moveTo(_p(bounds.x + bounds.w, bounds.y + centerY))
      .arcTo(_p(bounds.x + radius, bounds.y + circleBottom), radius, radius, 0, 0, 1)
      .arcTo(_p(bounds.x, bounds.y + centerY), radius, radius, 0, 0, 1)
      .arcTo(_p(bounds.x + radius, bounds.y + centerY - radius), radius, radius, 0, 0, 1)
      .arcTo(_p(bounds.x + bounds.w, bounds.y + centerY), radius, radius, 0, 0, 1);
  }

  getCustomPropertyDefinitions(def: DiagramNode): CustomPropertyDefinition {
    return new CustomPropertyDefinition(p => [
      p.boolean(def, 'Complete', 'custom.dataModellingIDEF1XCategoryDiscriminator.complete')
    ]);
  }

  protected getShapeAnchors(node: DiagramNode): Anchor[] {
    const bounds = node.bounds;
    const complete = node.renderProps.custom.dataModellingIDEF1XCategoryDiscriminator.complete;
    const extraHeight = complete ? 5 : 0;

    // Top of circle in normalized coordinates
    const topY = (bounds.h - extraHeight - bounds.w) / bounds.h;

    return [
      // Top of circle
      { start: _p(0.5, topY), id: '1', type: 'point', isPrimary: true, normal: -Math.PI / 2 },
      // Three evenly spaced anchors at the bottom of the bottom-most line
      { start: _p(0.25, 1), id: '2', type: 'point', isPrimary: true, normal: Math.PI / 2 },
      { start: _p(0.5, 1), id: '3', type: 'point', isPrimary: true, normal: Math.PI / 2 },
      { start: _p(0.75, 1), id: '4', type: 'point', isPrimary: true, normal: Math.PI / 2 },
      // Center
      { start: _p(0.5, 0.5), clip: true, id: 'c', type: 'center' }
    ];
  }
}

class IDEF1XCategoryDiscriminatorComponent extends BaseNodeComponent<IDEF1XCategoryDiscriminatorNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    const bounds = props.node.bounds;
    const complete = props.nodeProps.custom.dataModellingIDEF1XCategoryDiscriminator.complete;

    // The circle's vertical space depends on whether complete or not
    const extraHeight = complete ? 5 : 0;
    const circleBottom = bounds.h - extraHeight;

    // Draw the circle as boundary
    const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();
    shapeBuilder.boundaryPath(boundary.all());

    // Draw the tangent line at the bottom of the circle (10px wider, 5px on each side)
    const lineExtension = 5;
    const tangentY = bounds.y + circleBottom;
    const tangentPath = new PathListBuilder()
      .moveTo(_p(bounds.x - lineExtension, tangentY))
      .lineTo(_p(bounds.x + bounds.w + lineExtension, tangentY));

    shapeBuilder.path(tangentPath.getPaths().all());

    // If complete, draw another line 5 pixels below the tangent
    if (complete) {
      const secondLineY = tangentY + 5;
      const secondLinePath = new PathListBuilder()
        .moveTo(_p(bounds.x - lineExtension, secondLineY))
        .lineTo(_p(bounds.x + bounds.w + lineExtension, secondLineY));

      shapeBuilder.path(secondLinePath.getPaths().all());
    }

    shapeBuilder.text(this);
  }
}
