import React from 'react';
import { PathBuilder } from '../geometry/pathBuilder.ts';
import { Path } from '../geometry/path.ts';
import { round } from '../utils/math.ts';
import { Box } from '../geometry/box.ts';
import { DiagramNode } from '../model/diagramNode.ts';
import {
  CustomPropertyDefinition,
  NodeCapability,
  NodeDefinition
} from '../model/elementDefinitionRegistry.ts';
import { Extent } from '../geometry/extent.ts';
import { Diagram } from '../model/diagram.ts';

type Props = {
  node: DiagramNode;
  nodeProps: NodeProps;
  def: NodeDefinition;
  diagram: Diagram;
  isSelected: boolean;
  isSingleSelected: boolean;
} & React.SVGProps<SVGRectElement>;

type ReactNode = React.FunctionComponent<Props>;

type BoundingPathFactory = (node: DiagramNode) => PathBuilder;
type CustomPropertyFactory = (node: DiagramNode) => Record<string, CustomPropertyDefinition>;
type DefaultPropsFactory = (mode: 'picker' | 'canvas') => NodeProps;
type InitialConfig = { size: Extent };

export class ReactNodeDefinition implements NodeDefinition {
  constructor(
    readonly type: string,
    readonly name: string,
    readonly reactNode: ReactNode,
    readonly config: {
      getBoundingPath: BoundingPathFactory;
      getCustomProperties?: CustomPropertyFactory;
      defaultPropsFactory?: DefaultPropsFactory;
      initialConfig?: InitialConfig;
    }
  ) {}

  supports(_capability: NodeCapability): boolean {
    return true;
  }

  getBoundingPath(node: DiagramNode): Path {
    const bnd = node.bounds;

    const pb = this.config.getBoundingPath?.(node);
    if (round(bnd.rotation) !== 0) {
      pb.setRotation(bnd.rotation, Box.center(bnd));
    }
    return pb.getPath();
  }

  getCustomProperties(node: DiagramNode): Record<string, CustomPropertyDefinition> {
    if (this.config?.getCustomProperties !== undefined) {
      return this.config.getCustomProperties(node);
    }
    return {};
  }

  getDefaultProps(mode: 'picker' | 'canvas'): NodeProps {
    if (this.config?.defaultPropsFactory !== undefined) {
      return this.config.defaultPropsFactory(mode);
    }
    return {};
  }

  getInitialConfig(): { size: Extent } {
    if (this.config?.initialConfig !== undefined) {
      return this.config.initialConfig;
    }
    return { size: { w: 100, h: 100 } };
  }
}
