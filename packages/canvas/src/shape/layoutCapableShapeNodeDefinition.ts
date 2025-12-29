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
import { Transform } from '@diagram-craft/geometry/transform';
import { Box } from '@diagram-craft/geometry/box';
import { DiagramElement, isNode } from '@diagram-craft/model/diagramElement';
import { applyLayoutTree, buildLayoutTree } from '@diagram-craft/canvas/layout/layoutTree';
import { Point } from '@diagram-craft/geometry/point';
import { layoutChildren } from '@diagram-craft/canvas/layout/layout';

export interface LayoutCapableShapeNodeDefinitionInterface extends NodeDefinition {
  getContainerPadding(node: DiagramNode): {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
}

export type CollapsibleProps = { collapsible?: boolean; mode?: string; bounds?: string };

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
    this.capabilities.children = true;
  }

  onTransform(
    transforms: ReadonlyArray<Transform>,
    node: DiagramNode,
    newBounds: Box,
    previousBounds: Box,
    uow: UnitOfWork
  ) {
    if (
      newBounds.w === previousBounds.w &&
      newBounds.h === previousBounds.h &&
      newBounds.r === previousBounds.r
    ) {
      return super.onTransform(transforms, node, newBounds, previousBounds, uow);
    }

    const newWidth = newBounds.w;
    const newHeight = newBounds.h;

    if (newWidth !== newBounds.w || newHeight !== newBounds.h) {
      node.setBounds({ ...newBounds, w: newWidth, h: newHeight }, uow);
    }

    return this.layoutChildren(node, uow);
  }

  layoutChildren(node: DiagramNode, uow: UnitOfWork) {
    // First layout all children
    super.layoutChildren(node, uow);

    // Find root container
    let layoutRoot = node;
    while (
      layoutRoot.parent &&
      isNode(layoutRoot.parent) &&
      layoutRoot.parent.getDefinition().supports('can-have-layout')
    ) {
      layoutRoot = layoutRoot.parent;
    }

    uow.registerOnCommitCallback('layout', layoutRoot, () => {
      const layoutTree = buildLayoutTree(layoutRoot);
      layoutChildren(layoutTree);
      applyLayoutTree(layoutRoot, layoutTree, uow);
    });
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

    if (mode === 'expanded') {
      node.updateCustomProps(
        this.type as 'container',
        props => {
          props.mode = 'collapsed';
          props.bounds = currentBounds;
        },
        uow
      );
    } else {
      node.updateCustomProps(
        this.type as 'container',
        props => {
          props.mode = 'expanded';
          props.bounds = currentBounds;
        },
        uow
      );
    }
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
    const customProps = node.renderProps.custom[this.type as 'container'];
    return {
      collapsible: customProps?.collapsible ?? false,
      mode: customProps?.mode ?? 'expanded',
      bounds: customProps?.bounds ?? ''
    };
  }

  /**
   * Get standard collapsible custom property definitions
   */
  protected getCollapsiblePropertyDefinitions(node: DiagramNode): CustomPropertyDefinition[] {
    const customProps = node.renderProps.custom[this.type as 'container'];
    const storedProps = node.storedProps.custom?.[this.type as 'container'];

    return [
      {
        id: 'collapsible',
        type: 'boolean',
        label: 'Collapsible',
        value: customProps?.collapsible,
        isSet: storedProps?.collapsible !== undefined,
        onChange: (value: boolean | undefined, uow: UnitOfWork) => {
          node.updateCustomProps(
            this.type as 'container',
            props => (props.collapsible = value ?? false),
            uow
          );
        }
      }
    ];
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
}
