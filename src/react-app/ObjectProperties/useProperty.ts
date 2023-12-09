import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { useEffect, useState } from 'react';
import { useEventListener } from '../hooks/useEventListener.ts';
import { unique } from '../../utils/array.ts';
import { DiagramEdge } from '../../model-viewer/diagramEdge.ts';
import { DiagramNode } from '../../model-viewer/diagramNode.ts';

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

type PropertyHook<T> = <K extends PropPath<T>, V extends PropPathValue<T, K>, DV extends V>(
  propertyPath: K,
  diagram: EditableDiagram,
  defaultValue: DV
) => [V, (value: V) => void];

type PropertyArrayHook<T> = <K extends PropPath<T>, V extends PropPathValue<T, K>, DV extends V>(
  propertyPath: K,
  diagram: EditableDiagram,
  defaultValue: DV
) => [V, (value: V) => void, boolean];

const makePropertyHook = <
  T,
  K extends PropPath<T> = PropPath<T>,
  V extends PropPathValue<T, K> = PropPathValue<T, K>
>(
  base: (diagram: EditableDiagram) => T,
  subscribe: (diagram: EditableDiagram, handler: () => void) => void
): PropertyHook<T> => {
  return ((path: K, diagram: EditableDiagram, defaultValue: V): [V, (value: V) => void] => {
    const accessor = new DynamicAccessor<T>();
    const [value, setValue] = useState<V>(defaultValue);
    const handler = () => {
      const value = accessor.get(base(diagram), path);

      if (value === undefined || value === null) return setValue(defaultValue);
      else return setValue(value as unknown as V);
    };
    subscribe(diagram, handler);
    useEffect(handler, []);

    return [
      value,
      v => {
        accessor.set(base(diagram), path, v);
        diagram.update();
        setValue(v);
      }
    ];
  }) as PropertyHook<T>;
};

const makePropertyArrayHook = <
  T,
  I,
  K extends PropPath<T> = PropPath<T>,
  V extends PropPathValue<T, K> = PropPathValue<T, K>
>(
  getArr: (diagram: EditableDiagram) => I[],
  base: (e: I) => T,
  subscribe: (diagram: EditableDiagram, handler: () => void) => void
): PropertyArrayHook<T> => {
  return ((
    path: K,
    diagram: EditableDiagram,
    defaultValue: V
  ): [V, (value: V) => void, boolean] => {
    const accessor = new DynamicAccessor<T>();
    const [value, setValue] = useState<V>(defaultValue);
    const [multiple, setMultiple] = useState(false);
    const handler = () => {
      const arr = unique(getArr(diagram).map(obj => accessor.get(base(obj), path)));

      if (arr.length === 1) setValue((arr[0]! as V) ?? defaultValue);
      else setValue(defaultValue);

      setMultiple(arr.length > 1);
    };
    subscribe(diagram, handler);
    useEffect(handler, []);

    return [
      value,
      v => {
        getArr(diagram).forEach(n => {
          accessor.set(base(n), path, v);
          diagram.updateElement(n as DiagramEdge | DiagramNode);
        });
        setValue(v);
      },
      multiple
    ];
  }) as PropertyArrayHook<T>;
};

export const useDiagramProperty: PropertyHook<DiagramProps> = makePropertyHook<DiagramProps>(
  diagram => diagram.props,
  (diagram, handler) => {
    useEventListener('change', handler, diagram);
  }
);

export const useEdgeProperty: PropertyArrayHook<EdgeProps> = makePropertyArrayHook<
  EdgeProps,
  DiagramEdge
>(
  diagram => diagram.selectionState.edges,
  edge => edge.props,
  (diagram, handler) => {
    useEventListener('change', handler, diagram.selectionState);
  }
);

export const useNodeProperty: PropertyArrayHook<NodeProps> = makePropertyArrayHook<
  NodeProps,
  DiagramNode
>(
  diagram => diagram.selectionState.nodes,
  node => node.props,
  (diagram, handler) => {
    useEventListener('change', handler, diagram.selectionState);
  }
);

export const useElementProperty: PropertyArrayHook<ElementProps> = makePropertyArrayHook<
  ElementProps,
  DiagramEdge | DiagramNode
>(
  diagram => diagram.selectionState.elements,
  element => element.props,
  (diagram, handler) => {
    useEventListener('change', handler, diagram.selectionState);
  }
);
