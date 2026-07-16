import React, { forwardRef, useCallback } from 'react';
import {
  InteractiveCanvasComponent,
  InteractiveCanvasProps
} from '@diagram-craft/canvas/canvas/InteractiveCanvasComponent';
import {
  BaseCanvasComponent,
  BaseCanvasProps
} from '@diagram-craft/canvas/canvas/BaseCanvasComponent';
import { useCanvasComponent } from './useCanvasComponent';

type CanvasFactory<C extends BaseCanvasComponent> = {
  canvasFactory?: () => C;
};

interface CanvasComponentType
  extends React.FC<InteractiveCanvasProps & CanvasFactory<BaseCanvasComponent>> {
  <C extends BaseCanvasComponent<P>, P extends BaseCanvasProps>(
    props: P & CanvasFactory<C> & { ref?: React.Ref<SVGSVGElement> }
  ): ReturnType<React.FC<P & CanvasFactory<C> & { ref?: React.Ref<SVGSVGElement> }>>;
}

export const Canvas: CanvasComponentType = forwardRef<
  SVGSVGElement,
  InteractiveCanvasProps & CanvasFactory<BaseCanvasComponent>
>((props, canvasRef) => {
  const diagram = props.diagram;

  const defaultFactory = useCallback(() => new InteractiveCanvasComponent(), []);
  const factory = props.canvasFactory ?? defaultFactory;

  const cmpProps = { ...props, diagram };

  const ref = useCanvasComponent(factory, cmpProps, canvasRef, true);

  return <div ref={ref}></div>;
});
