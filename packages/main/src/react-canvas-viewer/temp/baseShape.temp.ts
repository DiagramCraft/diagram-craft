import { Component } from '../../base-ui/component.ts';
import { DiagramNode } from '../../model/diagramNode.ts';
import { DefaultPathRenderer, PathRenderer, SketchPathRenderer } from './pathRenderer.temp.ts';
import { Extent } from '../../geometry/extent.ts';
import { Box } from '../../geometry/box.ts';
import { h, r, s, VNode } from '../../base-ui/vdom.ts';
import { Path } from '../../geometry/path.ts';
import { Angle } from '../../geometry/angle.ts';
import { DeepReadonly } from '../../utils/types.ts';
import { deepClone } from '../../utils/object.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { Tool } from '../../react-canvas-editor/tools/types.ts';
import { ShapeControlPointDrag } from '../../base-ui/drag/shapeControlDrag.ts';
import { DRAG_DROP_MANAGER } from '../DragDropManager.ts';
import { Point } from '../../geometry/point.ts';
import { Modifiers } from '../../base-ui/drag/dragDropManager.ts';
import { ApplicationTriggers } from '../../react-canvas-editor/EditableCanvas.tsx';
import { DASH_PATTERNS } from '../../base-ui/dashPatterns.ts';
import { makeShadowFilter } from '../../base-ui/styleUtils.ts';
import { EventHelper } from '../../base-ui/eventHelper.ts';
import { Diagram } from '../../model/diagram.ts';
import { FillFilter, FillPattern } from './fill.temp.ts';

const VALIGN_TO_FLEX_JUSTIFY = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end'
};

const toKebabCase = (key: string) => {
  return key.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
};

const withPx = (n?: number) => (n ? n + 'px' : undefined);

// TODO: Move to vdom.ts
export const toInlineCSS = (style: Partial<CSSStyleDeclaration>) => {
  return Object.entries(style!)
    .map(([key, value]) => `${toKebabCase(key)}: ${value}`)
    .join(';');
};

type ControlPointCallback = (x: number, y: number, uow: UnitOfWork) => string;

type ControlPoint = {
  x: number;
  y: number;
  cb: ControlPointCallback;
};

const makeControlPoint = (cp: ControlPoint, node: DiagramNode) => {
  return s('circle.svg-shape-control-point', {
    attrs: {
      cx: cp.x.toString(),
      cy: cp.y.toString(),
      r: '4'
    },
    on: {
      mousedown: (e: MouseEvent) => {
        if (e.button !== 0) return;
        DRAG_DROP_MANAGER.initiate(new ShapeControlPointDrag(node, cp.cb));
        e.stopPropagation();
      }
    }
  });
};

type NodeWrapperComponentProps = {
  children: VNode[];
  node: DiagramNode;
  path: Path;
  style: Partial<CSSStyleDeclaration>;
};

