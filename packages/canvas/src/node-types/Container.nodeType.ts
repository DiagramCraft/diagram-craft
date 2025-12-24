import { ShapeNodeDefinition } from '../shape/shapeNodeDefinition';
import { BaseNodeComponent, BaseShapeBuildShapeProps } from '../components/BaseNodeComponent';
import * as svg from '../component/vdom-svg';
import { Transforms } from '../component/vdom-svg';
import { ShapeBuilder } from '../shape/ShapeBuilder';
import { Box } from '@diagram-craft/geometry/box';
import { Point } from '@diagram-craft/geometry/point';
import { Rotation, Scale, Transform, Translation } from '@diagram-craft/geometry/transform';
import { DiagramElement, isNode } from '@diagram-craft/model/diagramElement';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { DiagramNode, NodePropsForRendering } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { largest } from '@diagram-craft/utils/array';
import { assert, mustExist } from '@diagram-craft/utils/assert';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { hasHighlight, Highlights } from '../highlight';
import { isStringUnion } from '@diagram-craft/utils/types';
import { renderElement } from '../components/renderElement';
import type { VNode } from '../component/vdom';
import { Component } from '../component/component';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { type PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import type { Anchor } from '@diagram-craft/model/anchor';
import {
  AbstractSelectionAction,
  ElementType,
  MultipleType
} from '../actions/abstractSelectionAction';
import { $tStr } from '@diagram-craft/utils/localize';
import { ActionCriteria, type ActionMap } from '../action';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import type { Context } from '../context';

type ContainerResize = 'none' | 'shrink' | 'grow' | 'both';
function assertIsContainerResizeOrUndefined(
  value: string | undefined
): asserts value is ContainerResize | undefined {
  assert.true(value === undefined || isStringUnion(value, ['none', 'shrink', 'grow', 'both']));
}

type ChildResize = 'fixed' | 'scale' | 'fill';
function assertIsChildResizeOrUndefined(
  value: string | undefined
): asserts value is ChildResize | undefined {
  assert.true(value === undefined || isStringUnion(value, ['fixed', 'scale', 'fill']));
}

type LayoutType = 'manual' | 'horizontal' | 'vertical';
function assertIsLayoutTypeOrUndefined(
  value: string | undefined
): asserts value is LayoutType | undefined {
  assert.true(value === undefined || isStringUnion(value, ['manual', 'horizontal', 'vertical']));
}

type GapType = 'between' | 'around';
function assertIsGapTypeOrUndefined(
  value: string | undefined
): asserts value is GapType | undefined {
  assert.true(value === undefined || isStringUnion(value, ['between', 'around']));
}

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      container?: {
        containerResize?: ContainerResize;
        childResize?: ChildResize;
        layout?: LayoutType;
        gap?: number;
        gapType?: GapType;
        collapsible?: boolean;
        bounds?: string;
        mode?: 'collapsed' | 'expanded';
        shape?: string;
      };
    }
  }
}

registerCustomNodeDefaults('container', {
  containerResize: 'none',
  childResize: 'fixed',
  layout: 'manual',
  gap: 0,
  gapType: 'between',
  collapsible: false,
  bounds: '',
  mode: 'expanded',
  shape: ''
});

type ContainerProps = NodePropsForRendering['custom']['container'];

type Entry = {
  node: DiagramElement;
  localBounds: Box;
  newLocalBounds?: Box;
};

type LayoutFn = (
  node: DiagramNode,
  props: ContainerProps,
  children: Entry[],
  localBounds: Box
) => Box;

type Layout = {
  fn: LayoutFn;
  primaryAxis: 'x' | 'y' | undefined;
};

const getShape = (node: DiagramNode): ShapeNodeDefinition | undefined => {
  const shape = node.renderProps.custom.container.shape;
  if (shape === '') return undefined;

  return node.diagram.document.nodeDefinitions.get(shape) as ShapeNodeDefinition | undefined;
};

