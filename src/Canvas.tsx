import { useCallback, useRef } from 'react';
import { Drag, ObjectDrag, SelectionState } from './state.ts';
import { Node, NodeApi } from './Node.tsx';
import { Edge, EdgeApi } from './Edge.tsx';
import { Selection, SelectionApi } from './Selection.tsx';
import { Box, Coord } from './geometry.ts';
import { LoadedDiagram, NodeDef } from './diagram.ts';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { SelectionMarquee, SelectionMarqueeApi } from './SelectionMarquee.tsx';
import { selectionResize } from './Selection.logic.ts';

const BACKGROUND = 'background';

type ObjectId = typeof BACKGROUND | string;

type DeferedMouseAction = {
  id: ObjectId;
  add?: boolean;
};

export const Canvas = (props: Props) => {
  const diagram = props.diagram;

  const svgRef = useRef<SVGSVGElement>(null);
  const selection = useRef<SelectionState>(SelectionState.EMPTY());
  const drag = useRef<Drag | undefined>(undefined);
  const nodeRefs = useRef<Record<string, NodeApi | null>>({});
  const edgeRefs = useRef<Record<string, EdgeApi | null>>({});
  const selectionRef = useRef<SelectionApi | null>(null);
  const selectionMarqueeRef = useRef<SelectionMarqueeApi | null>(null);
  const deferedMouseAction = useRef<DeferedMouseAction | null>(null);

  const updateCursor = useCallback(
    (coord: Coord) => {
      if (Box.contains(selection.current, coord)) {
        svgRef.current!.style.cursor = 'move';
      } else {
        svgRef.current!.style.cursor = 'default';
      }
    },
    [svgRef]
  );

  const onDragStart = useCallback((coord: Coord, type: Drag['type'], original: Box) => {
    drag.current = { type, offset: coord, original };
  }, []);

  const onMouseDown = useCallback(
    (id: ObjectId, coord: Coord, add: boolean) => {
      const isClickOnBackground = id === BACKGROUND;
      try {
        if (add) {
          if (!isClickOnBackground) {
            SelectionState.toggle(selection.current, diagram.nodeLookup[id]);
          }
        } else {
          if (Box.contains(selection.current, coord)) {
            deferedMouseAction.current = { id };
          } else {
            if (isClickOnBackground) {
              SelectionState.clear(selection.current);
              drag.current = { type: 'marquee', offset: coord };
            } else {
              SelectionState.clear(selection.current);
              SelectionState.toggle(selection.current, diagram.nodeLookup[id]);
            }
          }
        }

        updateCursor(coord);

        if (SelectionState.isEmpty(selection.current)) return;

        const localCoord = Coord.subtract(coord, selection.current.pos);
        onDragStart(localCoord, 'move', Box.snapshot(selection.current));
      } finally {
        selectionRef.current?.repaint();
      }
    },
    [onDragStart, updateCursor, diagram]
  );

  const onMouseUp = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_id: ObjectId, _coord: Coord) => {
      try {
        selectionMarqueeRef.current?.clear();
        drag.current = undefined;

        if (deferedMouseAction.current) {
          if (deferedMouseAction.current.id === BACKGROUND) {
            SelectionState.clear(selection.current);
            return;
          } else {
            SelectionState.clear(selection.current);
            SelectionState.toggle(
              selection.current,
              diagram.nodeLookup[deferedMouseAction.current.id]
            );
            return;
          }
        }
      } finally {
        selectionRef.current?.repaint();
        deferedMouseAction.current = null;
      }
    },
    [diagram]
  );

  const onMouseMove = useCallback(
    (coord: Coord) => {
      if (drag.current === undefined) return;

      try {
        if (drag.current.type.startsWith('resize-') || drag.current.type === 'rotate') {
          // TODO: Fix this "as" cast
          return selectionResize(coord, selection.current, drag.current! as ObjectDrag);
        } else if (drag.current.type === 'move') {
          if (SelectionState.isEmpty(selection.current)) throw new Error('invalid state');

          deferedMouseAction.current = null;

          const d = Coord.subtract(coord, Coord.add(selection.current.pos, drag.current?.offset));

          for (const node of selection.current.elements) {
            NodeDef.move(node, d);

            SelectionState.recalculate(selection.current);
          }
        } else if (drag.current.type === 'marquee') {
          selectionMarqueeRef.current?.repaint(
            Box.snapshot({
              pos: drag.current.offset,
              size: { w: coord.x - drag.current?.offset.x, h: coord.y - drag.current?.offset.y }
            })
          );
        }
      } finally {
        updateCursor(coord);

        for (const node of selection.current.elements) {
          nodeRefs.current[node.id]?.repaint();

          for (const edge of NodeDef.edges(node)) {
            edgeRefs.current[edge.id]?.repaint();
          }
        }

        selectionRef.current?.repaint();
      }
    },
    [updateCursor]
  );

  return (
    <>
      <DndProvider backend={HTML5Backend}>
        <div>
          <svg
            ref={svgRef}
            width="640px"
            height="480px"
            style={{ border: '1px solid white', background: 'white' }}
            onMouseDown={e => onMouseDown(BACKGROUND, Coord.fromEvent(e.nativeEvent), e.shiftKey)}
            onMouseUp={e => onMouseUp(BACKGROUND, Coord.fromEvent(e.nativeEvent))}
            onMouseMove={e => onMouseMove(Coord.fromEvent(e.nativeEvent))}
          >
            {diagram.elements.map(e => {
              const id = e.id;
              if (e.type === 'edge') {
                const edge = diagram.edgeLookup[id]!;
                return (
                  <Edge
                    key={id}
                    ref={(element: EdgeApi) => (edgeRefs.current[id] = element)}
                    def={edge}
                  />
                );
              } else {
                const node = diagram.nodeLookup[id]!;
                return (
                  <Node
                    key={id}
                    ref={(element: NodeApi) => (nodeRefs.current[id] = element)}
                    isSelected={!!selection.current?.elements?.includes(node)}
                    onMouseDown={onMouseDown}
                    def={node}
                  />
                );
              }
            })}

            <Selection ref={selectionRef} selection={selection.current} onDragStart={onDragStart} />
            <SelectionMarquee ref={selectionMarqueeRef} />
          </svg>
        </div>
      </DndProvider>
    </>
  );
};

type Props = {
  diagram: LoadedDiagram;
};