const wrapComponent = (props: NodeWrapperComponentProps) => {
  const center = Box.center(props.node.bounds);

  let pathBounds: Box | undefined = undefined;
  if (props.node.props.effects?.reflection) {
    const path = props.node.diagram.nodeDefinitions
      .get(props.node.nodeType)
      .getBoundingPath(props.node);

    pathBounds = path.bounds();
  }

  const strength = props.node.props.effects?.reflectionStrength?.toString() ?? '1';
  const reflection = props.node.props.effects?.reflection
    ? [
        s(
          'linearGradient',
          {
            attrs: {
              id: `reflection-grad-${props.node.id}`,
              y2: '1',
              x2: '0',
              gradientUnits: 'objectBoundingBox',
              gradientTransform: `rotate(${-Angle.toDeg(props.node.bounds.r)} 0.5 0.5)`
            }
          },
          s('stop', { attrs: { 'offset': '0.65', 'stop-color': 'white', 'stop-opacity': '0' } }),
          s('stop', { attrs: { 'offset': '1', 'stop-color': 'white', 'stop-opacity': strength } })
        ),
        s(
          'mask',
          {
            attrs: {
              id: `reflection-mask-${props.node.id}`,
              maskContentUnits: 'objectBoundingBox'
            }
          },
          s('rect', {
            attrs: { width: '1', height: '1', fill: `url(#reflection-grad-${props.node.id})` }
          })
        ),
        s(
          'g',
          {
            attrs: {
              transform: `
                  rotate(${-Angle.toDeg(props.node.bounds.r)} ${center.x} ${center.y})
                  scale(1 -1)
                  translate(0 -${2 * (pathBounds!.y + pathBounds!.h)})
                  rotate(${Angle.toDeg(props.node.bounds.r)} ${center.x} ${center.y})
                `,
              mask: `url(#reflection-mask-${props.node.id})`,
              style: `filter: url(#reflection-filter); pointer-events: none`
            }
          },
          ...props.children.map(e => deepClone(e))
        )
      ]
    : [];

  return s(
    'g',
    {
      attrs: {
        style: `filter: ${props.style.filter}`
      }
    },
    ...reflection,
    ...props.children
  );
};

export class TextComponent extends Component<Props> {
  private width: number = 0;
  private height: number = 0;

  constructor() {
    super();
  }

  render(props: Props) {
    const style: Partial<CSSStyleDeclaration> = {
      color: props.text?.color ?? 'unset',
      fontFamily: props.text?.font ?? 'unset',
      fontSize: withPx(props.text?.fontSize) ?? 'unset',
      fontWeight: props.text?.bold ? 'bold' : 'normal',
      fontStyle: props.text?.italic ? 'italic' : 'normal',
      lineHeight: `${1.2 * (props.text?.lineHeight ?? 1) * 100}%`,
      minWidth: 'min-content',
      textDecoration: props.text?.textDecoration
        ? `${props.text.textDecoration} ${props.text.color ?? 'black'}`
        : 'none',
      textTransform: props.text?.textTransform ?? 'none',
      textAlign: props.text?.align ?? 'unset',
      paddingLeft: withPx(props.text?.left) ?? '0',
      paddingRight: withPx(props.text?.right) ?? '0',
      paddingTop: withPx(props.text?.top) ?? '0',
      paddingBottom: withPx(props.text?.bottom) ?? '0'
    };

    const valign = VALIGN_TO_FLEX_JUSTIFY[props.text?.valign ?? 'middle'];

    return s(
      'foreignObject.svg-node__fo',
      {
        attrs: {
          id: props.id,
          x: props.bounds.x.toString(),
          y: props.bounds.y.toString(),
          width: props.bounds.w.toString(),
          height: props.bounds.h.toString()
        },
        on: {
          mousedown: e =>
            // TODO: This is a massive hack
            // @ts-ignore
            props.onMouseDown(e) /*{
              button: e.button,
              nativeEvent: e,
              stopPropagation() {
                e.stopPropagation();
              }
            })*/
        }
      },
      h(
        'div.svg-node__fo__inner',
        {
          attrs: {
            style: `justify-content: ${valign}`
          },
          on: {
            dblclick: (e: MouseEvent) => {
              const $textNode = (e.currentTarget as HTMLElement).firstChild as HTMLElement;
              $textNode.contentEditable = 'true';
              $textNode.style.pointerEvents = 'auto';
              $textNode.focus();
            }
          }
        },
        h(
          'div.svg-node__text',
          {
            attrs: {
              style: toInlineCSS(style)
            },
            on: {
              keydown: (e: KeyboardEvent) => {
                const target = e.target as HTMLElement;
                if (e.key === 'Escape') {
                  target.innerText = props.text?.text ?? '';
                  target.blur();
                } else if (e.key === 'Enter' && e.metaKey) {
                  target.blur();
                }

                setTimeout(() => {
                  const w = target.offsetWidth;
                  const h = target.offsetHeight;
                  if (w !== this.width || h !== this.height) {
                    props.onSizeChange?.({ w, h });
                    this.width = w;
                    this.height = h;
                  }
                }, 0);
              },
              blur: (e: FocusEvent) => {
                (e.target as HTMLElement).contentEditable = 'false';
                (e.target as HTMLElement).style.pointerEvents = 'none';
                props.onChange((e.target as HTMLElement).innerHTML);
                props.onSizeChange?.({
                  w: (e.target as HTMLElement).offsetWidth,
                  h: (e.target as HTMLElement).offsetHeight
                });
              }
            },
            hooks: {
              onInsert: (n: VNode) => {
                if (!props.text?.text) return;
                props.onSizeChange?.({
                  w: (n.el! as HTMLElement).offsetWidth,
                  h: (n.el! as HTMLElement).offsetHeight
                });
              },
              onUpdate: (_o: VNode, n: VNode) => {
                if (
                  (n.el! as HTMLElement).offsetWidth !== this.width ||
                  (n.el! as HTMLElement).offsetHeight !== this.height
                ) {
                  props.onSizeChange?.({
                    w: (n.el! as HTMLElement).offsetWidth,
                    h: (n.el! as HTMLElement).offsetHeight
                  });
                }
              }
            }
          },
          r(props.text?.text ?? '')
        )
      )
    );
  }
}

