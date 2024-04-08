import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Node, NodeApi } from '../react-canvas-viewer/Node.tsx';
import { Edge, EdgeApi } from '../react-canvas-viewer/Edge.tsx';
import { Selection, SelectionComponent } from './Selection.tsx';
import { Box } from '../geometry/box.ts';
import { SelectionMarquee, SelectionMarqueeComponent } from './SelectionMarquee.tsx';
import { debounce } from '../utils/debounce.ts';
import { Grid, GridComponent } from './Grid.tsx';
import { useRedraw } from '../react-canvas-viewer/useRedraw.tsx';
import { executeAction } from '../base-ui/keyMap.ts';
import { Point } from '../geometry/point.ts';
import { DocumentBounds, DocumentBoundsComponent } from '../react-canvas-viewer/DocumentBounds.tsx';
import { propsUtils } from '../react-canvas-viewer/utils/propsUtils.ts';
import { SelectionStateEvents } from '../model/selectionState.ts';
import { useDomEventListener, useEventListener } from '../react-app/hooks/useEventListener.ts';
import { DRAG_DROP_MANAGER } from '../react-canvas-viewer/DragDropManager.ts';
import { useCanvasZoomAndPan } from '../react-canvas-viewer/useCanvasZoomAndPan.ts';
import { EventHelper } from '../base-ui/eventHelper.ts';
import { useDiagram } from '../react-app/context/DiagramContext.ts';
import { ActionsContextType, useActions } from '../react-app/context/ActionsContext.ts';
import { BACKGROUND, DeferedMouseAction, Tool, ToolContructor } from './tools/types.ts';
import { MoveTool } from './tools/moveTool.ts';
import { TextTool } from './tools/textTool.ts';
import { DragLabel, DragLabelComponent } from './DragLabel.tsx';
import { ApplicationState, ToolType } from '../base-ui/ApplicationState.ts';
import { getTopMostNode, isNode } from '../model/diagramElement.ts';
import { EdgeTool } from './tools/edgeTool.ts';
import { getAncestorDiagramElement } from './utils/canvasDomUtils.ts';
import { AnchorHandles, AnchorHandlesComponent } from './selection/AnchorHandles.tsx';
import { NodeTool } from './tools/node/nodeTool.ts';
import { PenTool } from './tools/penTool.ts';
import { Component, createEffect } from '../base-ui/component.ts';
import { Diagram } from '../model/diagram.ts';
import { UndoEvents } from '../model/undoManager.ts';
import * as svg from '../base-ui/vdom-svg.ts';
import * as html from '../base-ui/vdom-html.ts';
import { EdgeComponent } from '../react-canvas-viewer/EdgeComponent.temp.ts';
import { ReactNodeDefinition } from '../react-canvas-viewer/reactNodeDefinition.ts';
import { Modifiers } from '../base-ui/drag/dragDropManager.ts';
import { useComponent } from '../react-canvas-viewer/temp/useComponent.temp.ts';
import { ViewboxEvents } from '../model/viewBox.ts';

const TOOLS: Record<ToolType, ToolContructor> = {
  move: MoveTool,
  text: TextTool,
  edge: EdgeTool,
  node: NodeTool,
  pen: PenTool
};

export interface ApplicationTriggers {
  showCanvasContextMenu?: (point: Point, mouseEvent: MouseEvent) => void;
  showSelectionContextMenu?: (point: Point, mouseEvent: MouseEvent) => void;
  showEdgeContextMenu?: (point: Point, id: string, mouseEvent: MouseEvent) => void;
  showNodeContextMenu?: (point: Point, id: string, mouseEvent: MouseEvent) => void;

  showNodeLinkPopup?: (point: Point, sourceNodeId: string, edgeId: string) => void;

  showDialog?: (
    title: string,
    message: string,
    okLabel: string,
    cancelLabel: string,
    onClick: () => void
  ) => void;
}

type ComponentProps = Props & ActionsContextType & { diagram: Diagram };

type Ref<T> = { current: T };

class EditableCanvasComponent extends Component<ComponentProps> {
  private deferedMouseAction: Ref<DeferedMouseAction | undefined> = { current: undefined };
  // @ts-ignore
  private svgRef: Ref<SVGSVGElement> = { current: undefined };
  private tool: Tool | undefined;

