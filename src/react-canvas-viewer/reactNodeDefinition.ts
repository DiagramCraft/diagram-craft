import React from 'react';
import { NOT_IMPLEMENTED_YET } from '../utils/assert.ts';
import { DiagramNode, NodeCapability, NodeDefinition } from '../model-viewer/diagram.ts';

type Props = {
  def: DiagramNode;
  isSelected: boolean;
  isSingleSelected: boolean;
} & React.SVGProps<SVGRectElement>;

type ReactNode = React.FunctionComponent<Props>;

export class ReactNodeDefinition implements NodeDefinition {
  constructor(
    readonly type: string,
    readonly reactNode: ReactNode
  ) {}

  supports(_capability: NodeCapability): boolean {
    return true;
  }

  getBoundingPaths(node: DiagramNode): string[] {
    const dest: string[] = [];

    // TODO: We probably need to scope the node ids by the diagram id
    const el = document.getElementById(`node-${node.id}`);
    el?.querySelectorAll('.node-boundary')?.forEach(b => {
      if (b instanceof SVGPathElement) {
        dest.push(b.getAttribute('d') ?? '');
      } else if (b instanceof SVGRectElement) {
        dest.push(
          `M ${b.x.baseVal.value} ${b.y.baseVal.value} h ${b.width.baseVal.value} v ${b.height.baseVal.value} h -${b.width.baseVal.value} Z`
        );
      } else {
        NOT_IMPLEMENTED_YET();
      }
    });

    return dest;
  }
}
