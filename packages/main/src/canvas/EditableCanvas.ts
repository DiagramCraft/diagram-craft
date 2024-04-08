import { SelectionComponent } from './Selection.ts';
import { Box } from '../geometry/box.ts';
import { SelectionMarqueeComponent } from './SelectionMarquee.ts';
import { debounce } from '../utils/debounce.ts';
import { GridComponent } from './Grid.ts';
import { Actions, executeAction } from '../base-ui/keyMap.ts';
import { Point } from '../geometry/point.ts';
import { DocumentBoundsComponent } from './DocumentBounds.ts';
import { SelectionState, SelectionStateEvents } from '../model/selectionState.ts';
import { DRAG_DROP_MANAGER } from './DragDropManager.ts';
import { EventHelper } from '../base-ui/eventHelper.ts';
import { BACKGROUND, DeferedMouseAction, Tool, ToolContructor } from './tools/types.ts';
import { MoveTool } from './tools/moveTool.ts';
import { TextTool } from './tools/textTool.ts';
import { DragLabelComponent } from './DragLabel.ts';
import { ApplicationState, ToolType } from '../base-ui/ApplicationState.ts';
import { DiagramElement, getTopMostNode, isNode } from '../model/diagramElement.ts';
import { EdgeTool } from './tools/edgeTool.ts';
import { getAncestorDiagramElement } from './utils/canvasDomUtils.ts';
import { AnchorHandlesComponent } from './selection/AnchorHandles.ts';
import { NodeTool } from './tools/node/nodeTool.ts';
import { PenTool } from './tools/penTool.ts';
import { Component, ComponentVNodeData, createEffect } from '../base-ui/component.ts';
import { Diagram, DiagramEvents } from '../model/diagram.ts';
import { UndoEvents } from '../model/undoManager.ts';
import * as svg from '../base-ui/vdom-svg.ts';
import * as html from '../base-ui/vdom-html.ts';
import { EdgeComponent } from './EdgeComponent.ts';
import { Modifiers } from '../base-ui/drag/dragDropManager.ts';
import { ViewboxEvents } from '../model/viewBox.ts';
import { ShapeNodeDefinition } from './shapeNodeDefinition.ts';
import { BaseShape, BaseShapeProps } from './temp/baseShape.temp.ts';
import { EventKey } from '../utils/event.ts';

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

type ComponentProps = Props & Actions & { diagram: Diagram };

type Ref<T> = { current: T };

export class EditableCanvasComponent extends Component<ComponentProps> {
  private deferedMouseAction: Ref<DeferedMouseAction | undefined> = { current: undefined };
  private svgRef: Ref<SVGSVGElement | null> = { current: null };
  private tool: Tool | undefined;

  // TODO: Change to Map
  private nodeRefs: Record<string, Component<unknown> | null> = {};
  private edgeRefs: Record<string, Component<unknown> | null> = {};

  setTool(tool: Tool | undefined) {
    this.tool = tool;
    this.redraw();
  }

  render(props: ComponentProps) {
    const diagram = props.diagram;
    const { actionMap, keyMap } = props;

    if (this.tool === undefined) {
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

    // State
    const selection = diagram.selectionState;

    const drag = DRAG_DROP_MANAGER;

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
        if (!executeAction(e, {}, keyMap, actionMap)) {
          this.tool?.onKeyDown(e);
        }
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
      const cb = (e: { element: DiagramElement }) => this.redrawElement(e);
      diagram.on('elementChange', cb);
      return () => diagram.off('elementChange', cb);
    }, [diagram]);

    this.onDiagramRedraw('elementAdd', diagram);
    this.onDiagramRedraw('elementRemove', diagram);
    this.onDiagramRedraw('change', diagram);

    this.onSelectionRedrawElement(selection);

    const onDoubleClick = (id: string, coord: Point) => {
      actionMap['EDGE_TEXT_ADD']?.execute({
        point: diagram.viewBox.toDiagramPoint(coord),
        id
      });
    };

    const canvasState = {
      applicationState: props.applicationState,
      applicationTriggers: props.applicationTriggers,
      diagram
    };

