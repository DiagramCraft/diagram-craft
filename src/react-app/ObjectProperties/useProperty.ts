import { EditableDiagram, SnapManagerConfigProps } from '../../model-editor/editable-diagram.ts';
import { useEffect, useState } from 'react';
import { useEventListener } from '../hooks/useEventListener.ts';
import { unique } from '../../utils/array.ts';
import { DiagramEdge } from '../../model-viewer/diagramEdge.ts';
import { DiagramNode } from '../../model-viewer/diagramNode.ts';
import { UndoableAction } from '../../model-editor/undoManager.ts';

/* eslint-disable @typescript-eslint/no-explicit-any */

type IsAny<T> = unknown extends T ? ([keyof T] extends [never] ? false : true) : false;

type PropPathImpl<T, Key extends keyof T> = Key extends string
  ? IsAny<T[Key]> extends true
    ? never
    : NonNullable<T[Key]> extends Record<string, any>
    ?
        | `${Key}.${PropPathImpl<
            NonNullable<T[Key]>,
            Exclude<keyof NonNullable<T[Key]>, keyof any[]>
          > &
            string}`
        | `${Key}.${Exclude<keyof NonNullable<T[Key]>, keyof any[]> & string}`
    : never
  : never;

type PropPathImpl2<T> = PropPathImpl<T, keyof T> | keyof T;

export type PropPath<T> = keyof T extends string
  ? PropPathImpl2<T> extends infer P
    ? P extends string | keyof T
      ? P
      : keyof T
    : keyof T
  : never;

export type PropPathValue<T, P extends PropPath<T>> = P extends `${infer Key}.${infer Rest}`
  ? Key extends keyof T
    ? Rest extends PropPath<NonNullable<T[Key]>>
      ? PropPathValue<NonNullable<T[Key]>, Rest>
      : never
    : never
  : P extends keyof T
  ? T[P]
  : never;

export class DynamicAccessor<T> {
  constructor() {}

  get<K extends PropPath<T> = PropPath<T>>(obj: T, key: K): PropPathValue<T, K> {
    const parts = (key as string).split('.');
    let current: any = obj;
    for (const part of parts) {
      if (current === undefined) return undefined as PropPathValue<T, K>;
      current = current[part] as PropPathValue<T, K>;
    }
    return current;
  }

  set<K extends PropPath<T> = PropPath<T>>(obj: T, key: K, value: PropPathValue<T, K>): void {
    const parts = (key as string).split('.');
    let current: any = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      current[parts[i]] ??= {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
  }
}

type PropertyHook<TBase, TObj> = <
  K extends PropPath<TObj>,
  V extends PropPathValue<TObj, K>,
  DV extends V
>(
  obj: TBase,
  propertyPath: K,
  defaultValue: DV
) => {
  val: V;
  set: (value: V) => void;
};

type PropertyArrayHook<TBase, TObj> = <
  K extends PropPath<TObj>,
  V extends PropPathValue<TObj, K>,
  DV extends V
>(
  obj: TBase,
  propertyPath: K,
  defaultValue: DV
) => {
  val: V;
  set: (value: V) => void;
  hasMultipleValues: boolean;
};

const makePropertyHook = <
  TBase,
  TObj,
  TPath extends PropPath<TObj> = PropPath<TObj>,
  TValue extends PropPathValue<TObj, TPath> = PropPathValue<TObj, TPath>
>(
  getObj: (obj: TBase) => TObj,
  subscribe: (obj: TBase, handler: () => void) => void,
  commit: (obj: TBase) => void = () => {},
  callbacks?: {
    onAfterSet?: (obj: TBase, path: TPath, oldValue: TValue, newValue: TValue) => void;
  }
): PropertyHook<TBase, TObj> => {
  return ((obj: TBase, path: TPath, defaultValue: TValue) => {
    const accessor = new DynamicAccessor<TObj>();
    const [value, setValue] = useState<TValue>(defaultValue);
    const handler = () => {
      const value = accessor.get(getObj(obj), path);

      if (value === undefined || value === null) return setValue(defaultValue);
      else return setValue(value as unknown as TValue);
    };
    subscribe(obj, handler);
    useEffect(handler, []);

    return {
      val: value,
      set: (v: TValue) => {
        accessor.set(getObj(obj), path, v);
        callbacks?.onAfterSet?.(obj, path, value, v);
        commit(obj);
        setValue(v);
      }
    };
  }) as PropertyHook<TBase, TObj>;
};

const makePropertyArrayHook = <
  TBase,
  TItem,
  TObj,
  TPath extends PropPath<TObj> = PropPath<TObj>,
  TValue extends PropPathValue<TObj, TPath> = PropPathValue<TObj, TPath>
>(
  getArr: (obj: TBase) => TItem[],
  getObj: (e: TItem) => TObj,
  subscribe: (obj: TBase, handler: () => void) => void,
  commit: (obj: TBase, item: TItem) => void,
  callbacks?: {
    onAfterSet?: (
      obj: TBase,
      items: TItem[],
      path: TPath,
      oldValues: TValue[],
      value: TValue
    ) => void;
  }
): PropertyArrayHook<TBase, TObj> => {
  return ((obj: TBase, path: TPath, defaultValue: TValue) => {
    const accessor = new DynamicAccessor<TObj>();
    const [value, setValue] = useState<TValue>(defaultValue);
    const [multiple, setMultiple] = useState(false);
    const handler = () => {
      const arr = unique(getArr(obj).map(obj => accessor.get(getObj(obj), path)));

      if (arr.length === 1) setValue((arr[0]! as TValue) ?? defaultValue);
      else setValue(defaultValue);

      setMultiple(arr.length > 1);
    };
    subscribe(obj, handler);
    useEffect(handler, []);

    return {
      val: value,
      set: (v: TValue) => {
        const oldValues = getArr(obj).map(obj => accessor.get(getObj(obj), path));
        getArr(obj).forEach(n => {
          accessor.set(getObj(n), path, v);
          commit(obj, n);
        });
        callbacks?.onAfterSet?.(obj, getArr(obj), path, oldValues as TValue[], v);
        setValue(v);
      },
      hasMultipleValues: multiple
    };
  }) as PropertyArrayHook<TBase, TObj>;
};

class PropertyArrayUndoableAction<T> implements UndoableAction {
  #accessor = new DynamicAccessor<T>();

