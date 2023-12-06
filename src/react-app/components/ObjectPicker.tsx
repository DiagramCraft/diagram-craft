import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { DiagramNode } from '../../model-viewer/diagram.ts';
import { SVGProps } from 'react';
import { propsUtils } from '../../react-canvas-viewer/utils/propsUtils.ts';
import { Edge } from '../../react-canvas-viewer/Edge.tsx';
import { Node } from '../../react-canvas-viewer/Node.tsx';

const PickerCanvas = (props: PickerCanvasProps) => {
  const diagram = props.diagram;

  return (
    <svg {...propsUtils.except(props, 'diagram')} preserveAspectRatio="none">
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
              onDragStart={() => {
                console.log('start');
              }}
            />
          );
        }
      })}
    </svg>
  );
};

type PickerCanvasProps = {
  // TODO: This should really by Diagram and not EditableDiagram
  diagram: EditableDiagram;
} & Omit<
  SVGProps<SVGSVGElement>,
  'viewBox' | 'onMouseDown' | 'onMouseUp' | 'onMouseMove' | 'onContextMenu' | 'preserveAspectRatio'
>;

export const ObjectPicker = (props: Props) => {
  const nodes = props.diagram.nodeDefinitions.getAll();

  const diagrams = nodes.map(n => {
    return new EditableDiagram(
      n.type,
      [
        new DiagramNode(
          n.type,
          n.type,
          {
            pos: { x: 1, y: 1 },
            size: { w: props.size - 2, h: props.size - 2 },
            rotation: 0
          },
          undefined
        )
      ],
      props.diagram.nodeDefinitions,
      props.diagram.edgeDefinitions
    );
  });
  return (
    <div className={'cmp-object-picker'}>
      {diagrams.map((d, idx) => (
        <div
          key={idx}
          draggable={true}
          onDragStart={ev => {
            ev.dataTransfer.setData('text/plain', nodes[idx].type);
            ev.dataTransfer.setData('application/x-diagram-craft-node-type', nodes[idx].type);
          }}
          style={{ background: 'transparent' }}
        >
          <PickerCanvas diagram={d} width={props.size} height={props.size} />
        </div>
      ))}
    </div>
  );
};

type Props = {
  diagram: EditableDiagram;
  size: number;
};
