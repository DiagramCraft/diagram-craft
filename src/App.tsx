import './App.css';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useCallback, useRef, useState } from 'react';
import { Coord } from './types.ts';
import { Node, NodeApi } from './Node.tsx';
import { Edge, EdgeApi } from './Edge.tsx';
import { Diagram, loadDiagram } from './diagram.ts';

type Drag = {
  id: string;
  x: number;
  y: number;
};

const diagram: Diagram = {
  elements: [
    {
      type: 'edge',
      id: 'e1',
      start: { anchor: 'c', node: { id: '1' } },
      end: { anchor: 'c', node: { id: '2' } }
    },
    {
      type: 'node',
      nodeType: 'group',
      id: '1',
      x: 50,
      y: 50,
      w: 100,
      h: 100,
      children: [
        { type: 'node', nodeType: 'rect', id: '1_1', x: 10, y: 10, w: 20, h: 20, children: [] },
        { type: 'node', nodeType: 'rect', id: '1_2', x: 50, y: 50, w: 40, h: 40, children: [] },
      ]
    },
    { type: 'node', nodeType: 'rect', id: '2', x: 250, y: 220, w: 100, h: 100, children: [] }
  ]
};

const { nodeLookup, edgeLookup } = loadDiagram(diagram);

const App = () => {
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [drag, setDrag] = useState<Drag | undefined>(undefined);
  const nodeRefs = useRef<Record<string, NodeApi | null>>({});
  const edgeRefs = useRef<Record<string, EdgeApi | null>>({});

  const onMouseDown = useCallback((id: string, coord: Coord) => {
    setSelected(id);
    setDrag({ id, ...coord });
  }, []);

  return (
    <>
      <DndProvider backend={HTML5Backend}>
        <div>
          <svg
            width="640px"
            height="480px"
            style={{ border: '1px solid white', background: 'white' }}
            onMouseDown={() => {
              setSelected(undefined);
            }}
            onMouseUp={() => {
              setDrag(undefined);
            }}
            onMouseMove={e => {
              if (drag !== undefined) {
                nodeLookup[drag.id].x = e.nativeEvent.offsetX - drag.x;
                nodeLookup[drag.id].y = e.nativeEvent.offsetY - drag.y;

                nodeRefs.current[drag.id]?.repaint();

                for (const edges of Object.values(nodeLookup[drag.id].edges ?? {})) {
                  for (const edge of edges) {
                    edgeRefs.current[edge.id]?.repaint();
                  }
                }
              }
            }}
          >
            {diagram.elements.map(e => {
              const id = e.id;
              if (e.type === 'edge') {
                const edge = edgeLookup[id]!;
                return (
                  <Edge
                    key={id}
                    id={id}
                    ref={(element: EdgeApi) => (edgeRefs.current[id] = element)}
                    def={edge}
                  />
                );
              } else {
                const node = nodeLookup[id]!;
                return (
                  <Node
                    key={id}
                    id={id}
                    ref={(element: NodeApi) => (nodeRefs.current[id] = element)}
                    isSelected={selected === id}
                    onMouseDown={onMouseDown}
                    def={node}
                  />
                );
              }
            })}
          </svg>
        </div>
      </DndProvider>
    </>
  );
};

export default App;
