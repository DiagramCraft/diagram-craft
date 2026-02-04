import { CollapsibleOverlayComponent } from '@diagram-craft/canvas/shape/collapsible';
import { LayoutCapableShapeNodeDefinition } from '@diagram-craft/canvas/shape/layoutCapableShapeNodeDefinition';
import {
  CustomPropertyDefinition,
  NodeFlags
} from '@diagram-craft/model/elementDefinitionRegistry';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { renderChildren } from '@diagram-craft/canvas/components/renderElement';
import { Extent } from '@diagram-craft/geometry/extent';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { isNode } from '@diagram-craft/model/diagramElement';

const DEFAULT_SIZE = 12;

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      boxContainer?: {
        size?: number;
      };
    }
  }
}

registerCustomNodeDefaults('boxContainer', { size: DEFAULT_SIZE });

export class IEEntityNodeDefinition extends LayoutCapableShapeNodeDefinition {
  overlayComponent = CollapsibleOverlayComponent;

  constructor() {
    super('boxContainer', 'IE Entity', IEEntityComponent);

    this.setFlags({
      [NodeFlags.StyleFill]: true,
      [NodeFlags.StyleRounding]: false,
      [NodeFlags.ChildrenCollapsible]: true,
      [NodeFlags.ChildrenTransformScaleX]: false,
      [NodeFlags.ChildrenTransformScaleY]: false
    });
  }

  getContainerPadding(node: DiagramNode) {
    const titleSize = node.renderProps.custom.boxContainer.size ?? DEFAULT_SIZE;
    return { top: titleSize, bottom: 0, right: 0, left: 0 };
  }

  getCustomPropertyDefinitions(node: DiagramNode) {
    return new CustomPropertyDefinition(() => [this.getCollapsiblePropertyDefinitions(node)]);
  }
}

export class IEEntityComponent extends BaseNodeComponent<IEEntityNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    const nodeProps = props.nodeProps;
    const bounds = props.node.bounds;

    const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();
    builder.boundaryPath(boundary.all(), nodeProps);

    if (this.def.shouldRenderChildren(props.node)) {
      builder.add(renderChildren(this, props.node, props));
    }

    const titleSize = nodeProps.custom.boxContainer.size ?? DEFAULT_SIZE;

    const separator = new PathListBuilder()
      .moveTo(Point.of(bounds.x, bounds.y + titleSize))
      .lineTo(Point.of(bounds.x + bounds.w, bounds.y + titleSize))
      .getPaths()
      .all();
    builder.path(separator, nodeProps);

    builder.text(
      this,
      '1',
      props.node.getText(),
      nodeProps.text,
      { ...bounds, h: titleSize },
      (size: Extent) =>
        UnitOfWork.execute(props.node.diagram, uow => {
          uow.metadata.nonDirty = true;

          props.node.updateCustomProps('boxContainer', p => (p.size = size.h), uow);

          const parent = props.node.parent;
          if (isNode(parent)) {
            parent.getDefinition().onChildChanged(parent, uow);
          }
        })
    );
  }
}
