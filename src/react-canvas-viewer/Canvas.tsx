import { forwardRef, SVGProps, useImperativeHandle, useRef } from 'react';
import { Diagram } from '../model-viewer/diagram.ts';
import { propsUtils } from './utils/propsUtils.ts';
import { Edge } from './Edge.tsx';
import { Node } from './Node.tsx';
import { useCanvasZoomAndPan } from './useCanvasZoomAndPan.ts';

export const Canvas = forwardRef<SVGSVGElement, Props>((props, ref) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const diagram = props.diagram;

  useImperativeHandle(ref, () => {
    return svgRef.current!;
  });

  useCanvasZoomAndPan(diagram, svgRef);

  // TODO: Maybe we should support updating based on diagram changes?
  // TODO: If we do, we can share quite a bit of code with the EditabledCanvas
  return (
    <svg
      ref={svgRef}
      {...propsUtils.except(props, 'diagram')}
      preserveAspectRatio="none"
      viewBox={diagram.viewBox.svgViewboxString}
    >
      {diagram.elements.map(e => {
        const id = e.id;
        if (e.type === 'edge') {
          const edge = diagram.edgeLookup[id]!;
          return (
            <Edge
              key={id}
              onMouseDown={() => {}}
              onMouseEnter={() => {}}
              onMouseLeave={() => {}}
              def={edge}
              diagram={diagram}
            />
          );
        } else {
          const node = diagram.nodeLookup[id]!;
          return (
            <Node
              key={id}
              onMouseDown={() => {}}
              onMouseEnter={() => {}}
              onMouseLeave={() => {}}
              def={node}
              diagram={diagram}
            />
          );
        }
      })}
    </svg>
  );
});

type Props = {
  diagram: Diagram;
} & Omit<
  SVGProps<SVGSVGElement>,
  'viewBox' | 'onMouseDown' | 'onMouseUp' | 'onMouseMove' | 'onContextMenu' | 'preserveAspectRatio'
>;
