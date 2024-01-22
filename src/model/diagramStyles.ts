import { DiagramNode } from './diagramNode.ts';
import { UnitOfWork } from './unitOfWork.ts';
import { DiagramEdge } from './diagramEdge.ts';

type NodeStyle = {
  id: string;
  name: string;
  props: Partial<NodeProps>;
};

type EdgeStyle = {
  id: string;
  name: string;
  props: Partial<EdgeProps>;
};

export class DiagramStyles {
  nodeStyles: NodeStyle[] = [
    {
      id: 'default',
      name: 'Default',
      props: {
        fill: {
          color: 'red'
          //color: 'var(--canvas-bg)'
        },
        stroke: {
          color: 'var(--canvas-fg)'
        },
        text: {
          color: 'var(--canvas-fg)',
          fontSize: 10,
          font: 'sans-serif',
          top: 6,
          left: 6,
          right: 6,
          bottom: 6
        }
      }
    },
    {
      id: 'default-text',
      name: 'Default text',
      props: {
        fill: {
          enabled: false
        },
        stroke: {
          enabled: false
        },
        text: {
          color: 'pink',
          //color: 'var(--canvas-fg)',
          fontSize: 10,
          font: 'sans-serif',
          align: 'left',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0
        }
      }
    }
  ];
  edgeStyles: EdgeStyle[] = [
    {
      id: 'default',
      name: 'Default',
      props: {
        stroke: {
          color: 'green'
          //color: 'var(--canvas-fg)'
        }
      }
    }
  ];

  applyNodeProps(node: DiagramNode, style: string, uow: UnitOfWork) {
    node.updateProps(props => {
      Object.keys(props).forEach(key => {
        delete props[key as keyof NodeProps];
      });
      props.style = style;
    }, uow);
  }

  applyEdgeProps(edge: DiagramEdge, style: string, uow: UnitOfWork) {
    edge.updateProps(props => {
      Object.keys(props).forEach(key => {
        delete props[key as keyof EdgeProps];
      });
      props.style = style;
    }, uow);
  }
}
