import { SelectionComponent } from '../components/SelectionComponent';
import { SelectionMarqueeComponent } from '../components/SelectionMarqueeComponent';
import { GridComponent } from '../components/GridComponent';
import { CanvasGuidesComponent } from '../components/CanvasGuidesComponent';
import { Actions, findAndExecuteAction } from '../keyMap';
import { DocumentBoundsComponent } from '../components/DocumentBoundsComponent';
import { DRAG_DROP_MANAGER, Modifiers } from '../dragDropManager';
import { AbstractTool, Tool, ToolConstructor, ToolType } from '../tool';
import { DragLabelComponent } from '../components/DragLabelComponent';
import { AnchorHandlesComponent } from '@diagram-craft/canvas/components/AnchorHandlesComponent';
import { $cmp, createEffect, Observable } from '../component/component';
import * as svg from '../component/vdom-svg';
import * as html from '../component/vdom-html';
import { Point } from '@diagram-craft/geometry/point';
import { Box } from '@diagram-craft/geometry/box';
import { Diagram } from '@diagram-craft/model/diagram';
import { ViewboxEvents } from '@diagram-craft/model/viewBox';
import { DiagramElement, getTopMostNode, isNode } from '@diagram-craft/model/diagramElement';
import { Selection, SelectionEvents } from '@diagram-craft/model/selection';
import { EventHelper } from '@diagram-craft/utils/eventHelper';
import { rawHTML } from '../component/vdom';
import styles from './canvas.css?inline';
import { PanTool } from '@diagram-craft/canvas-app/tools/panTool';
import { Context } from '../context';
import { unique } from '@diagram-craft/utils/array';
import { BaseCanvasComponent, BaseCanvasProps } from './BaseCanvasComponent';
import {
  createUpdateOnViewboxChangeEffect,
  createZoomPanOnMouseEventEffect
} from './InteractiveCanvasComponent';
import { AwarenessCursorComponent } from '../components/AwarenessCursorComponent';
import {
  isResolvableToModificationLayer,
  isResolvableToRegularLayer
} from '@diagram-craft/model/diagramLayerUtils';
import { AnchorHighlightComponent } from '../components/AnchorHighlightComponent';
import { MoveTool } from '../tools/moveTool';
import { CollaborationConfig } from '@diagram-craft/collaboration/collaborationConfig';

const removeSuffix = (s: string) => {
  return s.replace(/---.+$/, '');
};

const getAncestorDiagramElement = (
  e: SVGElement | HTMLElement
):
  | {
      id: string;
      type: 'edge' | 'node';
    }
  | undefined => {
  let element: SVGElement | HTMLElement | null = e;
  while (element) {
    if (element.id.startsWith('node-')) {
      return {
        id: removeSuffix(element.id.slice('node-'.length)),
        type: 'node'
      };
    } else if (element.id.startsWith('edge-')) {
      return {
        id: removeSuffix(element.id.slice('edge-'.length)),
        type: 'edge'
      };
    }
    element = element.parentElement;
  }
  return undefined;
};

type ComponentProps = Props & Actions & { diagram: Diagram };

export class EditableCanvasComponent extends BaseCanvasComponent<ComponentProps> {
  protected defaultClassName = 'canvas editable-canvas';
  protected preserveAspectRatio = 'none';

  private svgRef: SVGSVGElement | null = null;
  private tool: Tool | undefined;

  private point: Point = { x: 0, y: 0 };

  private hoverElement = new Observable<string | undefined>(undefined);

  setTool(tool: Tool | undefined) {
    this.tool?.onToolChange?.();
    this.tool = tool;
    this.redraw();
  }

