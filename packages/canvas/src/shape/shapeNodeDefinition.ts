import { BaseNodeComponent } from '../components/BaseNodeComponent';
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
import { DiagramElement, isNode } from '@diagram-craft/model/diagramElement';
import { round } from '@diagram-craft/utils/math';
import { Anchor } from '@diagram-craft/model/anchor';
import { VerifyNotReached } from '@diagram-craft/utils/assert';

type NodeShapeConstructor<T extends ShapeNodeDefinition = ShapeNodeDefinition> = {
  new (shapeNodeDefinition: T): BaseNodeComponent<T>;
};

export abstract class ShapeNodeDefinition implements NodeDefinition {
  protected capabilities: Record<NodeCapability, boolean>;

  public readonly name: string;
  public readonly type: string;
  public readonly component: NodeShapeConstructor<this>;

  // @ts-ignore
  protected constructor(type: string, component: NodeShapeConstructor<this>);
  // @ts-ignore
  protected constructor(type: string, name: string, component: NodeShapeConstructor<this>);
  // eslint-disable-next-line
  protected constructor(...arr: any[]) {
    if (arr.length === 2) {
      this.type = arr[0];
      this.name = '#unnamed';
      this.component = arr[1];
    } else if (arr.length === 3) {
      this.type = arr[0];
      this.name = arr[1];
      this.component = arr[2];
    } else {
      throw new VerifyNotReached();
    }

    this.capabilities = {
      'fill': true,
      'select': true,
      'children': false,
      'connect-to-boundary': true
    };
  }

  supports(capability: NodeCapability): boolean {
    return this.capabilities[capability];
  }

  getBoundingPathBuilder(node: DiagramNode) {
    const pathBuilder = new PathBuilder(unitCoordinateSystem(node.bounds));
    PathBuilderHelper.rect(pathBuilder, Box.unit());
    return pathBuilder;
  }

  getAnchors(node: DiagramNode) {
    const newAnchors: Array<Anchor> = [];
    newAnchors.push({ id: 'c', start: { x: 0.5, y: 0.5 }, clip: true, type: 'center' });

    const paths = this.getBoundingPath(node);

    for (let i = 0; i < paths.all().length; i++) {
      const path = paths.all()[i];
      for (let j = 0; j < path.segments.length; j++) {
        const p = path.segments[j];
        const { x, y } = p.point(0.5);

        // Need to rotate back to get anchors in the [0,1],[0,1] coordinate system
        const rp = Point.rotateAround({ x, y }, -node.bounds.r, Box.center(node.bounds));

        // Note: This is to Prevent NaN issues
        if (node.bounds.h === 0 || node.bounds.w === 0) continue;

        const lx = round((rp.x - node.bounds.x) / node.bounds.w);
        const ly = round((rp.y - node.bounds.y) / node.bounds.h);

        newAnchors.push({ id: `${i}_${j}`, start: { x: lx, y: ly }, clip: false, type: 'point' });
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

  onChildChanged(node: DiagramNode, uow: UnitOfWork): void {
    if (uow.changeType === 'interactive') return;

    this.layoutChildren(node, uow);

    if (node.parent) {
      const parentDef = node.parent.getDefinition();
      parentDef.onChildChanged(node.parent, uow);
    }
  }

  onTransform(
    transforms: ReadonlyArray<Transform>,
    node: DiagramNode,
    _newBounds: Box,
    _previousBounds: Box,
    uow: UnitOfWork
  ): void {
    for (const child of node.children) {
      child.transform(transforms, uow, true);
    }

    this.layoutChildren(node, uow);
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

  onPropUpdate(node: DiagramNode, uow: UnitOfWork): void {
    this.layoutChildren(node, uow);
  }

  layoutChildren(node: DiagramNode, uow: UnitOfWork): void {
    for (const child of node.children) {
      if (isNode(child)) {
        child.getDefinition().layoutChildren(child, uow);
      }
    }
  }
}
