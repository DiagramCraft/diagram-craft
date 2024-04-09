import { Component } from '../../base-ui/component.ts';
import { DiagramNode } from '../../model/diagramNode.ts';
import { DefaultPathRenderer, PathRenderer, SketchPathRenderer } from './pathRenderer.temp.ts';
import { rawHTML, toInlineCSS, VNode } from '../../base-ui/vdom.ts';
import { Angle } from '@diagram-craft/geometry/src/angle.ts';
import { DeepReadonly } from '@diagram-craft/utils';
import { deepClone } from '@diagram-craft/utils';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { Tool } from '../tools/types.ts';
import { ShapeControlPointDrag } from '../../base-ui/drag/shapeControlDrag.ts';
import { DRAG_DROP_MANAGER } from '../DragDropManager.ts';
import { Modifiers } from '../../base-ui/drag/dragDropManager.ts';
import { ApplicationTriggers } from '../EditableCanvas.ts';
import { DASH_PATTERNS } from '../../base-ui/dashPatterns.ts';
import { makeShadowFilter } from '../../base-ui/styleUtils.ts';
import { EventHelper } from '../../base-ui/eventHelper.ts';
import { Diagram } from '../../model/diagram.ts';
import { FillFilter, FillPattern } from './fill.temp.ts';
import * as svg from '../../base-ui/vdom-svg.ts';
import * as html from '../../base-ui/vdom-html.ts';
import { DiagramEdge } from '../../model/diagramEdge.ts';
import { EdgeComponent } from '../EdgeComponent.ts';
import { ShapeNodeDefinition } from '../shapeNodeDefinition.ts';
import { NodeDefinition } from '../../model/elementDefinitionRegistry.ts';
import { Box, Extent, Path, Point } from '@diagram-craft/geometry';

const VALIGN_TO_FLEX_JUSTIFY = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end'
};

const withPx = (n?: number) => (n ? n + 'px' : undefined);

type ControlPointCallback = (x: number, y: number, uow: UnitOfWork) => string;

type ControlPoint = {
  x: number;
  y: number;
  cb: ControlPointCallback;
};

