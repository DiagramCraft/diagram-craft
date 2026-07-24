import { DiagramNode } from './diagramNode';
import { Transform } from '@diagram-craft/geometry/transform';
import { Point } from '@diagram-craft/geometry/point';
import { UnitOfWork } from './unitOfWork';
import { Anchor } from './anchor';
import { Box } from '@diagram-craft/geometry/box';
import type { Diagram } from './diagram';
import { PathList } from '@diagram-craft/geometry/pathList';
import { DiagramElement } from './diagramElement';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import type { Endpoint } from './endpoint';
import type { NodeLinkOptions } from './stencilRegistry';
import type { CustomPropertyDefinition } from './customProperty';

export type NodeFlag = string & { __brand: 'nodeFlag' };

export const makeNodeFlag = (flag: string): NodeFlag => flag as NodeFlag;

/**
 * Node flags that control various node behaviors and features.
 *
 * These flags are used throughout the canvas system to conditionally enable/disable
 * features, render UI panels, and control node behavior.
 */
export const NodeFlags = {
  /**
   * Whether a node can have fill properties (colors, gradients, patterns).
   *
   * When disabled, fill is set to 'none' in rendering, sketch fill effects are skipped,
   * and the fill panel is hidden in the UI.
   * Default: true
   *
   * @example
   * Disabled by: CurlyBracket, Table, TableRow
   */
  StyleFill: makeNodeFlag('style.fill'),

  /**
   * Whether corner rounding effects can be applied to the node's path.
   *
   * When disabled, the rounding effects panel is hidden.
   * Default: true
   */
  StyleRounding: makeNodeFlag('style.rounding'),

  /**
   * Whether edges can connect to any point on the node's boundary (not just predefined anchors).
   *
   * When disabled, only edge anchors are used for connections. The implementation uses
   * a 5px preference threshold for anchor points.
   * Default: true
   *
   * @example
   * Disabled by: UmlLifeline
   * @see packages/model/src/anchor.ts:241-258
   */
  AnchorsBoundary: makeNodeFlag('anchors.boundary'),

  /**
   * Whether the anchor strategy can be changed.
   *
   * Allows configuration of anchor strategies: shape-defaults, per-edge, per-path,
   * north-south, east-west, directions, custom, none.
   * When disabled, the anchors configuration panel is hidden.
   * Default: true
   *
   * @example
   * Disabled by: CurlyBracket, UmlLifeline, UmlDestroy
   */
  AnchorsConfigurable: makeNodeFlag('anchors.configurable'),

  /**
   * Whether anchor handles appear when the node is hovered.
   *
   * When disabled, anchor handles are only rendered for selected nodes.
   * Default: true
   *
   * @example
   * Disabled by: TableRow, TableCell
   */
  AnchorsVisibleOnHover: makeNodeFlag('anchors.visible-on-hover'),

  /**
   * Whether a node can contain child elements.
   *
   * When enabled, the node appears as expandable in the layer panel and supports nesting.
   * Default: false
   *
   * @example
   * Group, Table, TableRow, layout containers
   */
  ChildrenAllowed: makeNodeFlag('children.allowed'),

  /**
   * Whether a node can serve as a container in layout operations.
   *
   * Used to filter available shapes when changing selection to container types.
   * Different from 'children' - affects layout system eligibility rather than parent-child relationships.
   * Default: true
   *
   * @example
   * Disabled by: Table, TableRow, FlexShapeNodeDefinition (when not a group)
   */
  ChildrenCanConvertToContainer: makeNodeFlag('children.can-convert-to-container'),

  /**
   * Whether a node supports the auto-layout system.
   *
   * Enables group layout, container padding, and layout tree traversal for nested containers.
   * When enabled, the layout controls panel becomes available.
   * Default: false
   *
   * @example
   * Enabled by: LayoutCapableShapeNodeDefinition subclasses (except BPMNChoreographyActivity)
   */
  ChildrenCanHaveLayout: makeNodeFlag('children.can-have-layout'),

  /**
   * Whether a node can be toggled between expanded and collapsed states.
   *
   * When enabled, a collapse/expand toggle button is rendered and children can be hidden.
   * Default: false
   *
   * @example
   * Enabled by: LayoutCapableShapeNodeDefinition subclasses
   * @see packages/canvas/src/shape/collapsible.ts:27, 130
   */
  ChildrenCollapsible: makeNodeFlag('children.collapsible'),

  /**
   * Whether clicking a child selects the parent instead (group selection behavior).
   *
   * When enabled:
   * - First click on child selects parent
   * - Second click "drills down" to select child
   *
   * Default: false
   *
   * @example
   * Enabled by: Group, BPMNChoreographyActivity
   * @see packages/canvas/src/tools/moveTool.ts:103-116
   */
  ChildrenSelectParent: makeNodeFlag('children.select-parent'),

  /**
   * Whether the parent exclusively manages child lifecycle (prevents independent deletion).
   *
   * When enabled, children cannot be deleted independently.
   * Default: false
   *
   * @example
   * Enabled by: TableRow (table cells managed by table structure)
   * @see packages/canvas-app/src/actions/selectionDeleteAction.ts:45
   */
  ChildrenManagedByParent: makeNodeFlag('children.managed-by-parent'),

  ChildrenTransformRotate: makeNodeFlag('children.transform-rotate'),
  ChildrenTransformScaleX: makeNodeFlag('children.transform-scale-x'),
  ChildrenTransformScaleY: makeNodeFlag('children.transform-scale-y'),
  ChildrenTransformTranslate: makeNodeFlag('children.transform-translate')
};

