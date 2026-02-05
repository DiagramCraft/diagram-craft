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
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DynamicAccessor } from '@diagram-craft/utils/propertyPath';

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

const LINE_OFFSET = 5;

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
    const radius = bounds.w / 2;

    // Circle is always at the top of the bounds
    return new PathListBuilder()
      .moveTo(_p(bounds.x + bounds.w, bounds.y + radius))
      .arcTo(_p(bounds.x + radius, bounds.y + bounds.w), radius, radius, 0, 0, 1)
      .arcTo(_p(bounds.x, bounds.y + radius), radius, radius, 0, 0, 1)
      .arcTo(_p(bounds.x + radius, bounds.y), radius, radius, 0, 0, 1)
      .arcTo(_p(bounds.x + bounds.w, bounds.y + radius), radius, radius, 0, 0, 1);
  }

  getCustomPropertyDefinitions(def: DiagramNode): CustomPropertyDefinition {
    return new CustomPropertyDefinition(p => [
      p.boolean(def, 'Complete', 'custom.dataModellingIDEF1XCategoryDiscriminator.complete', {
        set: (value: boolean | undefined, uow: UnitOfWork) => {
          const acc = new DynamicAccessor();
          def.updateProps(p => {
            // @ts-expect-error
            acc.set(p, 'custom.dataModellingIDEF1XCategoryDiscriminator.complete', value);
          }, uow);
          def.setBounds({ ...def.bounds, h: def.bounds.h + (value ? 1 : -1) * LINE_OFFSET }, uow);
        }
      })
    ]);
  }

  protected getShapeAnchors(_node: DiagramNode): Anchor[] {
    return [
      // Top of circle
      { start: _p(0.5, 0), id: '1', type: 'point', isPrimary: true, normal: -Math.PI / 2 },
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

    // Draw the circle as boundary
    const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();
    shapeBuilder.boundaryPath(boundary.all());

    // Tangent line at the bottom of the circle (10px wider, 5px on each side)
    const lineExtension = 5;
    const tangentY = bounds.y + bounds.w;
    const tangentPath = new PathListBuilder()
      .moveTo(_p(bounds.x - lineExtension, tangentY))
      .lineTo(_p(bounds.x + bounds.w + lineExtension, tangentY));

    shapeBuilder.path(tangentPath.getPaths().all());

    // If complete, draw another line LINE_OFFSET pixels below the tangent
    if (complete) {
      const secondLineY = tangentY + LINE_OFFSET;
      const secondLinePath = new PathListBuilder()
        .moveTo(_p(bounds.x - lineExtension, secondLineY))
        .lineTo(_p(bounds.x + bounds.w + lineExtension, secondLineY));

      shapeBuilder.path(secondLinePath.getPaths().all());
    }

    shapeBuilder.text(this);
  }
}
