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
import { renderElement } from '@diagram-craft/canvas/components/renderElement';
import { Extent } from '@diagram-craft/geometry/extent';
import { isNode } from '@diagram-craft/model/diagramElement';
import { fromUnitLCS, PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { _p } from '@diagram-craft/geometry/point';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import * as svg from '@diagram-craft/canvas/component/vdom-svg';
import { Transforms } from '@diagram-craft/canvas/component/vdom-svg';
import { VNode } from '@diagram-craft/canvas/component/vdom';

const DEFAULT_TITLE_SIZE = 20;

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      dataModellingIDEF1XEntity?: {
        dependant?: boolean;
        size?: number;
      };
    }
  }
}

registerCustomNodeDefaults('dataModellingIDEF1XEntity', {
  dependant: true,
  size: DEFAULT_TITLE_SIZE
});

export class IDEF1XEntityNodeDefinition extends LayoutCapableShapeNodeDefinition {
  overlayComponent = CollapsibleOverlayComponent;

  constructor() {
    super('dataModellingIDEF1XEntity', 'IDEF1X Entity', IDEF1XEntityComponent);

    this.setFlags({
      [NodeFlags.StyleFill]: true,
      [NodeFlags.StyleRounding]: false,
      [NodeFlags.ChildrenCollapsible]: true,
      [NodeFlags.ChildrenTransformScaleX]: false,
      [NodeFlags.ChildrenTransformScaleY]: false,
      [NodeFlags.ChildrenSelectParent]: true
    });
  }

  getContainerPadding(node: DiagramNode) {
    const titleSize = node.renderProps.custom.dataModellingIDEF1XEntity.size ?? DEFAULT_TITLE_SIZE;
    return { top: titleSize, bottom: 0, right: 0, left: 0 };
  }

  getCustomPropertyDefinitions(def: DiagramNode): CustomPropertyDefinition {
    return new CustomPropertyDefinition(p => [
      p.boolean(def, 'Dependant', 'custom.dataModellingIDEF1XEntity.dependant')
    ]);
  }
}

export class IDEF1XEntityComponent extends BaseNodeComponent<IDEF1XEntityNodeDefinition> {
  getPathBuilder(node: DiagramNode) {
    const size = node.renderProps.custom.dataModellingIDEF1XEntity.size ?? DEFAULT_TITLE_SIZE;
    const bounds = { ...node.bounds, y: node.bounds.y + size, h: node.bounds.h - size };

    const radius = node.renderProps.custom.dataModellingIDEF1XEntity.dependant ? 10 : 0;
    const xr = radius / bounds.w;
    const yr = radius / bounds.h;

    return new PathListBuilder()
      .withTransform(fromUnitLCS(bounds))
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

  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    const nodeProps = props.nodeProps;
    const bounds = props.node.bounds;

    const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();
    builder.boundaryPath(boundary.all(), props.nodeProps, '1', {
      style: {
        fill: 'transparent',
        stroke: 'transparent'
      }
    });

    builder.path(this.getPathBuilder(props.node).getPaths().all(), nodeProps, {});

    const titleSize = props.nodeProps.custom.dataModellingIDEF1XEntity.size ?? DEFAULT_TITLE_SIZE;

    if (this.def.shouldRenderChildren(props.node)) {
      let h = 0;
      const children: VNode[] = [];
      for (let i = 0; i < props.node.children.length; i++) {
        const child = props.node.children[i]!;
        children.push(
          svg.g(
            { transform: Transforms.rotateBack(props.node.bounds) },
            renderElement(this, child, props)
          )
        );
        h += child.bounds.h;

        if (i < props.node.children.length - 1) {
          children.push(
            svg.line({
              x1: bounds.x,
              y1: bounds.y + titleSize + h,
              x2: bounds.x + bounds.w,
              y2: bounds.y + titleSize + h,
              stroke: props.nodeProps.stroke.color
            })
          );
        }
      }
      builder.add(svg.g({}, ...children));
    }

    builder.text(
      this,
      '1',
      props.node.getText(),
      nodeProps.text,
      { ...bounds, h: titleSize },
      (size: Extent) =>
        UnitOfWork.execute(props.node.diagram, uow => {
          uow.metadata.nonDirty = true;

          props.node.updateCustomProps('dataModellingIDEF1XEntity', p => (p.size = size.h), uow);

          const parent = props.node.parent;
          if (isNode(parent)) {
            parent.getDefinition().onChildChanged(parent, uow);
          }
        })
    );
  }
}
