import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { CanvasComponent, CanvasProps } from '@diagram-craft/canvas/CanvasComponent';

type CanvasFactory = {
  canvasFactory?: () => CanvasComponent;
};

export const Canvas = forwardRef<SVGSVGElement, CanvasProps & CanvasFactory>((props, _ref) => {
  const diagram = props.diagram;

  const svgRef = useRef<SVGSVGElement | null>(null);

  const factory = props.canvasFactory ?? (() => new CanvasComponent());
  const ref = useRef<HTMLDivElement>(null);
  const cmpRef = useRef(factory());

  const cmpProps = { ...props, diagram };

  if (ref.current) {
    cmpRef.current.update(cmpProps);
  }

  useImperativeHandle(_ref, () => svgRef.current!);

  useEffect(() => {
    if (cmpRef.current.isRendered()) return;
    cmpRef.current.attach(ref.current!, cmpProps);
    svgRef.current = cmpRef.current.getSvgElement();
  });

  useLayoutEffect(() => {
    return () => {
      cmpRef.current.detach();
      cmpRef.current = factory();
    };
  }, []);

  return <div ref={ref}></div>;
});
