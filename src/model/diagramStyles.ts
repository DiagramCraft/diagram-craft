import { UnitOfWork } from './unitOfWork.ts';
import { DiagramElement, isEdge } from './diagramElement.ts';
import { DiagramDocument } from './diagramDocument.ts';
import { common, isObj } from '../utils/object.ts';

export type Stylesheet<P extends ElementProps> = {
  id: string;
  name: string;
  props: Partial<P>;
  type: 'node' | 'edge';
};

const DEFAULT_NODE_STYLES: Stylesheet<NodeProps>[] = [
  {
    id: 'default',
    name: 'Default',
    type: 'node',
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
    type: 'node',
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

const DEFAULT_EDGE_STYLES: Stylesheet<EdgeProps>[] = [
  {
    id: 'default-edge',
    type: 'edge',
    name: 'Default',
    props: {
      stroke: {
        color: 'green'
        //color: 'var(--canvas-fg)'
      }
    }
  }
];

export const getCommonProps = <T extends Record<string, unknown>>(arr: Array<T>): Partial<T> => {
  let e: T = arr[0];
  for (let i = 1; i < arr.length; i++) {
    e = common(e, arr[i]) as T;
  }
  return e as Partial<T>;
};

export const isPropsDirty = (
  props: Record<string, unknown>,
  stylesheetProps: Record<string, unknown>
): boolean => {
  for (const key of Object.keys(props)) {
    if (stylesheetProps[key] === undefined) continue;
    if (isObj(props[key])) {
      const r = isPropsDirty(
        props[key] as Record<string, unknown>,
        stylesheetProps[key] as Record<string, unknown>
      );
      if (r) return true;
    } else if (props[key] !== stylesheetProps[key]) {
      return true;
    }
  }
  return false;
};

export class DiagramStyles {
  constructor(private readonly document: DiagramDocument) {}

  nodeStyles: Stylesheet<NodeProps>[] = DEFAULT_NODE_STYLES;
  edgeStyles: Stylesheet<EdgeProps>[] = DEFAULT_EDGE_STYLES;

  get(id: string) {
    return [...this.nodeStyles, ...this.edgeStyles].find(s => s.id === id);
  }

  setStylesheet(el: DiagramElement, style: string, uow: UnitOfWork) {
    el.updateProps(props => {
      Object.keys(props).forEach(key => {
        delete props[key as keyof (NodeProps | EdgeProps)];
      });
      props.style = style;
    }, uow);
  }

  clearStylesheet(el: DiagramElement, uow: UnitOfWork) {
    el.updateProps(props => {
      Object.keys(props).forEach(key => {
        const validKey = key as keyof (NodeProps | EdgeProps);
        // @ts-ignore
        props[validKey] = el.propsForEditing[validKey];
      });
      props.style = isEdge(el) ? 'default-edge' : 'default';
    }, uow);
  }

  deleteStylesheet(id: string, uow: UnitOfWork) {
    // Cannot delete the default stylesheet
    if (id === 'default' || id === 'default-text') {
      return;
    }

    for (const diagram of this.document.diagrams) {
      for (const node of Object.values(diagram.nodeLookup)) {
        if (node.props.style === id) {
          this.clearStylesheet(node, uow);
        }
      }
      for (const edge of Object.values(diagram.edgeLookup)) {
        if (edge.props.style === id) {
          this.clearStylesheet(edge, uow);
        }
      }
    }
  }
}
