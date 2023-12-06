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
import { executeAction, KeyMap } from '../base-ui/keyMap.ts';
import { Point } from '../geometry/point.ts';
import { DocumentBounds } from '../react-canvas-viewer/DocumentBounds.tsx';
import { EditableDiagram } from '../model-editor/editable-diagram.ts';
import { propsUtils } from '../react-canvas-viewer/utils/propsUtils.ts';
import { SelectionStateEvents } from '../model-editor/selectionState.ts';
import { useDomEventListener, useEventListener } from '../react-app/hooks/useEventListener.ts';
import { useDragDrop } from '../react-canvas-viewer/DragDropManager.tsx';
import { MarqueeDrag } from './SelectionMarquee.logic.tsx';
import { MoveDrag } from '../base-ui/drag/moveDrag.ts';
import { useCanvasZoomAndPan } from '../react-canvas-viewer/useCanvasZoomAndPan.ts';
import { getPoint } from '../react-canvas-viewer/eventHelper.ts';
import { EventHelper } from '../base-ui/eventHelper.ts';

const BACKGROUND = 'background';

type ObjectId = typeof BACKGROUND | string;

type DeferedMouseAction = {
  callback: () => void;
};

export const EditableCanvas = forwardRef<SVGSVGElement, Props>((props, ref) => {
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

  useCanvasZoomAndPan(diagram, svgRef);

  useDomEventListener(
    'keydown',
    e => {
      executeAction(e, {}, props.keyMap, props.actionMap);
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
          current.onDragEnd(diagram.viewBox.toDiagramPoint(point), diagram);
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

      // Abort early in case there's no drag in progress
      if (!current) return;

      try {
        current.onDrag(diagram.viewBox.toDiagramPoint(point), diagram, modifiers);
      } finally {
        deferedMouseAction.current = undefined;
        updateCursor(point);
      }
    },
    [diagram, drag, updateCursor]
  );

  return (
    <svg
      ref={svgRef}
      {...propsUtils.except(props, 'actionMap', 'keyMap', 'diagram')}
      preserveAspectRatio="none"
      viewBox={diagram.viewBox.svgViewboxString}
      onMouseDown={e => {
        if (e.button !== 0) return;
        onMouseDown(BACKGROUND, EventHelper.point(e.nativeEvent), e.nativeEvent);
      }}
      onMouseUp={e => onMouseUp(BACKGROUND, EventHelper.point(e.nativeEvent))}
      onMouseMove={e => {
        onMouseMove(getPoint(e, diagram), e.nativeEvent);
      }}
      onContextMenu={event => {
        const e = event as ContextMenuEvent & React.MouseEvent<SVGSVGElement, MouseEvent>;
        const point = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };

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