const defaultOnChange = (node: DiagramNode) => (text: string) => {
  UnitOfWork.execute(node.diagram, uow => {
    node.updateProps(props => {
      props.text ??= {};
      props.text.text = text;
    }, uow);
  });
};

export class ShapeBuilder {
  children: VNode[] = [];
  boundary: Path | undefined = undefined;
  controlPoints: ControlPoint[] = [];

  constructor(private readonly props: BaseShapeBuildProps) {}

  add(vnode: VNode) {
    this.children.push(vnode);
  }

  text(
    id: string = '1',
    text?: NodeProps['text'],
    bounds?: Box,
    onSizeChange?: (size: Extent) => void
  ) {
    const c = new TextComponent();
    this.children.push(
      c.render({
        id: `text_${id}_${this.props.node.id}`,
        text: text ?? this.props.nodeProps.text,
        bounds: bounds ?? this.props.node.bounds,
        onMouseDown: this.props.onMouseDown,
        onChange: defaultOnChange(this.props.node),
        onSizeChange: onSizeChange
      })
    );
  }

  boundaryPath(path: Path, map: (n: VNode) => VNode = a => a) {
    const pathRenderer: PathRenderer = this.props.node.props.effects?.sketch
      ? new SketchPathRenderer()
      : new DefaultPathRenderer();

    const paths = pathRenderer.render(this.props.node, {
      path: path,
      style: this.props.style
    });
    this.children.push(
      ...paths
        .map(path => ({
          d: path.path,
          x: this.props.node.bounds.x.toString(),
          y: this.props.node.bounds.y.toString(),
          width: this.props.node.bounds.w.toString(),
          height: this.props.node.bounds.h.toString(),
          class: 'svg-node__boundary svg-node',
          style: toInlineCSS(path.style)
        }))
        .map(p => map(s('path', { attrs: p })))
    );
  }

  controlPoint(x: number, y: number, cb: ControlPointCallback) {
    this.controlPoints.push({ x, y, cb });
  }
}

type Props = {
  id: string;
  text: NodeProps['text'];
  bounds: Box;
  onMouseDown: (e: MouseEvent) => void;
  onChange: (text: string) => void;
  onSizeChange?: (size: Extent) => void;
};

export type BaseShapeProps = {
  def: DiagramNode;
  diagram: Diagram;
  tool: Tool | undefined;
  onMouseDown: (id: string, coord: Point, modifiers: Modifiers) => void;
  onDoubleClick?: (id: string, coord: Point) => void;
  mode?: 'picker' | 'canvas';
  applicationTriggers: ApplicationTriggers;

  actionMap: Partial<ActionMap>;
};

