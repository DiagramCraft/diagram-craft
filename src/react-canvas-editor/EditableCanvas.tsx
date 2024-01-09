import React, {
  forwardRef,
  SVGProps,
  useCallback,
  useImperativeHandle,
  useRef,
  useState
} from 'react';
import { Node, NodeApi } from '../react-canvas-viewer/Node.tsx';
import { Edge, EdgeApi } from '../react-canvas-viewer/Edge.tsx';
import { Selection, SelectionApi } from './Selection.tsx';
import { Box } from '../geometry/box.ts';
import { SelectionMarquee, SelectionMarqueeApi } from './SelectionMarquee.tsx';
import { debounce } from '../utils/debounce.ts';
import { Grid } from './Grid.tsx';
import { useRedraw } from '../react-canvas-viewer/useRedraw.tsx';
import { executeAction } from '../base-ui/keyMap.ts';
import { Point } from '../geometry/point.ts';
import { DocumentBounds } from '../react-canvas-viewer/DocumentBounds.tsx';
import { propsUtils } from '../react-canvas-viewer/utils/propsUtils.ts';
import { SelectionStateEvents } from '../model/selectionState.ts';
import { useDomEventListener, useEventListener } from '../react-app/hooks/useEventListener.ts';
import { useDragDrop } from '../react-canvas-viewer/DragDropManager.ts';
import { useCanvasZoomAndPan } from '../react-canvas-viewer/useCanvasZoomAndPan.ts';
import { EventHelper } from '../base-ui/eventHelper.ts';
import { useDiagram } from '../react-app/context/DiagramContext.tsx';
import { useActions } from '../react-app/context/ActionsContext.tsx';
import { BACKGROUND, DeferedMouseAction, Tool, ToolContructor } from './tools/types.ts';
import { MoveTool } from './tools/moveTool.ts';
import { TextTool } from './tools/textTool.ts';
import { DragLabel } from './DragLabel.tsx';
import { ApplicationState, ToolType } from '../base-ui/ApplicationState.ts';
import { getTopMostNode } from '../model/diagramElement.ts';
import { EdgeTool } from './tools/edgeTool.ts';
import { getAncestorDiagramElement } from './utils/canvasDomUtils.ts';
import { AnchorHandles } from './selection/AnchorHandles.tsx';

