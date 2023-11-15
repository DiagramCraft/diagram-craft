import { useCallback, useEffect, useRef } from 'react';
import { SelectionState } from '../model-editor/selectionState.ts';
import { Node, NodeApi } from './Node.tsx';
import { Edge, EdgeApi } from './Edge.tsx';
import { Selection, SelectionApi } from './Selection.tsx';
import { Box } from '../geometry/box.ts';
import { Diagram, DiagramEvents, NodeHelper, ViewboxEvents } from '../model-viewer/diagram.ts';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { SelectionMarquee, SelectionMarqueeApi } from './SelectionMarquee.tsx';
import { debounce } from '../utils/debounce.ts';
import { marqueeDragActions } from './SelectionMarquee.logic.tsx';
import { moveDragActions } from './Selection.logic.ts';
import { Drag, DragActions, Modifiers } from './drag.ts';
import { Grid } from './Grid.tsx';
import { useRedraw } from './useRedraw.tsx';
import { findAction, MacKeymap } from './keyMap.ts';
import { Point } from '../geometry/point.ts';
import { DocumentBounds } from './DocumentBounds.tsx';

const BACKGROUND = 'background';

type ObjectId = typeof BACKGROUND | string;

type DeferedMouseAction = {
  callback: () => void;
};

export const Canvas = (props: Props) => {
  const redraw = useRedraw();

  const diagram = props.diagram;

  // State
  const selection = useRef<SelectionState>(new SelectionState());
  const deferedMouseAction = useRef<DeferedMouseAction | undefined>(undefined);
  const drag = useRef<Drag | undefined>(undefined);

  // Component/node refs
  const svgRef = useRef<SVGSVGElement>(null);
  const nodeRefs = useRef<Record<string, NodeApi | null>>({});
  const edgeRefs = useRef<Record<string, EdgeApi | null>>({});
  const selectionRef = useRef<SelectionApi | null>(null);
  const selectionMarqueeRef = useRef<SelectionMarqueeApi | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    // TODO: Add listeners for middle button pan

    const wheelEventHandler = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey) {
        const delta = e.deltaY ?? e.detail ?? 0;
        const normalized = -(delta % 3 ? delta * 10 : delta / 3);
        diagram.viewBox.zoom(Point.fromEvent(e), normalized > 0 ? 1 / 1.008 : 1.008);
      } else {
        diagram.viewBox.pan({
          x: diagram.viewBox.offset.x + e.deltaX * 0.7,
          y: diagram.viewBox.offset.y + e.deltaY * 0.7
        });
      }
    };

    const viewboxEventHandler = ({ viewbox }: ViewboxEvents['viewbox']) => {
      svgRef.current!.setAttribute('viewBox', viewbox.svgViewboxString);
    };

    diagram.viewBox.on('viewbox', viewboxEventHandler);
    svgRef.current.addEventListener('wheel', wheelEventHandler);

    return () => {
      diagram.viewBox.off('viewbox', viewboxEventHandler);
      svgRef.current?.removeEventListener('wheel', wheelEventHandler);
    };
  });

  useEffect(() => {
    if (!svgRef.current) return;

    const adjustViewbox = () => {
      // TODO: Respect zoom level
      if (diagram.viewBox.zoomLevel === 1) {
        diagram.viewBox.pan({
          x: Math.floor(-(svgRef.current!.getBoundingClientRect().width - diagram.size.w) / 2),
          y: Math.floor(-(svgRef.current!.getBoundingClientRect().height - diagram.size.h) / 2)
        });
      }
      diagram.viewBox.dimensions = {
        w: Math.floor(svgRef.current!.getBoundingClientRect().width * diagram.viewBox.zoomLevel),
        h: Math.floor(svgRef.current!.getBoundingClientRect().height * diagram.viewBox.zoomLevel)
      };
      diagram.viewBox.windowSize = {
        w: Math.floor(svgRef.current!.getBoundingClientRect().width),
        h: Math.floor(svgRef.current!.getBoundingClientRect().height)
      };
    };

    adjustViewbox();

    window.addEventListener('resize', adjustViewbox);
    return () => {
      window.removeEventListener('resize', adjustViewbox);
    };
  }, [diagram]);

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      const action = findAction(e, MacKeymap);
      action?.execute(props.diagram, selection.current, drag.current);
    };
    document.addEventListener('keydown', listener);
    return () => {
      document.removeEventListener('keydown', listener);
    };
  }, [props.diagram]);

  useEffect(() => {
    const nodeChanged = (e: DiagramEvents['nodechanged']) => {
      nodeRefs.current[e.after.id]?.repaint();

      for (const edge of NodeHelper.edges(e.after)) {
        edgeRefs.current[edge.id]?.repaint();
      }
    };

    const nodeAdded = () => {
      redraw();
    };

    const onUndo = debounce(() => {
      selection.current.clear();
    });

    diagram.undoManager.on('execute', onUndo);
    diagram.undoManager.on('undo', onUndo);
    diagram.undoManager.on('redo', onUndo);
    diagram.on('nodechanged', nodeChanged);
    diagram.on('nodeadded', nodeAdded);
    diagram.on('noderemoved', nodeAdded);

    return () => {
      diagram.off('nodechanged', nodeChanged);
      diagram.off('nodeadded', nodeAdded);
      diagram.off('noderemoved', nodeAdded);
      diagram.undoManager.off('execute', onUndo);
      diagram.undoManager.off('undo', onUndo);
      diagram.undoManager.off('redo', onUndo);
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
    (id: ObjectId, point: Point, modifiers: Modifiers) => {
      const isClickOnBackground = id === BACKGROUND;
      const isClickOnSelection = Box.contains(
        selection.current.bounds,
        diagram.viewBox.toDiagramPoint(point)
      );

      try {
        if (isClickOnSelection) {
          deferedMouseAction.current = {
            callback: () => {
              selection.current.clear();
              if (!isClickOnBackground) {
                selection.current.toggle(diagram.nodeLookup[id]);
              }
            }
          };
        } else if (isClickOnBackground) {
          if (!modifiers.shiftKey) {
            selection.current.clear();
          }
          onDragStart(diagram.viewBox.toDiagramPoint(point), 'marquee', marqueeDragActions);
          return;
        } else {
          if (!modifiers.shiftKey) {
            selection.current.clear();
          }
          selection.current.toggle(diagram.nodeLookup[id]);
        }

        if (!selection.current.isEmpty()) {
          onDragStart(
            Point.subtract(diagram.viewBox.toDiagramPoint(point), selection.current.bounds.pos),
            'move',
            moveDragActions
          );
        }
      } finally {
        updateCursor(diagram.viewBox.toDiagramPoint(point));
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
    (point: Point, modifiers: Modifiers) => {
      // Abort early in case there's no drag in progress
      if (!drag.current) return;

      try {
        drag.current.actions.onDrag(
          diagram.viewBox.toDiagramPoint(point),
          drag.current,
          diagram,
          selection.current,
          modifiers
        );
      } finally {
        deferedMouseAction.current = undefined;
        updateCursor(point);
      }
    },
    [updateCursor, diagram]
  );

  return (
    <>
      <DndProvider backend={HTML5Backend}>
        <svg
          ref={svgRef}
          preserveAspectRatio="none"
          viewBox={diagram.viewBox.svgViewboxString}
          onMouseDown={e => onMouseDown(BACKGROUND, Point.fromEvent(e.nativeEvent), e.nativeEvent)}
          onMouseUp={e => onMouseUp(BACKGROUND, Point.fromEvent(e.nativeEvent))}
          onMouseMove={e => onMouseMove(Point.fromEvent(e.nativeEvent), e.nativeEvent)}
        >
          <DocumentBounds diagram={diagram} />
          <Grid diagram={diagram} />

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

          <Selection
            ref={selectionRef}
            selection={selection.current}
            onDragStart={(point, type, actions) =>
              onDragStart(diagram.viewBox.toDiagramPoint(point), type, actions)
            }
          />
          <SelectionMarquee ref={selectionMarqueeRef} selection={selection.current} />
        </svg>
      </DndProvider>
    </>
  );
};

type Props = {
  diagram: Diagram;
};
