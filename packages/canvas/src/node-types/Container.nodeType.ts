import { LayoutCapableShapeNodeDefinition } from '../shape/layoutCapableShapeNodeDefinition';
import { BaseNodeComponent, BaseShapeBuildShapeProps } from '../components/BaseNodeComponent';
import * as svg from '../component/vdom-svg';
import { Transforms } from '../component/vdom-svg';
import { ShapeBuilder } from '../shape/ShapeBuilder';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { renderElement } from '../components/renderElement';
import { type PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import type { Anchor } from '@diagram-craft/model/anchor';
import { CollapsibleOverlayComponent } from '../shape/collapsible';
import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      container?: {
        shape?: string;
      };
    }
  }
}

registerCustomNodeDefaults('container', {
  shape: ''
});

const getShape = (node: DiagramNode): ShapeNodeDefinition | undefined => {
  const shape = node.renderProps.custom.container.shape;
  if (shape === '') return undefined;

  return node.diagram.document.nodeDefinitions.get(shape) as ShapeNodeDefinition | undefined;
};

export class ContainerNodeDefinition extends LayoutCapableShapeNodeDefinition {
  overlayComponent = CollapsibleOverlayComponent;

  constructor(id = 'container', name = 'Container', component = ContainerComponent) {
    super(id, name, component);

    this.capabilities.fill = true;
    this.capabilities.collapsible = true;
  }

  getCustomPropertyDefinitions(node: DiagramNode): Array<CustomPropertyDefinition> {
    const shape = getShape(node);
    return [
      ...this.getCollapsiblePropertyDefinitions(node),
      ...(shape
        ? [
          {
            id: 'delimiter',
            type: 'delimiter',
            label: shape.name,
            isSet: false
          } as CustomPropertyDefinition,
          ...shape.getCustomPropertyDefinitions(node)
        ]
        : [])
    ];
  }

  getBoundingPathBuilder(node: DiagramNode): PathListBuilder {
    const shape = getShape(node);
    if (shape) {
      return shape.getBoundingPathBuilder(node);
    } else {
      return super.getBoundingPathBuilder(node);
    }
  }

  getAnchors(node: DiagramNode): Anchor[] {
    const shape = getShape(node);
    if (shape) {
      return shape.getAnchors(node);
    } else {
      return super.getAnchors(node);
    }
  }
}

export class ContainerComponent extends BaseNodeComponent<ContainerNodeDefinition> {
  delegateComponent: BaseNodeComponent | undefined;

  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    const shape = getShape(props.node);
    if (shape) {
      if (!this.delegateComponent) {
        this.delegateComponent = new shape.component(shape);
      } else if (this.delegateComponent.constructor !== shape.component) {
        this.delegateComponent = new shape.component(shape);
      }
    }

    if (this.delegateComponent) {
      this.delegateComponent.buildShape(props, builder);
    } else {
      const paths = new ContainerNodeDefinition().getBoundingPathBuilder(props.node).getPaths();

      const path = paths.singular();
      const svgPath = path.asSvgPath();

      builder.noBoundaryNeeded();
      builder.add(
        svg.path({
          'class': 'svg-node--container-outline',
          'd': svgPath,
          'x': props.node.bounds.x,
          'y': props.node.bounds.y,
          'width': props.node.bounds.w,
          'height': props.node.bounds.h,
          'fill': 'transparent',
          'on': {
            mousedown: props.onMouseDown
          }
        })
      );
    }

    if (this.def.shouldRenderChildren(props.node)) {
      props.node.children.forEach(child => {
        builder.add(
          svg.g(
            { transform: Transforms.rotateBack(props.node.bounds) },
            renderElement(this, child, props)
          )
        );
      });
    }
  }
}
