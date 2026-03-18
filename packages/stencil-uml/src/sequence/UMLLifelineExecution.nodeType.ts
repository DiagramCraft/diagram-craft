import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { CustomPropertyDefinition, NodeFlags } from '@diagram-craft/model/elementDefinitionRegistry';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Point, _p } from '@diagram-craft/geometry/point';
import { DiagramElement, isNode } from '@diagram-craft/model/diagramElement';
import { renderChildren } from '@diagram-craft/canvas/components/renderElement';
import { Anchor } from '@diagram-craft/model/anchor';

export const UML_EXECUTION_DEFAULT_WIDTH = 10;
export const UML_EXECUTION_DEFAULT_HEIGHT = 40;
export const UML_EXECUTION_DEFAULT_TOP_GAP = 10;
export const UML_EXECUTION_NEST_OFFSET = 8;

const isExecutionNode = (element: DiagramElement): element is DiagramNode =>
  isNode(element) && element.nodeType === 'umlLifelineExecution';

const getExecutionChildren = (node: DiagramNode) => node.children.filter(isExecutionNode);

const getFirstAvailableExecutionY = (
  parent: DiagramNode,
  child: DiagramNode,
  topGap = UML_EXECUTION_DEFAULT_TOP_GAP
) => {
  const siblings = getExecutionChildren(parent)
    .filter(sibling => sibling.id !== child.id)
    .toSorted((a, b) => a.bounds.y - b.bounds.y);

  let y = parent.bounds.y + topGap;
  for (const sibling of siblings) {
    if (y + child.bounds.h + topGap <= sibling.bounds.y) {
      return y;
    }

    y = Math.max(y, sibling.bounds.y + sibling.bounds.h + topGap);
  }

  return y;
};

export const placeExecutionOnParent = (
  parent: DiagramNode,
  child: DiagramNode,
  uow: UnitOfWork,
  opts?: { assignDefaultY?: boolean }
) => {
  const currentY =
    child.parent === parent && child.bounds.y < parent.bounds.y
      ? parent.bounds.y + child.bounds.y
      : child.bounds.y;
  const nextX =
    parent.nodeType === 'umlLifeline'
      ? parent.bounds.x + (parent.bounds.w - child.bounds.w) / 2
      : parent.bounds.x + UML_EXECUTION_NEST_OFFSET;
  const nextY = opts?.assignDefaultY ? getFirstAvailableExecutionY(parent, child) : currentY;

  child.setBounds(
    {
      ...child.bounds,
      x: nextX,
      y: nextY
    },
    uow
  );
};

export class UMLLifelineExecutionNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('umlLifelineExecution', 'UML Lifeline Execution', UMLLifelineExecutionComponent);
    this.setFlags({
      [NodeFlags.StyleRounding]: false,
      [NodeFlags.ChildrenAllowed]: true,
      [NodeFlags.ChildrenTransformScaleX]: false,
      [NodeFlags.ChildrenTransformScaleY]: false
    });
  }

  override getAnchors(_node: DiagramNode): Anchor[] {
    return [
      { id: 'tl', start: _p(0, 0), type: 'point', isPrimary: true, normal: Math.PI },
      { id: 'bl', start: _p(0, 1), type: 'point', isPrimary: true, normal: Math.PI },
      { id: 'r1', start: _p(1, 0 / 6), type: 'point', isPrimary: true, normal: 0 },
      { id: 'r2', start: _p(1, 1 / 6), type: 'point', isPrimary: true, normal: 0 },
      { id: 'r3', start: _p(1, 2 / 6), type: 'point', isPrimary: true, normal: 0 },
      { id: 'r4', start: _p(1, 3 / 6), type: 'point', isPrimary: true, normal: 0 },
      { id: 'r5', start: _p(1, 4 / 6), type: 'point', isPrimary: true, normal: 0 },
      { id: 'r6', start: _p(1, 5 / 6), type: 'point', isPrimary: true, normal: 0 },
      { id: 'r7', start: _p(1, 6 / 6), type: 'point', isPrimary: true, normal: 0 }
    ];
  }

  override onAdd(node: DiagramNode, diagram: DiagramNode['diagram'], uow: UnitOfWork) {
    super.onAdd(node, diagram, uow);
    node.invalidateAnchors(uow);
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
    const executions = elements.filter(isExecutionNode);
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
    for (const execution of getExecutionChildren(node)) {
      placeExecutionOnParent(node, execution, uow);
    }
  }
}

class UMLLifelineExecutionComponent extends BaseNodeComponent<UMLLifelineExecutionNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    builder.boundaryPath(this.def.getBoundingPathBuilder(props.node).getPaths().all());
    builder.add(renderChildren(this, props.node, props));
  }
}
