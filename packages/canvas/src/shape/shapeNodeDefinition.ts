import type { BaseNodeComponent } from '../components/BaseNodeComponent';
import { PathListBuilder, PathBuilderHelper } from '@diagram-craft/geometry/pathListBuilder';
import { Box } from '@diagram-craft/geometry/box';
import { Transform, TransformFactory } from '@diagram-craft/geometry/transform';
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
import { Anchor, AnchorStrategy, BoundaryDirection } from '@diagram-craft/model/anchor';
import { assert, VerifyNotReached } from '@diagram-craft/utils/assert';
import { PathList } from '@diagram-craft/geometry/pathList';

type NodeShapeConstructor<T extends ShapeNodeDefinition> = {
  new (shapeNodeDefinition: T): BaseNodeComponent<T>;
};

export abstract class ShapeNodeDefinition implements NodeDefinition {
  protected capabilities: Record<NodeCapability, boolean>;

  public readonly name: string;
  public readonly type: string;
  public readonly component: NodeShapeConstructor<this>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected constructor(type: string, component: NodeShapeConstructor<any>);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected constructor(type: string, name: string, component: NodeShapeConstructor<any>);
  protected constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...arr: [string, NodeShapeConstructor<any>] | [string, string, NodeShapeConstructor<any>]
  ) {
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
      'connect-to-boundary': true,
      'anchors-configurable': true,
      'rounding': true
    };
  }

  supports(capability: NodeCapability): boolean {
    return this.capabilities[capability];
  }

  getBoundingPathBuilder(node: DiagramNode) {
    const pathBuilder = new PathListBuilder();
    PathBuilderHelper.rect(pathBuilder, node.bounds);
    return pathBuilder;
  }

  protected getShapeAnchors(_node: DiagramNode): Anchor[] {
    return [];
  }

  protected boundaryDirection(): BoundaryDirection {
    return 'unknown';
  }

  getAnchors(node: DiagramNode) {
    const anchorStrategy = node.getDefinition().supports('anchors-configurable')
      ? (node.renderProps.anchors.type ?? 'shape-defaults')
      : 'shape-defaults';

    if (anchorStrategy === 'shape-defaults') {
      const shapeAnchors = this.getShapeAnchors(node);
      if (shapeAnchors.length > 0) return shapeAnchors;

      return AnchorStrategy.getEdgeAnchors(
        node,
        this.getBoundingPath(node),
        1,
        this.boundaryDirection()
      );
    } else if (anchorStrategy === 'per-edge') {
      return AnchorStrategy.getEdgeAnchors(
        node,
        this.getBoundingPath(node),
        node.renderProps.anchors.perEdgeCount,
        this.boundaryDirection()
      );
    } else if (anchorStrategy === 'none') {
      return [
        { id: 'c', start: Point.of(0.5, 0.5), clip: true, type: 'center' }
      ] satisfies Anchor[];
    } else if (anchorStrategy === 'north-south') {
      return [
        { id: '1', start: Point.of(0.5, 1), type: 'point', isPrimary: true, normal: Math.PI / 2 },
        { id: '2', start: Point.of(0.5, 0), type: 'point', isPrimary: true, normal: -Math.PI / 2 },
        { id: 'c', start: Point.of(0.5, 0.5), clip: true, type: 'center' }
      ] satisfies Anchor[];
    } else if (anchorStrategy === 'east-west') {
      return [
        { id: '3', start: Point.of(1, 0.5), type: 'point', isPrimary: true, normal: 0 },
        { id: '4', start: Point.of(0, 0.5), type: 'point', isPrimary: true, normal: Math.PI },
        { id: 'c', start: Point.of(0.5, 0.5), clip: true, type: 'center' }
      ] satisfies Anchor[];
    } else if (anchorStrategy === 'directions') {
      return AnchorStrategy.getAnchorsByDirection(
        node,
        this.getBoundingPath(node),
        node.renderProps.anchors.directionsCount
      );
    }

    throw new VerifyNotReached();
  }

  getBoundingPath(node: DiagramNode): PathList {
    const bnd = node.bounds;

    const pb = this.getBoundingPathBuilder(node);
    if (round(bnd.r) !== 0) {
      pb.addTransform(TransformFactory.rotateAround(bnd.r, Box.center(bnd)));
    }
    return pb.getPaths();
  }

  getCustomPropertyDefinitions(_node: DiagramNode): ReadonlyArray<CustomPropertyDefinition> {
    return [];
  }

  requestFocus(node: DiagramNode, selectAll = true): void {
    if (node.renderProps.capabilities.editable === false) return;

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

    if (selectAll) {
      setTimeout(() => {
        document.execCommand('selectAll', false, undefined);
      }, 0);
    }
  }

  onChildChanged(node: DiagramNode, uow: UnitOfWork): void {
    if (uow.changeType === 'interactive') return;

    const boundsBefore = node.bounds;

    this.layoutChildren(node, uow);

    if (node.parent && isNode(node.parent) && !Box.isEqual(node.bounds, boundsBefore)) {
      uow.registerOnCommitCallback('onChildChanged', node.parent, () => {
        assert.node(node.parent!);

        const parentDef = node.parent.getDefinition();
        parentDef.onChildChanged(node.parent, uow);
      });
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

  protected layoutChildren(node: DiagramNode, uow: UnitOfWork): void {
    for (const child of node.children) {
      if (isNode(child)) {
        const def = child.getDefinition();
        if (def instanceof ShapeNodeDefinition) {
          def.layoutChildren(child, uow);
        }
      }
    }
  }
}
