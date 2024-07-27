import { DiagramElement, isEdge, isNode } from './diagramElement';
import { UndoableAction } from './undoManager';
import { StylesheetSnapshot, UnitOfWork, UOWTrackable } from './unitOfWork';
import { DiagramDocument } from './diagramDocument';
import { Diagram } from './diagram';
import { common, deepClear, deepClone, deepMerge, isObj } from '@diagram-craft/utils/object';
import { assert } from '@diagram-craft/utils/assert';
import { DefaultStyles, edgeDefaults, nodeDefaults } from './diagramDefaults';

export type StylesheetType = 'node' | 'edge' | 'text';

type TextStyleProps = { text: Omit<NodeProps['text'], 'text' | 'style'> };
type NodeStyleProps = Omit<NodeProps, 'name' | 'text' | 'data' | 'style'>;
type EdgeStyleProps = Omit<EdgeProps, 'name' | 'text' | 'data' | 'style'>;

export class Stylesheet<
  T extends StylesheetType,
  P = {
    node: NodeStyleProps;
    edge: EdgeStyleProps;
    text: TextStyleProps;
  }[T]
> implements UOWTrackable<StylesheetSnapshot>
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
      if (p.text) {
        if (Object.keys(p.text).length === 0) {
          delete p.text;
        }
      }
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

const isDefaults = (props: Record<string, unknown>, defaults: Record<string, unknown>): boolean => {
  for (const key of Object.keys(props)) {
    if (isObj(props[key])) {
      if (
        !isDefaults(props[key] as Record<string, unknown>, defaults[key] as Record<string, unknown>)
      ) {
        return false;
      }
    } else if (props[key] !== defaults[key]) {
      return false;
    }
  }
  return true;
};

const isPropsDirty = (
  props: Record<string, unknown>,
  stylesheetProps: Record<string, unknown>,
  defaults: Record<string, unknown>
): boolean => {
  for (const key of Object.keys(props)) {
    if (isObj(props[key])) {
      if (stylesheetProps[key] === undefined) {
        const keys = Object.keys(props[key]);

        if (keys.length === 0) continue;
        if (isDefaults(props[key], defaults[key] as Record<string, unknown>)) continue;

        // TODO: We should add some normalization - or check compared to default value instead
        //        if (key === 'shadow' && keys.length === 1 && props[key].enabled === false) continue;

        console.log('missing key', key, props[key]);
        return true;
      }

      const r = isPropsDirty(
        props[key] as Record<string, unknown>,
        stylesheetProps[key] as Record<string, unknown>,
        defaults[key] as Record<string, unknown>
      );
      if (r) return true;
    } else if (props[key] !== undefined && props[key] !== stylesheetProps[key]) {
      console.log('key', key, props[key], stylesheetProps[key]);
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

  const stylesheet = isText ? styles.get(metadata.textStyle!) : styles.get(metadata.style!);
  assert.present(stylesheet);

  return $d.selectionState.elements.some(e => {
    const propsFromElement = stylesheet.getPropsFromElement(e);
    return isPropsDirty(
      propsFromElement,
      stylesheet?.props ?? {},
      isNode(e) ? nodeDefaults : edgeDefaults
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

  setStylesheet(el: DiagramElement, style: string, uow: UnitOfWork, force: boolean) {
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

    if (force) {
      el.updateProps((props: NodeProps & EdgeProps) => {
        deepClear(stylesheet.getPropsFromElement(el), props);
      }, uow);
      el.updateMetadata(meta => {
        if (stylesheet.type !== 'text') {
          meta.style = style;
        } else {
          meta.textStyle = style;
        }
      }, uow);
    }
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
    for (const diagram of this.document.diagrams) {
      for (const node of diagram.nodeLookup.values()) {
        if (node.metadata.style === stylesheet.id || node.metadata.textStyle === stylesheet.id) {
          this.setStylesheet(node, stylesheet.id, uow, false);
        }
      }
      for (const edge of diagram.edgeLookup.values()) {
        if (edge.metadata.style === stylesheet.id) {
          this.setStylesheet(edge, stylesheet.id, uow, false);
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

    for (const diagram of this.document.diagrams) {
      for (const node of diagram.nodeLookup.values()) {
        if (node.metadata.style === id || node.metadata.textStyle === id) {
          this.clearStylesheetFromElement(node, stylesheet, uow);
        }
      }
      for (const edge of diagram.edgeLookup.values()) {
        if (edge.metadata.style === id) {
          this.clearStylesheetFromElement(edge, stylesheet, uow);
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
