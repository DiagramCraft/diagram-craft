import { useCallback, useRef } from 'react';
import { Drag, SelectionState } from './state.ts';
import { Node, NodeApi } from './Node.tsx';
import { Edge, EdgeApi } from './Edge.tsx';
import { Selection, SelectionApi } from './Selection.tsx';
import { Box, Coord } from './geometry.ts';
import { LoadedDiagram, NodeDef } from './diagram.ts';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
  SelectionMarquee,
  SelectionMarqueeApi,
  updatePendingElements
} from './SelectionMarquee.tsx';
import { selectionResize, selectionRotate } from './Selection.logic.ts';
import { assert } from './assert.ts';

const BACKGROUND = 'background';

type ObjectId = typeof BACKGROUND | string;

type DeferedMouseAction = {
  id: ObjectId;
  add?: boolean;
};

export const Canvas = (props: Props) => {
  const diagram = props.diagram;

  const svgRef = useRef<SVGSVGElement>(null);
  const selection = useRef<SelectionState>(new SelectionState());
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
            selection.current.toggle(diagram.nodeLookup[id]);
          }
        } else {
          if (Box.contains(selection.current, coord)) {
            deferedMouseAction.current = { id };
          } else {
            if (isClickOnBackground) {
              selection.current.clear();
              drag.current = { type: 'marquee', offset: coord };
            } else {
              selection.current.clear();
              selection.current.toggle(diagram.nodeLookup[id]);
            }
          }
        }

        updateCursor(coord);

        if (selection.current.isEmpty()) return;

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
        drag.current = undefined;

        if (deferedMouseAction.current) {
          if (deferedMouseAction.current.id === BACKGROUND) {
            selection.current.clear();
            return;
          } else {
            selection.current.clear();
            selection.current.toggle(diagram.nodeLookup[deferedMouseAction.current.id]);
            return;
          }
        } else if (selection.current.pendingElements) {
          selection.current.rotation = undefined;
          selection.current.elements = selection.current.pendingElements;

          selection.current.recalculateBoundingBox();
          selection.current.clearMarquee();
        }
      } finally {
        selectionRef.current?.repaint();
        selectionMarqueeRef.current?.repaint();
        deferedMouseAction.current = null;
      }
    },
    [diagram]
  );

  const onMouseMove = useCallback(
    (coord: Coord) => {
      if (drag.current === undefined) return;

      try {
        deferedMouseAction.current = null;

        if (
          drag.current.type === 'resize-se' ||
          drag.current.type === 'resize-sw' ||
          drag.current?.type === 'resize-ne' ||
          drag.current?.type === 'resize-nw' ||
          drag.current?.type === 'resize-n' ||
          drag.current?.type === 'resize-s' ||
          drag.current?.type === 'resize-e' ||
          drag.current?.type === 'resize-w'
        ) {
          assert.false(selection.current.isEmpty());
          return selectionResize(coord, selection.current, drag.current);
        } else if (drag.current?.type === 'rotate') {
          assert.false(selection.current.isEmpty());
          return selectionRotate(coord, selection.current, drag.current);
        } else if (drag.current.type === 'move') {
          assert.false(selection.current.isEmpty());

          const d = Coord.subtract(coord, Coord.add(selection.current.pos, drag.current?.offset));

          for (const node of selection.current.elements) {
            NodeDef.move(node, d);

            selection.current.recalculateBoundingBox();
          }
        } else if (drag.current.type === 'marquee') {
          selection.current.marquee = Box.normalize(
            Box.snapshot({
              pos: drag.current.offset,
              size: { w: coord.x - drag.current?.offset.x, h: coord.y - drag.current?.offset.y }
            })
          );

          updatePendingElements(selection.current, diagram);

          selectionMarqueeRef.current?.repaint();
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
            <SelectionMarquee ref={selectionMarqueeRef} selection={selection.current} />
          </svg>
        </div>
      </DndProvider>
    </>
  );
};

type Props = {
  diagram: LoadedDiagram;
};
