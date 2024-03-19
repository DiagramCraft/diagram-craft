import { propsUtils } from '../react-canvas-viewer/utils/propsUtils.ts';
import { Edge } from '../react-canvas-viewer/Edge.tsx';
import { Node } from '../react-canvas-viewer/Node.tsx';
import { Diagram } from '../model/diagram.ts';
import { SVGProps } from 'react';

export const PickerCanvas = (props: PickerCanvasProps) => {
  const diagram = props.diagram;

  return (
    <svg {...propsUtils.filterDomProperties(props)} preserveAspectRatio="none">
      {diagram.layers.active.elements.map(e => {
        const id = e.id;
        if (e.type === 'edge') {
          const edge = diagram.edgeLookup.get(id)!;
          return (
            <Edge
              key={id}
              onMouseDown={() => {}}
              onDoubleClick={() => {}}
              def={edge}
              diagram={diagram}
              applicationTriggers={{}}
              tool={undefined}
            />
          );
        } else {
          const node = diagram.nodeLookup.get(id)!;
          return (
            <Node
              key={id}
              onMouseDown={() => {}}
              def={node}
              diagram={diagram}
              applicationTriggers={{}}
              tool={undefined}
            />
          );
        }
      })}
    </svg>
  );
};

type PickerCanvasProps = {
  diagram: Diagram;
} & Omit<
  SVGProps<SVGSVGElement>,
  'viewBox' | 'onMouseDown' | 'onMouseUp' | 'onMouseMove' | 'onContextMenu' | 'preserveAspectRatio'
>;
