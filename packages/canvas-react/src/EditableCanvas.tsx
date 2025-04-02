import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import {
  EditableCanvasComponent,
  Props
} from '@diagram-craft/canvas/canvas/EditableCanvasComponent';
import { Actions } from '@diagram-craft/canvas/keyMap';

export const EditableCanvas = forwardRef<SVGSVGElement, Props & Actions>((props, _ref) => {
  const diagram = props.diagram;

  const { actionMap, keyMap } = props;
  const svgRef = useRef<SVGSVGElement | null>(null);

  const ref = useRef<HTMLDivElement>(null);
  const cmpRef = useRef(new EditableCanvasComponent());

  const cmpProps = { ...props, diagram, actionMap, keyMap };

  if (ref.current) {
    // TODO: Is this needed or not?
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
      cmpRef.current = new EditableCanvasComponent();
    };
  }, []);

  return <div ref={ref}></div>;
});
