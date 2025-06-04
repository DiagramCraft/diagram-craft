import { DiagramElement, isEdge, isNode } from './diagramElement';
import { UndoableAction } from './undoManager';
import { StylesheetSnapshot, UnitOfWork, UOWTrackable } from './unitOfWork';
import { DiagramDocument } from './diagramDocument';
import { Diagram } from './diagram';
import { common, deepClear, deepClone, deepMerge, isObj } from '@diagram-craft/utils/object';
import { assert } from '@diagram-craft/utils/assert';
import { Defaults, DefaultStyles, edgeDefaults, nodeDefaults } from './diagramDefaults';
import { CRDTMap, CRDTRoot } from './collaboration/crdt';

export type StylesheetType = 'node' | 'edge' | 'text';

const DEFAULT_NODE_STYLES: Record<string, Omit<StylesheetSnapshot, 'id' | '_snapshotType'>> = {
  [DefaultStyles.node.default]: {
    name: 'Default',
    props: {
      fill: {
        color: 'var(--canvas-bg2)'
      },
      stroke: {
        color: 'var(--canvas-fg)'
      }
    },
    type: 'node'
  },

  [DefaultStyles.node.text]: {
    type: 'node',
    name: 'Text',
    props: {
      fill: {
        enabled: false
      },
      stroke: {
        enabled: false
      }
    }
  }
};

const DEFAULT_TEXT_STYLES: Record<string, Omit<StylesheetSnapshot, 'id' | '_snapshotType'>> = {
  [DefaultStyles.text.default]: {
    type: 'text',
    name: 'Default',
    props: {
      text: {
        color: 'var(--canvas-fg)',
        fontSize: 10,
        font: 'sans-serif',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
      }
    }
  },
  h1: {
    type: 'text',
    name: 'H1',
    props: {
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
    }
  }
};