const horizontalLayout: LayoutFn = (
  node: DiagramNode,
  props: ContainerProps,
  children: Entry[],
  localBounds: Box
) => {
  if (children.length === 0) return localBounds;

  const fill = props.childResize === 'fill';
  const gap = props.gap;
  const gapType = props.gapType;

  // Sort children by x position
  const sortedLocalChildren = children.sort((a, b) => a.localBounds.x - b.localBounds.x);

  const maxHeight = Math.max(
    node.bounds.h,
    largest(
      sortedLocalChildren.map(c => c.localBounds.h),
      (a, b) => a - b
    )!
  );

  let x = gapType === 'around' ? gap : 0;
  for (const entry of sortedLocalChildren) {
    if (!isNode(entry.node)) continue;

    entry.newLocalBounds = {
      ...entry.localBounds,
      x,
      y: fill ? 0 : entry.localBounds.y,
      h: fill ? maxHeight : entry.localBounds.h
    };
    x += entry.newLocalBounds.w + (gapType === 'around' ? 2 : 1) * gap;
  }

  return Box.boundingBox(children.map(c => c.localBounds));
};

const verticalLayout: LayoutFn = (
  node: DiagramNode,
  props: ContainerProps,
  children: Entry[],
  localBounds: Box
) => {
  if (children.length === 0) return localBounds;

  const fill = props.childResize === 'fill';
  const gap = props.gap;
  const gapType = props.gapType;

  // Sort children by y position
  const sortedLocalChildren = children.sort((a, b) => a.localBounds.y - b.localBounds.y);

  const maxWidth = Math.max(
    node.bounds.w,
    largest(
      sortedLocalChildren.map(c => c.localBounds.w),
      (a, b) => a - b
    )!
  );

  let y = gapType === 'around' ? gap : 0;
  for (const entry of sortedLocalChildren) {
    if (!isNode(entry.node)) continue;

    entry.newLocalBounds = {
      ...entry.localBounds,
      x: fill ? 0 : entry.localBounds.x,
      y,
      w: fill ? maxWidth : entry.localBounds.w
    };
    y += entry.newLocalBounds.h + (gapType === 'around' ? 2 : 1) * gap;
  }

  return Box.boundingBox(children.map(c => c.localBounds));
};

const defaultLayout: LayoutFn = (
  _node: DiagramNode,
  props: ContainerProps,
  children: Entry[],
  localBounds: Box
) => {
  if (props.containerResize === 'shrink' || props.containerResize === 'none') return localBounds;
  if (children.length === 0) return localBounds;

  return Box.boundingBox([localBounds, ...children.map(c => c.localBounds)]);
};

const LAYOUTS: Record<string, Layout> = {
  horizontal: { fn: horizontalLayout, primaryAxis: 'x' },
  vertical: { fn: verticalLayout, primaryAxis: 'y' },
  manual: { fn: defaultLayout, primaryAxis: undefined }
};

export class ContainerNodeDefinition extends ShapeNodeDefinition {
  overlayComponent = ContainerComponentOverlay;

