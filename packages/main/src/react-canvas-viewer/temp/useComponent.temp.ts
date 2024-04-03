import { useEffect, useRef } from 'react';
import { BaseShape, BaseShapeProps } from './baseShape.temp.ts';

export const useComponent = <P extends BaseShapeProps, T extends BaseShape>(
  component: () => T,
  props: P
) => {
  const cmpRef = useRef<T>(component());
  const parentRef = useRef<SVGGElement>(null);

  const newComponent = component();
  const isSameComponent = cmpRef.current.constructor === newComponent.constructor;
  if (!isSameComponent) {
    cmpRef.current.replaceWith(newComponent);
    cmpRef.current = newComponent;
  }

  if (parentRef.current) {
    setTimeout(() => {
      cmpRef.current.update(props);
    }, 0);
  }

  useEffect(() => {
    if (cmpRef.current.isRendered()) return;
    cmpRef.current.attach(parentRef.current!, props);
  });

  return parentRef;
};