export type BaseShapeBuildProps = {
  style: Partial<CSSStyleDeclaration>;
  nodeProps: DeepReadonly<NodeProps>;
  isSingleSelected: boolean;

  node: DiagramNode;
  onMouseDown: (e: MouseEvent) => void;

  tool: Tool | undefined;
  actionMap: Partial<ActionMap>;
  childProps: {
    onMouseDown: (id: string, coord: Point, modifiers: Modifiers) => void;
    onDoubleClick?: (id: string, coord: Point) => void;
    applicationTriggers: ApplicationTriggers;
  };
};

export abstract class BaseShape extends Component<BaseShapeProps> {
  protected currentProps: BaseShapeProps | undefined;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // @ts-ignore
  build(props: BaseShapeBuildProps, shapeBuilder: ShapeBuilder) {}

  // TODO: We should find a way to keep the TextComponent instance across renders
  render(props: BaseShapeProps): VNode {
    this.currentProps = props;

    const $d = props.def.diagram;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;

      const target = document.getElementById(`diagram-${$d.id}`) as HTMLElement | undefined;
      if (!target) return;

      props.onMouseDown(props.def.id, EventHelper.pointWithRespectTo(e, target), e);
      e.stopPropagation();
    };

    const nodeProps = props.def.propsForRendering;

    const center = Box.center(props.def.bounds);

    const isSelected = $d.selectionState.elements.includes(props.def);
    const isSingleSelected = isSelected && $d.selectionState.elements.length === 1;
    const isEdgeConnect = nodeProps.highlight.includes('edge-connect');

    const style: Partial<CSSStyleDeclaration> = {
      fill: nodeProps.fill.color,
      strokeWidth: nodeProps.stroke.width?.toString(),
      stroke: isEdgeConnect ? 'red' : nodeProps.stroke.color
    };

    let patternId = undefined;

    if (nodeProps.fill.type === 'gradient') {
      style.fill = `url(#node-${props.def.id}-gradient)`;
    } else if (nodeProps.fill.type === 'image' || nodeProps.fill.type === 'texture') {
      patternId = `node-${props.def.id}-pattern`;
      style.fill = `url(#${patternId})`;
    } else if (nodeProps.fill.type === 'pattern' && nodeProps.fill.pattern !== '') {
      patternId = `node-${props.def.id}-pattern`;
      style.fill = `url(#${patternId})`;
    }

    if (nodeProps.stroke.pattern) {
      style.strokeDasharray = DASH_PATTERNS[nodeProps.stroke.pattern]?.(
        nodeProps.stroke.patternSize / 100,
        nodeProps.stroke.patternSpacing / 100
      );
    }

    if (nodeProps.shadow.enabled) {
      style.filter = makeShadowFilter(nodeProps.shadow);
    }

    if (nodeProps.stroke.enabled === false) {
      style.stroke = 'transparent';
      style.strokeWidth = '0';
    }

    if (nodeProps.fill.enabled === false) {
      style.fill = 'transparent';
    }

    let filterId = undefined;
    if (nodeProps.effects.blur || nodeProps.effects.opacity !== 1) {
      filterId = `node-${props.def.id}-filter`;
      style.filter = `url(#${filterId})`;
    }

    const buildProps: BaseShapeBuildProps = {
      node: props.def,
      actionMap: props.actionMap,
      tool: props.tool,
      onMouseDown: onMouseDown,
      style,
      nodeProps,
      isSingleSelected,
      childProps: {
        onMouseDown: props.onMouseDown,
        onDoubleClick: props.onDoubleClick,
        applicationTriggers: props.applicationTriggers
      }
    };

    const shapeBuilder = new ShapeBuilder(buildProps);
    this.build(buildProps, shapeBuilder);

    const children = [...shapeBuilder.children];

