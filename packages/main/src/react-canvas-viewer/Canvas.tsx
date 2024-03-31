import { CSSProperties, forwardRef, SVGProps, useImperativeHandle, useRef } from 'react';
import { propsUtils } from './utils/propsUtils.ts';
import { Edge } from './Edge.tsx';
import { Node } from './Node.tsx';
import { useCanvasZoomAndPan } from './useCanvasZoomAndPan.ts';
import { ApplicationTriggers } from '../react-canvas-editor/EditableCanvas.tsx';
import { useDiagram } from '../react-app/context/DiagramContext.ts';

export const Canvas = forwardRef<SVGSVGElement, Props>((props, ref) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const diagram = useDiagram();

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
      {...propsUtils.filterDomProperties(props)}
      preserveAspectRatio="none"
      viewBox={diagram.viewBox.svgViewboxString}
      style={style}
    >
      {diagram.layers.visible.flatMap(layer => {
        return layer.elements.map(e => {
          const id = e.id;
          if (e.type === 'edge') {
            const edge = diagram.edgeLookup.get(id)!;
            return (
              <Edge
                key={id}
                onMouseDown={() => {}}
                onDoubleClick={() => {}}
                tool={undefined}
                def={edge}
                diagram={diagram}
                applicationTriggers={props.applicationTriggers}
              />
            );
          } else {
            const node = diagram.nodeLookup.get(id)!;
            return (
              <Node
                key={id}
                onMouseDown={() => {}}
                tool={undefined}
                def={node}
                diagram={diagram}
                applicationTriggers={props.applicationTriggers}
              />
            );
          }
        });
      })}
    </svg>
  );
});

type Props = {
  applicationTriggers: ApplicationTriggers;
} & Omit<
  SVGProps<SVGSVGElement>,
  'viewBox' | 'onMouseDown' | 'onMouseUp' | 'onMouseMove' | 'onContextMenu' | 'preserveAspectRatio'
>;