const makeControlPoint = (cp: ControlPoint, node: DiagramNode) => {
  return svg.circle({
    class: 'svg-shape-control-point',
    cx: cp.x,
    cy: cp.y,
    r: '4',
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
        svg.linearGradient(
          {
            id: `reflection-grad-${props.node.id}`,
            y2: '1',
            x2: '0',
            gradientUnits: 'objectBoundingBox',
            gradientTransform: `rotate(${-Angle.toDeg(props.node.bounds.r)} 0.5 0.5)`
          },
          svg.stop({ 'offset': '0.65', 'stop-color': 'white', 'stop-opacity': '0' }),
          svg.stop({ 'offset': '1', 'stop-color': 'white', 'stop-opacity': strength })
        ),
        svg.mask(
          {
            id: `reflection-mask-${props.node.id}`,
            maskContentUnits: 'objectBoundingBox'
          },
          svg.rect({
            width: '1',
            height: '1',
            fill: `url(#reflection-grad-${props.node.id})`
          })
        ),
        svg.g(
          {
            transform: `
              rotate(${-Angle.toDeg(props.node.bounds.r)} ${center.x} ${center.y})
              scale(1 -1)
              translate(0 -${2 * (pathBounds!.y + pathBounds!.h)})
              rotate(${Angle.toDeg(props.node.bounds.r)} ${center.x} ${center.y})
            `,
            mask: `url(#reflection-mask-${props.node.id})`,
            style: `filter: url(#reflection-filter); pointer-events: none`
          },
          ...props.children.map(e => deepClone(e))
        )
      ]
    : [];

  return svg.g(
    {
      style: `filter: ${props.style.filter ?? 'none'}`
    },
    ...reflection,
    ...props.children
  );
};

export class TextComponent extends Component<Props> {
  private width: number = 0;
  private height: number = 0;

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

    const updateBounds = (w: number, h: number) => {
      if (w === this.width && h === this.height) return;
      this.width = w;
      this.height = h;
      props.onSizeChange?.({ w, h });
    };

    return svg.foreignObject(
      {
        class: 'svg-node__fo',
        id: props.id,
        x: props.bounds.x.toString(),
        y: props.bounds.y.toString(),
        width: props.bounds.w.toString(),
        height: props.bounds.h.toString(),
        on: {
          mousedown: props.onMouseDown
        }
      },
      html.div(
        {
          class: 'svg-node__fo__inner',
          style: `justify-content: ${valign}`,
          on: {
            dblclick: (e: MouseEvent) => {
              const $textNode = (e.currentTarget as HTMLElement).firstChild as HTMLElement;
              $textNode.contentEditable = 'true';
              $textNode.style.pointerEvents = 'auto';
              $textNode.focus();
            }
          }
        },
        [
          html.div(
            {
              class: 'svg-node__text',
              style: toInlineCSS(style),
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
                      updateBounds(
                        (e.target as HTMLElement).offsetWidth,
                        (e.target as HTMLElement).offsetHeight
                      );
                    }
                  }, 0);
                },
                blur: (e: FocusEvent) => {
                  (e.target as HTMLElement).contentEditable = 'false';
                  (e.target as HTMLElement).style.pointerEvents = 'none';
                  props.onChange((e.target as HTMLElement).innerHTML);

                  updateBounds(
                    (e.target as HTMLElement).offsetWidth,
                    (e.target as HTMLElement).offsetHeight
                  );
                }
              },
              hooks: {
                onInsert: (n: VNode) => {
                  if (!props.text?.text) return;

                  updateBounds(
                    (n.el! as HTMLElement).offsetWidth,
                    (n.el! as HTMLElement).offsetHeight
                  );
                },
                onUpdate: (_o: VNode, n: VNode) => {
                  updateBounds(
                    (n.el! as HTMLElement).offsetWidth,
                    (n.el! as HTMLElement).offsetHeight
                  );
                }
              }
            },
            [rawHTML(props.text?.text ?? '')]
          )
        ]
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

  // TODO: Maybe we can pass Component<any> in the constructor instead
  text(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cmp: Component<any>,
    id: string = '1',
    text?: NodeProps['text'],
    bounds?: Box,
    onSizeChange?: (size: Extent) => void
  ) {
    this.children.push(
      cmp.subComponent<Props, TextComponent>('text', () => new TextComponent(), {
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
        .map(p => map(svg.path(p)))
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
  constructor(protected readonly nodeDefinition: NodeDefinition) {
    super();
  }

  abstract buildShape(props: BaseShapeBuildProps, shapeBuilder: ShapeBuilder): void;

  render(props: BaseShapeProps): VNode {
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
    this.buildShape(buildProps, shapeBuilder);

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
        svg.filter(
          {
            id: filterId,
            filterUnits: 'objectBoundingBox'
          },
          nodeProps.effects.blur
            ? svg.feGaussianBlur({ stdDeviation: 5 * nodeProps.effects.blur })
            : null,
          nodeProps.effects.opacity !== 1
            ? svg.feColorMatrix({
                type: 'matrix',
                values: `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${nodeProps.effects.opacity} 0`
              })
            : null
        )
      );
    }

    if (patternId) {
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
        svg.linearGradient(
          {
            id: `node-${props.def.id}-gradient`,
            gradientTransform: `rotate(${Angle.toDeg(nodeProps.fill.gradient.direction)} 0.5 0.5)`
          },
          svg.stop({
            'offset': '0%',
            'stop-color': nodeProps.fill.color
          }),
          svg.stop({
            'offset': '100%',
            'stop-color': nodeProps.fill.color2
          })
        )
      );
    }

    if (nodeProps.fill.type === 'gradient' && nodeProps.fill.gradient.type === 'radial') {
      level1.push(
        svg.radialGradient(
          {
            id: `node-${props.def.id}-gradient`,
            gradientTransform: `rotate(${Angle.toDeg(nodeProps.fill.gradient.direction)} 0.5 0.5)`
          },
          svg.stop({ 'offset': '0%', 'stop-color': nodeProps.fill.color }),
          svg.stop({ 'offset': '100%', 'stop-color': nodeProps.fill.color2 })
        )
      );
    }

    level1.push(
      wrapComponent({
        node: props.def,
        path: shapeBuilder.boundary!,
        style: style,
        children
      })
    );

    if (isEdgeConnect) {
      level1.push(
        svg.g(
          { transform: `rotate(${-Angle.toDeg(props.def.bounds.r)} ${center.x} ${center.y})` },
          ...props.def.anchors.map(anchor =>
            svg.circle({
              class: 'svg-node__anchor',
              cx: props.def.bounds.x + anchor.point.x * props.def.bounds.w,
              cy: props.def.bounds.y + anchor.point.y * props.def.bounds.h,
              r: '5'
            })
          )
        )
      );
    }

    return svg.g(
      {},
      ...outer,
      svg.g(
        {
          id: `node-${props.def.id}`,
          class: 'svg-node ' + nodeProps.highlight.map(h => `svg-node--highlight-${h}`).join(' '),
          transform: `rotate(${Angle.toDeg(props.def.bounds.r)} ${center.x} ${center.y})`
        },
        ...level1
      )
    );
  }

  protected makeEdge(child: DiagramEdge, props: BaseShapeBuildProps) {
    return this.subComponent(`edge-${child.id}`, () => new EdgeComponent(), {
      def: child,
      diagram: child.diagram,
      tool: props.tool,
      onDoubleClick: props.childProps.onDoubleClick ?? (() => {}),
      onMouseDown: props.childProps.onMouseDown,
      applicationTriggers: props.childProps.applicationTriggers,
      actionMap: props.actionMap
    });
  }

  protected makeNode(child: DiagramNode, props: BaseShapeBuildProps) {
    const nodeProps: BaseShapeProps = {
      def: child as DiagramNode,
      applicationTriggers: props.childProps.applicationTriggers,
      diagram: child.diagram,
      tool: props.tool,
      onMouseDown: props.childProps.onMouseDown,
      onDoubleClick: props.childProps.onDoubleClick ?? (() => {}),
      actionMap: props.actionMap
    };

    return this.subComponent(
      `node-${child.id}`,
      (props.node.diagram.nodeDefinitions.get(child.nodeType) as ShapeNodeDefinition).component!,
      nodeProps
    );
  }

  protected rotateBack(center: Point, angle: number, child: VNode) {
    return svg.g({ transform: `rotate(${-angle} ${center.x} ${center.y})` }, child);
  }
}
