import { useEffect, useRef } from 'react';
import { Component } from '../../base-ui/component.ts';

export const useComponent = <P, T extends Component<P>, R = SVGGElement>(
  component: () => T,
  props: P
) => {
  const cmpRef = useRef<T>(component());
  const parentRef = useRef<R>(null);

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
    // @ts-ignore
    cmpRef.current.attach(parentRef.current!, props);
  });

  return parentRef;
};
