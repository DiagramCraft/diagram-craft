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
import { renderChildren } from '@diagram-craft/canvas/components/renderElement';
import { Extent } from '@diagram-craft/geometry/extent';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { isNode } from '@diagram-craft/model/diagramElement';
import { fromUnitLCS, PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { _p } from '@diagram-craft/geometry/point';

const DEFAULT_SIZE = 12;

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      dataModellingBarkerEntity?: {
        size?: number;
      };
    }
  }
}

registerCustomNodeDefaults('dataModellingBarkerEntity', { size: DEFAULT_SIZE });

export class BarkerEntityNodeDefinition extends LayoutCapableShapeNodeDefinition {
  overlayComponent = CollapsibleOverlayComponent;

  constructor() {
    super('dataModellingBarkerEntity', 'Barker Entity', BarkerEntityComponent);

    this.setFlags({
      [NodeFlags.StyleFill]: true,
      [NodeFlags.StyleRounding]: false,
      [NodeFlags.ChildrenCollapsible]: true,
      [NodeFlags.ChildrenTransformScaleX]: false,
      [NodeFlags.ChildrenTransformScaleY]: false
    });
  }

  getContainerPadding(node: DiagramNode) {
    const titleSize = node.renderProps.custom.dataModellingBarkerEntity.size ?? DEFAULT_SIZE;
    return { top: titleSize, bottom: 0, right: 0, left: 0 };
  }

  getCustomPropertyDefinitions(node: DiagramNode) {
    return new CustomPropertyDefinition(() => [this.getCollapsiblePropertyDefinitions(node)]);
  }

  getBoundingPathBuilder(node: DiagramNode) {
    const radius = 5;
    const xr = radius / node.bounds.w;
    const yr = radius / node.bounds.h;

    return new PathListBuilder()
      .withTransform(fromUnitLCS(node.bounds))
      .moveTo(_p(xr, 0))
      .lineTo(_p(1 - xr, 0))
      .arcTo(_p(1, yr), xr, yr, 0, 0, 1)
      .lineTo(_p(1, 1 - yr))
      .arcTo(_p(1 - xr, 1), xr, yr, 0, 0, 1)
      .lineTo(_p(xr, 1))
      .arcTo(_p(0, 1 - yr), xr, yr, 0, 0, 1)
      .lineTo(_p(0, yr))
      .arcTo(_p(xr, 0), xr, yr, 0, 0, 1);
  }
}

export class BarkerEntityComponent extends BaseNodeComponent<BarkerEntityNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    const nodeProps = props.nodeProps;
    const bounds = props.node.bounds;

    const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();
    builder.boundaryPath(boundary.all(), nodeProps);

    if (this.def.shouldRenderChildren(props.node)) {
      builder.add(renderChildren(this, props.node, props));
    }

    const titleSize = nodeProps.custom.boxContainer.size ?? DEFAULT_SIZE;

    builder.text(
      this,
      '1',
      props.node.getText(),
      nodeProps.text,
      { ...bounds, h: titleSize },
      (size: Extent) =>
        UnitOfWork.execute(props.node.diagram, uow => {
          uow.metadata.nonDirty = true;

          props.node.updateCustomProps('dataModellingBarkerEntity', p => (p.size = size.h), uow);

          const parent = props.node.parent;
          if (isNode(parent)) {
            parent.getDefinition().onChildChanged(parent, uow);
          }
        })
    );
  }
}
