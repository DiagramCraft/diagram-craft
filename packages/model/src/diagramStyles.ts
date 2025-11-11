import { DiagramElement, isEdge, isNode } from './diagramElement';
import type { UndoableAction } from './undoManager';
import { StylesheetSnapshot, UnitOfWork, UOWTrackable } from './unitOfWork';
import type { DiagramDocument } from './diagramDocument';
import type { Diagram } from './diagram';
import { common, deepClear, deepClone, deepMerge, isObj } from '@diagram-craft/utils/object';
import { assert } from '@diagram-craft/utils/assert';
import { Defaults, DefaultStyles, edgeDefaults, nodeDefaults } from './diagramDefaults';
import {
  DEFAULT_EDGE_STYLES,
  DEFAULT_NODE_STYLES,
  DEFAULT_TEXT_STYLES
} from './diagramStylesDefaults';
import { watch } from '@diagram-craft/utils/watchableValue';
import { EventEmitter } from '@diagram-craft/utils/event';
import type { CRDTFactory, CRDTMap, CRDTRoot } from '@diagram-craft/collaboration/crdt';
import type { CRDTMapper } from '@diagram-craft/collaboration/datatypes/mapped/types';
import { MappedCRDTMap } from '@diagram-craft/collaboration/datatypes/mapped/mappedCrdtMap';

export type StylesheetType = 'node' | 'edge' | 'text';

type TextStyleProps = { text: Omit<DiagramCraft.NodeProps['text'], 'text' | 'style'> };
type NodeStyleProps = Omit<DiagramCraft.NodeProps, 'name' | 'text' | 'data' | 'style'>;
type EdgeStyleProps = Omit<DiagramCraft.EdgeProps, 'name' | 'text' | 'data' | 'style'>;

type TypeMap = {
  node: NodeStyleProps;
  edge: EdgeStyleProps;
  text: TextStyleProps;
};

export class Stylesheet<T extends StylesheetType, P = TypeMap[T]>
  implements UOWTrackable<StylesheetSnapshot>
{
  type: T;

  readonly trackableType = 'stylesheet';

  constructor(readonly crdt: CRDTMap<StylesheetSnapshot>) {
    this.type = crdt.get('type') as T;
  }

  static fromSnapshot<T extends StylesheetType>(
    type: T,
    snapshot: Omit<StylesheetSnapshot, '_snapshotType' | 'type'>,
    factory: CRDTFactory
  ) {
    const m = factory.makeMap<StylesheetSnapshot>();
    m.set('_snapshotType', 'stylesheet');
    m.set('id', snapshot.id);
    m.set('name', snapshot.name);
    m.set('props', snapshot.props);
    m.set('type', type);
    return new Stylesheet<T>(m);
  }

  get id(): string {
    return this.crdt.get('id')!;
  }

  get props(): Partial<P> {
    return this.crdt.get('props') as P;
  }

  setProps(props: Partial<P>, manager: DiagramStyles, uow: UnitOfWork): void {
    uow.snapshot(this);
    this.crdt.set(
      'props',
      this.cleanProps(props) as DiagramCraft.NodeProps | DiagramCraft.EdgeProps
    );
    uow.updateElement(this);
    manager.emit('stylesheetUpdated', { stylesheet: this });
  }

  get name() {
    return this.crdt.get('name')!;
  }

  setName(name: string, manager: DiagramStyles, uow: UnitOfWork) {
    uow.snapshot(this);
    this.crdt.set('name', name);
    uow.updateElement(this);
    manager.emit('stylesheetUpdated', { stylesheet: this });
  }

  invalidate(_uow: UnitOfWork): void {
    // Do nothing
  }

  restore(snapshot: StylesheetSnapshot, uow: UnitOfWork): void {
    this.crdt.set('name', snapshot.name);
    this.crdt.set('props', snapshot.props);
    uow.updateElement(this);
  }

  snapshot(): StylesheetSnapshot {
    return {
      _snapshotType: 'stylesheet',
      id: this.id,
      name: this.name,
      props: deepClone(this.props) as DiagramCraft.NodeProps | DiagramCraft.EdgeProps,
      type: this.type
    };
  }

  getPropsFromElement(el: DiagramElement): Partial<P> {
    const p = deepClone(el.editProps);
    return this.cleanProps(p as unknown as Partial<P>);
  }

  private cleanProps(props: Partial<P>): Partial<P> {
    if (this.type === 'edge') {
      const p = deepClone(props) as DiagramCraft.NodeProps;
      delete p.text;
      return p as P;
    } else if (this.type === 'text') {
      const p = deepClone(props) as DiagramCraft.NodeProps;
      // TODO: Not sure why this is needed?
      /*if (p.text && Object.keys(p.text).length === 0) {
        delete p.text;
      }*/
      return { text: p.text } as P;
    } else {
      const p = deepClone(props) as DiagramCraft.NodeProps;
      delete p.text;
      return p as P;
    }
  }
}

