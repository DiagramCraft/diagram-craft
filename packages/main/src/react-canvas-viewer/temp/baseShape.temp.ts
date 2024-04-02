import { Component } from '../../base-ui/component.ts';
import { MouseEventHandler } from 'react';
import { DiagramNode } from '../../model/diagramNode.ts';
import { DefaultPathRenderer, PathRenderer, SketchPathRenderer } from './pathRenderer.temp.ts';
import { Extent } from '../../geometry/extent.ts';
import { Box } from '../../geometry/box.ts';
import { h, s, t, VNode } from '../../base-ui/vdom.ts';
import { Path } from '../../geometry/path.ts';
import { Angle } from '../../geometry/angle.ts';
import { DeepReadonly } from '../../utils/types.ts';
import { deepClone } from '../../utils/object.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { Tool } from '../../react-canvas-editor/tools/types.ts';
import { ShapeControlPointDrag } from '../../base-ui/drag/shapeControlDrag.ts';
import { DRAG_DROP_MANAGER } from '../DragDropManager.ts';

const VALIGN_TO_FLEX_JUSTIFY = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end'
};

const toKebabCase = (key: string) => {
  return key.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
};

const withPx = (n?: number) => (n ? n + 'px' : undefined);

const toInlineCSS = (style: Partial<CSSStyleDeclaration>) => {
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
          s('stop', { attrs: { offset: '0.65', 'stop-color': 'white', 'stop-opacity': '0' } }),
          s('stop', { attrs: { offset: '1', 'stop-color': 'white', 'stop-opacity': strength } })
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
            props.onMouseDown({
              button: e.button,
              nativeEvent: e,
              stopPropagation() {
                e.stopPropagation();
              }
            })
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
          t(props.text?.text ?? '')
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

  constructor(private readonly props: BaseShapeProps) {}

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

  boundaryPath(path: Path) {
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
        .map(p => s('path', { attrs: p }))
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
  onMouseDown: MouseEventHandler;
  onChange: (text: string) => void;
  onSizeChange?: (size: Extent) => void;
};

export type BaseShapeProps = {
  style: Partial<CSSStyleDeclaration>;
  node: DiagramNode;
  nodeProps: DeepReadonly<NodeProps>;
  onMouseDown: MouseEventHandler<SVGGElement>;

  isSingleSelected: boolean;
  tool: Tool | undefined;
};

export abstract class BaseShape<P extends BaseShapeProps = BaseShapeProps> extends Component<P> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // @ts-ignore
  build(props: P, shapeBuilder: ShapeBuilder) {}

  // TODO: We should find a way to keep the TextComponent instance across renders
  render(props: P) {
    const shapeBuilder = new ShapeBuilder(props);
    this.build(props, shapeBuilder);

    const children = [...shapeBuilder.children];

    if (props.isSingleSelected && props.tool?.type === 'move') {
      for (const cp of shapeBuilder.controlPoints) {
        children.push(makeControlPoint(cp, props.node));
      }
    }

    return wrapComponent({
      node: props.node,
      path: shapeBuilder.boundary!,
      style: props.style,
      children: [s('g', {}, ...children)]
    });
  }
}
