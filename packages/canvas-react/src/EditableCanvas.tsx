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

  // TODO: This update() call during render can cause "Cannot update a component while rendering
  //       a different component" warnings. The proper fix is to move this into a useEffect, but
  //       that causes other issues that need debugging. As a workaround, useRedraw was modified
  //       to use queueMicrotask - revert that change once this is properly fixed.
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
      cmpRef.current = new EditableCanvasComponent();
    };
  }, []);

  return <div ref={ref}></div>;
});
