import { ShapeNodeDefinition } from '../shape/shapeNodeDefinition';
import { BaseNodeComponent, BaseShapeBuildShapeProps } from '../components/BaseNodeComponent';
import * as svg from '../component/vdom-svg';
import { Transforms } from '../component/vdom-svg';
import { ShapeBuilder } from '../shape/ShapeBuilder';
import { Box } from '@diagram-craft/geometry/box';
import { PathBuilder, unitCoordinateSystem } from '@diagram-craft/geometry/pathBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { Rotation, Scale, Transform, Translation } from '@diagram-craft/geometry/transform';
import { DiagramElement, isNode } from '@diagram-craft/model/diagramElement';
import {
  CustomPropertyDefinition,
  NodeCapability
} from '@diagram-craft/model/elementDefinitionRegistry';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { largest } from '@diagram-craft/utils/array';

declare global {
  interface NodeProps {
    container?: {
      autoGrow?: boolean;
      fillSecondaryAxis?: boolean;
      canResize?: 'primary' | 'secondary' | 'both';
      layout?: 'manual' | 'horizontal' | 'vertical';
      gap?: number;
    };
  }
}

type Entry = {
  node: DiagramElement;
  localBounds: Box;
  newLocalBounds?: Box;
};

type Layout = (node: DiagramNode, children: Entry[], localBounds: Box) => Box;

const horizontalLayout: Layout = (node: DiagramNode, children: Entry[], localBounds: Box) => {
  if (children.length === 0) return localBounds;

  const fill = node.props.container?.fillSecondaryAxis;
  const gap = node.props.container?.gap ?? 0;

  // Sort children by x position
  const sortedLocalChildren = children.sort((a, b) => a.localBounds.x - b.localBounds.x);

  const maxHeight = largest(
    sortedLocalChildren.map(c => c.localBounds.h),
    (a, b) => a - b
  )!;

  let x = gap;
  for (const entry of sortedLocalChildren) {
    if (!isNode(entry.node)) continue;

    entry.newLocalBounds = {
      ...entry.localBounds,
      x,
      y: fill ? 0 : entry.localBounds.y,
      h: maxHeight
    };
    x += entry.newLocalBounds.w + (node.props.container?.gap ?? 0);
  }

  return Box.boundingBox([
    { ...localBounds, w: x - localBounds.x, h: 1 },
    ...children.map(c => c.localBounds)
  ]);
};

const verticalLayout: Layout = (node: DiagramNode, children: Entry[], localBounds: Box) => {
  if (children.length === 0) return localBounds;

  const fill = node.props.container?.fillSecondaryAxis;
  const gap = node.props.container?.gap ?? 0;

  // Sort children by y position
  const sortedLocalChildren = children.sort((a, b) => a.localBounds.y - b.localBounds.y);

  const maxWidth = largest(
    sortedLocalChildren.map(c => c.localBounds.w),
    (a, b) => a - b
  )!;

  let y = gap;
  for (const entry of sortedLocalChildren) {
    if (!isNode(entry.node)) continue;

    entry.newLocalBounds = {
      ...entry.localBounds,
      x: fill ? 0 : entry.localBounds.x,
      y,
      w: maxWidth
    };
    y += entry.newLocalBounds.h + (node.props.container?.gap ?? 0);
  }

  return Box.boundingBox([
    { ...localBounds, w: 1, h: y - node.bounds.y },
    ...children.map(c => c.localBounds)
  ]);
};

const defaultLayout: Layout = (node: DiagramNode, children: Entry[], localBounds: Box) => {
  if (!node.props.container?.autoGrow) return localBounds;
  if (children.length === 0) return localBounds;

  return Box.boundingBox([localBounds, ...children.map(c => c.localBounds)]);
};

const LAYOUTS = {
  horizontal: horizontalLayout,
  vertical: verticalLayout,
  manual: defaultLayout
};