  // TODO: Change to Map
  private nodeRefs: Record<string, Component | null> = {};
  private edgeRefs: Record<string, Component | null> = {};

  onAttach(props: ComponentProps) {
    const diagram = props.diagram;

    this.tool = new MoveTool(
      diagram,
      DRAG_DROP_MANAGER,
      this.svgRef,
      this.deferedMouseAction,
      props.applicationTriggers,
      () => {
        props.applicationState.tool = 'move';
      }
    );
  }

  setTool(tool: Tool | undefined) {
    this.tool = tool;
    this.redraw();
  }

  render(props: ComponentProps) {
    const diagram = props.diagram;
    const { actionMap, keyMap } = props;

    // State
    const selection = diagram.selectionState;

    const drag = DRAG_DROP_MANAGER;

    // Component/node refs
    // const svgRef = useRef<SVGSVGElement>(null);

    const resetTool = () => (props.applicationState.tool = 'move');

    createEffect(() => {
      const cb = (s: { tool: ToolType }) => {
        this.setTool(
          new TOOLS[s.tool](
            diagram,
            drag,
            this.svgRef,
            this.deferedMouseAction,
            props.applicationTriggers,
            resetTool
          )
        );
      };
      props.applicationState.on('toolChange', cb);
      return () => props.applicationState.off('toolChange', cb);
    }, [props.applicationState]);

    // ---> start useCanvasZoomAndPan

    createEffect(() => {
      const cb = ({ viewbox }: ViewboxEvents['viewbox']) => {
        this.svgRef.current!.setAttribute('viewBox', viewbox.svgViewboxString);
      };
      diagram.viewBox.on('viewbox', cb);
      return () => diagram.viewBox.off('viewbox', cb);
    }, [diagram.viewBox]);

    createEffect(() => {
      if (!this.svgRef.current) return;

      const cb = (e: WheelEvent) => {
        e.preventDefault();
        if (e.ctrlKey) {
          const delta = e.deltaY;
          const normalized = -(delta % 3 ? delta * 10 : delta / 3);
          diagram.viewBox.zoom(EventHelper.point(e), normalized > 0 ? 1 / 1.008 : 1.008);
        } else {
          diagram.viewBox.pan({
            x: diagram.viewBox.offset.x + e.deltaX * 0.7,
            y: diagram.viewBox.offset.y + e.deltaY * 0.7
          });
        }
      };
      this.svgRef.current!.addEventListener('wheel', cb);
      return () => this.svgRef.current!.removeEventListener('wheel', cb);
    }, [this.svgRef.current]);

    createEffect(() => {
      const cb = () => this.adjustViewbox();
      window.addEventListener('resize', cb);
      return () => window.removeEventListener('resize', cb);
    }, [diagram]);

    // ---> end useCanvasZoomAndPan

    createEffect(() => {
      const cb = (e: KeyboardEvent) => {
        if (executeAction(e, {}, keyMap, actionMap)) {
          return;
        }
        this.tool?.onKeyDown(e);
      };
      document.addEventListener('keydown', cb);
      return () => document.removeEventListener('keydown', cb);
    }, []);

    createEffect(() => {
      const cb = (e: KeyboardEvent) => this.tool?.onKeyUp(e);
      document.addEventListener('keyup', cb);
      return () => document.removeEventListener('keyup', cb);
    }, []);

    const clearSelection = debounce(() => selection.clear());

    createEffect(() => {
      const cb = (e: UndoEvents['execute']) => {
        if (e.type === 'undo') clearSelection();
      };
      diagram.undoManager.on('execute', cb);
      return () => diagram.undoManager.off('execute', cb);
    }, [diagram.undoManager]);

    createEffect(() => {
      const cb = (e: SelectionStateEvents['add'] | SelectionStateEvents['remove']) => {
        if (isNode(e.element)) {
          const nodeToRepaint = getTopMostNode(e.element);
          this.nodeRefs[nodeToRepaint.id]?.redraw();
          for (const edge of nodeToRepaint.listEdges()) {
            this.edgeRefs[edge.id]?.redraw();
          }
        } else {
          this.edgeRefs[e.element.id]?.redraw();
        }
      };
      diagram.on('elementChange', cb);
      return () => diagram.off('elementChange', cb);
    }, [diagram]);

    createEffect(() => {
      const cb = () => this.redraw();
      diagram.on('elementAdd', cb);
      return () => diagram.off('elementAdd', cb);
    }, [diagram]);
    createEffect(() => {
      const cb = () => this.redraw();
      diagram.on('elementRemove', cb);
      return () => diagram.off('elementRemove', cb);
    }, [diagram]);
    createEffect(() => {
      const cb = () => this.redraw();
      diagram.on('change', cb);
      return () => diagram.off('change', cb);
    }, [diagram]);

    const redrawElement = (e: SelectionStateEvents['add'] | SelectionStateEvents['remove']) => {
      if (isNode(e.element)) {
        const nodeToRepaint = getTopMostNode(e.element);
        this.nodeRefs[nodeToRepaint.id]?.redraw();
      } else {
        this.edgeRefs[e.element.id]?.redraw();
      }
    };

    createEffect(() => {
      const cb = (e: SelectionStateEvents['add'] | SelectionStateEvents['remove']) =>
        redrawElement(e);
      selection.on('add', cb);
      return () => selection.off('add', cb);
    }, [selection]);

    createEffect(() => {
      const cb = (e: SelectionStateEvents['add'] | SelectionStateEvents['remove']) =>
        redrawElement(e);
      selection.on('remove', cb);
      return () => selection.off('remove', cb);
    }, [selection]);

    const onDoubleClick = (id: string, coord: Point) => {
      actionMap['EDGE_TEXT_ADD']?.execute({
        point: diagram.viewBox.toDiagramPoint(coord),
        id
      });
    };

    return html.div({}, [
      html.textarea({ id: 'clipboard', style: 'position: absolute; left: -4000px' }),
      this.subComponent('drag-label', () => new DragLabelComponent(), {}),
      html.svg(
        {
          //          ...propsUtils.filterDomProperties(props),
          id: `diagram-${diagram.id}`,
          class: props.className ?? 'canvas',
          preserveAspectRatio: 'none',
          viewBox: diagram.viewBox.svgViewboxString,
          style: `user-select: none`,
          hooks: {
            onInsert: node => {
              this.svgRef.current = node.el! as SVGSVGElement;
              this.adjustViewbox();

              // TODO: This is a bit of a hack until EffectManager runs onInsert
              this.redraw();
            },
            onRemove: () => {
              // @ts-ignore
              this.svgRef.current = null;
            }
          },
          on: {
            mousedown: e => {
              if (e.button !== 0) return;
              this.tool!.onMouseDown(BACKGROUND, EventHelper.point(e), e);
            },
            mouseover: e => {
              const el = getAncestorDiagramElement(e.target as SVGElement);
              if (!el) return;
              // TODO: Do we need to call onMouseOver if we keep the state in ApplicationState?
              this.tool!.onMouseOver(el.id, EventHelper.point(e));
              props.applicationState.hoverElement = el.id;
            },
            mouseout: e => {
              const el = getAncestorDiagramElement(e.target as SVGElement);
              if (!el) return;
              // TODO: Do we need to call onMouseOver if we keep the state in ApplicationState?
              this.tool!.onMouseOut(el.id, EventHelper.point(e));
              props.applicationState.hoverElement = undefined;
            },
            mouseup: e => this.tool!.onMouseUp(EventHelper.point(e)),
            mousemove: e => {
              const r = (e.currentTarget! as SVGSVGElement).getBoundingClientRect();
              this.tool!.onMouseMove(
                {
                  x: e.clientX - r.x,
                  y: e.clientY - r.y
                },
                e
              );
            },
            contextmenu: event => {
              const bounds = this.svgRef.current!.getBoundingClientRect();
              const point = {
                x: event.clientX - bounds.x,
                y: event.clientY - bounds.y
              };

              const isClickOnSelection = Box.contains(
                selection.bounds,
                diagram.viewBox.toDiagramPoint(point)
              );

              if (isClickOnSelection) {
                props.applicationTriggers.showSelectionContextMenu?.(
                  diagram.viewBox.toDiagramPoint(point),
                  event
                );
              } else {
                props.applicationTriggers.showCanvasContextMenu?.(
                  diagram.viewBox.toDiagramPoint(point),
                  event
                );
              }

              props.onContextMenu?.(event);
            },

            drag: e => {
              props.onDrag?.(e);
            },
            drop: e => {
              props.onDrop?.(e);
            },
            dragover: e => {
              props.onDragOver?.(e);
            }
          }
        },
        [
          svg.defs(
            svg.filter(
              { id: 'reflection-filter', filterUnits: 'objectBoundingBox' },
              svg.feGaussianBlur({ stdDeviation: 0.5 })
            )
          ),

          this.subComponent('document-bounds', () => new DocumentBoundsComponent(), {
            diagram
          }),

          this.subComponent('grid', () => new GridComponent(), {
            diagram
          }),

          svg.g(
            {},
            ...diagram.layers.visible.flatMap(layer => {
              return layer.elements.map(e => {
                const id = e.id;
                if (e.type === 'edge') {
                  const edge = diagram.edgeLookup.get(id)!;
                  return this.subComponent(
                    `edge-${id}`,
                    () => new EdgeComponent(),
                    {
                      onDoubleClick,
                      onMouseDown: (id: string, coord: Point, modifiers: Modifiers) =>
                        this.tool!.onMouseDown(id, coord, modifiers),
                      def: edge,
                      diagram,
                      applicationTriggers: props.applicationTriggers,
                      tool: this.tool
                    },
                    // TODO: We should be able to clean this up a bit
                    {
                      onCreate: element =>
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (this.edgeRefs[id] = (element.data as any).component.instance),
                      onRemove: element => {
                        /* Note: Need to check if the instance is the same as the one we have stored,
                         *       as removes and adds can come out of order */
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        if (this.edgeRefs[id] === (element.data as any).component.instance) {
                          this.edgeRefs[id] = null;
                        }
                      }
                    }
                  );
                } else {
                  const node = diagram.nodeLookup.get(id)!;
                  const nodeDef = diagram.nodeDefinitions.get(node.nodeType);

                  return this.subComponent(
                    `node-${node.nodeType}-${id}`,
                    // @ts-ignore
                    (nodeDef as ReactNodeDefinition).component!,
                    {
                      onMouseDown: (id: string, coord: Point, modifiers: Modifiers) =>
                        this.tool!.onMouseDown(id, coord, modifiers),
                      onDoubleClick,
                      def: node,
                      diagram,
                      applicationTriggers: props.applicationTriggers,
                      tool: this.tool
                    },
                    // TODO: We should be able to clean this up a bit
                    {
                      onCreate: element =>
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (this.nodeRefs[id] = (element.data as any).component.instance),
                      onRemove: element => {
                        /* Note: Need to check if the instance is the same as the one we have stored,
                         *       as removes and adds can come out of order */
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        if (this.nodeRefs[id] === (element.data as any).component.instance) {
                          this.nodeRefs[id] = null;
                        }
                      }
                    }
                  );
                }
              });
            })
          ),

          this.tool?.type === 'move'
            ? this.subComponent('selection', () => new SelectionComponent(), {
                diagram
              })
            : svg.g({}),

          this.subComponent('selection-marquee', () => new SelectionMarqueeComponent(), {
            selection
          }),

          this.tool?.type === 'move'
            ? this.subComponent('anchor-handles', () => new AnchorHandlesComponent(), {
                applicationState: props.applicationState,
                applicationTriggers: props.applicationTriggers,
                diagram
              })
            : svg.g({})
        ]
      )
    ]);
  }

