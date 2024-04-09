import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { EditableCanvasComponent, Props } from '@diagram-craft/canvas';
import { Actions } from '@diagram-craft/canvas';

export const EditableCanvas = forwardRef<SVGSVGElement, Props & Actions>((props, _ref) => {
  const diagram = props.diagram;

  const { actionMap, keyMap } = props;
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
