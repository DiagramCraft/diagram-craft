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
import { Point } from '../geometry/point.ts';
import { Modifiers } from '../base-ui/drag/dragDropManager.ts';

type Props = {
  node: DiagramNode;
  nodeProps: NodeProps;
  def: NodeDefinition;
  diagram: Diagram;
  isSelected: boolean;
  isSingleSelected: boolean;
  childProps: {
    onMouseDown: (id: string, coord: Point, modifiers: Modifiers) => void;
    onMouseEnter: (id: string) => void;
    onMouseLeave: (id: string) => void;
    onDoubleClick?: (id: string, coord: Point) => void;
  };
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
      requestFocus?: () => void;
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

  requestFocus(node: DiagramNode): void {
    if (this.config?.requestFocus !== undefined) {
      return this.config?.requestFocus();
    }

    const editable = document
      .getElementById(`text_1_${node.id}`)
      ?.getElementsByClassName('svg-node__text')
      .item(0) as HTMLDivElement | undefined | null;

    if (!editable) {
      return;
    }

    editable.contentEditable = 'true';
    editable.style.pointerEvents = 'auto';
    editable.focus();

    setTimeout(() => {
      document.execCommand('selectAll', false, undefined);
    }, 0);
  }
}