    return html.div({}, [
      html.textarea({ id: 'clipboard', style: 'position: absolute; left: -4000px' }),
      this.subComponent('drag-label', () => new DragLabelComponent(), { ...canvasState }),
      html.svg(
        {
          ...(props.width ? { width: props.width } : {}),
          ...(props.height ? { height: props.height } : {}),
          id: `diagram-${diagram.id}`,
          class: props.className ?? 'canvas',
          preserveAspectRatio: 'none',
          viewBox: diagram.viewBox.svgViewboxString,
          style: `user-select: none`,
          hooks: {
            onInsert: node => {
              this.svgRef.current = node.el! as SVGSVGElement;
              this.adjustViewbox();
            },
            onRemove: () => {
              this.svgRef.current = null;
            }
          },
          on: {
            click: e => {
              props.onClick?.(e);
            },
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
            ...canvasState
          }),

          this.subComponent('grid', () => new GridComponent(), { ...canvasState }),

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
                    {
                      onCreate: element => {
                        this.edgeRefs[id] = (
                          element.data as ComponentVNodeData<unknown, Component>
                        ).component.instance!;
                      },
                      onRemove: element => {
                        /* Note: Need to check if the instance is the same as the one we have stored,
                         *       as removes and adds can come out of order */
                        const instance = element.data as ComponentVNodeData<unknown, Component>;
                        if (this.edgeRefs[id] === instance.component.instance) {
                          this.edgeRefs[id] = null;
                        }
                      }
                    }
                  );
                } else {
                  const node = diagram.nodeLookup.get(id)!;
                  const nodeDef = diagram.nodeDefinitions.get(node.nodeType);

                  return this.subComponent<BaseShapeProps, BaseShape>(
                    `node-${node.nodeType}-${id}`,
                    (nodeDef as ShapeNodeDefinition).component!,
                    {
                      def: node,
                      diagram,
                      tool: this.tool,
                      onMouseDown: (id: string, coord: Point, modifiers: Modifiers) =>
                        this.tool!.onMouseDown(id, coord, modifiers),
                      onDoubleClick,
                      applicationTriggers: props.applicationTriggers,
                      actionMap
                    },
                    {
                      onCreate: element => {
                        this.nodeRefs[id] = (
                          element.data as ComponentVNodeData<BaseShapeProps, BaseShape>
                        ).component.instance!;
                      },
                      onRemove: element => {
                        /* Note: Need to check if the instance is the same as the one we have stored,
                         *       as removes and adds can come out of order */
                        const instance = (
                          element.data as ComponentVNodeData<BaseShapeProps, BaseShape>
                        ).component.instance;
                        if (this.nodeRefs[id] === instance) {
                          this.nodeRefs[id] = null;
                        }
                      }
                    }
                  );
                }
              });
            })
          ),

          this.tool.type === 'move'
            ? this.subComponent('selection', () => new SelectionComponent(), { ...canvasState })
            : svg.g({}),

          this.subComponent('selection-marquee', () => new SelectionMarqueeComponent(), {
            ...canvasState
          }),

          this.tool.type === 'move'
            ? this.subComponent('anchor-handles', () => new AnchorHandlesComponent(), {
                ...canvasState
              })
            : svg.g({})
        ]
      )
    ]);
  }

  private redrawElement = (e: { element: DiagramElement }) => {
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

  private onDiagramRedraw(eventName: EventKey<DiagramEvents>, diagram: Diagram) {
    createEffect(() => {
      const cb = () => this.redraw();
      diagram.on(eventName, cb);
      return () => diagram.off(eventName, cb);
    }, [diagram]);
  }

  private onSelectionRedrawElement(selection: SelectionState) {
    createEffect(() => {
      const cb = (e: SelectionStateEvents['add'] | SelectionStateEvents['remove']) =>
        this.redrawElement(e);
      selection.on('add', cb);
      return () => selection.off('add', cb);
    }, [selection]);

    createEffect(() => {
      const cb = (e: SelectionStateEvents['add'] | SelectionStateEvents['remove']) =>
        this.redrawElement(e);
      selection.on('remove', cb);
      return () => selection.off('remove', cb);
    }, [selection]);
  }

  private adjustViewbox() {
    const diagram = this.currentProps!.diagram;

    const rect = this.svgRef.current!.getBoundingClientRect();

    if (diagram.viewBox.zoomLevel === 1) {
      diagram.viewBox.pan({
        x: Math.floor(-(rect.width - diagram.canvas.w) / 2),
        y: Math.floor(-(rect.height - diagram.canvas.h) / 2)
      });
    }
    diagram.viewBox.dimensions = {
      w: Math.floor(rect.width * diagram.viewBox.zoomLevel),
      h: Math.floor(rect.height * diagram.viewBox.zoomLevel)
    };
    diagram.viewBox.windowSize = {
      w: Math.floor(rect.width),
      h: Math.floor(rect.height)
    };
  }

  getSvgElement(): SVGSVGElement {
    return document.getElementById(
      `diagram-${this.currentProps?.diagram.id}`
    )! as unknown as SVGSVGElement;
  }
}

export type Props = {
  applicationState: ApplicationState;
  applicationTriggers: ApplicationTriggers;
  className?: string;
  diagram: Diagram;
  width?: string | number;
  height?: string | number;
  onClick?: (e: MouseEvent) => void;
  onDrop?: (e: DragEvent) => void;
  onDrag?: (e: DragEvent) => void;
  onDragOver?: (e: DragEvent) => void;
  onContextMenu?: (e: MouseEvent) => void;
};

export type CanvasState = {
  applicationState: ApplicationState;
  applicationTriggers: ApplicationTriggers;
  diagram: Diagram;
};
