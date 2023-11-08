import { useCallback, useEffect, useRef } from 'react';
import { SelectionState } from '../model/selectionState.ts';
import { Node, NodeApi } from './Node.tsx';
import { Edge, EdgeApi } from './Edge.tsx';
import { Selection, SelectionApi } from './Selection.tsx';
import { Box, Point } from '../geometry/geometry.ts';
import { LoadedDiagram, NodeDef } from '../model/diagram.ts';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { SelectionMarquee, SelectionMarqueeApi } from './SelectionMarquee.tsx';
import { useRedraw } from './useRedraw.tsx';
import { debounce } from '../utils/debounce.ts';
import { marqueeDragActions } from './SelectionMarquee.logic.tsx';
import { moveDragActions } from './Selection.logic.ts';
import { Drag, DragActions } from './drag.ts';

const BACKGROUND = 'background';

type ObjectId = typeof BACKGROUND | string;

type DeferedMouseAction = {
  callback: () => void;
};

export const Canvas = (props: Props) => {
  const redraw = useRedraw();
  const diagram = props.diagram;

  const svgRef = useRef<SVGSVGElement>(null);
  const selection = useRef<SelectionState>(new SelectionState());
  const drag = useRef<Drag | undefined>(undefined);
  const nodeRefs = useRef<Record<string, NodeApi | null>>({});
  const edgeRefs = useRef<Record<string, EdgeApi | null>>({});
  const selectionRef = useRef<SelectionApi | null>(null);
  const selectionMarqueeRef = useRef<SelectionMarqueeApi | null>(null);
  const deferedMouseAction = useRef<DeferedMouseAction | undefined>(undefined);

  // TODO: Ideally we should not need this once we have events for all updates in the diagram
  useEffect(() => {
    const callback = () => {
      selection.current.clear();
      redraw();
    };
    diagram.undoManager.on('*', callback);
    return () => {
      diagram.undoManager.off('*', callback);
    };
  }, [diagram, redraw]);

  useEffect(() => {
    const callback = debounce(() => {
      selectionRef.current?.repaint();
      selectionMarqueeRef.current?.repaint();
    });
    const sel = selection.current;
    sel.on('change', callback);
    return () => {
      sel.off('change', callback);
    };
  }, []);

  const updateCursor = useCallback(
    (coord: Point) => {
      if (Box.contains(selection.current.bounds, coord)) {
        svgRef.current!.style.cursor = 'move';
      } else {
        svgRef.current!.style.cursor = 'default';
      }
    },
    [svgRef]
  );

  const onDragStart = useCallback((point: Point, type: Drag['type'], actions: DragActions) => {
    drag.current = { type, offset: point, actions };
  }, []);

  const onMouseDown = useCallback(
    (id: ObjectId, point: Point, add: boolean) => {
      const isClickOnBackground = id === BACKGROUND;
      const isClickOnSelection = Box.contains(selection.current.bounds, point);

      try {
        if (add) {
          if (!isClickOnBackground) {
            selection.current.toggle(diagram.nodeLookup[id]);
          }
        } else {
          if (isClickOnSelection) {
            deferedMouseAction.current = {
              callback: () => {
                if (id === BACKGROUND) {
                  selection.current.clear();
                } else {
                  selection.current.clear();
                  selection.current.toggle(diagram.nodeLookup[id]);
                }
              }
            };
          } else {
            if (isClickOnBackground) {
              selection.current.clear();
              onDragStart(point, 'marquee', marqueeDragActions);
              return;
            } else {
              selection.current.clear();
              selection.current.toggle(diagram.nodeLookup[id]);
            }
          }
        }

        if (!selection.current.isEmpty()) {
          onDragStart(Point.subtract(point, selection.current.bounds.pos), 'move', moveDragActions);
        }
      } finally {
        updateCursor(point);
      }
    },
    [onDragStart, diagram, updateCursor]
  );

  const onMouseUp = useCallback(
    (_id: ObjectId, point: Point) => {
      try {
        if (drag.current) {
          drag.current.actions.onDragEnd(point, drag.current, diagram, selection.current);
        }

        if (deferedMouseAction.current) {
          deferedMouseAction.current?.callback();
        }
      } finally {
        drag.current = undefined;
        deferedMouseAction.current = undefined;

        updateCursor(point);
      }
    },
    [diagram, updateCursor]
  );

  const onMouseMove = useCallback(
    (point: Point) => {
      // Abort early in case there's no drag in progress
      if (!drag.current) return;

      try {
        drag.current.actions.onDrag(point, drag.current, diagram, selection.current);
      } finally {
        deferedMouseAction.current = undefined;

        for (const node of selection.current.elements) {
          nodeRefs.current[node.id]?.repaint();

          for (const edge of NodeDef.edges(node)) {
            edgeRefs.current[edge.id]?.repaint();
          }
        }

        updateCursor(point);
      }
    },
    [updateCursor, diagram]
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
            onMouseDown={e => onMouseDown(BACKGROUND, Point.fromEvent(e.nativeEvent), e.shiftKey)}
            onMouseUp={e => onMouseUp(BACKGROUND, Point.fromEvent(e.nativeEvent))}
            onMouseMove={e => onMouseMove(Point.fromEvent(e.nativeEvent))}
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