  constructor(id = 'container', name = 'Container', component = ContainerComponent) {
    super(id, name, component);

    this.capabilities.fill = true;
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

    const isScaling = transforms.find(t => t instanceof Scale);

    const newWidth = newBounds.w;
    const newHeight = newBounds.h;
    const newTransforms: Array<Transform> = [...transforms];

    if (newWidth !== newBounds.w || newHeight !== newBounds.h) {
      node.setBounds({ ...newBounds, w: newWidth, h: newHeight }, uow);
      newTransforms.push(new Scale(newWidth / newBounds.w, newHeight / newBounds.h));
    }

    if (!isScaling || node.renderProps.custom.container.childResize !== 'fixed') {
      for (const child of node.children) {
        child.transform(newTransforms, uow, true);
      }
    }

    return this.layoutChildren(node, uow);
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

  layoutChildren(node: DiagramNode, uow: UnitOfWork) {
    // First layout all children
    super.layoutChildren(node, uow);

    this.doLayoutChildren(node.renderProps.custom.container, node, uow);
  }

  protected doLayoutChildren(props: ContainerProps, node: DiagramNode, uow: UnitOfWork) {
    const autoShrink = props.containerResize === 'shrink' || props.containerResize === 'both';
    const autoGrow = props.containerResize === 'grow' || props.containerResize === 'both';
    const gapType = node.renderProps.custom.container.gapType;

    // We need to perform all layout operations in the local coordinate system of the node

    const transformBack = [
      // Rotation around center
      new Translation({
        x: -node.bounds.x - node.bounds.w / 2,
        y: -node.bounds.y - node.bounds.h / 2
      }),
      new Rotation(-node.bounds.r),
      // Move back to 0,0
      new Translation({
        x: node.bounds.w / 2,
        y: node.bounds.h / 2
      })
    ];
    const transformForward = transformBack.map(t => t.invert()).reverse();

    const boundsBefore = node.bounds;
    const localBounds = Transform.box(boundsBefore, ...transformBack);
    assert.true(Math.abs(localBounds.r) < 0.0001);

    const children: Entry[] = node.children.map(c => ({
      node: c,
      localBounds: Transform.box(c.bounds, ...transformBack),
      newLocalBounds: undefined
    }));

    if (children.length === 0) return;

    const layout = LAYOUTS[props.layout]!;
    let newBounds = layout.fn(node, props, children, localBounds);

    // Shrink to minimum size, but retain the position
    let xEnd = localBounds.x + (autoShrink ? 0 : localBounds.w);
    let yEnd = localBounds.y + (autoShrink ? 0 : localBounds.h);
    if (autoGrow || autoShrink) {
      for (const entry of children) {
        const lb = entry.newLocalBounds ?? entry.localBounds;
        xEnd = Math.max(xEnd, lb.x + lb.w);
        yEnd = Math.max(yEnd, lb.y + lb.h);
      }

      if (gapType === 'around') {
        xEnd += layout.primaryAxis === 'x' ? props.gap : 0;
        yEnd += layout.primaryAxis === 'y' ? props.gap : 0;
      }
    }

    let newWidth = Math.max(xEnd - localBounds.x, 10);
    if (autoShrink && !autoGrow) newWidth = Math.min(newWidth, localBounds.w);
    if (!autoShrink && autoGrow) newWidth = Math.max(newWidth, localBounds.w);

    let newHeight = Math.max(yEnd - localBounds.y, 10);
    if (autoShrink && !autoGrow) newHeight = Math.min(newHeight, localBounds.h);
    if (!autoShrink && autoGrow) newHeight = Math.max(newHeight, localBounds.h);

    newBounds = {
      x: localBounds.x,
      y: localBounds.y,
      w: newWidth,
      h: newHeight,
      r: 0
    };

    // Transform back to global coordinate system
    node.setBounds(Transform.box(newBounds, ...transformForward), uow);
    for (const entry of children) {
      if (!entry.newLocalBounds) continue;
      if (!isNode(entry.node)) continue;

      entry.node.setBounds(Transform.box(entry.newLocalBounds, ...transformForward), uow);
    }

    // Only trigger parent.onChildChanged in case this node has indeed changed
    if (node.parent && !Box.isEqual(node.bounds, boundsBefore)) {
      if (isNode(node.parent)) {
        uow.registerOnCommitCallback('onChildChanged', node.parent, () => {
          assert.node(node.parent!);
          const parentDef = node.parent.getDefinition();
          parentDef.onChildChanged(node.parent, uow);
        });
      }
    }
  }

  toggle(node: DiagramNode, uow: UnitOfWork) {
    const mode = node.renderProps.custom.container.mode;

    const currentBounds = Box.toString(node.bounds);
    const previousBounds =
      node.renderProps.custom.container.bounds === ''
        ? Box.fromCorners(
            Point.of(node.bounds.x, node.bounds.y),
            Point.of(node.bounds.x + 100, node.bounds.y + 50)
          )
        : Box.fromString(node.renderProps.custom.container.bounds);

    node.setBounds(
      { ...previousBounds, x: node.bounds.x, y: node.bounds.y, r: node.bounds.r },
      uow
    );

    if (mode === 'expanded') {
      node.updateCustomProps(
        'container',
        props => {
          props.mode = 'collapsed';
          props.bounds = currentBounds;
        },
        uow
      );
    } else {
      node.updateCustomProps(
        'container',
        props => {
          props.mode = 'expanded';
          props.bounds = currentBounds;
        },
        uow
      );
    }
  }

  getShapeActions(_node: DiagramNode): ReadonlyArray<keyof ActionMap> {
    return [...super.getShapeActions(_node), 'SHAPE_CONTAINER_TOGGLE'];
  }

  getCustomPropertyDefinitions(node: DiagramNode): Array<CustomPropertyDefinition> {
    const shape = getShape(node);
    return [
      {
        id: 'containerResize',
        type: 'select',
        label: 'Container Resize',
        value: node.renderProps.custom.container.containerResize,
        options: [
          { value: 'none', label: 'None' },
          { value: 'shrink', label: 'Auto Shrink' },
          { value: 'grow', label: 'Auto Grow' },
          { value: 'both', label: 'Both' }
        ],
        isSet: node.storedProps.custom?.container?.containerResize !== undefined,
        onChange: (value: string | undefined, uow: UnitOfWork) => {
          assertIsContainerResizeOrUndefined(value);
          node.updateCustomProps('container', props => (props.containerResize = value), uow);
        }
      },
      {
        id: 'layout',
        type: 'select',
        label: 'Layout',
        value: node.renderProps.custom.container.layout,
        options: [
          { value: 'manual', label: 'Manual' },
          { value: 'horizontal', label: 'Horizontal' },
          { value: 'vertical', label: 'Vertical' }
        ],
        isSet: node.storedProps.custom?.container?.layout !== undefined,
        onChange: (value: string | undefined, uow: UnitOfWork) => {
          assertIsLayoutTypeOrUndefined(value);
          node.updateCustomProps('container', props => (props.layout = value), uow);
        }
      },
      {
        id: 'gap',
        type: 'number',
        label: 'Gap',
        value: node.renderProps.custom.container.gap,
        unit: 'px',
        isSet: node.storedProps.custom?.container?.gap !== undefined,
        onChange: (value: number | undefined, uow: UnitOfWork) => {
          node.updateCustomProps('container', props => (props.gap = value), uow);
        }
      },
      {
        id: 'gapType',
        type: 'select',
        label: 'Gap Type',
        value: node.renderProps.custom.container.gapType,
        options: [
          { value: 'between', label: 'Between' },
          { value: 'around', label: 'Around' }
        ],
        isSet: node.storedProps.custom?.container?.gapType !== undefined,
        onChange: (value: string | undefined, uow: UnitOfWork) => {
          assertIsGapTypeOrUndefined(value);
          node.updateCustomProps('container', props => (props.gapType = value), uow);
        }
      },
      {
        id: 'childResize',
        type: 'select',
        label: 'Child Resize',
        value: node.renderProps.custom.container.childResize,
        options: [
          { value: 'fixed', label: 'Fixed' },
          { value: 'scale', label: 'Scale' },
          { value: 'fill', label: 'Fill' }
        ],
        isSet: node.storedProps.custom?.container?.childResize !== undefined,
        onChange: (value: string | undefined, uow: UnitOfWork) => {
          assertIsChildResizeOrUndefined(value);
          node.updateCustomProps('container', props => (props.childResize = value), uow);
        }
      },
      {
        id: 'collapsible',
        type: 'boolean',
        label: 'Collapsible',
        value: node.renderProps.custom.container.collapsible,
        isSet: node.storedProps.custom?.container?.collapsible !== undefined,
        onChange: (value: boolean | undefined, uow: UnitOfWork) => {
          node.updateCustomProps('container', props => (props.collapsible = value), uow);
        }
      },
      ...(shape
        ? [
            {
              id: 'delimiter',
              type: 'delimiter',
              label: shape.name,
              isSet: false
            } as CustomPropertyDefinition,
            ...shape.getCustomPropertyDefinitions(node)
          ]
        : [])
    ];
  }

  getBoundingPathBuilder(node: DiagramNode): PathListBuilder {
    const shape = getShape(node);
    if (shape) {
      return shape.getBoundingPathBuilder(node);
    } else {
      return super.getBoundingPathBuilder(node);
    }
  }

  getAnchors(node: DiagramNode): Anchor[] {
    const shape = getShape(node);
    if (shape) {
      return shape.getAnchors(node);
    } else {
      return super.getAnchors(node);
    }
  }
}

export class ContainerComponent extends BaseNodeComponent {
  delegateComponent: BaseNodeComponent | undefined;

  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    const shape = getShape(props.node);
    if (shape) {
      if (!this.delegateComponent) {
        this.delegateComponent = new shape.component(shape);
      } else if (this.delegateComponent.constructor !== shape.component) {
        this.delegateComponent = new shape.component(shape);
      }
    }

