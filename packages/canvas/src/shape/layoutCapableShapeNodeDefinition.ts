import { DiagramNode } from '@diagram-craft/model/diagramNode';
import {
  CustomPropertyDefinition,
  NodeDefinition
} from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { ActionMap } from '@diagram-craft/canvas/action';
import {
  NodeShapeConstructor,
  ShapeNodeDefinition
} from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import { Box } from '@diagram-craft/geometry/box';
import {
  DiagramElement,
  getElementAndAncestors,
  isEdge,
  isNode
} from '@diagram-craft/model/diagramElement';
import { applyLayoutTree, buildLayoutTree } from '@diagram-craft/canvas/layout/layoutTree';
import { Point } from '@diagram-craft/geometry/point';
import { layoutChildren } from '@diagram-craft/canvas/layout/layout';
import { invalidateDescendantEdges } from '@diagram-craft/model/collapsible';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';

type CollapsibleProps = { collapsible?: boolean; mode?: string; bounds?: string };

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      _collapsible?: CollapsibleProps;
    }
  }
}

registerCustomNodeDefaults('_collapsible', {
  collapsible: false,
  bounds: '',
  mode: 'expanded'
});

export interface LayoutCapableShapeNodeDefinitionInterface extends NodeDefinition {
  getContainerPadding(node: DiagramNode): {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
}

export abstract class LayoutCapableShapeNodeDefinition
  extends ShapeNodeDefinition
  implements LayoutCapableShapeNodeDefinitionInterface
{
  // biome-ignore lint/suspicious/noExplicitAny: false positive
  protected constructor(type: string, component: NodeShapeConstructor<any>);
  // biome-ignore lint/suspicious/noExplicitAny: false positive
  protected constructor(type: string, name: string, component: NodeShapeConstructor<any>);
  protected constructor(
    // biome-ignore lint/suspicious/noExplicitAny: false positive
    ...arr: [string, NodeShapeConstructor<any>] | [string, string, NodeShapeConstructor<any>]
  ) {
    if (arr.length === 2) super(arr[0], arr[1]);
    else super(arr[0], arr[1], arr[2]);

    this.capabilities['can-have-layout'] = true;
    this.capabilities['children.allowed'] = true;
  }

  layoutChildren(node: DiagramNode, uow: UnitOfWork) {
    // First layout all children
    super.layoutChildren(node, uow);

    if (this.getCollapsibleProps(node).mode === 'collapsed') {
      return;
    }

    // Find root container
    let layoutRoot = node;
    while (
      layoutRoot.parent &&
      isNode(layoutRoot.parent) &&
      layoutRoot.parent.getDefinition().supports('can-have-layout')
    ) {
      layoutRoot = layoutRoot.parent;
    }

    uow.on('before', 'commit', `layout/${layoutRoot.id}`, () => {
      const layoutTree = this.prepareLayoutTree(layoutRoot);
      layoutChildren(layoutTree);
      applyLayoutTree(layoutRoot, layoutTree, uow);
    });
  }

  protected prepareLayoutTree(layoutRoot: DiagramNode) {
    return buildLayoutTree(layoutRoot);
  }

  onDrop(
    _coord: Point,
    node: DiagramNode,
    elements: ReadonlyArray<DiagramElement>,
    uow: UnitOfWork,
    _operation: string
  ) {
    node.diagram.moveElement(elements, uow, node.layer, {
      relation: 'on',
      element: node
    });
  }

  getContainerPadding(_node: DiagramNode) {
    return { left: 0, right: 0, top: 0, bottom: 0 };
  }

  /**
   * Toggle collapse/expand state for collapsible nodes
   */
  toggle(node: DiagramNode, uow: UnitOfWork): void {
    const edgeSnapshot = this.snapshotEdges(node);

    const customProps = this.getCollapsibleProps(node);
    const mode = customProps.mode ?? 'expanded';

    const currentBounds = Box.toString(node.bounds);
    const previousBounds =
      customProps.bounds === '' || !customProps.bounds
        ? Box.fromCorners(
            Point.of(node.bounds.x, node.bounds.y),
            Point.of(node.bounds.x + 100, node.bounds.y + 50)
          )
        : Box.fromString(customProps.bounds);

    node.setBounds(
      { ...previousBounds, x: node.bounds.x, y: node.bounds.y, r: node.bounds.r },
      uow
    );

    const newMode = mode === 'expanded' ? 'collapsed' : 'expanded';

    node.updateCustomProps(
      '_collapsible',
      props => {
        props.mode = newMode;
        props.bounds = currentBounds;
      },
      uow
    );

    // Invalidate all edges connected to descendants so they recalculate positions
    invalidateDescendantEdges(node, uow);
    this.adjustEdges(edgeSnapshot, uow);
  }

  /**
   * Check if children should be rendered based on collapse state
   */
  shouldRenderChildren(node: DiagramNode): boolean {
    if (!this.supports('collapsible')) {
      return true; // Always render if not collapsible
    }

    return this.getCollapsibleProps(node).mode !== 'collapsed';
  }

  /**
   * Get collapsible properties for reading state
   */
  getCollapsibleProps(node: DiagramNode): CollapsibleProps {
    const customProps = node.renderProps.custom['_collapsible'];
    return {
      collapsible: customProps?.collapsible ?? false,
      mode: customProps?.mode ?? 'expanded',
      bounds: customProps?.bounds ?? ''
    };
  }

  /**
   * Get standard collapsible custom property definitions
   */
  protected getCollapsiblePropertyDefinitions(node: DiagramNode) {
    return new CustomPropertyDefinition(p => [
      p.boolean(node, 'Collapsible', 'custom._collapsible.collapsible')
    ]);
  }

  /**
   * Override to automatically add SHAPE_TOGGLE_COLLAPSIBLE action for collapsible nodes
   */
  getShapeActions(_node: DiagramNode): ReadonlyArray<keyof ActionMap> {
    const baseActions = super.getShapeActions(_node);

    if (this.supports('collapsible')) {
      return [...baseActions, 'SHAPE_TOGGLE_COLLAPSIBLE'];
    }

    return baseActions;
  }

  protected snapshotEdges(node: DiagramNode) {
    const layoutRoot = getElementAndAncestors(node)
      .toReversed()
      .find(e => isNode(e) && e.renderProps.layout.container.enabled) as DiagramNode | undefined;

    const edgeBounds = new Map<string, Box>();
    const recurse = (el: DiagramElement) => {
      for (const c of el.children) {
        if (isEdge(c)) edgeBounds.set(c.id, c.bounds);
        recurse(c);
      }
    };
    recurse(layoutRoot ?? node);
    return { edgeBounds, layoutRoot } as const;
  }

  protected adjustEdges(
    snapshot: {
      edgeBounds: Map<string, Box> | undefined;
      layoutRoot: DiagramNode | undefined;
    },
    uow: UnitOfWork
  ) {
    if (snapshot.edgeBounds === undefined || snapshot.layoutRoot === undefined) return;

    uow.on('after', 'commit', `layoutEdges/${snapshot.layoutRoot.id}`, () => {
      console.log('Adjusting edges');
      this.applyEdgeAdjustments(snapshot.layoutRoot!, snapshot.edgeBounds!, uow);
      // Need to explicitly notify, as these adjustments are done post-event dispatch
      uow.notify();
    });
  }

  private applyEdgeAdjustments(el: DiagramElement, edgeBounds: Map<string, Box>, uow: UnitOfWork) {
    if (isEdge(el)) {
      const previous = edgeBounds.get(el.id);
      if (previous) {
        try {
          const transform = TransformFactory.fromTo(previous, el.bounds);
          if (transform.length > 0) {
            uow.executeUpdate(el, () => el._transformWaypoints(transform));
          }
        } catch (e) {
          console.warn(e);
        }
      }
    }

    for (const c of el.children) {
      this.applyEdgeAdjustments(c, edgeBounds, uow);
    }
  }
}
