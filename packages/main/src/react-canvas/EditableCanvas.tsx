import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { useActions } from '../react-app/context/ActionsContext.ts';
import { EditableCanvasComponent, Props } from '../canvas/EditableCanvas.ts';

export const EditableCanvas = forwardRef<SVGSVGElement, Props>((props, _ref) => {
  const diagram = props.diagram;
  const { actionMap, keyMap } = useActions();
  const svgRef = useRef<SVGSVGElement | null>(null);

  const ref = useRef<HTMLDivElement>(null);
  const cmpRef = useRef<EditableCanvasComponent>(new EditableCanvasComponent());

  const cmpProps = {
    ...props,
    diagram,
    actionMap,
    keyMap
  };

  if (ref.current) {
    cmpRef.current.update(cmpProps);
  }

  useImperativeHandle(_ref, () => svgRef.current!, [svgRef.current]);

  useEffect(() => {
    if (cmpRef.current.isRendered()) return;
    cmpRef.current.attach(ref.current!, cmpProps);
    svgRef.current = cmpRef.current.getSvgElement();
  });

  return <div ref={ref}></div>;
});