    if (this.delegateComponent) {
      this.delegateComponent.buildShape(props, builder);
    } else {
      const paths = new ContainerNodeDefinition().getBoundingPathBuilder(props.node).getPaths();

      const path = paths.singular();
      const svgPath = path.asSvgPath();

      builder.noBoundaryNeeded();
      builder.add(
        svg.path({
          'd': svgPath,
          'x': props.node.bounds.x,
          'y': props.node.bounds.y,
          'width': props.node.bounds.w,
          'height': props.node.bounds.h,
          'stroke': hasHighlight(props.node, Highlights.NODE__DROP_TARGET) ? '#30A46C' : '#d5d5d4',
          'stroke-width': hasHighlight(props.node, Highlights.NODE__DROP_TARGET) ? 3 : 1,
          'fill': 'transparent',
          'on': {
            mousedown: props.onMouseDown
          }
        })
      );
    }

    if (props.node.renderProps.custom.container.mode === 'expanded') {
      props.node.children.forEach(child => {
        builder.add(
          svg.g(
            { transform: Transforms.rotateBack(props.node.bounds) },
            renderElement(this, child, props)
          )
        );
      });
    }
  }
}

export class ContainerComponentOverlay extends Component<{ node: DiagramNode }> {
  render(props: { node: DiagramNode }): VNode {
    const containerProps = props.node.renderProps.custom.container;

    if (!containerProps.collapsible) return svg.g({});

    const iconSize = 8;
    const iconPadding = 4;
    const iconX = props.node.bounds.x + iconPadding;
    const iconY = props.node.bounds.y + iconPadding;

    const minusIcon = svg.g(
      {
        class: 'svg-container__toggle svg-hover-overlay',
        on: {
          pointerdown: () => {
            const uow = new UnitOfWork(props.node.diagram, true);
            nodeDefinition.toggle(props.node, uow);
            commitWithUndo(uow, 'Toggle container');
            this.redraw();
          }
        }
      },
      svg.rect({
        'x': iconX,
        'y': iconY,
        'width': iconSize,
        'height': iconSize,
        'stroke-width': 1,
        'rx': 1.5
      }),
      svg.line({
        'x1': iconX + iconSize * 0.15,
        'y1': iconY + iconSize * 0.5,
        'x2': iconX + iconSize * 0.85,
        'y2': iconY + iconSize * 0.5,
        'stroke-width': 1.5
      })
    );

    const plusIcon = svg.g(
      {
        'class': 'svg-container__toggle svg-hover-overlay',
        'data-hover': 'true',
        'on': {
          pointerdown: () => {
            const uow = new UnitOfWork(props.node.diagram, true);
            nodeDefinition.toggle(props.node, uow);
            commitWithUndo(uow, 'Toggle container');
            this.redraw();
          }
        }
      },
      svg.rect({
        'x': iconX,
        'y': iconY,
        'width': iconSize,
        'height': iconSize,
        'stroke-width': 1,
        'rx': 1.5
      }),
      svg.line({
        'x1': iconX + iconSize * 0.15,
        'y1': iconY + iconSize * 0.5,
        'x2': iconX + iconSize * 0.85,
        'y2': iconY + iconSize * 0.5,
        'stroke-width': 1.5
      }),
      svg.line({
        'x1': iconX + iconSize * 0.5,
        'y1': iconY + iconSize * 0.15,
        'x2': iconX + iconSize * 0.5,
        'y2': iconY + iconSize * 0.85,
        'stroke-width': 1.5
      })
    );

    const nodeDefinition = props.node.getDefinition() as ContainerNodeDefinition;

    if (containerProps.mode === 'expanded') {
      return minusIcon;
    } else {
      return plusIcon;
    }
  }
}

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof containerShapeActions> {}
  }
}