  canUndo = true;
  canRedo = true;

  constructor(
    private readonly items: any[],
    private readonly path: any,
    private readonly before: any[],
    private readonly after: any,
    public readonly description: string,
    private readonly getObj: (item: T) => any,
    private readonly commit: (obj: T) => void
  ) {}

  undo(): void {
    this.items.forEach((e, idx) => {
      this.#accessor.set(this.getObj(e), this.path, this.before[idx]);
      this.commit(e);
    });
  }

  redo(): void {
    this.items.forEach(e => {
      this.#accessor.set(this.getObj(e), this.path, this.after);
      this.commit(e);
    });
  }
}

class PropertyUndoableAction<T> implements UndoableAction {
  #accessor = new DynamicAccessor<T>();

  canUndo = true;
  canRedo = true;

  constructor(
    private readonly obj: any,
    private readonly path: any,
    private readonly before: any,
    private readonly after: any,
    public readonly description: string,
    private readonly commit: (obj: T) => void
  ) {}

  undo(): void {
    this.#accessor.set(this.obj, this.path, this.before);
    this.commit(this.obj);
  }

  redo(): void {
    this.#accessor.set(this.obj, this.path, this.after);
    this.commit(this.obj);
  }
}

export const useDiagramProperty: PropertyHook<EditableDiagram, DiagramProps> = makePropertyHook<
  EditableDiagram,
  DiagramProps
>(
  diagram => diagram.props,
  (diagram, handler) => {
    useEventListener('canvaschanged', handler, diagram);
  },
  diagram => diagram.update(),
  {
    onAfterSet: (diagram, path, oldValue, newValue) => {
      diagram.undoManager.add(
        new PropertyUndoableAction<EditableDiagram>(
          diagram.props,
          path,
          oldValue,
          newValue,
          `Change diagram ${path}`,
          () => diagram.update()
        )
      );
    }
  }
);

export const useSnapManagerProperty: PropertyHook<EditableDiagram, SnapManagerConfigProps> =
  makePropertyHook<EditableDiagram, SnapManagerConfigProps>(
    diagram => diagram.snapManagerConfig,
    (diagram, handler) => {
      useEventListener('change', handler, diagram.snapManagerConfig);
    },
    diagram => diagram.snapManagerConfig.commit()
  );

export const useEdgeProperty: PropertyArrayHook<EditableDiagram, EdgeProps> = makePropertyArrayHook<
  EditableDiagram,
  DiagramEdge,
  EdgeProps
>(
  diagram => diagram.selectionState.edges,
  edge => edge.props,
  (diagram, handler) => {
    useEventListener('change', handler, diagram.selectionState);
  },
  (diagram, edge) => diagram.updateElement(edge),
  {
    onAfterSet: (diagram, edges, path, oldValue, newValue) => {
      diagram.undoManager.add(
        new PropertyArrayUndoableAction<DiagramEdge>(
          edges,
          path,
          oldValue,
          newValue,
          `Change edge ${path}`,
          edge => edge.props,
          edge => diagram.updateElement(edge)
        )
      );
    }
  }
);

export const useNodeProperty: PropertyArrayHook<EditableDiagram, NodeProps> = makePropertyArrayHook<
  EditableDiagram,
  DiagramNode,
  NodeProps
>(
  diagram => diagram.selectionState.nodes,
  node => node.props,
  (diagram, handler) => {
    useEventListener('change', handler, diagram.selectionState);
  },
  (diagram, node) => diagram.updateElement(node),
  {
    onAfterSet: (diagram, nodes, path, oldValue, newValue) => {
      diagram.undoManager.add(
        new PropertyArrayUndoableAction<DiagramNode>(
          nodes,
          path,
          oldValue,
          newValue,
          `Change node ${path}`,
          node => node.props,
          node => diagram.updateElement(node)
        )
      );
    }
  }
);

export const useElementProperty: PropertyArrayHook<EditableDiagram, ElementProps> =
  makePropertyArrayHook<EditableDiagram, DiagramEdge | DiagramNode, ElementProps>(
    diagram => diagram.selectionState.elements,
    element => element.props,
    (diagram, handler) => {
      useEventListener('change', handler, diagram.selectionState);
    },
    (diagram, element) => diagram.updateElement(element),
    {
      onAfterSet: (diagram, elements, path, oldValue, newValue) => {
        diagram.undoManager.add(
          new PropertyArrayUndoableAction<DiagramEdge | DiagramNode>(
            elements,
            path,
            oldValue,
            newValue,
            `Change element ${path}`,
            element => element.props,
            element => diagram.updateElement(element)
          )
        );
      }
    }
  );
