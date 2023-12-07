import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { useEffect, useState } from 'react';
import { useEventListener } from '../hooks/useEventListener.ts';
import { unique } from '../../utils/array.ts';
import { DiagramNode } from '../../model-viewer/diagramNode.ts';
import { DiagramEdge } from '../../model-viewer/diagramEdge.ts';

type PropertyStringPath<T, P = ''> = NonNullable<
  {
    [K in keyof T]: T[K] extends
      | string
      | number
      | boolean
      | undefined
      // eslint-disable-next-line
      | Array<any>
      ? `${string & P}${string & K}`
      :
          | `${string & P}${string & K}`
          | PropertyStringPath<NonNullable<T[K]>, `${string & P}${string & K}.`>;
  }[keyof T]
>;

// eslint-disable-next-line
const evaluatePropString = (props: Record<string, any | undefined>, s: string) => {
  const parts = s.split('.');
  let current = props;
  for (const part of parts) {
    if (current === undefined) return undefined;
    current = current[part] as Record<string, unknown>;
  }
  return current;
};

const getValues = <T, K>(
  arr: { props: T }[],
  s: PropertyStringPath<T>,
  defaultValue: K | undefined
): K[] =>
  unique(
    arr.map(n => {
      // @ts-ignore
      const value = evaluatePropString(n.props ?? {}, s);
      return value === undefined || value === null ? defaultValue : value;
    }),
    e => e
  ).filter(v => v !== undefined && v !== null) as K[];

const updateProperty = <T extends DiagramNode | DiagramEdge>(
  n: T,
  diagram: EditableDiagram,
  s: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  v: any
) => {
  let current = n.props ?? {};
  const parts = s.split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    // @ts-ignore
    current[parts[i]] ??= {};
    // @ts-ignore
    current = current[parts[i]];
  }
  // @ts-ignore
  current[parts[parts.length - 1]] = v;
  diagram.updateElement(n);
};

export const useElementProperty = <T>(
  s: PropertyStringPath<ElementProps>,
  diagram: EditableDiagram,
  defaultValue: T | undefined = undefined
): [T | undefined, (value: T | undefined) => void] => {
  const [value, setValue] = useState<T | undefined>(defaultValue);
  const handler = () => {
    const arr = getValues<ElementProps, T>(diagram.selectionState.elements, s, defaultValue);

    if (arr.length === 0) setValue(defaultValue);
    else if (arr.length === 1) setValue(arr[0]!);
    else setValue(undefined);
  };
  useEventListener('change', handler, diagram.selectionState);
  useEffect(handler, []);

  return [
    value,
    v => {
      diagram.selectionState.elements.forEach(n => updateProperty(n, diagram, s, v));
      setValue(v);
    }
  ];
};

export const useNodeProperty = <T>(
  s: PropertyStringPath<NodeProps>,
  diagram: EditableDiagram,
  defaultValue: T | undefined = undefined
): [T | undefined, (value: T | undefined) => void] => {
  const [value, setValue] = useState<T | undefined>(defaultValue);
  const handler = () => {
    const arr = getValues<NodeProps, T>(diagram.selectionState.nodes, s, defaultValue);

    if (arr.length === 0) setValue(defaultValue);
    else if (arr.length === 1) setValue(arr[0]!);
    else setValue(undefined);
  };
  useEventListener('change', handler, diagram.selectionState);
  useEffect(handler, []);

  return [
    value,
    v => {
      diagram.selectionState.nodes.forEach(n => updateProperty(n, diagram, s, v));
      setValue(v);
    }
  ];
};

export const useEdgeProperty = <T>(
  s: PropertyStringPath<EdgeProps>,
  diagram: EditableDiagram,
  defaultValue: T | undefined = undefined
): [T | undefined, (value: T | undefined) => void] => {
  const [value, setValue] = useState<T | undefined>(defaultValue);
  const handler = () => {
    const arr = getValues<EdgeProps, T>(diagram.selectionState.nodes, s, defaultValue);

    if (arr.length === 0) setValue(defaultValue);
    else if (arr.length === 1) setValue(arr[0]!);
    else setValue(undefined);
  };
  useEventListener('change', handler, diagram.selectionState);
  useEffect(handler, []);

  return [
    value,
    v => {
      diagram.selectionState.edges.forEach(n => updateProperty(n, diagram, s, v));
      setValue(v);
    }
  ];
};
