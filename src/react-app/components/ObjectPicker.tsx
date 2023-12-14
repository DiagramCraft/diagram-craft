import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { SVGProps } from 'react';
import { propsUtils } from '../../react-canvas-viewer/utils/propsUtils.ts';
import { Edge } from '../../react-canvas-viewer/Edge.tsx';
import { Node } from '../../react-canvas-viewer/Node.tsx';
import { DiagramNode } from '../../model-viewer/diagramNode.ts';
import { useDiagram } from '../context/DiagramContext.tsx';

const PickerCanvas = (props: PickerCanvasProps) => {
  const diagram = props.diagram;

  return (
    <svg {...propsUtils.filterDomProperties(props)} preserveAspectRatio="none">
      {diagram.layers.active.elements.map(e => {
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
};

type PickerCanvasProps = {
  diagram: EditableDiagram;
} & Omit<
  SVGProps<SVGSVGElement>,
  'viewBox' | 'onMouseDown' | 'onMouseUp' | 'onMouseMove' | 'onContextMenu' | 'preserveAspectRatio'
>;

export const ObjectPicker = (props: Props) => {
  const diagram = useDiagram();
  const nodes = diagram.nodeDefinitions.getAll();

  const diagrams = nodes.map(n => {
    return new EditableDiagram(n.type, n.type, diagram.nodeDefinitions, diagram.edgeDefinitions, [
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
    ]);
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
          <PickerCanvas width={props.size} height={props.size} diagram={d} />
        </div>
      ))}
    </div>
  );
};

type Props = {
  size: number;
};
