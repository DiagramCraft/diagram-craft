import React, {
  forwardRef,
  SVGProps,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef
} from 'react';
import { Node, NodeApi } from './Node.tsx';
import { Edge, EdgeApi } from './Edge.tsx';
import { Selection, SelectionApi } from './Selection.tsx';
import { Box } from '../geometry/box.ts';
import { DiagramEvents } from '../model-viewer/diagram.ts';
import { SelectionMarquee, SelectionMarqueeApi } from './SelectionMarquee.tsx';
import { debounce } from '../utils/debounce.ts';
import { marqueeDragActions } from './SelectionMarquee.logic.tsx';
import { moveDragActions } from './Selection.logic.ts';
import { Drag, DragActions, Modifiers } from './drag.ts';
import { Grid } from './Grid.tsx';
import { useRedraw } from './useRedraw.tsx';
import { executeAction, KeyMap } from './keyMap.ts';
import { Point } from '../geometry/point.ts';
import { DocumentBounds } from './DocumentBounds.tsx';
import { ViewboxEvents } from '../model-viewer/viewBox.ts';
import { EditableDiagram } from '../model-editor/editable-diagram.ts';
import { propsUtils } from './propsUtils.ts';

const BACKGROUND = 'background';

type ObjectId = typeof BACKGROUND | string;

type DeferedMouseAction = {
  callback: () => void;
};

