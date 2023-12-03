import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { useEffect, useState } from 'react';
import { useEventListener } from '../hooks/useEventListener.ts';
import { unique } from '../../utils/array.ts';

type PropertyStringPath<T, P = ''> = NonNullable<
  {
    [K in keyof T]: T[K] extends
      | string
      | number
      | bigint
      | boolean
      | undefined
      | symbol
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

export const useEdgeProperty = (
  s: PropertyStringPath<EdgeProps>,
  diagram: EditableDiagram,
  defaultValue: string | undefined = undefined
): [string | undefined, (value: string | undefined) => void] => {
  const [value, setValue] = useState<string | undefined>(defaultValue);
  const handler = () => {
    const arr = unique(
      diagram.selectionState.edges.map(n => evaluatePropString(n.props ?? {}, s) ?? defaultValue),
      e => e
    ).filter(Boolean);

    if (arr.length === 0) setValue(defaultValue);
    else if (arr.length === 1) setValue(arr[0]! as unknown as string);
    else setValue(undefined);
  };
  useEventListener('change', handler, diagram.selectionState);
  useEffect(handler, []);

  return [
    value,
    v => {
      diagram.selectionState.edges.forEach(n => {
        let current = n.props ?? {};
        const parts = s.split('.');
        for (let i = 0; i < parts.length - 1; i++) {
          // @ts-ignore
          current[parts[i]] ??= {};
          // @ts-ignore
          current = current[parts[i]] as Record<string, unknown>;
        }
        // @ts-ignore
        current[parts[parts.length - 1]] = v;
        diagram.updateElement(n);
      });
      setValue(v);
    }
  ];
};
