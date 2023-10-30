import './App.css';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useCallback, useRef, useState } from 'react';
import { Coord, Box } from './geometry.ts';
import { Node, NodeApi } from './Node.tsx';
import { Edge, EdgeApi } from './Edge.tsx';
import { Diagram, loadDiagram, NodeDef } from './diagram.ts';
import { Selection, SelectionApi } from './Selection.tsx';
import { SelectionState } from './state.ts';

type Drag = Coord;

type DeferedMouseAction = {
  id: 'background' | string;
  add?: boolean;
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
  // TODO: Maybe change all of these states to useRef?
  const [selected, setSelected] = useState<SelectionState | undefined>(undefined);
  const [drag, setDrag] = useState<Drag | undefined>(undefined);
  const nodeRefs = useRef<Record<string, NodeApi | null>>({});
  const edgeRefs = useRef<Record<string, EdgeApi | null>>({});
  const selectionRef = useRef<SelectionApi | null>(null);
  const deferedMouseAction = useRef<DeferedMouseAction | null>(null);

  const onMouseDown = useCallback(
    (id: string, coord: Coord, add: boolean) => {
      const node = nodeLookup[id];

      let newSelectionState: SelectionState | undefined;
      if (add) {
        newSelectionState = SelectionState.toggle(selected, node);
      } else {
        if (Box.contains(selected, coord)) {
          deferedMouseAction.current = { id };
        } else {
          newSelectionState = SelectionState.set(selected, node);
        }
      }

      if (newSelectionState) {
        setSelected(newSelectionState);
      }

      newSelectionState ??= selected;

      if (!newSelectionState) return;

      // Calculate anchor point
      const localCoord = Coord.subtract(coord, newSelectionState.pos);

      setDrag({ ...localCoord });
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
            onMouseDown={e => {
              if (selected && Box.contains(selected, Coord.fromEvent(e.nativeEvent))) {
                deferedMouseAction.current = { id: 'background' };
              } else {
                setSelected(undefined);
              }
            }}
            onMouseUp={() => {
              try {
                setDrag(undefined);

                if (deferedMouseAction.current) {
                  if (deferedMouseAction.current.id === 'background') {
                    setSelected(undefined);
                    return;
                  } else {
                    const node = nodeLookup[deferedMouseAction.current!.id];
                    setSelected(SelectionState.set(selected, node));
                    return;
                  }
                }

                if (selected) {
                  setSelected(SelectionState.recalculate(selected));
                }
              } finally {
                deferedMouseAction.current = null;
              }
            }}
            onMouseMove={e => {
              if (drag === undefined) return;
              if (!selected) throw new Error('invalid state');

              deferedMouseAction.current = null;

              const dx = e.nativeEvent.offsetX - selected.pos.x - drag.x;
              const dy = e.nativeEvent.offsetY - selected.pos.y - drag.y;

              for (const node of selected.elements) {
                // Need to calculate relative locations
                NodeDef.move(node, {
                  x: node.world.x + dx,
                  y: node.world.y + dy
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