  render(props: ComponentProps) {
    const diagram = props.diagram;
    const { actionMap, keyMap } = props;

    // State
    const selection = diagram.selection;
    const resetTool = () => props.context.tool.set(props.initialTool ?? 'move');

    this.tool ??= new props.tools[props.context.tool.get()]!(
      diagram,
      DRAG_DROP_MANAGER,
      this.svgRef,
      props.context,
      resetTool
    );

    createEffect(() => {
      const cb = (s: { newValue: ToolType }) => {
        this.setTool(
          new props.tools[s.newValue]!(
            diagram,
            DRAG_DROP_MANAGER,
            this.svgRef,
            props.context,
            resetTool
          )
        );
        this.updateToolClassOnSvg(s.newValue);
      };
      props.context.tool.on('change', cb);
      return () => props.context.tool.off('change', cb);
    }, [diagram, props.context.tool]);

    // ---> start useCanvasZoomAndPan

    createUpdateOnViewboxChangeEffect(() => this.svgRef, diagram.viewBox, diagram);
    createZoomPanOnMouseEventEffect(() => this.svgRef, diagram.viewBox, diagram);

    createEffect(() => {
      const cb = () => this.adjustViewbox(diagram);
      window.addEventListener('resize', cb);
      return () => window.removeEventListener('resize', cb);
    }, [diagram]);

    // ---> end useCanvasZoomAndPan

    createEffect(() => {
      const cb = (e: KeyboardEvent) => {
        if (
          e.code === 'Space' &&
          !(e.srcElement as HTMLElement | undefined)?.className.includes('svg-node__text') &&
          !e.ctrlKey &&
          !e.altKey &&
          !e.metaKey &&
          !e.shiftKey
        ) {
          if (this.tool?.type !== 'pan') {
            props.context.tool.set('pan');
          }
          return;
        }

        if (!findAndExecuteAction(e, { point: this.point }, keyMap, actionMap)) {
          this.tool?.onKeyDown(e);
        }
      };

      document.addEventListener('keydown', cb);
      return () => document.removeEventListener('keydown', cb);
    }, [diagram]);

    createEffect(() => {
      const cb = (e: KeyboardEvent) => this.tool?.onKeyUp(e);
      document.addEventListener('keyup', cb);
      return () => document.removeEventListener('keyup', cb);
    }, [diagram]);

    createEffect(() => {
      const highlightCb = (e: { element: DiagramElement }) => this.redrawElements([e.element]);
      diagram.on('elementHighlighted', highlightCb);
      return () => {
        diagram.off('elementHighlighted', highlightCb);
      };
    }, [diagram]);

    createEffect(() => {
      const commitCb = (e: { updated: DiagramElement[] }) => this.redrawElements(e.updated);
      diagram.on('elementBatchChange', commitCb);
      return () => {
        diagram.off('elementBatchChange', commitCb);
      };
    }, [diagram]);

    // Subscribe to tag selection updates
    createEffect(() => {
      const tagSelectionCb = () => {
        this.redraw();
      };
      diagram.document.tags.on('selectionUpdate', tagSelectionCb);
      return () => {
        diagram.document.tags.off('selectionUpdate', tagSelectionCb);
      };
    }, [diagram]);

    // Need to redraw each selected element on zoom or pan
    // as some of the control nodes will change dimensions
    createEffect(() => {
      const cb = ({ type }: ViewboxEvents['viewbox']) => {
        if (type === 'pan') return;
        for (const e of this.currentProps?.diagram?.selection.elements ?? []) {
          this.redrawElements([e]);
        }
      };
      diagram.viewBox.on('viewbox', cb);
      return () => {
        diagram.viewBox.off('viewbox', cb);
      };
    }, [diagram]);

    this.onEventRedraw(diagram, 'elementAdd');
    this.onEventRedraw(diagram, 'elementRemove');
    this.onEventRedraw(diagram, 'diagramChange');
    this.onEventRedraw(diagram.layers, 'layerStructureChange');

    this.onSelectionRedrawElement(selection);

    const onEdgeDoubleClick = (id: string, coord: Point) => {
      actionMap['EDGE_TEXT_ADD']?.execute({
        point: diagram.viewBox.toDiagramPoint(coord),
        id
      });
    };

    const onMouseDown = (id: string, coord: Point, modifiers: Modifiers) =>
      this.tool!.onMouseDown(id, coord, modifiers);

    const canvasState = {
      context: props.context,
      diagram
    };

    const viewBox = this.getViewboxString(props);

    return html.div(
      {
        class: 'light-theme canvas-wrapper'
      },
      [
        html.textarea({ id: 'clipboard', style: 'position: absolute; left: -4000px' }),
        this.subComponent($cmp(DragLabelComponent), { ...canvasState }),
        html.svg(
          {
            id: props.id,
            class: this.getClassName(props),

            ...this.getDimension(props),

            preserveAspectRatio: this.preserveAspectRatio,
            style: `user-select: none`,
            ...(viewBox ? { viewBox: viewBox } : {}),
            hooks: {
              onInsert: node => {
                this.svgRef = node.el! as SVGSVGElement;
                this.adjustViewbox(diagram);

                // Note: this causes an extra redraw, but it's necessary to ensure that
                //       the wheel events (among others) are bound correctly
                this.redraw();
              },
              onRemove: () => {
                this.svgRef = null;
              }
            },
            on: {
              click: e => {
                props.onClick?.(e);
              },
              mousedown: e => {
                if (e.button === 1) {
                  const currentTool = props.context.tool.get();
                  const panTool = new PanTool(
                    diagram,
                    DRAG_DROP_MANAGER,
                    this.svgRef,
                    props.context,
                    () => {
                      props.context.tool.set(currentTool);
                    }
                  );
                  this.setTool(panTool);
                  panTool.setResetOnMouseUp(true);
                  this.updateToolClassOnSvg('pan');
                  panTool.onMouseDown(AbstractTool.BACKGROUND, EventHelper.point(e), e);
                }
                if (e.button !== 0) return;
                this.tool!.onMouseDown(AbstractTool.BACKGROUND, EventHelper.point(e), e);
              },
              mouseover: e => {
                const el = getAncestorDiagramElement(e.target as SVGElement);
                if (!el) return;
                this.tool!.onMouseOver(el.id, EventHelper.point(e), e.currentTarget!);
                props.onMouseOver?.(e, el);
                this.hoverElement.value = el.id;
              },
              mouseout: e => {
                const el = getAncestorDiagramElement(e.target as SVGElement);
                if (!el) return;
                this.tool!.onMouseOut(el.id, EventHelper.point(e), e.currentTarget!);
                props.onMouseOut?.(e, el);
                this.hoverElement.value = undefined;
              },
              mouseup: e => this.tool!.onMouseUp(EventHelper.point(e), e, e.currentTarget!),
              mousemove: e => {
                // TODO: Could we cache this and only update in case a resize happens?
                const b = (e.currentTarget! as SVGSVGElement).getBoundingClientRect();
                this.tool!.onMouseMove(
                  {
                    x: e.clientX - b.x,
                    y: e.clientY - b.y
                  },
                  e,
                  e.currentTarget!
                );
                if (e.x >= b.left && e.x <= b.right && e.y >= b.top && e.y <= b.bottom) {
                  this.point = diagram.viewBox.toDiagramPoint({
                    x: e.x - b.left,
                    y: e.y - b.top
                  });
                }

                CollaborationConfig.Backend.awareness?.updateCursor({
                  ...this.point,
                  activeDiagramId: diagram.id
                });
              },
              contextmenu: event => {
                const bounds = this.svgRef!.getBoundingClientRect();
                const point = {
                  x: event.clientX - bounds.x,
                  y: event.clientY - bounds.y
                };

                const isClickOnSelection = Box.contains(
                  selection.bounds,
                  diagram.viewBox.toDiagramPoint(point)
                );

                if (isClickOnSelection) {
                  props.context.ui.showContextMenu(
                    'selection',
                    diagram.viewBox.toDiagramPoint(point),
                    event,
                    {}
                  );
                } else {
                  const id = (this.tool as AbstractTool).currentElement;
                  const el = diagram.lookup(id ?? '');

                  if (el && this.tool instanceof MoveTool) {
                    diagram.selection.setElements([el]);
                    props.context.ui.showContextMenu(
                      'selection',
                      diagram.viewBox.toDiagramPoint(point),
                      event,
                      {}
                    );
                  } else {
                    props.context.ui.showContextMenu(
                      'canvas',
                      diagram.viewBox.toDiagramPoint(point),
                      event,
                      {}
                    );
                  }
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
            svg.style({}, rawHTML(styles)),
            this.svgFilterDefs(),

            this.subComponent($cmp(DocumentBoundsComponent), { ...canvasState }),

            this.subComponent($cmp(GridComponent), { ...canvasState }),

            this.subComponent($cmp(CanvasGuidesComponent), { ...canvasState }),

            svg.g(
              {},
              ...diagram.layers.visible.flatMap(layer => {
                if (!isResolvableToRegularLayer(layer) && !isResolvableToModificationLayer(layer))
                  return null;
                return this.renderLayer(layer, diagram, onMouseDown, onEdgeDoubleClick);
              })
            ),

            this.tool.type === 'move'
              ? this.subComponent($cmp(SelectionComponent), { ...canvasState })
              : svg.g({}),

            this.subComponent($cmp(AnchorHighlightComponent), { ...canvasState }),

            this.subComponent($cmp(SelectionMarqueeComponent), { ...canvasState }),

            this.tool.type === 'move'
              ? this.subComponent($cmp(AnchorHandlesComponent), {
                  ...canvasState,
                  hoverElement: this.hoverElement
                })
              : svg.g({}),

            this.subComponent($cmp(AwarenessCursorComponent), { ...canvasState })
          ]
        )
      ]
    );
  }

  private updateToolClassOnSvg(s: ToolType) {
    for (const cl of this.svgRef?.classList ?? []) {
      if (cl.startsWith('tool-')) {
        this.svgRef?.classList.remove(cl);
      }
    }
    this.svgRef?.classList.add(`tool-${s}`);
  }

  private redrawElements = (e: DiagramElement[]) => {
    const resolvedElements = unique(e.map(e => (isNode(e) ? getTopMostNode(e) : e)));
    for (const element of resolvedElements) {
      if (isNode(element)) {
        this.nodeRefs.get(element.id)?.redraw();
        for (const edge of element.edges) {
          this.edgeRefs.get(edge.id)?.redraw();
        }
      } else {
        this.edgeRefs.get(element.id)?.redraw();
      }
    }
  };

  private onSelectionRedrawElement(selection: Selection) {
    createEffect(() => {
      const cb = (e: SelectionEvents['add'] | SelectionEvents['remove']) =>
        this.redrawElements([e.element]);
      selection.on('add', cb);
      return () => selection.off('add', cb);
    }, [selection]);

    createEffect(() => {
      const cb = (e: SelectionEvents['add'] | SelectionEvents['remove']) =>
        this.redrawElements([e.element]);
      selection.on('remove', cb);
      return () => selection.off('remove', cb);
    }, [selection]);
  }

  private adjustViewbox(diagram: Diagram) {
    const rect = this.svgRef!.getBoundingClientRect();

    diagram.viewBox.dimensions = {
      w: Math.floor(rect.width * diagram.viewBox.zoomLevel),
      h: Math.floor(rect.height * diagram.viewBox.zoomLevel)
    };
    diagram.viewBox.windowSize = {
      w: Math.floor(rect.width),
      h: Math.floor(rect.height)
    };
  }
}

export type Props = BaseCanvasProps & {
  offset: Point;
  tools: Partial<Record<ToolType, ToolConstructor>>;
  initialTool?: ToolType;
  onDrop?: (e: DragEvent) => void;
  onDrag?: (e: DragEvent) => void;
  onDragOver?: (e: DragEvent) => void;
  onContextMenu?: (e: MouseEvent) => void;
  onMouseOver?: (e: MouseEvent, el: { type: 'edge' | 'node'; id: string }) => void;
  onMouseOut?: (e: MouseEvent, el: { type: 'edge' | 'node'; id: string }) => void;
};

export type CanvasState = {
  context: Context;
  diagram: Diagram;
};