/**
 * Contract implemented by every node shape (rect, circle, UML class, ...).
 *
 * A `NodeDefinition` is a stateless, singleton-per-type description of a shape's
 * geometry, behavior, and editable properties. It is registered once (see
 * `NodeDefinitionRegistry`) and shared by every {@link DiagramNode} of that
 * `type`; per-instance state lives on the node itself, not here.
 */
export interface NodeDefinition {
  /** Unique shape type id (e.g. `'rect'`, `'umlClass'`), used as the registry key. */
  type: string;

  /** Human-readable display name shown in pickers, tooltips, and panels. */
  name: string;

  /** Whether this shape supports the given {@link NodeFlag} (see {@link NodeFlags}). */
  hasFlag(flag: NodeFlag): boolean;

  /**
   * Number of additional fill layers (beyond the primary fill) the shape renders,
   * e.g. for multi-tone icons. Most shapes use 0.
   */
  additionalFillCount: number;

  /** Returns the custom (shape-specific) properties editable for this node. */
  getCustomPropertyDefinitions(node: DiagramNode): CustomPropertyDefinition;

  /** Returns the shape's outline, in node-local coordinates, used for rendering and selection. */
  getBoundingPath(node: DiagramNode): PathList;

  /**
   * Returns the shape's hit-test area, in node-local coordinates.
   * Defaults to {@link getBoundingPath} when undefined.
   */
  getHitArea(node: DiagramNode): PathList | undefined;

  /** Returns the shape's connection anchors, in local coordinates in the range [0-1], [0-1]. */
  getAnchors(node: DiagramNode): ReadonlyArray<Anchor>;

  /**
   * Called when an edge endpoint is being attached to (or dragged over) this node.
   * Return a possibly-adjusted {@link Endpoint} (e.g. to snap to a different anchor),
   * or `undefined` to leave the endpoint unchanged.
   */
  onAttachEdge(
    node: DiagramNode,
    edge: DiagramEdge,
    endpoint: Endpoint,
    context: AttachEdgeContext
  ): Endpoint | undefined;

  /** Called whenever a child of this node has changed, so the parent can react (e.g. resize). */
  onChildChanged(node: DiagramNode, uow: UnitOfWork): void;

  /** Called after a transform (move/resize/rotate) has been applied to this node. */
  onTransform(
    transforms: ReadonlyArray<Transform>,
    node: DiagramNode,
    newBounds: Box,
    previousBounds: Box,
    uow: UnitOfWork
  ): void;

  /**
   * Called when elements are dropped onto this node. Optional; shapes that don't
   * accept drops (e.g. as containers) can omit it.
   */
  onDrop?: (
    coord: Point,
    node: DiagramNode,
    elements: ReadonlyArray<DiagramElement>,
    uow: UnitOfWork,
    operation: string
  ) => void;

  /** Called after any of the node's props have been updated. */
  onPropUpdate(node: DiagramNode, uow: UnitOfWork): void;

  /** Called once when the node is first added to a diagram. */
  onAdd(node: DiagramNode, diagram: Diagram, uow: UnitOfWork): void;

  /**
   * Called to move keyboard/edit focus into the node, e.g. when entering text-edit mode.
   * @param selectAll whether the initial content, if any, should be selected.
   */
  requestFocus(node: DiagramNode, selectAll?: boolean): void;

  /** Returns the current stencil/edge-style link options for this node, if it supports them. */
  getNodeLinkOptions?(node: DiagramNode): NodeLinkOptions | undefined;

  /** Persists updated stencil/edge-style link options for this node. */
  setNodeLinkOptions?(
    node: DiagramNode,
    options: NodeLinkOptions | undefined,
    uow: UnitOfWork
  ): void;

  /**
   * When defined, replaces the default "apply stencil + apply stylesheet" popup behavior.
   * Called once per user selection change (stencil or edge style).
   * Either selectedStencilId or selectedEdgeStyleId may be undefined (partial selection).
   */
  onNodeLinkSelection?(
    sourceNode: DiagramNode,
    edge: DiagramEdge,
    provisionalNode: DiagramNode | undefined,
    selectedStencilId: string | undefined,
    selectedEdgeStyleId: string | undefined,
    resolvedOptions: NodeLinkOptions,
    uow: UnitOfWork
  ): void;
}

export type AttachPhase = 'drag' | 'dragEnd';

export type AttachEdgeContext = {
  phase: AttachPhase;
  type: 'anchor' | 'boundary' | 'point';
  end: 'start' | 'end';
  point: Point;
  modifiers: {
    shiftKey: boolean;
    altKey: boolean;
    metaKey: boolean;
    ctrlKey: boolean;
  };
};
