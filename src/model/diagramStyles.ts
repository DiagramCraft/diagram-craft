import { UnitOfWork } from './unitOfWork.ts';
import { DiagramElement } from './diagramElement.ts';

export type Stylesheet<P extends ElementProps> = {
  id: string;
  name: string;
  props: Partial<P>;
};

export class DiagramStyles {
  nodeStyles: Stylesheet<NodeProps>[] = [
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
  edgeStyles: Stylesheet<EdgeProps>[] = [
    {
      id: 'default-edge',
      name: 'Default',
      props: {
        stroke: {
          color: 'green'
          //color: 'var(--canvas-fg)'
        }
      }
    }
  ];

  applyProps(el: DiagramElement, style: string, uow: UnitOfWork) {
    el.updateProps(props => {
      Object.keys(props).forEach(key => {
        delete props[key as keyof (NodeProps | EdgeProps)];
      });
      props.style = style;
    }, uow);
  }
}
