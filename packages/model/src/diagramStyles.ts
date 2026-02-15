import { DiagramElement, isEdge, isNode } from './diagramElement';
import { UnitOfWork, UOWTrackable } from './unitOfWork';
import type { DiagramDocument } from './diagramDocument';
import type { Diagram } from './diagram';
import { common, deepClear, deepClone, deepMerge, isObj } from '@diagram-craft/utils/object';
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
import type { EdgeProps, NodeProps } from './diagramProps';
import type { Releasable } from '@diagram-craft/utils/releasable';
import { UOWRegistry } from '@diagram-craft/model/unitOfWork';
import {
  DiagramStylesChildUOWAdapter,
  DiagramStylesUOWAdapter,
  StylesheetSnapshot,
  StylesheetUOWAdapter
} from '@diagram-craft/model/diagramStyles.uow';
import { assert, mustExist, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';

export type StylesheetType = 'node' | 'edge' | 'text';

type StylesheetTypeImplementations = {
  text: TextStylesheet;
  node: NodeStylesheet;
  edge: EdgeStylesheet;
};

type TextStyleProps = { text: Omit<NodeProps['text'], 'text' | 'style'> };
type NodeStyleProps = Omit<NodeProps, 'name' | 'text' | 'data' | 'style'>;
type EdgeStyleProps = Omit<EdgeProps, 'name' | 'text' | 'data' | 'style'>;

export abstract class Stylesheet<P = Partial<NodeProps | EdgeProps>> implements UOWTrackable {
  abstract type: StylesheetType;

  readonly _trackableType = 'stylesheet';
  private readonly _styles: DiagramStyles;

  protected constructor(
    readonly crdt: CRDTMap<StylesheetSnapshot>,
    styles: DiagramStyles,
    type: StylesheetType
  ) {
    this._styles = styles;
    if (this.crdt.get('type') !== type) {
      this.crdt.set('type', type);
    }
  }

  static fromSnapshot<T extends StylesheetType>(
    type: T,
    snapshot: Omit<StylesheetSnapshot, '_snapshotType' | 'type'>,
    factory: CRDTFactory,
    styles: DiagramStyles
  ) {
    const m = factory.makeMap<StylesheetSnapshot>();
    m.set('_snapshotType', 'stylesheet');
    m.set('id', snapshot.id);
    m.set('name', snapshot.name);
    m.set('props', snapshot.props);
    m.set('type', type);
    if (snapshot.parentId) {
      m.set('parentId', snapshot.parentId);
    }

    return makeStylesheet<T>(type, m, styles);
  }

  get id(): string {
    return this.crdt.get('id')!;
  }

  get props(): Partial<P> {
    const parent = this.parent;

    let parentProps: Partial<P> = {};
    if (parent) {
      parentProps = parent.props as Partial<P>;
    }

    return deepMerge({}, this.crdt.get('props') as Partial<P>, parentProps) as Partial<P>;
  }

  set parent(parent: Stylesheet | undefined) {
    assert.false(parent && this.ancestors.includes(parent));
    assert.false(parent?.ancestors.includes(this));

    this.crdt.set('parentId', parent?.id ?? '');
  }

  get parent(): Stylesheet | undefined {
    const parentId = this.crdt.get('parentId') as string;
    if (parentId) {
      const parent = this._styles.getStyle(parentId);
      assert.true(parent.type === this.type);
      return parent;
    }
    return undefined;
  }

  get ancestors(): Array<Stylesheet> {
    const dest: Array<Stylesheet> = [];

    let el = this.parent;
    while (el !== undefined) {
      dest.push(el);
      el = el.parent;
    }

    return dest;
  }

  get children() {
    return mustExist(this._styles).styles.filter(s => s.parent === this);
  }

  setProps(props: Partial<P>, uow: UnitOfWork): void {
    uow.executeUpdate(this, () => {
      this.crdt.set('props', this.cleanProps(props) as NodeProps | EdgeProps);
    });
  }

  get name() {
    return this.crdt.get('name')!;
  }

  setName(name: string, uow: UnitOfWork) {
    uow.executeUpdate(this, () => {
      this.crdt.set('name', name);
    });
  }

  restore(snapshot: StylesheetSnapshot, uow: UnitOfWork): void {
    this.crdt.set('name', snapshot.name);
    this.crdt.set('props', snapshot.props);
    this.crdt.set('parentId', snapshot.parentId);
    uow.updateElement(this);
  }

  snapshot(): StylesheetSnapshot {
    return {
      _snapshotType: 'stylesheet',
      id: this.id,
      name: this.name,
      props: deepClone(this.props) as NodeProps | EdgeProps,
      parentId: this.parent?.id ?? undefined,
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

  if (!stylesheet) {
    return false;
  }

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

export class TextStylesheet extends Stylesheet<TextStyleProps> {
  type: 'text' = 'text';
  constructor(crdt: CRDTMap<StylesheetSnapshot>, styles: DiagramStyles) {
    super(crdt, styles, 'text');
  }
}

export class NodeStylesheet extends Stylesheet<NodeStyleProps> {
  type: 'node' = 'node';
  constructor(crdt: CRDTMap<StylesheetSnapshot>, styles: DiagramStyles) {
    super(crdt, styles, 'node');
  }
}

export class EdgeStylesheet extends Stylesheet<EdgeStyleProps> {
  type: 'edge' = 'edge';
  constructor(crdt: CRDTMap<StylesheetSnapshot>, styles: DiagramStyles) {
    super(crdt, styles, 'edge');
  }
}

export function isTextStylesheet(s: Stylesheet): s is TextStylesheet {
  return s.type === 'text';
}

export function isNodeStylesheet(s: Stylesheet): s is NodeStylesheet {
  return s.type === 'node';
}

export function isEdgeStylesheet(s: Stylesheet): s is EdgeStylesheet {
  return s.type === 'edge';
}

export const makeStylesheet = <T extends StylesheetType>(
  type: T,
  m: CRDTMap<StylesheetSnapshot>,
  styles: DiagramStyles
): StylesheetTypeImplementations[T] => {
  if (type === 'text') return new TextStylesheet(m, styles) as StylesheetTypeImplementations[T];
  else if (type === 'node')
    return new NodeStylesheet(m, styles) as StylesheetTypeImplementations[T];
  else return new EdgeStylesheet(m, styles) as StylesheetTypeImplementations[T];
};

declare global {
  namespace DiagramCraft {
    interface AdditionalCRDTCompatibleInnerObjects {
      nodeProps: NodeProps;
      edgeProps: EdgeProps;
    }
  }
}

const mapper = <S extends Stylesheet>(
  d: DiagramStyles
): CRDTMapper<S, CRDTMap<StylesheetSnapshot>> => ({
  fromCRDT(e: CRDTMap<StylesheetSnapshot>): S {
    console.log([...e.values()]);

    const s = makeStylesheet(e.get('type')!, e, d) as S;
    s.crdt.on('remoteUpdate', _e => {
      d.emit('stylesheetUpdated', { stylesheet: s });
    });
    return s;
  },

  toCRDT(e: S): CRDTMap<StylesheetSnapshot> {
    return e.crdt;
  }
});

export type DiagramStylesEvents = {
  stylesheetAdded: { stylesheet: Stylesheet };
  stylesheetUpdated: { stylesheet: Stylesheet };
  stylesheetRemoved: { stylesheet: string };
};

export class DiagramStyles
  extends EventEmitter<DiagramStylesEvents>
  implements Releasable, UOWTrackable
{
  #textStyles: MappedCRDTMap<TextStylesheet, StylesheetSnapshot>;
  #nodeStyles: MappedCRDTMap<NodeStylesheet, StylesheetSnapshot>;
  #edgeStyles: MappedCRDTMap<EdgeStylesheet, StylesheetSnapshot>;

  #activeNodeStylesheet = DefaultStyles.node.default;
  #activeEdgeStylesheet = DefaultStyles.edge.default;
  #activeTextStylesheet = DefaultStyles.text.default;

  readonly id = 'diagramStyles';
  readonly _trackableType = 'diagramStyles';

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
            const stylesheet = Stylesheet.fromSnapshot('text', { id, ...s }, crdt.factory, this);
            this.#textStyles.set(id, stylesheet);
          });
        }
        if (hasNoNodeStyles) {
          Object.entries(DEFAULT_NODE_STYLES).forEach(([id, s]) => {
            const stylesheet = Stylesheet.fromSnapshot('node', { id, ...s }, crdt.factory, this);
            this.#nodeStyles.set(id, stylesheet);
          });
        }
        if (hasNoEdgeStyles) {
          Object.entries(DEFAULT_EDGE_STYLES).forEach(([id, s]) => {
            const stylesheet = Stylesheet.fromSnapshot('edge', { id, ...s }, crdt.factory, this);
            this.#edgeStyles.set(id, stylesheet);
          });
        }
      });
    }
  }

  invalidate(_uow: UnitOfWork) {}

  release() {}

  get nodeStyles(): NodeStylesheet[] {
    return Array.from(this.#nodeStyles.values);
  }

  get edgeStyles(): EdgeStylesheet[] {
    return Array.from(this.#edgeStyles.values);
  }

  get textStyles(): TextStylesheet[] {
    return Array.from(this.#textStyles.values);
  }

  get styles(): Stylesheet[] {
    return [...this.nodeStyles, ...this.edgeStyles, ...this.textStyles];
  }

  get activeNodeStylesheet() {
    return this.#nodeStyles.get(this.#activeNodeStylesheet)!;
  }

  set activeNodeStylesheet(style: NodeStylesheet) {
    if (style.id === DefaultStyles.node.text) return;
    this.#activeNodeStylesheet = style.id;
  }

  get activeEdgeStylesheet() {
    return this.#edgeStyles.get(this.#activeEdgeStylesheet)!;
  }

  set activeEdgeStylesheet(style: EdgeStylesheet) {
    this.#activeEdgeStylesheet = style.id;
  }

  get activeTextStylesheet() {
    return this.#textStyles.get(this.#activeTextStylesheet)!;
  }

  set activeTextStylesheet(style: TextStylesheet) {
    this.#activeTextStylesheet = style.id;
  }

  get(id: string): Stylesheet | undefined {
    return this.getEdgeStyle(id) ?? this.getNodeStyle(id) ?? this.getTextStyle(id);
  }

  getEdgeStyle(id: string | undefined): EdgeStylesheet | undefined {
    if (id === undefined) return undefined;
    return this.#edgeStyles.get(id);
  }

  getNodeStyle(id: string | undefined): NodeStylesheet | undefined {
    if (id === undefined) return undefined;
    return this.#nodeStyles.get(id);
  }

  getStyle(id: string | undefined): Stylesheet {
    return this.getEdgeStyle(id) ?? this.getNodeStyle(id) ?? this.getTextStyle(id)!;
  }

  getTextStyle(id: string | undefined): TextStylesheet | undefined {
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
        this.activeNodeStylesheet = stylesheet as NodeStylesheet;
      } else if (stylesheet.type === 'text') {
        this.activeTextStylesheet = stylesheet as TextStylesheet;
      } else {
        this.activeEdgeStylesheet = stylesheet as EdgeStylesheet;
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

      uow.executeRemove(stylesheet, this, 0, () => {
        if (stylesheet.type === 'node') {
          this.#nodeStyles.remove(id);
        } else if (stylesheet.type === 'text') {
          this.#textStyles.remove(id);
        } else {
          this.#edgeStyles.remove(id);
        }
      });

      //this.emit('stylesheetRemoved', { stylesheet: stylesheet.id });

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
  reapplyStylesheet(stylesheet: Stylesheet, uow: UnitOfWork) {
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

  private clearStylesheetFromElement(el: DiagramElement, stylesheet: Stylesheet, uow: UnitOfWork) {
    el.updateProps((props: NodeProps & EdgeProps) => {
      Object.keys(stylesheet.props).forEach(key => {
        const validKey = key as keyof (NodeProps | EdgeStyleProps);
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

  addStylesheet(id: string, stylesheet: Stylesheet, uow: UnitOfWork) {
    this.crdt.transact(() => {
      uow.executeAdd(stylesheet, this, 0, () => {
        if (isNodeStylesheet(stylesheet)) {
          this.#nodeStyles.set(id, stylesheet);
          this.activeNodeStylesheet = stylesheet;
        } else if (isTextStylesheet(stylesheet)) {
          this.#textStyles.set(id, stylesheet);
          this.activeTextStylesheet = stylesheet;
        } else if (isEdgeStylesheet(stylesheet)) {
          this.#edgeStyles.set(id, stylesheet);
          this.activeEdgeStylesheet = stylesheet;
        } else {
          VERIFY_NOT_REACHED();
        }
      });
    });
  }
}

UOWRegistry.adapters['stylesheet'] = new StylesheetUOWAdapter();
UOWRegistry.adapters['diagramStyles'] = new DiagramStylesUOWAdapter();
UOWRegistry.childAdapters['diagramStyles-stylesheet'] = new DiagramStylesChildUOWAdapter();
