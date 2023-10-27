import './App.css';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useCallback, useRef, useState } from 'react';
import { Coord } from './types.ts';
import { Node, NodeApi } from './Node.tsx';
import { Edge, EdgeApi } from './Edge.tsx';
import { Diagram, loadDiagram, NodeDef } from './diagram.ts';
import { Selection, SelectionApi } from './Selection.tsx';
import { SelectionState } from './state.ts';

type Drag = {
  x: number;
  y: number;
};

const diagram: Diagram = {
  elements: [
    {
      type: 'edge',
      id: 'e1',
      start: { anchor: 'c', node: { id: '1_2' } },
      end: { anchor: 'c', node: { id: '2' } }
    },
    {
      type: 'node',
      nodeType: 'group',
      id: '1',
      pos: { x: 50, y: 50 },
      size: { w: 100, h: 100 },
      children: [
        {
          type: 'node',
          nodeType: 'rect',
          id: '1_1',
          pos: { x: 10, y: 10 },
          size: { w: 20, h: 20 },
          children: []
        },
        {
          type: 'node',
          nodeType: 'rect',
          id: '1_2',
          pos: { x: 50, y: 50 },
          size: { w: 40, h: 40 },
          children: []
        }
      ]
    },
    {
      type: 'node',
      nodeType: 'rect',
      id: '2',
      pos: { x: 250, y: 220 },
      size: { w: 100, h: 100 },
      children: []
    },
    {
      type: 'node',
      nodeType: 'rect',
      id: '3',
      pos: { x: 370, y: 20 },
      size: { w: 100, h: 100 },
      children: []
    }
  ]
};

const { nodeLookup, edgeLookup } = loadDiagram(diagram);

const App = () => {
  const [selected, setSelected] = useState<SelectionState | undefined>(undefined);
  const [drag, setDrag] = useState<Drag | undefined>(undefined);
  const nodeRefs = useRef<Record<string, NodeApi | null>>({});
  const edgeRefs = useRef<Record<string, EdgeApi | null>>({});
  const selectionRef = useRef<SelectionApi | null>(null);

  const onMouseDown = useCallback(
    (id: string, coord: Coord, add: boolean) => {
      const node = nodeLookup[id];
      if (add) {
        setSelected(SelectionState.toggle(selected, node));
      } else {
        setSelected(SelectionState.set(selected, node));
      }
      setDrag({ ...coord });
    },
    [selected]
  );

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
              if (selected) {
                setSelected(SelectionState.recalculate(selected));
              }
            }}
            onMouseMove={e => {
              if (drag !== undefined) {
                if (!selected) throw new Error('invalid state');

                for (const node of selected.elements) {
                  NodeDef.move(node, {
                    x: e.nativeEvent.offsetX - drag.x,
                    y: e.nativeEvent.offsetY - drag.y
                  });

                  if (selected) {
                    SelectionState.recalculate(selected);
                  }

                  nodeRefs.current[node.id]?.repaint();

                  for (const edge of NodeDef.edges(node)) {
                    edgeRefs.current[edge.id]?.repaint();
                  }
                }

                selectionRef.current?.repaint();
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
                    ref={(element: EdgeApi) => (edgeRefs.current[id] = element)}
                    def={edge}
                  />
                );
              } else {
                const node = nodeLookup[id]!;
                return (
                  <Node
                    key={id}
                    ref={(element: NodeApi) => (nodeRefs.current[id] = element)}
                    isSelected={!!selected?.elements?.includes(node)}
                    onMouseDown={onMouseDown}
                    def={node}
                  />
                );
              }
            })}

            {selected && <Selection ref={selectionRef} selection={selected} />}
          </svg>
        </div>
      </DndProvider>
    </>
  );
};

export default App;
