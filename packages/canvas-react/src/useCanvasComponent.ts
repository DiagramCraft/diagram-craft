import { useEffect, useLayoutEffect, useRef } from 'react';
import type { Ref } from 'react';
import type {
  BaseCanvasComponent,
  BaseCanvasProps
} from '@diagram-craft/canvas/canvas/BaseCanvasComponent';

const setRef = <T>(ref: Ref<T> | null | undefined, value: T | null) => {
  if (typeof ref === 'function') {
    ref(value);
  } else if (ref) {
    ref.current = value;
  }
};

export const useCanvasComponent = <C extends BaseCanvasComponent<P>, P extends BaseCanvasProps>(
  factory: () => C,
  props: P,
  forwardedRef: Ref<SVGSVGElement> | null | undefined,
  forceUpdate = false
) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const componentRef = useRef<C | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const forwardedRefRef = useRef(forwardedRef);
  const previousForwardedRef = useRef(forwardedRef);

  forwardedRefRef.current = forwardedRef;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let component = componentRef.current;
    if (!component) {
      component = factory();
      componentRef.current = component;
      component.attach(host, props);

      const svg = component.getSvgElement();
      svgRef.current = svg;
      setRef(forwardedRefRef.current, svg);
      return;
    }

    if (component.isRendered()) {
      component.update(props, forceUpdate);
    }
  });

  // The factory identifies the imperative component type and intentionally controls recreation.
  // biome-ignore lint/correctness/useExhaustiveDependencies: Recreate the component when its factory changes.
  useLayoutEffect(() => {
    return () => {
      const component = componentRef.current;
      component?.detach();

      if (componentRef.current === component) {
        componentRef.current = null;
      }

      svgRef.current = null;
      setRef(forwardedRefRef.current, null);
    };
  }, [factory]);

  useEffect(() => {
    if (previousForwardedRef.current === forwardedRef) return;

    setRef(previousForwardedRef.current, null);
    if (svgRef.current) {
      setRef(forwardedRef, svgRef.current);
    }
    previousForwardedRef.current = forwardedRef;
  }, [forwardedRef]);

  return hostRef;
};
