import { ShapeNodeDefinition } from '../shape/shapeNodeDefinition';
import { BaseNodeComponent, BaseShapeBuildShapeProps } from '../components/BaseNodeComponent';
import { NodeCapability } from '@diagram-craft/model/elementDefinitionRegistry';
import { DiagramNode, NodePropsForRendering } from '@diagram-craft/model/diagramNode';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { Box } from '@diagram-craft/geometry/box';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { ShapeBuilder } from '../shape/ShapeBuilder';
import * as svg from '../component/vdom-svg';
import { Transforms } from '../component/vdom-svg';
import { Point } from '@diagram-craft/geometry/point';
import { DiagramElement, isNode } from '@diagram-craft/model/diagramElement';
import { Scale, Transform } from '@diagram-craft/geometry/transform';
import { assert } from '@diagram-craft/utils/assert';
import { deepMerge } from '@diagram-craft/utils/object';
import { Modifiers } from '../dragDropManager';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { hasHighlight, Highlights } from '../highlight';
import { renderElement } from '../components/renderElement';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import type { NodeProps } from '@diagram-craft/model/diagramProps';

type TypeOrPropsFn<T> = T | ((p: NodePropsForRendering) => T);

function getValue<T>(value: TypeOrPropsFn<T>, props: NodePropsForRendering): T {
  if (typeof value === 'function') {
    return (value as (p: NodePropsForRendering) => T)(props);
  } else {
    return value;
  }
}

type TextConfig = {
  id: string;
  text?: NodeProps['text'];
  bounds?: Box;
};

type FlexShapeNodeDefinitionConfig<T extends ShapeNodeDefinition> = {
  isGroup: boolean;
  boundary: T;
  text?: TypeOrPropsFn<TextConfig>;
  drawBoundary?: boolean;
  components?: Array<{
    id: string;
    nodeType?: TypeOrPropsFn<string>;
    bounds?: TypeOrPropsFn<Box>;
    offset?: TypeOrPropsFn<Omit<Box, 'r'>>;
    props?: TypeOrPropsFn<NodeProps>;
    text?: TypeOrPropsFn<TextConfig>;
  }>;
};

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      flex?: {
        components?: Array<{
          id: string;
          nodeType?: string | null;
          bounds?: Box | null;
          offset?: Omit<Box, 'r'> | null;
          props?: NodeProps | null;
          text?: TextConfig | null;
        }> | null;
      };
    }
  }
}

registerCustomNodeDefaults('flex', { components: null });

export class FlexShapeNodeDefinition<
  B extends ShapeNodeDefinition = ShapeNodeDefinition
