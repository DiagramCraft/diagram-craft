import React from 'react';
import { DiagramNode, NodeCapability, NodeDefinition } from '../model-viewer/diagram.ts';
import { Path, PathBuilder } from '../geometry/pathBuilder.ts';

type Props = {
  node: DiagramNode;
  def: NodeDefinition;
  isSelected: boolean;
  isSingleSelected: boolean;
} & React.SVGProps<SVGRectElement>;

type ReactNode = React.FunctionComponent<Props>;

type BoundingPathFactory = (node: DiagramNode) => Path;

export class ReactNodeDefinition implements NodeDefinition {
  constructor(
    readonly type: string,
    readonly reactNode: ReactNode,
    readonly bounds?: BoundingPathFactory
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
      return builder.getPath();
    }
    return this.bounds?.(node);
  }
}