export const Canvas = forwardRef<SVGSVGElement, Props>((props, ref) => {
  const redraw = useRedraw();

  const diagram = props.diagram;

  // State
  const selection = diagram.selectionState;
  const deferedMouseAction = useRef<DeferedMouseAction | undefined>(undefined);
  const drag = useRef<Drag | undefined>(undefined);

  // Component/node refs
  const svgRef = useRef<SVGSVGElement>(null);
  const nodeRefs = useRef<Record<string, NodeApi | null>>({});
  const edgeRefs = useRef<Record<string, EdgeApi | null>>({});
  const selectionRef = useRef<SelectionApi | null>(null);
  const selectionMarqueeRef = useRef<SelectionMarqueeApi | null>(null);

  useImperativeHandle(ref, () => {
    return svgRef.current!;
  });

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
          x: Math.floor(
            -(svgRef.current!.getBoundingClientRect().width - diagram.canvas.size.w) / 2
          ),
          y: Math.floor(
            -(svgRef.current!.getBoundingClientRect().height - diagram.canvas.size.h) / 2
          )
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
      executeAction(e, props.keyMap, props.actionMap);
    };
    document.addEventListener('keydown', listener);
    return () => {
      document.removeEventListener('keydown', listener);
    };
  }, [props.diagram]);

  useEffect(() => {
    const nodeChanged = (e: DiagramEvents['nodechanged']) => {
      nodeRefs.current[e.after.id]?.repaint();

      for (const edge of e.after.listEdges(true)) {
        edgeRefs.current[edge.id]?.repaint();
      }
    };

    const edgeChanged = (e: DiagramEvents['edgechanged']) => {
      edgeRefs.current[e.after.id]?.repaint();
    };

    const triggerRedraw = () => {
      redraw();
    };

    const onUndo = debounce(() => {
      selection.clear();
    });

    diagram.undoManager.on('execute', onUndo);
    diagram.undoManager.on('undo', onUndo);
    diagram.undoManager.on('redo', onUndo);
    diagram.on('nodechanged', nodeChanged);
    diagram.on('nodeadded', triggerRedraw);
    diagram.on('noderemoved', triggerRedraw);
    diagram.on('edgechanged', edgeChanged);
    diagram.on('canvaschanged', triggerRedraw);

    return () => {
      diagram.undoManager.off('execute', onUndo);
      diagram.undoManager.off('undo', onUndo);
      diagram.undoManager.off('redo', onUndo);
      diagram.off('nodechanged', nodeChanged);
      diagram.off('nodeadded', triggerRedraw);
      diagram.off('noderemoved', triggerRedraw);
      diagram.off('edgechanged', edgeChanged);
      diagram.off('canvaschanged', triggerRedraw);
    };
  }, [diagram, redraw]);

  useEffect(() => {
    const callback = debounce(() => {
      selectionRef.current?.repaint();
      selectionMarqueeRef.current?.repaint();
    });
    const sel = selection;
    sel.on('change', callback);
    return () => {
      sel.off('change', callback);
    };
  }, []);

  const onMouseEnter = useCallback((id: string) => {
    if (drag.current) drag.current.hoverElement = id;
  }, []);

  const onMouseLeave = useCallback((_id: string) => {
    if (drag.current) drag.current.hoverElement = undefined;
  }, []);

  const updateCursor = useCallback(
    (coord: Point) => {
      if (Box.contains(selection.bounds, coord)) {
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
        selection.bounds,
        diagram.viewBox.toDiagramPoint(point)
      );

      try {
        if (isClickOnSelection) {
          deferedMouseAction.current = {
            callback: () => {
              selection.clear();
              if (!isClickOnBackground) {
                selection.toggle(diagram.nodeLookup[id] ?? diagram.edgeLookup[id]);
              }
            }
          };
        } else if (isClickOnBackground) {
          if (!modifiers.shiftKey) {
            selection.clear();
          }
          onDragStart(diagram.viewBox.toDiagramPoint(point), 'marquee', marqueeDragActions);
          return;
        } else {
          if (!modifiers.shiftKey) {
            selection.clear();
          }
          selection.toggle(diagram.nodeLookup[id] ?? diagram.edgeLookup[id]);
        }

        if (!selection.isEmpty()) {
          onDragStart(
            Point.subtract(diagram.viewBox.toDiagramPoint(point), selection.bounds.pos),
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
          drag.current.actions.onDragEnd(point, drag.current, diagram, selection);
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
          selection,
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
    <svg
      ref={svgRef}
      {...propsUtils.except(props, 'actionMap', 'keyMap', 'diagram')}
      preserveAspectRatio="none"
      viewBox={diagram.viewBox.svgViewboxString}
      onMouseDown={e => {
        if (e.button !== 0) return;
        onMouseDown(BACKGROUND, Point.fromEvent(e.nativeEvent), e.nativeEvent);
      }}
      onMouseUp={e => onMouseUp(BACKGROUND, Point.fromEvent(e.nativeEvent))}
      onMouseMove={e => onMouseMove(Point.fromEvent(e.nativeEvent), e.nativeEvent)}
      onContextMenu={event => {
        const e = event as ContextMenuEvent & React.MouseEvent<SVGSVGElement, MouseEvent>;

        const point = {
          x: event.nativeEvent.offsetX,
          y: event.nativeEvent.offsetY
        };

        const isClickOnSelection = Box.contains(
          selection.bounds,
          diagram.viewBox.toDiagramPoint(point)
        );

        e.contextMenuTarget = {
          type: isClickOnSelection ? 'selection' : 'canvas',
          pos: diagram.viewBox.toDiagramPoint(point)
        };
        props.onContextMenu?.(e);
      }}
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
              onMouseDown={onMouseDown}
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}
              def={edge}
            />
          );
        } else {
          const node = diagram.nodeLookup[id]!;
          return (
            <Node
              key={id}
              ref={(element: NodeApi) => (nodeRefs.current[id] = element)}
              onMouseDown={onMouseDown}
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}
              def={node}
            />
          );
        }
      })}

      <Selection
        ref={selectionRef}
        selection={selection}
        onDragStart={(point, type, actions) =>
          onDragStart(diagram.viewBox.toDiagramPoint(point), type, actions)
        }
      />
      <SelectionMarquee ref={selectionMarqueeRef} selection={selection} />
    </svg>
  );
});

type Props = {
  // TODO: We should split Canvas and EditableCanvas somehow
  diagram: EditableDiagram;

  onContextMenu: (event: ContextMenuEvent & React.MouseEvent<SVGSVGElement, MouseEvent>) => void;

  actionMap: Partial<ActionMap>;
  keyMap: KeyMap;
} & Omit<
  SVGProps<SVGSVGElement>,
  'viewBox' | 'onMouseDown' | 'onMouseUp' | 'onMouseMove' | 'onContextMenu' | 'preserveAspectRatio'
>;

export type ContextMenuTarget = { pos: Point } & (
  | {
      type: 'canvas';
    }
  | {
      type: 'selection';
    }
);
type ContextMenuEvent = {
  contextMenuTarget: ContextMenuTarget;
};