  private adjustViewbox() {
    const diagram = this.currentProps!.diagram;

    if (diagram.viewBox.zoomLevel === 1) {
      diagram.viewBox.pan({
        x: Math.floor(-(this.svgRef.current!.getBoundingClientRect().width - diagram.canvas.w) / 2),
        y: Math.floor(-(this.svgRef.current!.getBoundingClientRect().height - diagram.canvas.h) / 2)
      });
    }
    diagram.viewBox.dimensions = {
      w: Math.floor(this.svgRef.current!.getBoundingClientRect().width * diagram.viewBox.zoomLevel),
      h: Math.floor(this.svgRef.current!.getBoundingClientRect().height * diagram.viewBox.zoomLevel)
    };
    diagram.viewBox.windowSize = {
      w: Math.floor(this.svgRef.current!.getBoundingClientRect().width),
      h: Math.floor(this.svgRef.current!.getBoundingClientRect().height)
    };
  }
}

export const EditableCanvas = forwardRef<SVGSVGElement, Props>((props, _ref) => {
  const diagram = useDiagram();
  const { actionMap, keyMap } = useActions();

  const ref = useComponent<ComponentProps, EditableCanvasComponent, HTMLDivElement>(
    () => new EditableCanvasComponent(),
    {
      ...props,
      diagram,
      actionMap,
      keyMap
    }
  );

  return <div ref={ref}></div>;
});