const TOOLS: Record<ToolType, ToolContructor> = {
  move: MoveTool,
  text: TextTool,
  edge: EdgeTool
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

  // TODO: Change to Map
  const nodeRefs = useRef<Record<string, NodeApi | null>>({});
  const edgeRefs = useRef<Record<string, EdgeApi | null>>({});
  const selectionRef = useRef<SelectionApi | null>(null);
  const selectionMarqueeRef = useRef<SelectionMarqueeApi | null>(null);

  const resetTool = () => (props.applicationState.tool = 'move');

  const [tool, setTool] = useState<Tool>(
    new MoveTool(diagram, drag, svgRef, deferedMouseAction, resetTool)
  );

  useEventListener(props.applicationState, 'toolChange', s => {
    setTool(new TOOLS[s.tool](diagram, drag, svgRef, deferedMouseAction, resetTool));
  });

  useImperativeHandle(ref, () => {
    return svgRef.current!;
  });

  useCanvasZoomAndPan(diagram, svgRef);

  useDomEventListener(
    'keydown',
    e => {
      if (executeAction(e, {}, keyMap, actionMap)) return;
      tool.onKeyDown(e);
    },
    document
  );

  const clearSelection = debounce(() => selection.clear());

  useEventListener(diagram.undoManager, 'execute', e => {
    if (e.type === 'undo') clearSelection();
  });

  useEventListener(diagram, 'elementChange', e => {
    if (e.element.type === 'node') {
      const nodeToRepaint = getTopMostNode(e.element);
      nodeRefs.current[nodeToRepaint.id]?.repaint();

      for (const edge of nodeToRepaint.listEdges()) {
        edgeRefs.current[edge.id]?.repaint();
      }
    } else {
      edgeRefs.current[e.element.id]?.repaint();
    }
  });
  useEventListener(diagram, 'elementAdd', redraw);
  useEventListener(diagram, 'elementRemove', redraw);
  useEventListener(diagram, 'change', redraw);

  const redrawElement = (e: SelectionStateEvents['add'] | SelectionStateEvents['remove']) => {
    if (e.element.type === 'node') {
      const nodeToRepaint = getTopMostNode(e.element);
      nodeRefs.current[nodeToRepaint.id]?.repaint();
    } else {
      edgeRefs.current[e.element.id]?.repaint();
    }
  };

  // This needs to stay in here for performance reasons
  useEventListener(selection, 'add', redrawElement);
  useEventListener(selection, 'remove', redrawElement);

  const onDoubleClick = useCallback(
    (id: string, coord: Point) => {
      actionMap['EDGE_TEXT_ADD']?.execute({
        point: diagram.viewBox.toDiagramPoint(coord),
        id
      });
    },
    [actionMap, diagram.viewBox]
  );

  return (
    <>
      <textarea id={'clipboard'} style={{ position: 'absolute', left: '-4000px' }}></textarea>
      <DragLabel />
      <svg
        id={`diagram-${diagram.id}`}
        ref={svgRef}
        {...propsUtils.filterDomProperties(props)}
        preserveAspectRatio="none"
        viewBox={diagram.viewBox.svgViewboxString}
        onMouseDown={e => {
          if (e.button !== 0) return;
          tool.onMouseDown(BACKGROUND, EventHelper.point(e.nativeEvent), e.nativeEvent);
        }}
        style={{ userSelect: 'none' }}
        onMouseOver={e => {
          const el = getAncestorDiagramElement(e.target as SVGElement);
          if (!el) return;
          // TODO: Do we need to call onMouseOver if we keep the state in ApplicationState?
          tool.onMouseOver(el.id, EventHelper.point(e.nativeEvent));
          props.applicationState.hoverElement = el.id;
        }}
        onMouseOut={e => {
          const el = getAncestorDiagramElement(e.target as SVGElement);
          if (!el) return;
          // TODO: Do we need to call onMouseOver if we keep the state in ApplicationState?
          tool.onMouseOut(el.id, EventHelper.point(e.nativeEvent));
          props.applicationState.hoverElement = undefined;
        }}
        onMouseUp={e => tool.onMouseUp(EventHelper.point(e.nativeEvent))}
        onMouseMove={e => {
          const r = e.currentTarget.getBoundingClientRect();
          tool.onMouseMove(
            {
              x: e.nativeEvent.clientX - r.x,
              y: e.nativeEvent.clientY - r.y
            },
            e.nativeEvent
          );
        }}
        onContextMenu={event => {
          const e = event as ContextMenuEvent & React.MouseEvent<SVGSVGElement, MouseEvent>;

          const bounds = svgRef.current!.getBoundingClientRect();
          const point = {
            x: e.nativeEvent.clientX - bounds.x,
            y: e.nativeEvent.clientY - bounds.y
          };

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

        {diagram.layers.visible.flatMap(layer => {
          return layer.elements.map(e => {
            const id = e.id;
            if (e.type === 'edge') {
              const edge = diagram.edgeLookup.get(id)!;
              return (
                <Edge
                  key={id}
                  ref={(element: EdgeApi) => (edgeRefs.current[id] = element)}
                  onDoubleClick={onDoubleClick}
                  onMouseDown={(id, coord, modifiers) => tool.onMouseDown(id, coord, modifiers)}
                  def={edge}
                  diagram={diagram}
                />
              );
            } else {
              const node = diagram.nodeLookup.get(id)!;
              return (
                <Node
                  key={id}
                  ref={(element: NodeApi) => (nodeRefs.current[id] = element)}
                  onMouseDown={(id, coord, modifiers) => tool.onMouseDown(id, coord, modifiers)}
                  onDoubleClick={onDoubleClick}
                  def={node}
                  diagram={diagram}
                />
              );
            }
          });
        })}

        <Selection ref={selectionRef} selection={selection} diagram={diagram} />
        <SelectionMarquee ref={selectionMarqueeRef} selection={selection} />

        <AnchorHandles diagram={diagram} applicationState={props.applicationState} />
      </svg>
    </>
  );
});

type Props = {
  applicationState: ApplicationState;
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