> extends ShapeNodeDefinition {
  constructor(
    type: string,
    name: string,
    private readonly config: FlexShapeNodeDefinitionConfig<B>
  ) {
    super(type, name, FlexShapeNodeDefinition.Shape);
  }

  static Shape = class extends BaseNodeComponent<FlexShapeNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
      const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();

      builder.add(
        svg.path({
          'd': boundary.asSvgPath(),
          'x': props.node.bounds.x,
          'y': props.node.bounds.y,
          'width': props.node.bounds.w,
          'height': props.node.bounds.h,
          'stroke': hasHighlight(props.node, Highlights.NODE__DROP_TARGET) ? '#30A46C' : 'none', // ''#d5d5d4',
          'stroke-width': hasHighlight(props.node, Highlights.NODE__DROP_TARGET) ? 3 : 1,
          'fill': 'transparent',
          'on': {
            mousedown: props.onMouseDown
          }
        })
      );

      if (this.def.config.drawBoundary === undefined || this.def.config.drawBoundary) {
        builder.boundaryPath(boundary.all());
      }

      if (this.def.config.text) {
        const txtConfig = getValue(this.def.config.text, props.nodeProps);
        builder.text(
          this,
          txtConfig.id,
          props.node.getText(txtConfig.id),
          txtConfig.text,
          txtConfig.bounds
        );
      }

      for (const cmp of props.nodeProps.custom.flex.components ?? this.def.config.components!) {
        const cmpDef = this.def.config.components?.find(c => c.id === cmp.id);

        const cmpBounds = getValue(cmp.bounds ?? cmpDef?.bounds, props.nodeProps);
        const cmpOffset = getValue(cmp.offset ?? cmpDef?.offset, props.nodeProps);
        const cmpProps = deepMerge(
          {},
          getValue(cmpDef?.props, props.nodeProps) ?? {},
          // @ts-expect-error - this should be fine
          getValue(cmp.props ?? cmpDef?.props ?? {}, props.nodeProps)
        );
        const cmpNodeType = getValue(cmp.nodeType ?? cmpDef?.nodeType, props.nodeProps);

        assert.present(
          cmpNodeType,
          `nodeType must be specified in either def or component for FlexShapeNodeDefinition.${this.def.type}`
        );

        const adjustedBounds = {
          x: props.node.bounds.x + (cmpBounds?.x ?? 0) * props.node.bounds.w,
          y: props.node.bounds.y + (cmpBounds?.y ?? 0) * props.node.bounds.h,
          w: (cmpBounds?.w ?? 0) * props.node.bounds.w,
          h: (cmpBounds?.h ?? 0) * props.node.bounds.h,
          r: 0
        };

        if (cmpOffset) {
          adjustedBounds.x += cmpOffset.x;
          adjustedBounds.y += cmpOffset.y;
          adjustedBounds.w += cmpOffset.w;
          adjustedBounds.h += cmpOffset.h;
        }

        // Create a dummy node
        const node = ElementFactory.node(
          `${props.node.id}-${cmpDef?.id ?? cmp.id}`,
          cmpNodeType,
          adjustedBounds,
          props.node.layer,
          cmpProps,
          {}
        );

        const onDoubleClick = builder.makeOnDblclickHandle('1');
        builder.add(
          svg.g(
            {},
            renderElement(this, node, {
              ...props,
              childProps: {
                ...props.childProps,
                onMouseDown: (_id: string, coord: Point, m: Modifiers) => {
                  props.childProps.onMouseDown(props.node.id, coord, m);
                },
                onDoubleClick: () => onDoubleClick?.()
              }
            })
          )
        );

        const txtConfig =
          getValue(cmp.text, props.nodeProps) ?? getValue(cmpDef?.text, props.nodeProps);
        if (txtConfig) {
          builder.text(
            this,
            txtConfig.id,
            props.node.getText(txtConfig.id),
            txtConfig.text,
            txtConfig.bounds ?? node.bounds
          );
        }
      }

      if (this.def.config.isGroup) {
        builder.add(
          svg.g(
            {},
            ...props.node.children.map(child =>
              svg.g(
                { transform: Transforms.rotateBack(props.node.bounds) },
                renderElement(this, child, props)
              )
            )
          )
        );
      }
    }
  };

  onTransform(
    transforms: ReadonlyArray<Transform>,
    node: DiagramNode,
    _newBounds: Box,
    _previousBounds: Box,
    uow: UnitOfWork
  ) {
    if (transforms.find(t => t instanceof Scale)) return;
    for (const child of node.children) {
      child.transform(transforms, uow, true);
    }
  }

  supports(capability: NodeCapability): boolean {
    if (capability === 'children.allowed') return this.config.isGroup;
    if (capability === 'can-be-container') return false;
    return super.supports(capability);
  }

  onDrop(
    _coord: Point,
    node: DiagramNode,
    elements: ReadonlyArray<DiagramElement>,
    uow: UnitOfWork,
    _operation: string
  ) {
    node.diagram.moveElement(elements, uow, node.layer, {
      relation: 'on',
      element: node
    });
  }

  getBoundingPathBuilder(node: DiagramNode): PathListBuilder {
    return this.config.boundary.getBoundingPathBuilder(node);
  }

  onChildChanged(node: DiagramNode, uow: UnitOfWork) {
    if (node.parent && isNode(node.parent)) {
      const parentDef = node.parent.getDefinition();
      parentDef.onChildChanged(node.parent, uow);
    }
  }
}
