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
import { SelectionMarquee, SelectionMarqueeApi } from './SelectionMarquee.tsx';
import { debounce } from '../utils/debounce.ts';
import { Modifiers } from './drag.ts';
import { Grid } from './Grid.tsx';
import { useRedraw } from './useRedraw.tsx';
import { executeAction, KeyMap } from './keyMap.ts';
import { Point } from '../geometry/point.ts';
import { DocumentBounds } from './DocumentBounds.tsx';
import { ViewboxEvents } from '../model-viewer/viewBox.ts';
import { EditableDiagram } from '../model-editor/editable-diagram.ts';
import { propsUtils } from './propsUtils.ts';
import { SelectionStateEvents } from '../model-editor/selectionState.ts';
import { MoveDrag } from './Selection.logic.ts';
import { useDomEventListener, useEventListener } from '../app/hooks/useEventListener.ts';
import { useDragDrop } from './DragDropManager.tsx';
import { MarqueeDrag } from './SelectionMarquee.logic.tsx';

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
  //const drag = useRef<Drag | undefined>(undefined);

  const drag = useDragDrop();

  // Component/node refs
  const svgRef = useRef<SVGSVGElement>(null);
  const nodeRefs = useRef<Record<string, NodeApi | null>>({});
  const edgeRefs = useRef<Record<string, EdgeApi | null>>({});
  const selectionRef = useRef<SelectionApi | null>(null);
  const selectionMarqueeRef = useRef<SelectionMarqueeApi | null>(null);

  useImperativeHandle(ref, () => {
    return svgRef.current!;
  });

  useEventListener(
    'viewbox',
    ({ viewbox }: ViewboxEvents['viewbox']) => {
      svgRef.current!.setAttribute('viewBox', viewbox.svgViewboxString);
    },
    diagram.viewBox
  );

  useDomEventListener(
    'wheel',
    e => {
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
    },
    svgRef
  );

  const adjustViewbox = () => {
    // TODO: Respect zoom level
    if (diagram.viewBox.zoomLevel === 1) {
      diagram.viewBox.pan({
        x: Math.floor(-(svgRef.current!.getBoundingClientRect().width - diagram.canvas.size.w) / 2),
        y: Math.floor(-(svgRef.current!.getBoundingClientRect().height - diagram.canvas.size.h) / 2)
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

  useDomEventListener('resize', adjustViewbox, window);

  useEffect(() => {
    if (svgRef.current) adjustViewbox();
  }, [adjustViewbox]);

  useDomEventListener(
    'keydown',
    e => {
      executeAction(e, props.keyMap, props.actionMap);
    },
    document
  );

  const clearSelection = debounce(() => {
    selection.clear();
  });

  useEventListener('execute', clearSelection, diagram.undoManager);
  useEventListener('undo', clearSelection, diagram.undoManager);
  useEventListener('redo', clearSelection, diagram.undoManager);

  useEventListener(
    'nodechanged',
    e => {
      nodeRefs.current[e.after.id]?.repaint();

      for (const edge of e.after.listEdges(true)) {
        edgeRefs.current[edge.id]?.repaint();
      }
    },
    diagram
  );
  useEventListener(
    'edgechanged',
    e => {
      edgeRefs.current[e.after.id]?.repaint();
    },
    diagram
  );
  useEventListener('nodeadded', redraw, diagram);
  useEventListener('noderemoved', redraw, diagram);
  useEventListener('canvaschanged', redraw, diagram);

  const redrawElement = (e: SelectionStateEvents['add'] | SelectionStateEvents['remove']) => {
    if (e.element.type === 'node') {
      nodeRefs.current[e.element.id]?.repaint();
    } else {
      edgeRefs.current[e.element.id]?.repaint();
    }
  };

  useEventListener(
    'change',
    debounce(() => {
      selectionRef.current?.repaint();
      selectionMarqueeRef.current?.repaint();
    }),
    selection
  );
  useEventListener('add', redrawElement, selection);
  useEventListener('remove', redrawElement, selection);

  const onMouseEnter = useCallback(
    (id: string) => {
      drag.currentDrag()?.onDragEnter?.(id);
    },
    [drag]
  );

  const onMouseLeave = useCallback(() => {
    drag.currentDrag()?.onDragLeave?.();
  }, [drag]);

  const updateCursor = useCallback(
    (coord: Point) => {
      if (Box.contains(selection.bounds, coord)) {
        svgRef.current!.style.cursor = 'move';
      } else {
        svgRef.current!.style.cursor = 'default';
      }
    },
    [selection.bounds]
  );

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
          drag.initiateDrag(new MarqueeDrag(diagram.viewBox.toDiagramPoint(point)));
          return;
        } else {
          if (!modifiers.shiftKey) {
            selection.clear();
          }
          selection.toggle(diagram.nodeLookup[id] ?? diagram.edgeLookup[id]);
        }

        if (!selection.isEmpty()) {
          drag.initiateDrag(
            new MoveDrag(
              Point.subtract(diagram.viewBox.toDiagramPoint(point), selection.bounds.pos)
            )
          );
        }
      } finally {
        updateCursor(diagram.viewBox.toDiagramPoint(point));
      }
    },
    [selection, diagram.viewBox, diagram.nodeLookup, diagram.edgeLookup, drag, updateCursor]
  );

  const onMouseUp = useCallback(
    (_id: ObjectId, point: Point) => {
      const current = drag.currentDrag();
      try {
        if (current) {
          current.onDragEnd(point, diagram);
        }

        if (deferedMouseAction.current) {
          deferedMouseAction.current?.callback();
        }
      } finally {
        drag.clearDrag();
        deferedMouseAction.current = undefined;

        updateCursor(point);
      }
    },
    [diagram, drag, selection, updateCursor]
  );

  const onMouseMove = useCallback(
    (point: Point, modifiers: Modifiers) => {
      const current = drag.currentDrag();

      // Abort early in case there's no drag in progress
      if (!current) return;

      try {
        current.onDrag(diagram.viewBox.toDiagramPoint(point), diagram, modifiers);
      } finally {
        deferedMouseAction.current = undefined;
        updateCursor(point);
      }
    },
    [diagram, drag, selection, updateCursor]
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
        const point = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };

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
              diagram={diagram}
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
              diagram={diagram}
            />
          );
        }
      })}

      <Selection ref={selectionRef} selection={selection} />
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
