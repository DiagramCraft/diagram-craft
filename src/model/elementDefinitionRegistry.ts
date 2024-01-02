import { DiagramNode } from './diagramNode.ts';
import { Path } from '../geometry/path.ts';
import { Extent } from '../geometry/extent.ts';
import { assert } from '../utils/assert.ts';
import { UnitOfWork } from './unitOfWork.ts';

export type NodeCapability = 'children';

// TODO: Make make this into an interface in the global namespace we can extend
export type CustomPropertyDefinition = {
  type: 'number';
  label: string;
  value: number;
  minValue?: number;
  maxValue?: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
};

export interface NodeDefinition {
  type: string;
  name: string;

  supports(capability: NodeCapability): boolean;

  getBoundingPath(node: DiagramNode): Path;
  getCustomProperties(node: DiagramNode): Record<string, CustomPropertyDefinition>;

  getDefaultProps(mode: 'picker' | 'canvas'): NodeProps;

  // TODO: This should support adding children and more than just the size
  getInitialConfig(): { size: Extent };

  onChildChanged(node: DiagramNode, uow: UnitOfWork): void;

  requestFocus(node: DiagramNode): void;
}

export class NodeDefinitionRegistry {
  private nodes = new Map<string, NodeDefinition>();

  register(node: NodeDefinition) {
    this.nodes.set(node.type, node);
  }

  get(type: string): NodeDefinition {
    const r = this.nodes.get(type);
    assert.present(r);
    return r;
  }

  getAll() {
    return [...this.nodes.values()];
  }
}

export type EdgeCapability = string;

export interface EdgeDefinition {
  type: string;

  supports(capability: EdgeCapability): boolean;
}

export class EdgeDefinitionRegistry {
  private edges = new Map<string, EdgeDefinition>();

  register(edge: EdgeDefinition) {
    this.edges.set(edge.type, edge);
  }

  get(type: string): EdgeDefinition {
    const r = this.edges.get(type);
    assert.present(r);
    return r;
  }
}
