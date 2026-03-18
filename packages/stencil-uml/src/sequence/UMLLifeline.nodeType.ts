import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { CustomPropertyDefinition, NodeFlags } from '@diagram-craft/model/elementDefinitionRegistry';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { PathBuilderHelper, PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { Point, _p } from '@diagram-craft/geometry/point';
import { Transform, TransformFactory, Translation } from '@diagram-craft/geometry/transform';
import { Anchor } from '@diagram-craft/model/anchor';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramElement, isNode } from '@diagram-craft/model/diagramElement';
import { renderChildren } from '@diagram-craft/canvas/components/renderElement';
import { Box } from '@diagram-craft/geometry/box';
import { placeExecutionOnParent } from '@diagram-craft/stencil-uml/sequence/UMLLifelineExecution.nodeType';
import { PathList } from '@diagram-craft/geometry/pathList';

const DEFAULT_HEAD_H = 28;
const DEFAULT_LINE_W = 12;
const MIN_LINE_H = 40;
const LIFELINE_HIT_WIDTH = 24;

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      umlLifeline?: {
        participant?: string;
        headH?: number;
      };
    }
  }
}

registerCustomNodeDefaults('umlLifeline', {
  participant: '',
  headH: DEFAULT_HEAD_H
});

const getNodeChildren = (node: DiagramNode) => node.children.filter(isNode);

const getHeadChild = (node: DiagramNode) => getNodeChildren(node)[0];

const getLineChild = (node: DiagramNode) => getNodeChildren(node)[1];

const getLocalCoordinateSpace = (node: DiagramNode): Box => ({
  x: 0,
  y: 0,
  w: node.bounds.w,
  h: node.bounds.h,
  r: 0
});

const getLocalChildBounds = (node: DiagramNode, child: DiagramNode) =>
  Transform.box(child.bounds, ...TransformFactory.fromTo(node.bounds, getLocalCoordinateSpace(node)));

const getGlobalBounds = (node: DiagramNode, localBounds: Box) =>
  Transform.box(localBounds, ...TransformFactory.fromTo(getLocalCoordinateSpace(node), node.bounds));

export class UMLLifelineContainerNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('umlLifelineContainer', 'UML Lifeline Container', UMLLifelineContainerComponent);
    this.setFlags({
      [NodeFlags.StyleFill]: false,
      [NodeFlags.StyleRounding]: false,
      [NodeFlags.AnchorsBoundary]: false,
      [NodeFlags.AnchorsConfigurable]: false,
      [NodeFlags.ChildrenAllowed]: true,
      [NodeFlags.ChildrenCanConvertToContainer]: false,
      [NodeFlags.ChildrenSelectParent]: true,
      [NodeFlags.ChildrenManagedByParent]: true,
      [NodeFlags.ChildrenTransformRotate]: false,
      [NodeFlags.ChildrenTransformScaleX]: false,
      [NodeFlags.ChildrenTransformScaleY]: false,
      [NodeFlags.ChildrenTransformTranslate]: false
    });
  }

  getShapeAnchors(node: DiagramNode): Anchor[] {
    const head = getHeadChild(node);
    const localHeadBounds = head
      ? getLocalChildBounds(node, head)
      : { x: 0, y: 0, w: node.bounds.w, h: DEFAULT_HEAD_H, r: 0 };

    const headLeft = localHeadBounds.x / node.bounds.w;
    const headRight = (localHeadBounds.x + localHeadBounds.w) / node.bounds.w;
    const headCenterY = (localHeadBounds.y + localHeadBounds.h / 2) / node.bounds.h;
    const headBottomY = (localHeadBounds.y + localHeadBounds.h) / node.bounds.h;

    return [
      { id: 'top', start: _p(0.5, 0), type: 'point', isPrimary: true, normal: -Math.PI / 2 },
      { id: 'left', start: _p(headLeft, headCenterY), type: 'point', isPrimary: true, normal: Math.PI },
      { id: 'right', start: _p(headRight, headCenterY), type: 'point', isPrimary: true, normal: 0 },
      {
        id: 'lifeline',
        type: 'edge',
        start: _p(0.5, headBottomY),
        end: _p(0.5, 1),
        clip: false,
        directions: [
          [0, 0],
          [Math.PI, Math.PI]
        ]
      },
      { id: 'bottom', start: _p(0.5, 1), type: 'point', isPrimary: true, normal: Math.PI / 2 },
      { id: 'c', start: _p(0.5, 0.5), clip: true, type: 'center' }
    ];
  }

  getCustomPropertyDefinitions(_def: DiagramNode) {
    return new CustomPropertyDefinition(() => []);
  }

  onTransform(
    _transforms: ReadonlyArray<Transform>,
    node: DiagramNode,
    _newBounds: Box,
    _prevBounds: Box,
    uow: UnitOfWork
  ): void {
    this.layoutChildren(node, uow);
  }

  protected layoutChildren(node: DiagramNode, uow: UnitOfWork): void {
    const head = getHeadChild(node);
    const line = getLineChild(node);
    if (!head || !line) return;

    const localHeadBounds = getLocalChildBounds(node, head);
    const localLineBounds = getLocalChildBounds(node, line);

    const nextContainerWidth = Math.max(node.bounds.w, localHeadBounds.w);
    const nextContainerHeight = Math.max(node.bounds.h, localHeadBounds.h + MIN_LINE_H);

    const nextContainerBounds =
      nextContainerWidth === node.bounds.w && nextContainerHeight === node.bounds.h
        ? node.bounds
        : { ...node.bounds, w: nextContainerWidth, h: nextContainerHeight };

    if (!Box.isEqual(node.bounds, nextContainerBounds)) {
      node.setBounds(nextContainerBounds, uow);
    }

    const effectiveContainerWidth = nextContainerBounds.w;
    const effectiveContainerHeight = nextContainerBounds.h;
    const nextHeadBounds = getGlobalBounds(node, {
      x: (effectiveContainerWidth - localHeadBounds.w) / 2,
      y: 0,
      w: localHeadBounds.w,
      h: localHeadBounds.h,
      r: 0
    });
    head.setBounds(nextHeadBounds, uow);

    const previousLineBounds = line.bounds;
    const nextLineBounds = getGlobalBounds(node, {
      x: (effectiveContainerWidth - localLineBounds.w) / 2,
      y: localHeadBounds.h,
      w: localLineBounds.w,
      h: Math.max(MIN_LINE_H, effectiveContainerHeight - localHeadBounds.h),
      r: 0
    });
    line.setBounds(nextLineBounds, uow);
    if (!Box.isEqual(previousLineBounds, nextLineBounds)) {
      line.getDefinition().onTransform(
        TransformFactory.fromTo(previousLineBounds, nextLineBounds),
        line,
        nextLineBounds,
        previousLineBounds,
        uow
      );
    }
  }
}

