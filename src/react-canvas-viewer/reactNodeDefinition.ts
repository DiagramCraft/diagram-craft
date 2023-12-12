import React from 'react';
import { PathBuilder } from '../geometry/pathBuilder.ts';
import { Path } from '../geometry/path.ts';
import { round } from '../utils/math.ts';
import { Box } from '../geometry/box.ts';
import { EditableDiagram } from '../model-editor/editable-diagram.ts';
import { DiagramNode } from '../model-viewer/diagramNode.ts';
import {
  CustomPropertyDefinition,
  NodeCapability,
  NodeDefinition
} from '../model-viewer/nodeDefinition.ts';

type Props = {
  node: DiagramNode;
  def: NodeDefinition;
  diagram: EditableDiagram;
  isSelected: boolean;
  isSingleSelected: boolean;
} & React.SVGProps<SVGRectElement>;

type ReactNode = React.FunctionComponent<Props>;

type BoundingPathFactory = (node: DiagramNode) => PathBuilder;
type CustomPropertyFactory = (node: DiagramNode) => Record<string, CustomPropertyDefinition>;
type DefaultPropsFactory = (node: DiagramNode, mode: 'picker' | 'canvas') => NodeProps;

export class ReactNodeDefinition implements NodeDefinition {
  constructor(
    readonly type: string,
    readonly name: string,
    readonly reactNode: ReactNode,
    readonly bounds?: BoundingPathFactory,
    readonly customProps?: CustomPropertyFactory,
    readonly defaultPropsFactory?: DefaultPropsFactory
  ) {}

  supports(_capability: NodeCapability): boolean {
    return true;
  }

  getBoundingPath(node: DiagramNode): Path {
    if (this.bounds === undefined) {
      const builder = new PathBuilder();
      builder.moveTo(node.bounds.pos.x, node.bounds.pos.y);
      builder.lineTo(node.bounds.pos.x + node.bounds.size.w, node.bounds.pos.y);
      builder.lineTo(
        node.bounds.pos.x + node.bounds.size.w,
        node.bounds.pos.y + node.bounds.size.h
      );
      builder.lineTo(node.bounds.pos.x, node.bounds.pos.y + node.bounds.size.h);
      builder.lineTo(node.bounds.pos.x, node.bounds.pos.y);

      if (round(node.bounds.rotation) !== 0) {
        builder.setRotation(node.bounds.rotation, Box.center(node.bounds));
      }

      return builder.getPath();
    }
    const pb = this.bounds?.(node);
    if (round(node.bounds.rotation) !== 0) {
      pb.setRotation(node.bounds.rotation, Box.center(node.bounds));
    }
    return pb.getPath();
  }

  getCustomProperties(node: DiagramNode): Record<string, CustomPropertyDefinition> {
    if (this.customProps !== undefined) {
      return this.customProps(node);
    }
    return {};
  }

  getDefaultProps(node: DiagramNode, mode: 'picker' | 'canvas'): NodeProps {
    if (this.defaultPropsFactory !== undefined) {
      return this.defaultPropsFactory(node, mode);
    }
    return {};
  }
}