export const OldEditableCanvas = forwardRef<SVGSVGElement, Props>((props, ref) => {
  const redraw = useRedraw();

  const diagram = useDiagram();
  const { actionMap, keyMap } = useActions();

  // State
  const selection = diagram.selectionState;
  const deferedMouseAction = useRef<DeferedMouseAction | undefined>(undefined);

  const drag = DRAG_DROP_MANAGER;

  // Component/node refs
  const svgRef = useRef<SVGSVGElement>(null);

  // TODO: Change to Map
  const nodeRefs = useRef<Record<string, NodeApi | null>>({});
  const edgeRefs = useRef<Record<string, EdgeApi | null>>({});

  const resetTool = () => (props.applicationState.tool = 'move');

  const [tool, setTool] = useState<Tool>(
    () =>
      new MoveTool(diagram, drag, svgRef, deferedMouseAction, props.applicationTriggers, resetTool)
  );

  useEventListener(props.applicationState, 'toolChange', s => {
    setTool(
      new TOOLS[s.tool](
        diagram,
        drag,
        svgRef,
        deferedMouseAction,
        props.applicationTriggers,
        resetTool
      )
    );
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
  useDomEventListener('keyup', e => tool.onKeyUp(e), document);

  const clearSelection = debounce(() => selection.clear());

  useEventListener(diagram.undoManager, 'execute', e => {
    if (e.type === 'undo') clearSelection();
  });

  useEventListener(diagram, 'elementChange', e => {
    if (isNode(e.element)) {
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
    if (isNode(e.element)) {
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
          const e = event as React.MouseEvent<SVGSVGElement, MouseEvent>;

          const bounds = svgRef.current!.getBoundingClientRect();
          const point = {
            x: e.nativeEvent.clientX - bounds.x,
            y: e.nativeEvent.clientY - bounds.y
          };

          const isClickOnSelection = Box.contains(
            selection.bounds,
            diagram.viewBox.toDiagramPoint(point)
          );

          if (isClickOnSelection) {
            props.applicationTriggers.showSelectionContextMenu?.(
              diagram.viewBox.toDiagramPoint(point),
              event.nativeEvent
            );
          } else {
            props.applicationTriggers.showCanvasContextMenu?.(
              diagram.viewBox.toDiagramPoint(point),
              event.nativeEvent
            );
          }

          props.onContextMenu?.(event.nativeEvent);
        }}
        onDrag={e => {
          props.onDrag?.(e.nativeEvent);
        }}
        onDrop={e => {
          props.onDrop?.(e.nativeEvent);
        }}
        onDragOver={e => {
          props.onDragOver?.(e.nativeEvent);
        }}
      >
        <defs>
          <filter id={'reflection-filter'} filterUnits={'objectBoundingBox'}>
            <feGaussianBlur stdDeviation={0.5} />
          </filter>
        </defs>

        <DocumentBounds />
        <Grid />

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
                  applicationTriggers={props.applicationTriggers}
                  tool={tool}
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
                  applicationTriggers={props.applicationTriggers}
                  tool={tool}
                />
              );
            }
          });
        })}

        {tool.type === 'move' && <Selection />}

        <SelectionMarquee selection={selection} />

        {tool.type === 'move' && (
          <AnchorHandles
            applicationState={props.applicationState}
            applicationTriggers={props.applicationTriggers}
          />
        )}
      </svg>
    </>
  );
});

type Props = {
  applicationState: ApplicationState;
  applicationTriggers: ApplicationTriggers;
  className?: string;
  onDrop?: (e: DragEvent) => void;
  onDrag?: (e: DragEvent) => void;
  onDragOver?: (e: DragEvent) => void;
  onContextMenu?: (e: MouseEvent) => void;
};
