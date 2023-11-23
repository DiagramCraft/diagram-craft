import { ToolWindowAccordion } from './ToolWindowAccordion.tsx';
import { Diagram, DiagramNode } from '../model-viewer/diagram.ts';
import { propsUtils } from '../react-canvas-viewer/utils/propsUtils.ts';
import { Edge } from '../react-canvas-viewer/Edge.tsx';
import { Node } from '../react-canvas-viewer/Node.tsx';
import React, { SVGProps } from 'react';
import { Point } from '../geometry/point.ts';

export const canvasDropHandler = ($d: Diagram) => {
  return (e: React.DragEvent<SVGSVGElement>) => {
    $d.addNode(
      new DiagramNode(
        $d.newid(),
        e.dataTransfer.getData('application/x-diagram-craft-node-type'),
        {
          pos: $d.viewBox.toDiagramPoint(Point.fromEvent(e.nativeEvent)),
          size: { w: 100, h: 100 },
          rotation: 0
        },
        undefined
      )
    );
  };
};

export const canvasDragOverHandler = () => {
  return (e: React.DragEvent<SVGSVGElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
};

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
  diagram: Diagram;
} & Omit<
  SVGProps<SVGSVGElement>,
  'viewBox' | 'onMouseDown' | 'onMouseUp' | 'onMouseMove' | 'onContextMenu' | 'preserveAspectRatio'
>;

export const PickerToolWindow = (props: Props) => {
  const nodes = props.diagram.nodDefinitions.getAll();

  const size = 40;

  const diagrams = nodes.map(n => {
    return new Diagram(
      [
        new DiagramNode(
          n.type,
          n.type,
          {
            pos: { x: 0, y: 0 },
            size: { w: size, h: size },
            rotation: 0
          },
          undefined
        )
      ],
      props.diagram.nodDefinitions,
      props.diagram.edgeDefinitions
    );
  });

  return (
    <ToolWindowAccordion title={'Shapes'}>
      <div className={'picker'}>
        {diagrams.map((d, idx) => {
          return (
            <div
              key={idx}
              draggable={true}
              onDragStart={ev => {
                ev.dataTransfer.setData('text/plain', nodes[idx].type);
                ev.dataTransfer.setData('application/x-diagram-craft-node-type', nodes[idx].type);
              }}
              style={{ background: 'transparent' }}
            >
              <PickerCanvas diagram={d} width={size} height={size} />
            </div>
          );
        })}
      </div>
    </ToolWindowAccordion>
  );
};

type Props = {
  diagram: Diagram;
};
