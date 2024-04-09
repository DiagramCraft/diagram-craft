import { DiagramNode } from '../model/diagramNode.ts';
import {
  CustomPropertyDefinition,
  NodeCapability,
  NodeDefinition
} from '../model/elementDefinitionRegistry.ts';
import { DiagramElement } from '../model/diagramElement.ts';
import { BaseShape } from './temp/baseShape.temp.ts';
import { Box, Extent, Path, PathBuilder, Point, Transform } from '@diagram-craft/geometry';
import { round } from '@diagram-craft/utils';
import { UnitOfWork } from '../model/unitOfWork.ts';

export abstract class ShapeNodeDefinition implements NodeDefinition {
  protected constructor(
    readonly type: string,
    readonly name: string,
    readonly component: () => BaseShape
  ) {}

  supports(_capability: NodeCapability): boolean {
    return false;
  }

  abstract getBoundingPathBuilder(node: DiagramNode): PathBuilder;

  getBoundingPath(node: DiagramNode): Path {
    const bnd = node.bounds;

    const pb = this.getBoundingPathBuilder(node);
    if (round(bnd.r) !== 0) {
      pb.setRotation(bnd.r, Box.center(bnd));
    }
    return pb.getPath();
  }

  getCustomProperties(_node: DiagramNode): Record<string, CustomPropertyDefinition> {
    return {};
  }

  getDefaultProps(_mode: 'picker' | 'canvas'): NodeProps {
    return {
      style: this.name === 'text' ? 'default-text' : 'default'
    };
  }

  getInitialConfig(): { size: Extent } {
    return { size: { w: 100, h: 100 } };
  }

  requestFocus(node: DiagramNode): void {
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

  onChildChanged(_node: DiagramNode, _uow: UnitOfWork): void {}
  onTransform(transforms: ReadonlyArray<Transform>, node: DiagramNode, uow: UnitOfWork): void {
    for (const child of node.children) {
      child.transform(transforms, uow, true);
    }
  }

  onDrop(
    _coord: Point,
    _node: DiagramNode,
    _elements: ReadonlyArray<DiagramElement>,
    _uow: UnitOfWork,
    _operation: string
  ) {
    // Do nothing
  }

  onPropUpdate(_node: DiagramNode, _uow: UnitOfWork): void {}
}
