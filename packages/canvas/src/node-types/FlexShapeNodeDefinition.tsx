import { ShapeNodeDefinition } from '../shape/shapeNodeDefinition';
import { BaseNodeComponent, BaseShapeBuildProps } from '../components/BaseNodeComponent';
import { NodeCapability } from '@diagram-craft/model/elementDefinitionRegistry';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { PathBuilder } from '@diagram-craft/geometry/pathBuilder';
import { Box } from '@diagram-craft/geometry/box';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { ShapeBuilder } from '../shape/ShapeBuilder';
import * as svg from '../component/vdom-svg';
import { Transforms } from '../component/vdom-svg';
import { newid } from '@diagram-craft/utils/id';
import { Point } from '@diagram-craft/geometry/point';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { Scale, Transform } from '@diagram-craft/geometry/transform';
import { DeepReadonly } from '@diagram-craft/utils/types';
import { assert } from '@diagram-craft/utils/assert';
import { deepMerge } from '@diagram-craft/utils/object';

type TypeOrPropsFn<T> = T | ((p: NodeProps | DeepReadonly<NodeProps>) => T);

function getValue<T>(value: TypeOrPropsFn<T>, props: NodeProps | DeepReadonly<NodeProps>): T {
  if (typeof value === 'function') {
    return (value as (p: NodeProps | DeepReadonly<NodeProps>) => T)(props);
  } else {
    return value;
  }
}

type TextConfig = {
  id: string;
  text?: NodeProps['text'];
  bounds?: Box;
};

type FlexShapeNodeDefinitionConfig = {
  isGroup: boolean;
  boundary: ShapeNodeDefinition;
  text?: TypeOrPropsFn<TextConfig>;
  drawBoundary?: boolean;
  components?: Array<{
    id: string;
    nodeType?: TypeOrPropsFn<string>;
    bounds?: TypeOrPropsFn<Box>;
    offset?: TypeOrPropsFn<Omit<Box, 'r'>>;
    props?: TypeOrPropsFn<NodeProps>;
    text?: TextConfig;
  }>;
};

declare global {
  interface NodeProps {
    shapeFlex?: {
      components?: Array<{
        id?: string;
        nodeType?: string;
        bounds?: Box;
        offset?: Omit<Box, 'r'>;
        props?: NodeProps;
        text?: TextConfig;
      }>;
    };
  }
}

export class FlexShapeNodeDefinition extends ShapeNodeDefinition {
  constructor(
    type: string,
    name: string,
    private readonly config: FlexShapeNodeDefinitionConfig
  ) {
    super(type, name, FlexShapeNodeDefinition.Shape);
  }

  static Shape = class extends BaseNodeComponent<FlexShapeNodeDefinition> {
    buildShape(props: BaseShapeBuildProps, builder: ShapeBuilder) {
      const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();

      builder.add(
        svg.path({
          'd': boundary.asSvgPath(),
          'x': props.node.bounds.x,
          'y': props.node.bounds.y,
          'width': props.node.bounds.w,
          'height': props.node.bounds.h,
          'stroke': props.nodeProps.highlight?.includes('drop-target') ? '#30A46C' : 'none', // ''#d5d5d4',
          'stroke-width': props.nodeProps.highlight?.includes('drop-target') ? 3 : 1,
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
        builder.text(this, txtConfig.id, txtConfig.text, txtConfig.bounds);
      }

      for (const cmp of props.nodeProps.shapeFlex?.components ?? this.def.config.components!) {
        const cmpDef = this.def.config.components?.find(c => c.id === cmp.id);

        const cmpBounds = getValue(cmp.bounds ?? cmpDef?.bounds, props.nodeProps);
        const cmpOffset = getValue(cmp.offset ?? cmpDef?.offset, props.nodeProps);
        const cmpProps = deepMerge(
          {},
          getValue(cmpDef?.props, props.nodeProps) ?? {},
          getValue(cmp.props ?? cmpDef?.props ?? {}, props.nodeProps)
        );
        const cmpNodeType = getValue(cmp.nodeType ?? cmpDef?.nodeType, props.nodeProps);

        assert.present(cmpNodeType, 'nodeType must be specified in either def or component');

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
        const node = new DiagramNode(
          newid(),
          cmpNodeType,
          adjustedBounds,
          props.node.diagram,
          props.node.layer,
          cmpProps
        );

        builder.add(svg.g({}, this.makeElement(node, props)));

        const txtConfig =
          getValue(cmp.text, props.nodeProps) ?? getValue(cmpDef?.text, props.nodeProps);
        if (txtConfig) {
          builder.text(this, txtConfig.id, txtConfig.text, txtConfig.bounds ?? node.bounds);
        }
      }

      if (this.def.config.isGroup) {
        builder.add(
          svg.g(
            {},
            ...props.node.children.map(child =>
              svg.g(
                { transform: Transforms.rotateBack(props.node.bounds) },
                this.makeElement(child, props)
              )
            )
          )
        );
      }
    }
  };

  onTransform(transforms: ReadonlyArray<Transform>, node: DiagramNode, uow: UnitOfWork) {
    if (transforms.find(t => t instanceof Scale)) return;
    for (const child of node.children) {
      child.transform(transforms, uow, true);
    }
  }

  supports(capability: NodeCapability): boolean {
    if (capability === 'children') return this.config.isGroup;
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

  getBoundingPathBuilder(node: DiagramNode): PathBuilder {
    return this.config.boundary.getBoundingPathBuilder(node);
  }

  onChildChanged(node: DiagramNode, uow: UnitOfWork) {
    if (node.parent) {
      const parentDef = node.parent.getDefinition();
      parentDef.onChildChanged(node.parent, uow);
    }
  }
}
