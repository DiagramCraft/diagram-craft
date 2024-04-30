import { BaseShape } from './BaseShape';
import {
  CompoundPath,
  PathBuilder,
  PathBuilderHelper,
  unitCoordinateSystem
} from '@diagram-craft/geometry/pathBuilder';
import { Box } from '@diagram-craft/geometry/box';
import { Extent } from '@diagram-craft/geometry/extent';
import { Transform } from '@diagram-craft/geometry/transform';
import { Point } from '@diagram-craft/geometry/point';
import {
  CustomPropertyDefinition,
  NodeCapability,
  NodeDefinition
} from '@diagram-craft/model/elementDefinitionRegistry';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { round } from '@diagram-craft/utils/math';
import { Anchor } from '@diagram-craft/model/types';

type ShapeConstructor<T extends ShapeNodeDefinition = ShapeNodeDefinition> = {
  new (shapeNodeDefinition: T): BaseShape<T>;
};

export abstract class ShapeNodeDefinition implements NodeDefinition {
  protected constructor(
    readonly type: string,
    readonly name: string,

    // @ts-ignore
    readonly component: ShapeConstructor<this>
  ) {}

  supports(capability: NodeCapability): boolean {
    return capability !== 'children';
  }

  getBoundingPathBuilder(node: DiagramNode) {
    const pathBuilder = new PathBuilder(unitCoordinateSystem(node.bounds));
    PathBuilderHelper.rect(pathBuilder, Box.unit());
    return pathBuilder;
  }

  getAnchors(node: DiagramNode) {
    const newAnchors: Array<Anchor> = [];
    newAnchors.push({ point: { x: 0.5, y: 0.5 }, clip: true });

    const paths = this.getBoundingPath(node);

    for (const path of paths.all()) {
      for (const p of path.segments) {
        const { x, y } = p.point(0.5);
        const lx = round((x - node.bounds.x) / node.bounds.w);
        const ly = round((y - node.bounds.y) / node.bounds.h);

        newAnchors.push({ point: { x: lx, y: ly }, clip: false });
      }
    }

    return newAnchors;
  }

  getDefaultAspectRatio(_node: DiagramNode) {
    return 1;
  }

  getBoundingPath(node: DiagramNode): CompoundPath {
    const bnd = node.bounds;

    const pb = this.getBoundingPathBuilder(node);
    if (round(bnd.r) !== 0) {
      pb.setRotation(bnd.r, Box.center(bnd));
    }
    return pb.getPaths();
  }

  getCustomProperties(_node: DiagramNode): Array<CustomPropertyDefinition> {
    return [];
  }

  getDefaultProps(_mode: 'picker' | 'canvas'): NodeProps {
    return {
      style: this.name === 'text' ? 'default-text' : 'default'
    };
  }

  getDefaultConfig(node: DiagramNode): { size: Extent } {
    return { size: { w: 100 * this.getDefaultAspectRatio(node), h: 100 } };
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
