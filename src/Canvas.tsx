import { useCallback, useEffect, useRef } from 'react';
import { Drag, isResizeDrag, SelectionState } from './state.ts';
import { Node, NodeApi } from './Node.tsx';
import { Edge, EdgeApi } from './Edge.tsx';
import { Selection, SelectionApi } from './Selection.tsx';
import { Box, Point } from './geometry.ts';
import { LoadedDiagram, MoveAction, NodeDef, ResizeAction, RotateAction } from './model/diagram.ts';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { SelectionMarquee, SelectionMarqueeApi } from './SelectionMarquee.tsx';
import { selectionResize, selectionRotate } from './Selection.logic.ts';
import { assert } from './assert.ts';
import { useRedraw } from './useRedraw.tsx';
import { updatePendingElements } from './SelectionMarquee.logic.tsx';

const BACKGROUND = 'background';

type ObjectId = typeof BACKGROUND | string;

type DeferedMouseAction = {
  id: ObjectId;
  add?: boolean;
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
  const deferedMouseAction = useRef<DeferedMouseAction | null>(null);

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

  const updateCursor = useCallback(
    (coord: Point) => {
      if (Box.contains(selection.current, coord)) {
        svgRef.current!.style.cursor = 'move';
      } else {
        svgRef.current!.style.cursor = 'default';
      }
    },
    [svgRef]
  );

  const onDragStart = useCallback((coord: Point, type: Drag['type']) => {
    drag.current = { type, offset: coord };
  }, []);

  const onMouseDown = useCallback(
    (id: ObjectId, coord: Point, add: boolean) => {
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

        const localCoord = Point.subtract(coord, selection.current.pos);
        onDragStart(localCoord, 'move');
      } finally {
        selectionRef.current?.repaint();
      }
    },
    [onDragStart, updateCursor, diagram]
  );

  const onMouseUp = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_id: ObjectId, _coord: Point) => {
      try {
        if (drag.current) {
          let changed = false;
          for (let i = 0; i < selection.current.elements.length; i++) {
            const node = selection.current.elements[i];
            const original = selection.current.source.elements[i];

            if (!Box.equals(node.bounds, original)) {
              changed = true;
              break;
            }
          }

          if (changed) {
            if (drag.current?.type === 'move') {
              diagram.undoManager.add(
                new MoveAction(
                  selection.current.source.elements,
                  selection.current.elements.map(e => e.bounds),
                  selection.current.elements
                )
              );
              selection.current.rebaseline();
            } else if (drag.current?.type === 'rotate') {
              diagram.undoManager.add(
                new RotateAction(
                  selection.current.source.elements,
                  selection.current.elements.map(e => e.bounds),
                  selection.current.elements
                )
              );
              selection.current.rebaseline();
            } else if (isResizeDrag(drag.current)) {
              diagram.undoManager.add(
                new ResizeAction(
                  selection.current.source.elements,
                  selection.current.elements.map(e => e.bounds),
                  selection.current.elements
                )
              );
              selection.current.rebaseline();
            }
          }
        }

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
          selection.current.rotation = 0;
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
    (coord: Point) => {
      try {
        if (drag.current === undefined) return;
        deferedMouseAction.current = null;

        if (isResizeDrag(drag.current)) {
          assert.false(selection.current.isEmpty());
          return selectionResize(coord, selection.current, drag.current);
        } else if (drag.current?.type === 'rotate') {
          assert.false(selection.current.isEmpty());
          return selectionRotate(coord, selection.current);
        } else if (drag.current.type === 'move') {
          assert.false(selection.current.isEmpty());

          const d = Point.subtract(coord, Point.add(selection.current.pos, drag.current?.offset));

          for (const node of selection.current.elements) {
            const after = Box.snapshot(node.bounds);
            after.pos = Point.add(after.pos, d);
            NodeDef.transform(node, Box.snapshot(node.bounds), after);
          }

          selection.current.recalculateBoundingBox();
        } else if (drag.current.type === 'marquee') {
          selection.current.marquee = Box.normalize(
            Box.snapshot({
              pos: drag.current.offset,
              size: { w: coord.x - drag.current?.offset.x, h: coord.y - drag.current?.offset.y },
              rotation: 0
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