    if (isSingleSelected && props.tool?.type === 'move') {
      for (const cp of shapeBuilder.controlPoints) {
        children.push(makeControlPoint(cp, props.def));
      }
    }

    const outer: VNode[] = [];
    const level1: VNode[] = [];

    if (filterId) {
      outer.push(
        s(
          'filter',
          {
            attrs: {
              id: filterId,
              filterUnits: 'objectBoundingBox'
            }
          },
          nodeProps.effects.blur
            ? s('feGaussianBlur', {
                attrs: {
                  stdDeviation: 5 * nodeProps.effects.blur
                }
              })
            : null,
          nodeProps.effects.opacity !== 1
            ? s('feColorMatrix', {
                attrs: {
                  type: 'matrix',
                  values: `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${nodeProps.effects.opacity} 0`
                }
              })
            : null
        )
      );
    }

    if (patternId) {
      /*      const fillFilter = this.subComponent('fillFilter', () => new FillFilter());
      outer.push(fillFilter.render({ patternId, nodeProps }));

      const fillPattern = this.subComponent('fillPattern', () => new FillPattern());
      outer.push(fillPattern.render({ patternId, nodeProps, def: props.def })); */

      outer.push(this.subComponent('fillFilter', () => new FillFilter(), { patternId, nodeProps }));
      outer.push(
        this.subComponent('fillPattern', () => new FillPattern(), {
          patternId,
          nodeProps,
          def: props.def
        })
      );
    }

    if (nodeProps.fill.type === 'gradient' && nodeProps.fill.gradient.type === 'linear') {
      level1.push(
        s(
          'linearGradient',
          {
            attrs: {
              id: `node-${props.def.id}-gradient`,
              gradientTransform: `rotate(${Angle.toDeg(nodeProps.fill.gradient.direction)} 0.5 0.5)`
            }
          },
          s('stop', {
            attrs: {
              'offset': '0%',
              'stop-color': nodeProps.fill.color
            }
          }),
          s('stop', {
            attrs: {
              'offset': '100%',
              'stop-color': nodeProps.fill.color2
            }
          })
        )
      );
    }

    if (nodeProps.fill.type === 'gradient' && nodeProps.fill.gradient.type === 'radial') {
      level1.push(
        s(
          'radialGradient',
          {
            attrs: {
              id: `node-${props.def.id}-gradient`,
              gradientTransform: `rotate(${Angle.toDeg(nodeProps.fill.gradient.direction)} 0.5 0.5)`
            }
          },
          s('stop', {
            attrs: {
              'offset': '0%',
              'stop-color': nodeProps.fill.color
            }
          }),
          s('stop', {
            attrs: {
              'offset': '100%',
              'stop-color': nodeProps.fill.color2
            }
          })
        )
      );
    }

    level1.push(
      wrapComponent({
        node: props.def,
        path: shapeBuilder.boundary!,
        style: style,
        children: [s('g', {}, ...children)]
      })
    );

    if (isEdgeConnect) {
      level1.push(
        s(
          'g',
          {
            attrs: {
              transform: `rotate(${-Angle.toDeg(props.def.bounds.r)} ${center.x} ${center.y})`
            }
          },
          ...props.def.anchors.map(anchor =>
            s('circle', {
              attrs: {
                class: 'svg-node__anchor',
                cx: props.def.bounds.x + anchor.point.x * props.def.bounds.w,
                cy: props.def.bounds.y + anchor.point.y * props.def.bounds.h,
                r: '5'
              }
            })
          )
        )
      );
    }

    return s(
      'g',
      {},
      ...outer,
      s(
        'g',
        {
          attrs: {
            id: `node-${props.def.id}`,
            class: 'svg-node ' + nodeProps.highlight.map(h => `svg-node--highlight-${h}`).join(' '),
            transform: `rotate(${Angle.toDeg(props.def.bounds.r)} ${center.x} ${center.y})`
          }
        },
        ...level1
      )
    );
  }
}
