import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { useEffect, useState } from 'react';
import { useEventListener } from '../hooks/useEventListener.ts';
import { unique } from '../../utils/array.ts';

export type DeepKeyOf<T> = (
  [T] extends [never]
    ? ''
    : T extends object
    ? {
        [K in Exclude<keyof T, symbol>]: `${K}${undefined extends T[K] ? '' : ''}${DotPrefix<
          DeepKeyOf<T[K]>
        >}`;
      }[Exclude<keyof T, symbol>]
    : ''
) extends infer D
  ? Extract<D, string>
  : never;

type DotPrefix<T extends string> = T extends '' ? '' : `.${T}`;

export class DynamicAccessor<T> {
  constructor() {}

  get<K extends DeepKeyOf<T> = DeepKeyOf<T>>(obj: T, key: K): T[K] {
    const parts = (key as string).split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = obj;
    for (const part of parts) {
      if (current === undefined) return undefined as T[K];
      current = current[part] as T[K];
    }
    return current;
  }

  set<K extends DeepKeyOf<T> = DeepKeyOf<T>>(obj: T, key: K, value: T[K]): void {
    const parts = (key as string).split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      current[parts[i]] ??= {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
  }
}

type PropertyHook<H> = <T extends H, R extends T[K], K extends DeepKeyOf<T> = DeepKeyOf<T>>(
  propertyPath: K,
  diagram: EditableDiagram,
  defaultValue: R
) => [R, (value: R) => void];

const makePropertyHook = <
  R extends T[K],
  T extends DiagramProps,
  K extends DeepKeyOf<T> = DeepKeyOf<T>
>(
  base: (diagram: EditableDiagram) => T,
  subscribe: (diagram: EditableDiagram, handler: () => void) => void
) => {
  return (s: K, diagram: EditableDiagram, defaultValue: R): [R, (value: R) => void] => {
    const accessor = new DynamicAccessor<T>();
    const [value, setValue] = useState<R>(defaultValue);
    const handler = () => {
      const value = accessor.get(base(diagram), s);

      if (value === undefined || value === null) return setValue(defaultValue);
      else return setValue(value as unknown as R);
    };
    subscribe(diagram, handler);
    useEffect(handler, []);

    return [
      value,
      v => {
        accessor.set(base(diagram), s, v);
        diagram.update();
        setValue(v);
      }
    ];
  };
};

export const useDiagramProperty: PropertyHook<DiagramProps> = makePropertyHook(
  diagram => diagram.props,
  (diagram, handler) => {
    useEventListener('change', handler, diagram);
  }
);

export const useElementProperty = <T>(
  s: DeepKeyOf<ElementProps>,
  diagram: EditableDiagram,
  defaultValue: T | undefined = undefined
): [T | undefined, (value: T | undefined) => void] => {
  const accessor = new DynamicAccessor<ElementProps>();
  const [value, setValue] = useState<T | undefined>(defaultValue);
  const handler = () => {
    const arr = unique(diagram.selectionState.elements.map(obj => accessor.get(obj.props, s)));

    if (arr.length === 0) setValue(defaultValue);
    else if (arr.length === 1) setValue((arr[0]! as T) ?? defaultValue);
    else setValue(undefined);
  };
  useEventListener('change', handler, diagram.selectionState);
  useEffect(handler, []);

  return [
    value,
    v => {
      diagram.selectionState.elements.forEach(n => {
        accessor.set(n.props, s, v);
        diagram.updateElement(n);
      });
      setValue(v);
    }
  ];
};

export const useNodeProperty = <T>(
  s: DeepKeyOf<NodeProps>,
  diagram: EditableDiagram,
  defaultValue: T | undefined = undefined
): [T | undefined, (value: T | undefined) => void] => {
  const accessor = new DynamicAccessor<NodeProps>();
  const [value, setValue] = useState<T | undefined>(defaultValue);
  const handler = () => {
    const arr = unique(diagram.selectionState.nodes.map(obj => accessor.get(obj.props, s)));

    if (arr.length === 0) setValue(defaultValue);
    else if (arr.length === 1) setValue((arr[0]! as T) ?? defaultValue);
    else setValue(undefined);
  };
  useEventListener('change', handler, diagram.selectionState);
  useEventListener('nodechanged', handler, diagram);
  useEffect(handler, []);

  return [
    value,
    v => {
      diagram.selectionState.nodes.forEach(n => {
        accessor.set(n.props, s, v);
        diagram.updateElement(n);
      });
      setValue(v);
    }
  ];
};

export const useEdgeProperty = <T>(
  s: DeepKeyOf<EdgeProps>,
  diagram: EditableDiagram,
  defaultValue: T | undefined = undefined
): [T | undefined, (value: T | undefined) => void] => {
  const accessor = new DynamicAccessor<EdgeProps>();
  const [value, setValue] = useState<T | undefined>(defaultValue);
  const handler = () => {
    const arr = unique(diagram.selectionState.edges.map(obj => accessor.get(obj.props, s)));

    if (arr.length === 0) setValue(defaultValue);
    else if (arr.length === 1) setValue((arr[0]! as T) ?? defaultValue);
    else setValue(undefined);
  };
  useEventListener('change', handler, diagram.selectionState);
  useEffect(handler, []);

  return [
    value,
    v => {
      diagram.selectionState.edges.forEach(n => {
        accessor.set(n.props, s, v);
        diagram.updateElement(n);
      });
      setValue(v);
    }
  ];
};