export const getCommonProps = <T extends Record<string, unknown>>(arr: Array<T>): Partial<T> => {
  if (arr.length === 0) return {};
  let e: T = arr[0]!;
  for (let i = 1; i < arr.length; i++) {
    e = common(e, arr[i]!) as T;
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
        // biome-ignore lint/suspicious/noExplicitAny: false positive
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
  if ($d.selection.elements.length === 0) {
    return false;
  }

  const metadata = $d.selection.elements[0]!.metadata;

  const stylesheet = isText
    ? styles.get(metadata.textStyle ?? DefaultStyles.text.default)
    : styles.get(metadata.style ?? DefaultStyles.node.default);
  assert.present(stylesheet);

  return $d.selection.elements.some(e => {
    const propsFromElement = stylesheet.getPropsFromElement(e);
    return isPropsDirty(
      propsFromElement,
      stylesheet.props,
      // @ts-expect-error
      isNode(e) ? nodeDefaults : edgeDefaults,
      []
    );
  });
};

declare global {
  namespace DiagramCraft {
    interface AdditionalCRDTCompatibleInnerObjects {
      nodeProps: NodeProps;
      edgeProps: EdgeProps;
    }
  }
}

const mapper: (
  d: DiagramStyles
  // biome-ignore lint/suspicious/noExplicitAny: false positive
) => CRDTMapper<Stylesheet<any>, CRDTMap<StylesheetSnapshot>> = d => ({
  fromCRDT<T extends StylesheetType>(e: CRDTMap<StylesheetSnapshot>): Stylesheet<T> {
    const s = new Stylesheet<T>(e);
    s.crdt.on('remoteUpdate', _e => {
      d.emit('stylesheetUpdated', { stylesheet: s });
    });
    return s;
  },

  toCRDT<T extends StylesheetType>(e: Stylesheet<T>): CRDTMap<StylesheetSnapshot> {
    return e.crdt;
  }
});

export type DiagramStylesEvents = {
  stylesheetAdded: { stylesheet: Stylesheet<StylesheetType> };
  stylesheetUpdated: { stylesheet: Stylesheet<StylesheetType> };
  stylesheetRemoved: { stylesheet: string };
};

export class DiagramStyles extends EventEmitter<DiagramStylesEvents> {
  #textStyles: MappedCRDTMap<Stylesheet<'text'>, StylesheetSnapshot>;
  #nodeStyles: MappedCRDTMap<Stylesheet<'node'>, StylesheetSnapshot>;
  #edgeStyles: MappedCRDTMap<Stylesheet<'edge'>, StylesheetSnapshot>;

  #activeNodeStylesheet = DefaultStyles.node.default;
  #activeEdgeStylesheet = DefaultStyles.edge.default;
  #activeTextStylesheet = DefaultStyles.text.default;

  constructor(
    readonly crdt: CRDTRoot,
    private readonly document: DiagramDocument,
    addDefaultStyles: boolean
  ) {
    super();

    this.#textStyles = new MappedCRDTMap(watch(crdt.getMap('styles.text')), mapper(this), {
      onRemoteChange: e => this.emit('stylesheetUpdated', { stylesheet: e }),
      onRemoteAdd: e => this.emit('stylesheetAdded', { stylesheet: e }),
      onRemoteRemove: e => this.emit('stylesheetRemoved', { stylesheet: e })
    });
    this.#nodeStyles = new MappedCRDTMap(watch(crdt.getMap('styles.node')), mapper(this), {
      onRemoteChange: e => this.emit('stylesheetUpdated', { stylesheet: e }),
      onRemoteAdd: e => this.emit('stylesheetAdded', { stylesheet: e }),
      onRemoteRemove: e => this.emit('stylesheetRemoved', { stylesheet: e })
    });
    this.#edgeStyles = new MappedCRDTMap(watch(crdt.getMap('styles.edge')), mapper(this), {
      onRemoteChange: e => this.emit('stylesheetUpdated', { stylesheet: e }),
      onRemoteAdd: e => this.emit('stylesheetAdded', { stylesheet: e }),
      onRemoteRemove: e => this.emit('stylesheetRemoved', { stylesheet: e })
    });

    const hasNoTextStyles = this.#textStyles.size === 0;
    const hasNoNodeStyles = this.#nodeStyles.size === 0;
    const hasNoEdgeStyles = this.#edgeStyles.size === 0;

    if (addDefaultStyles && (hasNoTextStyles || hasNoNodeStyles || hasNoEdgeStyles)) {
      crdt.transact(() => {
        if (hasNoTextStyles) {
          Object.entries(DEFAULT_TEXT_STYLES).forEach(([id, s]) => {
            this.#textStyles.set(id, Stylesheet.fromSnapshot('text', { id, ...s }, crdt.factory));
          });
        }
        if (hasNoNodeStyles) {
          Object.entries(DEFAULT_NODE_STYLES).forEach(([id, s]) => {
            this.#nodeStyles.set(id, Stylesheet.fromSnapshot('node', { id, ...s }, crdt.factory));
          });
        }
        if (hasNoEdgeStyles) {
          Object.entries(DEFAULT_EDGE_STYLES).forEach(([id, s]) => {
            this.#edgeStyles.set(id, Stylesheet.fromSnapshot('edge', { id, ...s }, crdt.factory));
          });
        }
      });
    }
  }

  get nodeStyles(): Stylesheet<'node'>[] {
    return Array.from(this.#nodeStyles.values);
  }

  get edgeStyles(): Stylesheet<'edge'>[] {
    return Array.from(this.#edgeStyles.values);
  }

  get textStyles(): Stylesheet<'text'>[] {
    return Array.from(this.#textStyles.values);
  }

  get activeNodeStylesheet() {
    return this.#nodeStyles.get(this.#activeNodeStylesheet)!;
  }

  set activeNodeStylesheet(style: Stylesheet<'node'>) {
    if (style.id === DefaultStyles.node.text) return;
    this.#activeNodeStylesheet = style.id;
  }

  get activeEdgeStylesheet() {
    return this.#edgeStyles.get(this.#activeEdgeStylesheet)!;
  }

  set activeEdgeStylesheet(style: Stylesheet<'edge'>) {
    this.#activeEdgeStylesheet = style.id;
  }

  get activeTextStylesheet() {
    return this.#textStyles.get(this.#activeTextStylesheet)!;
  }

  set activeTextStylesheet(style: Stylesheet<'text'>) {
    this.#activeTextStylesheet = style.id;
  }

  get(id: string): Stylesheet<'edge'> | Stylesheet<'node'> | Stylesheet<'text'> | undefined {
    return this.getEdgeStyle(id) ?? this.getNodeStyle(id) ?? this.getTextStyle(id);
  }

  getEdgeStyle(id: string | undefined): Stylesheet<'edge'> | undefined {
    if (id === undefined) return undefined;
    return this.#edgeStyles.get(id);
  }

  getNodeStyle(id: string | undefined): Stylesheet<'node'> | undefined {
    if (id === undefined) return undefined;
    return this.#nodeStyles.get(id);
  }

  getTextStyle(id: string | undefined): Stylesheet<'text'> | undefined {
    if (id === undefined) return undefined;
    return this.#textStyles.get(id);
  }

  setStylesheet(el: DiagramElement, style: string, uow: UnitOfWork, resetLocalProps: boolean) {
    const stylesheet = this.get(style);
    if (!stylesheet) {
      return;
    }

    this.crdt.transact(() => {
      if (stylesheet.type === 'node') {
        this.activeNodeStylesheet = stylesheet;
      } else if (stylesheet.type === 'text') {
        this.activeTextStylesheet = stylesheet;
      } else {
        this.activeEdgeStylesheet = stylesheet;
      }

      if (resetLocalProps) {
        el.updateProps((props: DiagramCraft.NodeProps & DiagramCraft.EdgeProps) => {
          const shapeToClear = stylesheet.getPropsFromElement(el);

          // For custom properties, we keep all custom properties that are
          // not part of the stylesheet
          if ('custom' in shapeToClear) {
            delete shapeToClear.custom;

            if ('custom' in stylesheet.props) {
              for (const key of Object.keys(stylesheet.props.custom!)) {
                if (key in (shapeToClear.custom ?? {})) {
                  // biome-ignore lint/suspicious/noExplicitAny: false positive
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

    this.crdt.transact(() => {
      this.clearStylesheet(id, uow);

      if (stylesheet.type === 'node') {
        this.#nodeStyles.remove(id);
      } else if (stylesheet.type === 'text') {
        this.#textStyles.remove(id);
      } else {
        this.#edgeStyles.remove(id);
      }

      this.emit('stylesheetRemoved', { stylesheet: stylesheet.id });

      // TODO: This can fail in case we delete the last stylesheet
      if (stylesheet.type === 'node') {
        this.activeNodeStylesheet = this.getNodeStyle(Array.from(this.#nodeStyles.keys)[0])!;
      } else if (stylesheet.type === 'text') {
        this.activeTextStylesheet = this.getTextStyle(Array.from(this.#textStyles.keys)[0])!;
      } else {
        this.activeEdgeStylesheet = this.getEdgeStyle(Array.from(this.#edgeStyles.keys)[0])!;
      }
    });
  }

  // TODO: Is this really needed? It seems it will have no additional effect
  reapplyStylesheet(stylesheet: Stylesheet<StylesheetType>, uow: UnitOfWork) {
    this.crdt.transact(() => {
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

    this.crdt.transact(() => {
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
    el.updateProps((props: DiagramCraft.NodeProps & DiagramCraft.EdgeProps) => {
      Object.keys(stylesheet.props).forEach(key => {
        const validKey = key as keyof (DiagramCraft.NodeProps | EdgeStyleProps);
        // @ts-expect-error
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

  // biome-ignore lint/suspicious/noExplicitAny: false positive
  addStylesheet(id: string, stylesheet: Stylesheet<any>, _uow?: UnitOfWork) {
    this.crdt.transact(() => {
      if (stylesheet.type === 'node') {
        this.#nodeStyles.set(id, stylesheet);
        this.activeNodeStylesheet = stylesheet;
      } else if (stylesheet.type === 'text') {
        this.#textStyles.set(id, stylesheet);
        this.activeTextStylesheet = stylesheet;
      } else {
        this.#edgeStyles.set(id, stylesheet);
        this.activeEdgeStylesheet = stylesheet;
      }
      this.emit('stylesheetAdded', { stylesheet });
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
