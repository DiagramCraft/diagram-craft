import React, { forwardRef, SVGProps, useCallback, useImperativeHandle, useRef } from 'react';
import { Node, NodeApi } from '../react-canvas-viewer/Node.tsx';
import { Edge, EdgeApi } from '../react-canvas-viewer/Edge.tsx';
import { Selection, SelectionApi } from './Selection.tsx';
import { Box } from '../geometry/box.ts';
import { SelectionMarquee, SelectionMarqueeApi } from './SelectionMarquee.tsx';
import { debounce } from '../utils/debounce.ts';
import { Modifiers } from '../base-ui/drag.ts';
import { Grid } from './Grid.tsx';
import { useRedraw } from '../react-canvas-viewer/useRedraw.tsx';
import { executeAction } from '../base-ui/keyMap.ts';
import { Point } from '../geometry/point.ts';
import { DocumentBounds } from '../react-canvas-viewer/DocumentBounds.tsx';
import { propsUtils } from '../react-canvas-viewer/utils/propsUtils.ts';
import { SelectionStateEvents } from '../model-editor/selectionState.ts';
import { useDomEventListener, useEventListener } from '../react-app/hooks/useEventListener.ts';
import { useDragDrop } from '../react-canvas-viewer/DragDropManager.tsx';
import { MarqueeDrag } from './SelectionMarquee.logic.tsx';
import { MoveDrag } from '../base-ui/drag/moveDrag.ts';
import { useCanvasZoomAndPan } from '../react-canvas-viewer/useCanvasZoomAndPan.ts';
import { getPoint } from '../react-canvas-viewer/eventHelper.ts';
import { EventHelper } from '../base-ui/eventHelper.ts';
import { useDiagram } from '../react-app/context/DiagramContext.tsx';
import { useActions } from '../react-app/context/ActionsContext.tsx';

const BACKGROUND = 'background';

type ObjectId = typeof BACKGROUND | string;

type DeferedMouseAction = {
  callback: () => void;
};

export const EditableCanvas = forwardRef<SVGSVGElement, Props>((props, ref) => {
  const redraw = useRedraw();

  const diagram = useDiagram();
  const { actionMap, keyMap } = useActions();

  // State
  const selection = diagram.selectionState;
  const deferedMouseAction = useRef<DeferedMouseAction | undefined>(undefined);

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

  useCanvasZoomAndPan(diagram, svgRef);

  useDomEventListener('keydown', e => executeAction(e, {}, keyMap, actionMap), document);

  const clearSelection = debounce(() => selection.clear());

  useEventListener(diagram.undoManager, 'execute', clearSelection);
  useEventListener(diagram.undoManager, 'undo', clearSelection);
  useEventListener(diagram.undoManager, 'redo', clearSelection);

  useEventListener(diagram, 'nodechanged', e => {
    nodeRefs.current[e.after.id]?.repaint();

    for (const edge of e.after.listEdges(true)) {
      edgeRefs.current[edge.id]?.repaint();
    }
  });
  useEventListener(diagram, 'edgechanged', e => {
    edgeRefs.current[e.after.id]?.repaint();
  });
  useEventListener(diagram, 'nodeadded', redraw);
  useEventListener(diagram, 'noderemoved', redraw);
  useEventListener(diagram, 'edgeadded', redraw);
  useEventListener(diagram, 'edgeremoved', redraw);
  useEventListener(diagram, 'canvaschanged', redraw);

  const redrawElement = (e: SelectionStateEvents['add'] | SelectionStateEvents['remove']) => {
    if (e.element.type === 'node') {
      nodeRefs.current[e.element.id]?.repaint();
    } else {
      edgeRefs.current[e.element.id]?.repaint();
    }
  };

  // TODO: This part we could move to Selection and SelectionMarquee without
  //       loosing any performance
  useEventListener(
    selection,
    'change',
    debounce(() => {
      selectionRef.current?.repaint();
    })
  );
  useEventListener(
    selection.marquee,
    'change',
    debounce(() => selectionMarqueeRef.current?.repaint())
  );

  // This needs to stay in heter for performance reasons
  useEventListener(selection, 'add', redrawElement);
  useEventListener(selection, 'remove', redrawElement);

  const onMouseEnter = useCallback((id: string) => drag.currentDrag()?.onDragEnter?.(id), [drag]);

  const onMouseLeave = useCallback(() => {
    drag.currentDrag()?.onDragLeave?.();
  }, [drag]);

  // TODO: Updating the cursor is not really working
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
          drag.initiateDrag(new MarqueeDrag(diagram, diagram.viewBox.toDiagramPoint(point)));
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
              diagram,
              Point.subtract(diagram.viewBox.toDiagramPoint(point), selection.bounds.pos)
            )
          );
        }
      } finally {
        updateCursor(diagram.viewBox.toDiagramPoint(point));
      }
    },
    [selection, diagram, drag, updateCursor]
  );

  const onMouseUp = useCallback(
    (point: Point) => {
      const current = drag.currentDrag();
      try {
        if (current) {
          current.onDragEnd();
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
    [diagram, drag, updateCursor]
  );

  const onMouseMove = useCallback(
    (point: Point, modifiers: Modifiers) => {
      const current = drag.currentDrag();

      try {
        // Abort early in case there's no drag in progress
        if (!current) return;

        current.onDrag(diagram.viewBox.toDiagramPoint(point), modifiers);
      } finally {
        deferedMouseAction.current = undefined;
        updateCursor(diagram.viewBox.toDiagramPoint(point));
      }
    },
    [diagram, drag, updateCursor]
  );

  return (
    <svg
      ref={svgRef}
      {...propsUtils.except(props)}
      preserveAspectRatio="none"
      viewBox={diagram.viewBox.svgViewboxString}
      onMouseDown={e => {
        if (e.button !== 0) return;
        onMouseDown(BACKGROUND, EventHelper.point(e.nativeEvent), e.nativeEvent);
      }}
      style={{ userSelect: 'none' }}
      onMouseUp={e => onMouseUp(EventHelper.point(e.nativeEvent))}
      onMouseMove={e => {
        onMouseMove(getPoint(e, diagram), e.nativeEvent);
      }}
      onContextMenu={event => {
        const e = event as ContextMenuEvent & React.MouseEvent<SVGSVGElement, MouseEvent>;

        const bounds = svgRef.current!.getBoundingClientRect();
        const point = { x: e.nativeEvent.clientX - bounds.x, y: e.nativeEvent.clientY - bounds.y };

        const isClickOnSelection = Box.contains(
          selection.bounds,
          diagram.viewBox.toDiagramPoint(point)
        );

        e.contextMenuTarget ??= {
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

      <Selection ref={selectionRef} selection={selection} diagram={diagram} />
      <SelectionMarquee ref={selectionMarqueeRef} selection={selection} />
    </svg>
  );
});

type Props = {
  onContextMenu: (event: ContextMenuEvent & React.MouseEvent<SVGSVGElement, MouseEvent>) => void;
} & Omit<
  SVGProps<SVGSVGElement>,
  'viewBox' | 'onMouseDown' | 'onMouseUp' | 'onMouseMove' | 'onContextMenu' | 'preserveAspectRatio'
>;

export type ContextMenuTarget = { pos: Point } & (
  | {
      type: 'canvas';
    }
  | {
      type: 'edge';
      id: string;
    }
  | {
      type: 'selection';
    }
);

export type ContextMenuEvent = {
  contextMenuTarget: ContextMenuTarget;
};
