import React, { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import {
  InteractiveCanvasComponent,
  InteractiveCanvasProps
} from '@diagram-craft/canvas/canvas/InteractiveCanvasComponent';
import {
  BaseCanvasComponent,
  BaseCanvasProps
} from '@diagram-craft/canvas/canvas/BaseCanvasComponent';

type CanvasFactory<C extends BaseCanvasComponent> = {
  canvasFactory?: () => C;
};

interface CanvasComponentType extends React.FC<
  InteractiveCanvasProps & CanvasFactory<BaseCanvasComponent>
> {
  <C extends BaseCanvasComponent<P>, P extends BaseCanvasProps>(
    props: P & CanvasFactory<C> & { ref?: React.Ref<SVGSVGElement> }
  ): ReturnType<React.FC<P & CanvasFactory<C> & { ref?: React.Ref<SVGSVGElement> }>>;
}

export const Canvas: CanvasComponentType = forwardRef((props, canvasRef) => {
  const diagram = props.diagram;

  const svgRef = useRef<SVGSVGElement | null>(null);

  const factory = props.canvasFactory ?? (() => new InteractiveCanvasComponent());
  const ref = useRef<HTMLDivElement>(null);
  const cmpRef = useRef(factory());

  const cmpProps = { ...props, diagram };

  if (ref.current) {
    // TODO: Using true here is needed due to stylesheet updates in ObjectPickerPanel
    //       Ideally we should have some other mechanism to force a redraw
    cmpRef.current.update(cmpProps, true);
  }

  useImperativeHandle(canvasRef, () => svgRef.current!);

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
  }, [factory]);

  return <div ref={ref}></div>;
});