const DEFAULT_EDGE_STYLES: Record<string, Omit<StylesheetSnapshot, 'id' | '_snapshotType'>> = {
  [DefaultStyles.edge.default]: {
    type: 'edge',
    name: 'Default',
    props: {
      stroke: {
        color: 'var(--canvas-fg)'
      },
      type: 'straight'
    }
  }
};

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
  type: T;

  #id: string;
  #name: string;
  #props: P;

  constructor(type: T, snapshot: Omit<StylesheetSnapshot, '_snapshotType' | 'type'>) {
    this.type = type;

    //assert.true(type === snapshot.type);
    this.#id = snapshot.id;
    this.#name = snapshot.name;
    this.#props = snapshot.props as P;
  }

  get id(): string {
    return this.#id;
  }

  get props(): Partial<P> {
    return this.#props;
  }

  // TODO: Should we call invalidate and then modifyStylesheet
  setProps(props: Partial<P>, uow: UnitOfWork): void {
    uow.snapshot(this);
    this.#props = this.cleanProps(props) as P;
    uow.updateElement(this);
  }

  get name() {
    return this.#name;
  }

  // TODO: Should we call invalidate and then modifyStylesheet
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
    this.#props = snapshot.props as P;
    uow.updateElement(this);
  }

  snapshot(): StylesheetSnapshot {
    return {
      _snapshotType: 'stylesheet',
      id: this.id,
      name: this.name,
      props: deepClone(this.#props) as NodeProps | EdgeProps,
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

export const getCommonProps = <T extends Record<string, unknown>>(arr: Array<T>): Partial<T> => {
  if (arr.length === 0) return {};
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

        // Also an object with all defaults is not dirty
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (defaults.isSameAsDefaults(props, [...path, key].join('.') as any)) continue;

        // TODO: It's unclear if this should be here or not
        // A missing object is considered non-dirty
        //if (isObj(props[key])) continue;
        //
        //console.log('missing key', key, props[key]);
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
  #textStyles: CRDTMap<StylesheetSnapshot>;
  #nodeStyles: CRDTMap<StylesheetSnapshot>;
  #edgeStyles: CRDTMap<StylesheetSnapshot>;

  #activeNodeStylesheet = DefaultStyles.node.default;
  #activeEdgeStylesheet = DefaultStyles.edge.default;
  #activeTextStylesheet = DefaultStyles.text.default;

  constructor(
    private readonly root: CRDTRoot,
    private readonly document: DiagramDocument,
    addDefaultStyles: boolean
  ) {
    this.#textStyles = root.getMap('styles.text');
    this.#nodeStyles = root.getMap('styles.node');
    this.#edgeStyles = root.getMap('styles.edge');

    const hasNoTextStyles = this.#textStyles.size === 0;
    const hasNoNodeStyles = this.#nodeStyles.size === 0;
    const hasNoEdgeStyles = this.#edgeStyles.size === 0;

    if (addDefaultStyles && (hasNoTextStyles || hasNoNodeStyles || hasNoEdgeStyles)) {
      root.transact(() => {
        if (hasNoTextStyles) {
          Object.entries(DEFAULT_TEXT_STYLES).forEach(([id, s]) => {
            this.#textStyles.set(id, { id, _snapshotType: 'stylesheet', ...s });
          });
        }
        if (hasNoNodeStyles) {
          Object.entries(DEFAULT_NODE_STYLES).forEach(([id, s]) => {
            this.#nodeStyles.set(id, { id, _snapshotType: 'stylesheet', ...s });
          });
        }
        if (hasNoEdgeStyles) {
          Object.entries(DEFAULT_EDGE_STYLES).forEach(([id, s]) => {
            this.#edgeStyles.set(id, { id, _snapshotType: 'stylesheet', ...s });
          });
        }
      });
    }
  }

  get nodeStyles(): Stylesheet<'node'>[] {
    return Array.from(this.#nodeStyles.values()).map(s => new Stylesheet<'node'>('node', s));
  }

  get edgeStyles(): Stylesheet<'edge'>[] {
    return Array.from(this.#edgeStyles.values()).map(s => new Stylesheet<'edge'>('edge', s));
  }

  get textStyles(): Stylesheet<'text'>[] {
    return Array.from(this.#textStyles.values()).map(s => new Stylesheet<'text'>('text', s));
  }

  get activeNodeStylesheet() {
    return new Stylesheet<'node'>(
      'node',
      this.#nodeStyles.get(this.#activeNodeStylesheet)!
    ) as Stylesheet<'node'>;
  }

  set activeNodeStylesheet(style: Stylesheet<'node'>) {
    if (style.id === DefaultStyles.node.text) return;
    this.#activeNodeStylesheet = style.id;
  }

  get activeEdgeStylesheet() {
    return new Stylesheet('edge', this.#edgeStyles.get(this.#activeEdgeStylesheet)!);
  }

  set activeEdgeStylesheet(style: Stylesheet<'edge'>) {
    this.#activeEdgeStylesheet = style.id;
  }

  get activeTextStylesheet() {
    return new Stylesheet('text', this.#textStyles.get(this.#activeTextStylesheet)!);
  }

  set activeTextStylesheet(style: Stylesheet<'text'>) {
    this.#activeTextStylesheet = style.id;
  }

  get(id: string): Stylesheet<'edge'> | Stylesheet<'node'> | Stylesheet<'text'> | undefined {
    return this.getEdgeStyle(id) ?? this.getNodeStyle(id) ?? this.getTextStyle(id);
  }

  getEdgeStyle(id: string | undefined): Stylesheet<'edge'> | undefined {
    if (id === undefined) return undefined;
    const crdt = this.#edgeStyles.get(id);
    if (!crdt) return undefined;
    return new Stylesheet<'edge'>('edge', crdt);
  }

  getNodeStyle(id: string | undefined): Stylesheet<'node'> | undefined {
    if (id === undefined) return undefined;
    const crdt = this.#nodeStyles.get(id);
    if (!crdt) return undefined;
    return new Stylesheet<'node'>('node', crdt);
  }

  getTextStyle(id: string | undefined): Stylesheet<'text'> | undefined {
    if (id === undefined) return undefined;
    const crdt = this.#textStyles.get(id);
    if (!crdt) return undefined;
    return new Stylesheet<'text'>('text', crdt);
  }

  setStylesheet(el: DiagramElement, style: string, uow: UnitOfWork, resetLocalProps: boolean) {
    const stylesheet = this.get(style);
    if (!stylesheet) {
      return;
    }

    this.root.transact(() => {
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
    });
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

    this.root.transact(() => {
      this.clearStylesheet(id, uow);

      if (stylesheet.type === 'node') {
        this.#nodeStyles.delete(id);
      } else if (stylesheet.type === 'text') {
        this.#textStyles.delete(id);
      } else {
        this.#edgeStyles.delete(id);
      }

      // TODO: This can fail in case we delete the last stylesheet
      if (stylesheet.type === 'node') {
        this.activeNodeStylesheet = this.getNodeStyle(Array.from(this.#nodeStyles.keys())[0])!;
      } else if (stylesheet.type === 'text') {
        this.activeTextStylesheet = this.getTextStyle(Array.from(this.#textStyles.keys())[0])!;
      } else {
        this.activeEdgeStylesheet = this.getEdgeStyle(Array.from(this.#edgeStyles.keys())[0])!;
      }
    });
  }

  modifyStylesheet(stylesheet: Stylesheet<StylesheetType>, uow: UnitOfWork) {
    this.root.transact(() => {
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
    });
  }

  clearStylesheet(id: string, uow: UnitOfWork) {
    // Cannot delete the default stylesheet
    if (this.isDefaultStyle(id)) {
      return;
    }

    const stylesheet = this.get(id);
    if (!stylesheet) return;

    this.root.transact(() => {
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
    });
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
  addStylesheet(id: string, stylesheet: Stylesheet<any>, _uow?: UnitOfWork) {
    this.root.transact(() => {
      if (stylesheet.type === 'node') {
        this.#nodeStyles.set(id, stylesheet.snapshot());
        this.activeNodeStylesheet = stylesheet;
      } else if (stylesheet.type === 'text') {
        this.#textStyles.set(id, stylesheet.snapshot());
        this.activeTextStylesheet = stylesheet;
      } else {
        this.#edgeStyles.set(id, stylesheet.snapshot());
        this.activeEdgeStylesheet = stylesheet;
      }
    });
  }
}

export class DeleteStylesheetUndoableAction implements UndoableAction {
  description = 'Delete stylesheet';

  constructor(
    private readonly diagram: Diagram,
    private readonly stylesheet: Stylesheet<StylesheetType>
  ) {}

  undo(uow: UnitOfWork) {
    this.diagram.document.styles.addStylesheet(this.stylesheet.id, this.stylesheet, uow);
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
    this.diagram.document.styles.addStylesheet(this.stylesheet.id, this.stylesheet, uow);
  }
}
