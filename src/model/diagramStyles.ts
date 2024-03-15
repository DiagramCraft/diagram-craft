import { StylesheetSnapshot, UnitOfWork, UOWTrackable } from './unitOfWork.ts';
import { DiagramElement, isEdge, isNode } from './diagramElement.ts';
import { DiagramDocument } from './diagramDocument.ts';
import { common, isObj } from '../utils/object.ts';
import { deepClone, deepMerge } from '../utils/object.ts';
import { UndoableAction } from './undoManager.ts';
import { Diagram } from './diagram.ts';

export class Stylesheet<P extends ElementProps = ElementProps>
  implements UOWTrackable<StylesheetSnapshot>
{
  id: string;
  #name: string;
  #props: Partial<P>;
  type: 'node' | 'edge';

  constructor(type: 'node' | 'edge', id: string, name: string, props: Partial<P>) {
    this.id = id;
    this.#name = name;
    this.#props = props;
    this.type = type;
  }

  get props(): Partial<P> {
    return this.#props;
  }

  setProps(props: Partial<P>, uow: UnitOfWork): void {
    uow.snapshot(this);
    this.#props = props;
    uow.updateElement(this);
  }

  get name() {
    return this.#name;
  }

  setName(name: string, uow: UnitOfWork) {
    uow.snapshot(this);
    this.#name = name;
    uow.updateElement(this);
  }

  invalidate(_uow: UnitOfWork): void {
    // Do nothing
  }

  restore(snapshot: StylesheetSnapshot, uow: UnitOfWork): void {
    this.setName(snapshot.name, uow);
    // eslint-disable-next-line
    this.#props = snapshot.props as any;
    uow.updateElement(this);
  }

  snapshot(): StylesheetSnapshot {
    return {
      _snapshotType: 'stylesheet',
      id: this.id,
      name: this.name,
      props: deepClone(this.#props),
      type: this.type
    };
  }
}

const DEFAULT_NODE_STYLES: Stylesheet<NodeProps>[] = [
  new Stylesheet('node', 'default', 'Default', {
    fill: {
      color: 'var(--canvas-bg)'
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
  }),
  new Stylesheet('node', 'default-text', 'Default text', {
    fill: {
      enabled: false
    },
    stroke: {
      enabled: false
    },
    text: {
      color: 'var(--canvas-fg)',
      fontSize: 10,
      font: 'sans-serif',
      align: 'left',
      left: 0,
      top: 0,
      right: 0,
      bottom: 0
    }
  })
];

const DEFAULT_EDGE_STYLES: Stylesheet<EdgeProps>[] = [
  new Stylesheet('edge', 'default-edge', 'Default', {
    stroke: {
      color: 'var(--canvas-fg)'
    }
  })
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

  deleteStylesheet(id: string, uow: UnitOfWork) {
    // Cannot delete the default stylesheet
    if (id === 'default' || id === 'default-text') {
      return;
    }

    const stylesheet = this.get(id);
    if (!stylesheet) {
      return;
    }

    this.clearStylesheet(id, uow);

    if (stylesheet.type === 'node') {
      this.nodeStyles = this.nodeStyles.filter(s => s.id !== id);
    } else {
      this.edgeStyles = this.edgeStyles.filter(s => s.id !== id);
    }
  }

  clearStylesheet(id: string, uow: UnitOfWork) {
    // Cannot delete the default stylesheet
    if (id === 'default' || id === 'default-text') {
      return;
    }

    const stylesheet = this.get(id);
    if (!stylesheet) return;

    for (const diagram of this.document.diagrams) {
      for (const node of diagram.nodeLookup.values()) {
        if (node.props.style === id) {
          this.clearStylesheetFromElement(node, stylesheet, uow);
        }
      }
      for (const edge of diagram.edgeLookup.values()) {
        if (edge.props.style === id) {
          this.clearStylesheetFromElement(edge, stylesheet, uow);
        }
      }
    }
  }

  private clearStylesheetFromElement(el: DiagramElement, stylesheet: Stylesheet, uow: UnitOfWork) {
    el.updateProps(props => {
      Object.keys(stylesheet.props).forEach(key => {
        const validKey = key as keyof (NodeProps | EdgeProps);
        // @ts-ignore
        props[validKey] = deepMerge({}, props[validKey], stylesheet.props[validKey]);
      });
      props.style = isEdge(el)
        ? 'default-edge'
        : isNode(el) && el.nodeType === 'text'
          ? 'default-text'
          : 'default';
    }, uow);
  }

  addStylesheet(stylesheet: Stylesheet, _uow: UnitOfWork) {
    if (stylesheet.type === 'node') {
      this.nodeStyles.push(stylesheet);
    } else {
      this.edgeStyles.push(stylesheet);
    }
  }

  toJSON() {
    return {
      nodeStyles: this.nodeStyles,
      edgeStyles: this.edgeStyles
    };
  }
}

export class DeleteStylesheetUndoableAction implements UndoableAction {
  description = 'Delete stylesheet';

  constructor(
    private readonly diagram: Diagram,
    private readonly stylesheet: Stylesheet
  ) {}

  undo(uow: UnitOfWork) {
    this.diagram.document.styles.addStylesheet(this.stylesheet, uow);
  }

  redo(uow: UnitOfWork) {
    this.diagram.document.styles.deleteStylesheet(this.stylesheet.id, uow);
  }
}

export class AddStylesheetUndoableAction implements UndoableAction {
  description = 'Add stylesheet';

  constructor(
    private readonly diagram: Diagram,
    private readonly stylesheet: Stylesheet
  ) {}

  undo(uow: UnitOfWork) {
    this.diagram.document.styles.deleteStylesheet(this.stylesheet.id, uow);
  }

  redo(uow: UnitOfWork) {
    this.diagram.document.styles.addStylesheet(this.stylesheet, uow);
  }
}