export class ContainerNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('container', 'Container', ContainerComponent);
  }

  supports(capability: NodeCapability): boolean {
    return ['children'].includes(capability);
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));
    pathBuilder.moveTo(Point.of(-1, 1));
    pathBuilder.lineTo(Point.of(1, 1));
    pathBuilder.lineTo(Point.of(1, -1));
    pathBuilder.lineTo(Point.of(-1, -1));
    pathBuilder.lineTo(Point.of(-1, 1));

    return pathBuilder;
  }

  onTransform(transforms: ReadonlyArray<Transform>, node: DiagramNode, uow: UnitOfWork) {
    if (transforms.find(t => t instanceof Scale)) return;
    for (const child of node.children) {
      child.transform(transforms, uow, true);
    }
  }

  getCustomProperties(node: DiagramNode): Array<CustomPropertyDefinition> {
    return [
      {
        id: 'layout',
        type: 'select',
        label: 'Layout',
        value: node.props.container?.layout ?? 'manual',
        options: [
          { value: 'manual', label: 'Manual' },
          { value: 'horizontal', label: 'Horizontal' },
          { value: 'vertical', label: 'Vertical' }
        ],
        onChange: (value: string, uow: UnitOfWork) => {
          node.updateProps(props => {
            props.container ??= {};
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            props.container.layout = value as any;
          }, uow);
        }
      },
      {
        id: 'autoGrow',
        type: 'boolean',
        label: 'Grow',
        value: node.props.container?.autoGrow ?? false,
        onChange: (value: boolean, uow: UnitOfWork) => {
          node.updateProps(props => {
            props.container ??= {};
            props.container.autoGrow = value;
          }, uow);
        }
      },

      {
        id: 'gap',
        type: 'number',
        label: 'Gap',
        value: node.props.container?.gap ?? 0,
        unit: 'px',
        onChange: (value: number, uow: UnitOfWork) => {
          node.updateProps(props => {
            props.container ??= {};
            props.container.gap = value;
          }, uow);
        }
      },
      {
        id: 'fillSecondaryAxis',
        type: 'boolean',
        label: 'Fill',
        value: node.props.container?.fillSecondaryAxis ?? false,
        onChange: (value: boolean, uow: UnitOfWork) => {
          node.updateProps(props => {
            props.container ??= {};
            props.container.fillSecondaryAxis = value;
          }, uow);
        }
      },
      {
        id: 'canResize',
        type: 'select',
        label: 'Can Resize',
        value: node.props.container?.canResize ?? 'both',
        options: [
          { value: 'primary', label: 'Primary' },
          { value: 'secondary', label: 'Secondary' },
          { value: 'both', label: 'Both' }
        ],
        onChange: (value: string, uow: UnitOfWork) => {
          node.updateProps(props => {
            props.container ??= {};
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            props.container.canResize = value as any;
          }, uow);
        }
      }
    ];
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

  onChildChanged(node: DiagramNode, uow: UnitOfWork) {
    if (uow.changeType === 'interactive') return;

    this.applyLayout(node, uow);

    if (node.parent) {
      const parentDef = node.parent.getDefinition();
      parentDef.onChildChanged(node.parent, uow);
    }
  }

  onPropUpdate(node: DiagramNode, uow: UnitOfWork): void {
    this.applyLayout(node, uow);
  }

  private applyLayout(node: DiagramNode, uow: UnitOfWork) {
    // We need to perform all layout operations in the local coordinate system of the node

    const transformBack = [
      new Translation({ x: -node.bounds.x, y: -node.bounds.y }),
      new Rotation(-node.bounds.r)
    ];
    const transformForward = [
      new Rotation(node.bounds.r),
      new Translation({ x: node.bounds.x, y: node.bounds.y })
    ];

    const localBounds = Transform.box(node.bounds, ...transformBack);
    const children: Entry[] = node.children.map(c => ({
      node: c,
      localBounds: Transform.box(c.bounds, ...transformBack),
      newLocalBounds: undefined
    }));

    if (children.length === 0) return;

    const layout = LAYOUTS[node.props.container?.layout ?? 'manual'];
    let newBounds = layout(node, children, localBounds);

    // Shrink to minimum size, but retain the position
    let xEnd = localBounds.x + localBounds.w;
    let yEnd = localBounds.y + localBounds.h;
    if (node.props.container?.autoGrow) {
      for (const entry of children) {
        const lb = entry.newLocalBounds ?? entry.localBounds;
        xEnd = Math.max(xEnd, lb.x + lb.w);
        yEnd = Math.max(yEnd, lb.y + lb.h);
      }
    }

    newBounds = {
      x: localBounds.x,
      y: localBounds.y,
      w: Math.max(xEnd - localBounds.x, 1),
      h: Math.max(yEnd - localBounds.y, 1),
      r: 0
    };

    // Transform back to global coordinate system
    node.setBounds(Transform.box(newBounds, ...transformForward), uow);
    for (const entry of children) {
      if (!entry.newLocalBounds) continue;
      if (!isNode(entry.node)) continue;
      entry.node.setBounds(Transform.box(entry.newLocalBounds, ...transformForward), uow);
    }

    if (node.parent) {
      const parentDef = node.parent.getDefinition();
      parentDef.onChildChanged(node.parent, uow);
    }
  }
}

class ContainerComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    const paths = new ContainerNodeDefinition().getBoundingPathBuilder(props.node).getPaths();

    const path = paths.singularPath();
    const svgPath = path.asSvgPath();

    builder.add(
      svg.path({
        'd': svgPath,
        'x': props.node.bounds.x,
        'y': props.node.bounds.y,
        'width': props.node.bounds.w,
        'height': props.node.bounds.h,
        'stroke': props.nodeProps.highlight?.includes('drop-target') ? '#30A46C' : '#d5d5d4',
        'stroke-width': props.nodeProps.highlight?.includes('drop-target') ? 3 : 1,
        'fill': 'transparent',
        'on': {
          mousedown: props.onMouseDown
        }
      })
    );

    props.node.children.forEach(child => {
      builder.add(
        svg.g(
          { transform: Transforms.rotateBack(props.node.bounds) },
          this.makeElement(child, props)
        )
      );
    });
  }
}
