import { CSSProperties, forwardRef, SVGProps, useImperativeHandle, useRef } from 'react';
import { propsUtils } from './utils/propsUtils.ts';
import { Edge } from './Edge.tsx';
import { Node } from './Node.tsx';
import { useCanvasZoomAndPan } from './useCanvasZoomAndPan.ts';
import { EditableDiagram } from '../model-editor/editable-diagram.ts';

export const Canvas = forwardRef<SVGSVGElement, Props>((props, ref) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const diagram = props.diagram;

  useImperativeHandle(ref, () => {
    return svgRef.current!;
  });

  useCanvasZoomAndPan(diagram, svgRef);

  const style: CSSProperties = {};

  if (diagram.props.background?.color) {
    style.backgroundColor = diagram.props.background.color;
  }

  // TODO: Maybe we should support updating based on diagram changes?
  // TODO: If we do, we can share quite a bit of code with the EditabledCanvas
  return (
    <svg
      ref={svgRef}
      {...propsUtils.except(props, 'diagram')}
      preserveAspectRatio="none"
      viewBox={diagram.viewBox.svgViewboxString}
      style={style}
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
  // TODO: This should really by Diagram and not EditableDiagram
  diagram: EditableDiagram;
} & Omit<
  SVGProps<SVGSVGElement>,
  'viewBox' | 'onMouseDown' | 'onMouseUp' | 'onMouseMove' | 'onContextMenu' | 'preserveAspectRatio'
>;
