import React from 'react';
import { DiagramNode } from '../../model/diagramNode.ts';
import { PathBuilder, unitCoordinateSystem } from '../../geometry/pathBuilder.ts';
import { Point } from '../../geometry/point.ts';
import { propsUtils } from '../utils/propsUtils.ts';
import { Edge } from '../Edge.tsx';
import { Node } from '../Node.tsx';
import { Modifiers } from '../../base-ui/drag/dragDropManager.ts';
import { AbstractReactNodeDefinition } from '../reactNodeDefinition.ts';
import { CustomPropertyDefinition, NodeCapability } from '../../model/elementDefinitionRegistry.ts';
import { Angle } from '../../geometry/angle.ts';
import { Box } from '../../geometry/box.ts';
import { Rotation, Scale, Transform, Translation } from '../../geometry/transform.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { DiagramElement, isNode } from '../../model/diagramElement.ts';
import { ApplicationTriggers } from '../../react-canvas-editor/EditableCanvas.tsx';
import { DiagramEdge } from '../../model/diagramEdge.ts';
import { Tool } from '../../react-canvas-editor/tools/types.ts';

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

export const Container = (props: Props) => {
  const path = new ContainerNodeDefinition().getBoundingPathBuilder(props.node).getPath();
  const svgPath = path.asSvgPath();

  const center = Box.center(props.node.bounds);
  return (
    <>
      <path
        d={svgPath}
        x={props.node.bounds.x}
        y={props.node.bounds.y}
        width={props.node.bounds.w}
        height={props.node.bounds.h}
        stroke={props.nodeProps.highlight?.includes('drop-target') ? '#30A46C' : '#d5d5d4'}
        strokeWidth={props.nodeProps.highlight?.includes('drop-target') ? 3 : 1}
        fill={'transparent'}
        {...propsUtils.filterSvgProperties(props, 'fill', 'stroke', 'strokeWidth', 'style')}
      />
      {props.node.children.map(child => (
        <g
          key={child.id}
          transform={`rotate(${-Angle.toDeg(props.node.bounds.r)} ${center.x} ${center.y})`}
        >
          {isNode(child) ? (
            <Node
              def={child}
              diagram={props.node.diagram}
              onDoubleClick={props.childProps.onDoubleClick}
              onMouseDown={props.childProps.onMouseDown}
              applicationTriggers={props.childProps.applicationTriggers}
              tool={props.tool}
            />
          ) : (
            <Edge
              def={child as DiagramEdge}
              diagram={props.node.diagram}
              onDoubleClick={props.childProps.onDoubleClick ?? (() => {})}
              onMouseDown={props.childProps.onMouseDown}
              applicationTriggers={props.childProps.applicationTriggers}
              tool={props.tool}
            />
          )}
        </g>
      ))}
    </>
  );
};

export class ContainerNodeDefinition extends AbstractReactNodeDefinition {
  constructor() {
    super('container', 'Container');
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

type Props = {
  node: DiagramNode;
  isSelected: boolean;
  isSingleSelected: boolean;
  nodeProps: NodeProps;
  tool: Tool | undefined;
  childProps: {
    onMouseDown: (id: string, coord: Point, modifiers: Modifiers) => void;
    onDoubleClick?: (id: string, coord: Point) => void;
    applicationTriggers: ApplicationTriggers;
  };
} & Omit<React.SVGProps<SVGRectElement>, 'onMouseDown' | 'onDoubleClick'>;
