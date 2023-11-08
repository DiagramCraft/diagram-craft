import { useCallback, useEffect, useRef } from 'react';
import { Drag, ResizeDrag, SelectionState } from './state.ts';
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

type DragActions = {
  onDrag: (coord: Point, drag: Drag, diagram: LoadedDiagram, selection: SelectionState) => void;
  onDragEnd: (coord: Point, drag: Drag, diagram: LoadedDiagram, selection: SelectionState) => void;
};

const resizeDragActions: DragActions = {
  onDrag: (coord: Point, drag: Drag, _diagram: LoadedDiagram, selection: SelectionState) => {
    assert.false(selection.isEmpty());
    return selectionResize(coord, selection, drag as ResizeDrag);
  },
  onDragEnd: (_coord: Point, _drag: Drag, diagram: LoadedDiagram, selection: SelectionState) => {
    if (selection.isChanged()) {
      diagram.undoManager.add(
        new ResizeAction(
          selection.source.elements,
          selection.elements.map(e => e.bounds),
          selection.elements
        )
      );
      selection.rebaseline();
    }
  }
};

const dragActions: Record<Partial<Drag['type']>, DragActions> = {
  move: {
    onDrag: (coord: Point, drag: Drag, _diagram: LoadedDiagram, selection: SelectionState) => {
      assert.false(selection.isEmpty());

      const d = Point.subtract(coord, Point.add(selection.bounds.pos, drag.offset));

      for (const node of selection.elements) {
        const after = node.bounds;
        NodeDef.transform(node, node.bounds, {
          ...after,
          pos: Point.add(after.pos, d)
        });
      }

      selection.recalculateBoundingBox();
    },
    onDragEnd: (_coord: Point, _drag: Drag, diagram: LoadedDiagram, selection: SelectionState) => {
      if (selection.isChanged()) {
        diagram.undoManager.add(
          new MoveAction(
            selection.source.elements,
            selection.elements.map(e => e.bounds),
            selection.elements
          )
        );
        selection.rebaseline();
      }
    }
  },
  rotate: {
    onDrag: (coord: Point, _drag: Drag, _diagram: LoadedDiagram, selection: SelectionState) => {
      assert.false(selection.isEmpty());
      return selectionRotate(coord, selection);
    },
    onDragEnd: (_coord: Point, _drag: Drag, diagram: LoadedDiagram, selection: SelectionState) => {
      if (selection.isChanged()) {
        diagram.undoManager.add(
          new RotateAction(
            selection.source.elements,
            selection.elements.map(e => e.bounds),
            selection.elements
          )
        );
        selection.rebaseline();
      }
    }
  },
  marquee: {
    onDrag: (coord: Point, drag: Drag, diagram: LoadedDiagram, selection: SelectionState) => {
      selection.marquee = Box.normalize({
        pos: drag.offset,
        size: { w: coord.x - drag.offset.x, h: coord.y - drag.offset.y },
        rotation: 0
      });

      updatePendingElements(selection, diagram);
    },
    onDragEnd: (_coord: Point, _drag: Drag, _diagram: LoadedDiagram, selection: SelectionState) => {
      if (selection.pendingElements) {
        selection.convertMarqueeToSelection();
      }
    }
  },
  'resize-se': resizeDragActions,
  'resize-sw': resizeDragActions,
  'resize-nw': resizeDragActions,
  'resize-ne': resizeDragActions,
  'resize-n': resizeDragActions,
  'resize-s': resizeDragActions,
  'resize-w': resizeDragActions,
  'resize-e': resizeDragActions
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
      if (Box.contains(selection.current.bounds, coord)) {
        svgRef.current!.style.cursor = 'move';
      } else {
        svgRef.current!.style.cursor = 'default';
      }
    },
    [svgRef]
  );

  const repaintSelection = useCallback(
    (coord: Point) => {
      updateCursor(coord);

      selectionRef.current?.repaint();
      selectionMarqueeRef.current?.repaint();
    },
    [updateCursor]
  );

  const onDragStart = useCallback((point: Point, type: Drag['type']) => {
    drag.current = { type, offset: point };
  }, []);

  const onMouseDown = useCallback(
    (id: ObjectId, coord: Point, add: boolean) => {
      const isClickOnBackground = id === BACKGROUND;
      const isClickOnSelection = Box.contains(selection.current.bounds, coord);

      try {
        if (add) {
          if (!isClickOnBackground) {
            selection.current.toggle(diagram.nodeLookup[id]);
          }
        } else {
          if (isClickOnSelection) {
            deferedMouseAction.current = { id };
          } else {
            if (isClickOnBackground) {
              selection.current.clear();
              onDragStart(coord, 'marquee');
              return;
            } else {
              selection.current.clear();
              selection.current.toggle(diagram.nodeLookup[id]);
            }
          }
        }

        if (!selection.current.isEmpty()) {
          onDragStart(Point.subtract(coord, selection.current.bounds.pos), 'move');
        }
      } finally {
        repaintSelection(coord);
      }
    },
    [onDragStart, diagram, repaintSelection]
  );

  const onMouseUp = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_id: ObjectId, coord: Point) => {
      try {
        if (drag.current) {
          dragActions[drag.current.type].onDragEnd(coord, drag.current, diagram, selection.current);
        }

        if (deferedMouseAction.current) {
          if (deferedMouseAction.current.id === BACKGROUND) {
            selection.current.clear();
          } else {
            selection.current.clear();
            selection.current.toggle(diagram.nodeLookup[deferedMouseAction.current.id]);
          }
        }
      } finally {
        drag.current = undefined;
        deferedMouseAction.current = null;

        repaintSelection(coord);
      }
    },
    [diagram, repaintSelection]
  );

  const onMouseMove = useCallback(
    (coord: Point) => {
      // Abort early in case there's no drag in progress
      if (!drag.current) return;

      try {
        dragActions[drag.current.type].onDrag(coord, drag.current, diagram, selection.current);
      } finally {
        deferedMouseAction.current = null;

        for (const node of selection.current.elements) {
          nodeRefs.current[node.id]?.repaint();

          for (const edge of NodeDef.edges(node)) {
            edgeRefs.current[edge.id]?.repaint();
          }
        }

        repaintSelection(coord);
      }
    },
    [repaintSelection, diagram]
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