export const containerShapeActions = (context: Context) => ({
  SHAPE_CONTAINER_TOGGLE: new ContainerToggleAction(context)
});

class ContainerToggleAction extends AbstractSelectionAction<Context> {
  name = $tStr('action.SHAPE_CONTAINER_TOGGLE.name', 'Collapse/Expand');

  constructor(context: Context) {
    super(context, MultipleType.SingleOnly, ElementType.Node);
  }

  getCriteria(context: Context): Array<ActionCriteria> {
    const cb = () => {
      const $s = context.model.activeDiagram.selection;
      if ($s.nodes.length !== 1) return false;

      const node = $s.nodes[0];
      if (!node) return false;

      return node.nodeType === 'container';
    };

    return [
      ActionCriteria.EventTriggered(context.model.activeDiagram.selection, 'add', cb),
      ActionCriteria.EventTriggered(context.model.activeDiagram.selection, 'remove', cb)
    ];
  }

  execute(): void {
    const diagram = this.context.model.activeDiagram;
    assertRegularLayer(diagram.activeLayer);

    const uow = new UnitOfWork(diagram, true);

    const node = mustExist(diagram.selection.nodes[0]);
    const nodeDefinition = node.getDefinition() as ContainerNodeDefinition;
    nodeDefinition.toggle(node, uow);

    commitWithUndo(uow, 'Expand/Collapse container');
  }
}
