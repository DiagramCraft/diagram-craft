import { ShapeNodeDefinition } from '../shapeNodeDefinition.ts';
import { CustomPropertyDefinition, NodeCapability } from '../../model/elementDefinitionRegistry.ts';
import { DiagramNode } from '../../model/diagramNode.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { DiagramElement, isNode } from '../../model/diagramElement.ts';
import { BaseShape, BaseShapeBuildProps, ShapeBuilder } from '../temp/baseShape.temp.ts';
import * as svg from '../../base-ui/vdom-svg.ts';
import { DiagramEdge } from '../../model/diagramEdge.ts';
import {
  Box,
  PathBuilder,
  Point,
  Rotation,
  Scale,
  Transform,
  Translation,
  unitCoordinateSystem
} from '@diagram-craft/geometry';

declare global {
  interface NodeProps {
    container?: {
      autoGrow?: boolean;
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

export class ContainerNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('container', 'Container', () => new ContainerComponent(this));
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

  getCustomProperties(node: DiagramNode): Record<string, CustomPropertyDefinition> {
    return {
      autoGrow: {
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
      layout: {
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
      gap: {
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
      }
    };
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

    let newBounds: Box;
    if (node.props.container?.layout === 'horizontal') {
      // Sort children by x position
      const sortedLocalChildren = children.sort((a, b) => a.localBounds.x - b.localBounds.x);
      if (sortedLocalChildren.length === 0) return;

      let x = node.props.container.gap ?? 0;
      for (let i = 0; i < sortedLocalChildren.length; i++) {
        const entry = sortedLocalChildren[i];
        if (!isNode(entry.node)) continue;

        entry.newLocalBounds = { ...entry.localBounds, x };
        x += entry.newLocalBounds.w + (node.props.container.gap ?? 0);
      }

      newBounds = Box.boundingBox([
        { ...localBounds, w: x - localBounds.x, h: 1 },
        ...children.map(c => c.localBounds)
      ]);
    } else if (node.props.container?.layout === 'vertical') {
      // Sort children by y position
      const sortedLocalChildren = children.sort((a, b) => a.localBounds.y - b.localBounds.y);
      if (sortedLocalChildren.length === 0) return;

      let y = node.props.container.gap ?? 0;
      for (let i = 0; i < sortedLocalChildren.length; i++) {
        const entry = sortedLocalChildren[i];
        if (!isNode(entry.node)) continue;

        entry.newLocalBounds = { ...entry.localBounds, y };
        y += entry.newLocalBounds.h + (node.props.container.gap ?? 0);
      }

      newBounds = Box.boundingBox([
        { ...localBounds, w: 1, h: y - node.bounds.y },
        ...children.map(c => c.localBounds)
      ]);
    } else {
      if (!node.props.container?.autoGrow) return;

      const sortedLocalChildren = children.sort((a, b) => a.localBounds.x - b.localBounds.x);
      if (sortedLocalChildren.length === 0) return;

      newBounds = Box.boundingBox([localBounds, ...children.map(c => c.localBounds)]);
    }

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

class ContainerComponent extends BaseShape {
  buildShape(props: BaseShapeBuildProps, builder: ShapeBuilder) {
    const path = this.nodeDefinition.getBoundingPathBuilder(props.node).getPath();
    const svgPath = path.asSvgPath();

    const center = Box.center(props.node.bounds);
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
        this.rotateBack(
          center,
          props.node.bounds.r,
          isNode(child) ? this.makeNode(child, props) : this.makeEdge(child as DiagramEdge, props)
        )
      );
    });
  }
}
