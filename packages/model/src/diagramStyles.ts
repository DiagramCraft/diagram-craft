import { DiagramElement, isEdge, isNode } from './diagramElement';
import { UndoableAction } from './undoManager';
import { StylesheetSnapshot, UnitOfWork, UOWTrackable } from './unitOfWork';
import { DiagramDocument } from './diagramDocument';
import { Diagram } from './diagram';
import { common, deepClear, deepClone, deepMerge, isObj } from '@diagram-craft/utils/object';
import { assert } from '@diagram-craft/utils/assert';
import { Defaults, DefaultStyles, edgeDefaults, nodeDefaults } from './diagramDefaults';

export type StylesheetType = 'node' | 'edge' | 'text';

type TextStyleProps = { text: Omit<NodeProps['text'], 'text' | 'style'> };
type NodeStyleProps = Omit<NodeProps, 'name' | 'text' | 'data' | 'style'>;
type EdgeStyleProps = Omit<EdgeProps, 'name' | 'text' | 'data' | 'style'>;

type TypeMap = {
  node: NodeStyleProps;
  edge: EdgeStyleProps;
  text: TextStyleProps;
};

export class Stylesheet<T extends StylesheetType, P = TypeMap[T]>
  implements UOWTrackable<StylesheetSnapshot>
{
  id: string;
  #name: string;
  #props: Partial<P>;
  type: T;

  constructor(type: T, id: string, name: string, props: Partial<P>) {
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

    this.#props = this.cleanProps(props);

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

  getPropsFromElement(el: DiagramElement): Partial<P> {
    const p = deepClone(el.editProps);
    return this.cleanProps(p as unknown as Partial<P>);
  }

  private cleanProps(props: Partial<P>): Partial<P> {
    if (this.type === 'edge') {
      const p = deepClone(props) as NodeProps;
      delete p.text;
      return p as P;
    } else if (this.type === 'text') {
      const p = deepClone(props) as NodeProps;
      // TODO: Not sure why this is needed?
      /*if (p.text && Object.keys(p.text).length === 0) {
        delete p.text;
      }*/
      return { text: p.text } as P;
    } else {
      const p = deepClone(props) as NodeProps;
      delete p.text;
      return p as P;
    }
  }
}

const DEFAULT_NODE_STYLES: Stylesheet<'node'>[] = [
  new Stylesheet('node', DefaultStyles.node.default, 'Default', {
    fill: {
      color: 'var(--canvas-bg2)'
    },
    stroke: {
      color: 'var(--canvas-fg)'
    }
  }),

  new Stylesheet('node', DefaultStyles.node.text, 'Text', {
    fill: {
      enabled: false
    },
    stroke: {
      enabled: false
    }
  })
];

const DEFAULT_TEXT_STYLES: Stylesheet<'text'>[] = [
  new Stylesheet('text', DefaultStyles.text.default, 'Default', {
    text: {
      color: 'var(--canvas-fg)',
      fontSize: 10,
      font: 'sans-serif',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0
    }
  }),
  new Stylesheet('text', 'h1', 'H1', {
    text: {
      color: 'var(--canvas-fg)',
      fontSize: 20,
      bold: true,
      font: 'sans-serif',
      align: 'left',
      top: 6,
      left: 6,
      right: 6,
      bottom: 6
    }
  })
];

const DEFAULT_EDGE_STYLES: Stylesheet<'edge'>[] = [
  new Stylesheet('edge', DefaultStyles.edge.default, 'Default', {
    stroke: {
      color: 'var(--canvas-fg)'
    },
    type: 'straight'
  })
];

export const getCommonProps = <T extends Record<string, unknown>>(arr: Array<T>): Partial<T> => {
  let e: T = arr[0];
  for (let i = 1; i < arr.length; i++) {
    e = common(e, arr[i]) as T;
  }
  return e as Partial<T>;
};

const isPropsDirty = (
  props: Record<string, unknown>,
  stylesheetProps: Record<string, unknown>,
  defaults: Defaults<unknown>,
  path: string[],
  strict = true
): boolean => {
  for (const key of Object.keys(props)) {
    if (isObj(props[key])) {
      // For custom props, we allow the stylesheet to include additional props
      if (key === 'custom' && path.length === 0) {
        if (stylesheetProps[key] === undefined) continue;

        const customPropsDirty = isPropsDirty(
          props[key],
          stylesheetProps[key] as Record<string, unknown>,
          defaults,
          [...path, key],
          false
        );
        if (customPropsDirty) return true;
      } else if (stylesheetProps[key] === undefined) {
        // If we are in non-strict mode (i.e. within the custom section), it's not considered
        // dirty in case the stylesheet is missing properties
        if (!strict) continue;

        // An empty object is considered equivalent to undefined
        if (Object.keys(props[key]).length === 0) continue;

        // Also an object with all defaults is equivalent to undefined
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (defaults.isDefaults(props[key] as any, [...path, key].join('.') as any)) continue;

        // TODO: We should add some normalization - or check compared to default value instead
        //        if (key === 'shadow' && keys.length === 1 && props[key].enabled === false) continue;

        // A missing object is considered non-dirty
        if (isObj(props[key])) continue;

        console.log('missing key', key, props[key]);
        return true;
      } else {
        const dirty = isPropsDirty(
          props[key],
          stylesheetProps[key] as Record<string, unknown>,
          defaults,
          [...path, key],
          strict
        );
        if (dirty) return true;
      }
    } else if (props[key] !== undefined && props[key] !== stylesheetProps[key]) {
      //      console.log('key', key, props[key], stylesheetProps[key]);
      return true;
    }
  }
  return false;
};

export const isSelectionDirty = ($d: Diagram, isText: boolean) => {
  const styles = $d.document.styles;
  if ($d.selectionState.elements.length === 0) {
    return false;
  }

  const metadata = $d.selectionState.elements[0].metadata;

  const stylesheet = isText
    ? styles.get(metadata.textStyle ?? DefaultStyles.text.default)
    : styles.get(metadata.style ?? DefaultStyles.node.default);
  assert.present(stylesheet);

  return $d.selectionState.elements.some(e => {
    const propsFromElement = stylesheet.getPropsFromElement(e);
    return isPropsDirty(
      propsFromElement,
      stylesheet?.props ?? {},
      // @ts-ignore
      isNode(e) ? nodeDefaults : edgeDefaults,
      []
    );
  });
};

export class DiagramStyles {
  constructor(private readonly document: DiagramDocument) {}

  textStyles: Stylesheet<'text'>[] = DEFAULT_TEXT_STYLES;
  nodeStyles: Stylesheet<'node'>[] = DEFAULT_NODE_STYLES;
  edgeStyles: Stylesheet<'edge'>[] = DEFAULT_EDGE_STYLES;

  #activeNodeStylesheet = DEFAULT_NODE_STYLES[0];
  #activeEdgeStylesheet = DEFAULT_EDGE_STYLES[0];
  #activeTextStylesheet = DEFAULT_TEXT_STYLES[0];

  get activeNodeStylesheet() {
    return this.#activeNodeStylesheet;
  }

  set activeNodeStylesheet(style: Stylesheet<'node'>) {
    if (style.id === DefaultStyles.node.text) return;
    this.#activeNodeStylesheet = style;
  }

  get activeEdgeStylesheet() {
    return this.#activeEdgeStylesheet;
  }

  set activeEdgeStylesheet(style: Stylesheet<'edge'>) {
    this.#activeEdgeStylesheet = style;
  }

  get activeTextStylesheet() {
    return this.#activeTextStylesheet;
  }

  set activeTextStylesheet(style: Stylesheet<'text'>) {
    this.#activeTextStylesheet = style;
  }

  get(id: string): Stylesheet<'edge'> | Stylesheet<'node'> | Stylesheet<'text'> | undefined {
    return [...this.nodeStyles, ...this.edgeStyles, ...this.textStyles].find(s => s.id === id);
  }

  setStylesheet(el: DiagramElement, style: string, uow: UnitOfWork, resetLocalProps: boolean) {
    const stylesheet = this.get(style);
    if (!stylesheet) {
      return;
    }

    if (stylesheet.type === 'node') {
      this.activeNodeStylesheet = stylesheet;
    } else if (stylesheet.type === 'text') {
      this.activeTextStylesheet = stylesheet;
    } else {
      this.activeEdgeStylesheet = stylesheet;
    }

    if (resetLocalProps) {
      el.updateProps((props: NodeProps & EdgeProps) => {
        const shapeToClear = stylesheet.getPropsFromElement(el);

        // For custom properties, we keep all custom properties that are
        // not part of the stylesheet
        if ('custom' in shapeToClear) {
          delete shapeToClear.custom;

          if ('custom' in stylesheet.props) {
            for (const key of Object.keys(stylesheet.props.custom!)) {
              if (shapeToClear.custom !== undefined && key in shapeToClear.custom) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                delete (shapeToClear.custom! as any)[key];
              }
            }
          }
        }

        deepClear(shapeToClear, props);
      }, uow);
    }
    el.updateMetadata(meta => {
      if (stylesheet.type !== 'text') {
        meta.style = style;
      } else {
        meta.textStyle = style;
      }
    }, uow);
  }

  deleteStylesheet(id: string, uow: UnitOfWork) {
    // Cannot delete the default stylesheet
    if (this.isDefaultStyle(id)) {
      return;
    }

    const stylesheet = this.get(id);
    if (!stylesheet) {
      return;
    }

    if (stylesheet.type === 'node') {
      this.activeNodeStylesheet = this.nodeStyles.filter(s => s !== stylesheet)[0];
    } else if (stylesheet.type === 'text') {
      this.activeTextStylesheet = this.textStyles.filter(s => s !== stylesheet)[0];
    } else {
      this.activeEdgeStylesheet = this.edgeStyles.filter(s => s !== stylesheet)[0];
    }

    this.clearStylesheet(id, uow);

    if (stylesheet.type === 'node') {
      this.nodeStyles = this.nodeStyles.filter(s => s.id !== id);
    } else if (stylesheet.type === 'text') {
      this.textStyles = this.textStyles.filter(s => s.id !== id);
    } else {
      this.edgeStyles = this.edgeStyles.filter(s => s.id !== id);
    }
  }

  modifyStylesheet(stylesheet: Stylesheet<StylesheetType>, uow: UnitOfWork) {
    for (const diagram of this.document.diagramIterator({ nest: true })) {
      for (const el of diagram.allElements()) {
        if (isNode(el)) {
          if (el.metadata.style === stylesheet.id || el.metadata.textStyle === stylesheet.id) {
            this.setStylesheet(el, stylesheet.id, uow, false);
          }
        } else {
          if (el.metadata.style === stylesheet.id) {
            this.setStylesheet(el, stylesheet.id, uow, false);
          }
        }
      }
    }
  }

  clearStylesheet(id: string, uow: UnitOfWork) {
    // Cannot delete the default stylesheet
    if (this.isDefaultStyle(id)) {
      return;
    }

    const stylesheet = this.get(id);
    if (!stylesheet) return;

    for (const diagram of this.document.diagramIterator({ nest: true })) {
      for (const el of diagram.allElements()) {
        if (isNode(el)) {
          if (el.metadata.style === id || el.metadata.textStyle === id) {
            this.clearStylesheetFromElement(el, stylesheet, uow);
          }
        } else {
          if (el.metadata.style === id) {
            this.clearStylesheetFromElement(el, stylesheet, uow);
          }
        }
      }
    }
  }

  private isDefaultStyle(id: string) {
    return id.startsWith('default');
  }

  private clearStylesheetFromElement(
    el: DiagramElement,
    stylesheet: Stylesheet<StylesheetType>,
    uow: UnitOfWork
  ) {
    el.updateProps((props: NodeProps & EdgeProps) => {
      Object.keys(stylesheet.props).forEach(key => {
        const validKey = key as keyof (NodeProps | EdgeStyleProps);
        // @ts-ignore
        props[validKey] = deepMerge({}, props[validKey], stylesheet.props[validKey]);
      });
    }, uow);
    el.updateMetadata(meta => {
      meta.style = isEdge(el) ? DefaultStyles.edge.default : DefaultStyles.node.default;
      if (isNode(el)) {
        meta.textStyle = DefaultStyles.text.default;
      }
    }, uow);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addStylesheet(stylesheet: Stylesheet<any>, _uow?: UnitOfWork) {
    if (stylesheet.type === 'node') {
      this.nodeStyles = this.nodeStyles.filter(s => s.id !== stylesheet.id);
      this.nodeStyles.push(stylesheet);
      this.activeNodeStylesheet = stylesheet;
    } else if (stylesheet.type === 'text') {
      this.textStyles = this.textStyles.filter(s => s.id !== stylesheet.id);
      this.textStyles.push(stylesheet);
      this.activeTextStylesheet = stylesheet;
    } else {
      this.edgeStyles = this.edgeStyles.filter(s => s.id !== stylesheet.id);
      this.edgeStyles.push(stylesheet);
      this.activeEdgeStylesheet = stylesheet;
    }
  }
}

export class DeleteStylesheetUndoableAction implements UndoableAction {
  description = 'Delete stylesheet';

  constructor(
    private readonly diagram: Diagram,
    private readonly stylesheet: Stylesheet<StylesheetType>
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
    private readonly stylesheet: Stylesheet<StylesheetType>
  ) {}

  undo(uow: UnitOfWork) {
    this.diagram.document.styles.deleteStylesheet(this.stylesheet.id, uow);
  }

  redo(uow: UnitOfWork) {
    this.diagram.document.styles.addStylesheet(this.stylesheet, uow);
  }
}
