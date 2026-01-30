import { Point } from '@diagram-craft/geometry/point';
import { LengthOffsetOnPath } from '@diagram-craft/geometry/pathPosition';
import { CustomPropertyDefinition } from './elementDefinitionRegistry';
import { DiagramEdge } from './diagramEdge';
import { DiagramElement, isNode } from './diagramElement';
import { UnitOfWork } from './unitOfWork';
import { DiagramNode } from './diagramNode';
import { AnchorEndpoint } from './endpoint';
import { newid } from '@diagram-craft/utils/id';
import { deepClone } from '@diagram-craft/utils/object';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { assertRegularLayer } from './diagramLayerUtils';
import { ElementFactory } from './elementFactory';
import type { EdgeProps } from './diagramProps';

/**
 * Edge capability flags that control various edge styling and visual features.
 *
 * These capabilities are used throughout the canvas system to conditionally enable/disable
 * styling options, render UI panels, and control edge appearance. Check capabilities using
 * `edge.getDefinition().supports('capability-name')`.
 *
 * By default, all edge definitions support all capabilities unless explicitly overridden.
 *
 * @see {@link EdgeDefinition.supports}
 */
export type EdgeCapability =
  /**
   * Whether an edge can display arrow decorations at its start and end points.
   *
   * When supported, the UI shows arrow/line ending selectors where users can choose
   * arrow types (none, triangle, filled-triangle, etc.) and sizes for both the start
   * and end of the edge.
   *
   * When disabled, edges override `getArrow()` to return `undefined`, preventing
   * arrow rendering entirely.
   *
   * Default: true
   *
   * @example
   * Disabled by: BlockArrow, BPMNConversationEdge
   * @see packages/main/src/react-app/toolwindow/ObjectToolWindow/EdgeLinePanel.tsx:272-274
   */
  | 'style.arrows'

  /**
   * Whether an edge's interior/fill can be styled with colors.
   *
   * When supported, the fill color picker appears in the Fill Panel for edges.
   * This is useful for edges that have a filled area (like BlockArrow) rather than
   * just a stroke line.
   *
   * The fill panel is only displayed when ALL selected edges support fill.
   *
   * Default: false (SimpleEdgeDefinition disables this by default)
   *
   * @example
   * Enabled by: BlockArrow, BPMNConversationEdge
   * Disabled by: SimpleEdgeDefinition (standard edges)
   * @see packages/main/src/react-app/toolwindow/ObjectToolWindow/EdgeLinePanel.tsx:280-282
   */
  | 'style.fill'

  /**
   * Whether an edge can display line hop visualizations where edges cross.
   *
   * When supported, the UI shows line hops configuration with options for:
   * - 'none': No gap where lines cross
   * - 'below-hide': Creates a gap when one line goes below another
   * - 'below-line': Shows a line across the gap when line goes below
   * - 'below-arc': Draws an arc when line goes below
   * - 'above-arc': Draws an arc when line goes above
   *
   * Line hops help visualize depth relationships between crossing edges.
   * This capability is typically disabled for special edge types where line hops
   * don't make sense visually (like filled block arrows).
   *
   * Default: true
   *
   * @example
   * Disabled by: BlockArrow, BPMNConversationEdge
   * @see packages/main/src/react-app/toolwindow/ObjectToolWindow/EdgeLinePanel.tsx:276-278
   */
  | 'style.line-hops';

export type EdgeDropOperation = 'attach' | 'split';

export interface EdgeDefinition {
  type: string;
  name: string;

  supports(capability: EdgeCapability): boolean;

  onDrop(
    coord: Point,
    edge: DiagramEdge,
    elements: ReadonlyArray<DiagramElement>,
    uow: UnitOfWork,
    operation: EdgeDropOperation
  ): void;

  getCustomPropertyDefinitions(edge: DiagramEdge): CustomPropertyDefinition;
}

export abstract class AbstractEdgeDefinition implements EdgeDefinition {
  public readonly name: string;
  public readonly type: string;

  protected constructor(name: string, type: string) {
    this.name = name;
    this.type = type;
  }

  supports(_capability: EdgeCapability): boolean {
    return true;
  }

  onDrop(
    coord: Point,
    edge: DiagramEdge,
    elements: ReadonlyArray<DiagramElement>,
    uow: UnitOfWork,
    operation: EdgeDropOperation
  ) {
    if (elements.length !== 1 || !isNode(elements[0])) return;

    if (operation === 'split') {
      this.onDropSplit(edge, elements[0], uow);
    } else {
      this.onDropAttachAsLabel(edge, elements[0], coord, uow);
    }
  }

  private onDropSplit(edge: DiagramEdge, element: DiagramNode, uow: UnitOfWork) {
    assertRegularLayer(edge.layer);

    // We will attach to the center point anchor
    const anchor = 'c';

    // TODO: This requires some work to support dropping on multi-segment edges
    const newEdge = ElementFactory.edge(
      newid(),
      new AnchorEndpoint(element, anchor),
      edge.end,
      deepClone(edge.editProps) as EdgeProps,
      deepClone(edge.metadata),
      [],
      edge.layer
    );
    edge.layer.addElement(newEdge, uow);

    edge.setEnd(new AnchorEndpoint(element, anchor), uow);
  }

  private onDropAttachAsLabel(
    edge: DiagramEdge,
    element: DiagramNode,
    coord: Point,
    uow: UnitOfWork
  ) {
    if (element.isLabelNode()) return;

    const path = edge.path();
    const projection = path.projectPoint(coord);

    uow.executeUpdate(edge, () => {
      uow.executeUpdate(element, () => {
        edge.addLabelNode(
          {
            id: element.id,
            node: () => element,
            offset: Point.ORIGIN,
            timeOffset: LengthOffsetOnPath.toTimeOffsetOnPath(projection, path).pathT,
            type: 'horizontal'
          },
          uow
        );

        // TODO: Perhaps create a helper to add an element as a label edge
        // TODO: Maybe use detach here
        if (edge.parent) {
          if (element.parent) {
            if (isNode(element.parent)) {
              element.parent.removeChild(element, uow);
            } else {
              // This means that element.parent is an edge - implying
              // element is a label node - however, we've already covered
              // this case at the beginning of the function
              VERIFY_NOT_REACHED();
            }
          }

          edge.parent.addChild(element, uow);
        }
      });
    });
  }

  getCustomPropertyDefinitions(_edge: DiagramEdge): CustomPropertyDefinition {
    return new CustomPropertyDefinition(() => []);
  }
}
