import { Direction } from '@diagram-craft/geometry/direction';
import { AbstractSelectionAction, ElementType, MultipleType } from './abstractSelectionAction';
import { ActionContext } from '@diagram-craft/canvas/action';
import { Point } from '@diagram-craft/geometry/point';
import { Box } from '@diagram-craft/geometry/box';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Angle } from '@diagram-craft/geometry/angle';
import { isNode } from '@diagram-craft/model/diagramElement';
import { Vector } from '@diagram-craft/geometry/vector';

export const createNavigateNodeActions = (context: ActionContext) => {
  return {
    NAVIGATE_NODE_E: new NavigateNodeAction(context, 'e'),
    NAVIGATE_NODE_W: new NavigateNodeAction(context, 'w'),
    NAVIGATE_NODE_N: new NavigateNodeAction(context, 'n'),
    NAVIGATE_NODE_S: new NavigateNodeAction(context, 's'),
    NAVIGATE_NODE_EXTEND_E: new NavigateNodeAction(context, 'e', true),
    NAVIGATE_NODE_EXTEND_W: new NavigateNodeAction(context, 'w', true),
    NAVIGATE_NODE_EXTEND_N: new NavigateNodeAction(context, 'n', true),
    NAVIGATE_NODE_EXTEND_S: new NavigateNodeAction(context, 's', true)
  };
};

declare global {
  interface ActionMap extends ReturnType<typeof createNavigateNodeActions> {}
}

export class NavigateNodeAction extends AbstractSelectionAction {
  constructor(
    context: ActionContext,
    protected readonly direction: Direction,
    protected readonly extendSelection: boolean = false
  ) {
    super(context, MultipleType.SingleOnly, ElementType.Node, ['regular']);
  }

  execute(): void {
    const selectedNodes = this.context.model.activeDiagram.selection.nodes;
    if (selectedNodes.length === 0) return;

    const currentNode = selectedNodes.at(-1)!;
    const allNodes = Array.from(this.context.model.activeDiagram.allElements()).filter(
      element =>
        isNode(element) &&
        element !== currentNode &&
        element.layer.type === 'regular' &&
        !element.isLabelNode() &&
        !element.parent
    ) as DiagramNode[];

    if (allNodes.length === 0) return;

    const closestNode = this.findClosestNodeInDirection(currentNode, allNodes, this.direction);
    if (!closestNode) return;

    if (this.extendSelection) {
      this.context.model.activeDiagram.selection.toggle(closestNode);
    } else {
      this.context.model.activeDiagram.selection.setElements([closestNode]);
    }

    this.emit('actionTriggered', {});
  }

  private findClosestNodeInDirection(
    currentNode: DiagramNode,
    candidates: DiagramNode[],
    direction: Direction
  ): DiagramNode | null {
    const currentCenter = Box.center(currentNode.bounds);
    const directionAngle = Direction.toAngle(direction, true); // Use inverted coordinate system

    let bestNode: DiagramNode | null = null;
    let bestScore = Infinity;

    for (const candidate of candidates) {
      const candidateCenter = Box.center(candidate.bounds);
      const vector = Vector.from(currentCenter, candidateCenter);

      // Skip nodes that are too close (practically overlapping)
      const distance = Point.distance(currentCenter, candidateCenter);
      if (distance < 1) continue;

      // Calculate angle from current node to candidate
      const vectorAngle = Vector.angle(vector);

      // Calculate angular difference (normalize to [0, PI])
      const angleDiff = Math.abs(Angle.normalize(vectorAngle - directionAngle));
      const normalizedAngleDiff = Math.min(angleDiff, 2 * Math.PI - angleDiff);

      // Only consider nodes that are roughly in the right direction (within 90 degrees)
      if (normalizedAngleDiff > Math.PI / 2) continue;

      // Score combines angular deviation and distance
      // Weight angular accuracy heavily, but factor in distance
      const angleWeight = 10;
      const distanceWeight = 1;
      const score = angleWeight * normalizedAngleDiff + distanceWeight * (distance / 100);

      if (score < bestScore) {
        bestScore = score;
        bestNode = candidate;
      }
    }

    return bestNode;
  }
}