class UMLLifelineContainerComponent extends BaseNodeComponent<UMLLifelineContainerNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    builder.noBoundaryNeeded();
    builder.add(renderChildren(this, props.node, props));
  }
}

export class UMLLifelineNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('umlLifeline', 'UML Lifeline', UMLLifelineComponent);
    this.setFlags({
      [NodeFlags.StyleFill]: false,
      [NodeFlags.StyleRounding]: false,
      [NodeFlags.AnchorsBoundary]: false,
      [NodeFlags.AnchorsConfigurable]: false,
      [NodeFlags.ChildrenAllowed]: true,
      [NodeFlags.ChildrenTransformScaleX]: false,
      [NodeFlags.ChildrenTransformScaleY]: false
    });
  }

  getBoundingPathBuilder(node: DiagramNode) {
    const bounds = node.bounds;
    const centerX = bounds.w / 2;

    return new PathListBuilder()
      .withTransform([new Translation(bounds)])
      .moveTo(Point.of(centerX, 0))
      .lineTo(Point.of(centerX, bounds.h));
  }

  getHitArea(node: DiagramNode): PathList {
    const builder = new PathListBuilder();
    PathBuilderHelper.rect(builder, {
      x: node.bounds.x + (node.bounds.w - LIFELINE_HIT_WIDTH) / 2,
      y: node.bounds.y,
      w: LIFELINE_HIT_WIDTH,
      h: node.bounds.h,
      r: 0
    });
    return builder.getPaths();
  }

  getShapeActions(_node: DiagramNode): ReadonlyArray<never> {
    return [];
  }

  override getAnchors(_node: DiagramNode): Anchor[] {
    return [];
  }

  getCustomPropertyDefinitions(_def: DiagramNode) {
    return new CustomPropertyDefinition(() => []);
  }

  onDrop(
    _coord: Point,
    node: DiagramNode,
    elements: ReadonlyArray<DiagramElement>,
    uow: UnitOfWork,
    _operation: string
  ) {
    const executions = elements.filter(
      (element): element is DiagramNode =>
        isNode(element) && element.nodeType === 'umlLifelineExecution'
    );
    if (executions.length === 0) return;

    node.diagram.moveElement(executions, uow, node.layer, {
      relation: 'on',
      element: node
    });

    for (const execution of executions) {
      placeExecutionOnParent(node, execution, uow, { assignDefaultY: true });
    }
  }

  protected layoutChildren(node: DiagramNode, uow: UnitOfWork): void {
    for (const child of node.children) {
      if (!isNode(child) || child.nodeType !== 'umlLifelineExecution') continue;
      placeExecutionOnParent(node, child, uow);
    }
  }
}

class UMLLifelineComponent extends BaseNodeComponent<UMLLifelineNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    builder.boundaryPath(this.def.getBoundingPathBuilder(props.node).getPaths().all(), props.nodeProps, undefined);
    builder.add(renderChildren(this, props.node, props));
  }
}

export const UML_LIFELINE_DEFAULTS = {
  headH: DEFAULT_HEAD_H,
  lineW: DEFAULT_LINE_W
} as const;
