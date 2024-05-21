import { toInlineCSS, VNode } from '../component/vdom';
import { $cmp, Component } from '../component/component';
import { ShapeText, ShapeTextProps } from './ShapeText';
import { DefaultPathRenderer, PathRenderer } from './PathRenderer';
import * as svg from '../component/vdom-svg';
import { ControlPoint, ControlPointCallback } from './ShapeControlPoint';
import { asDistortedSvgPath, SketchPathRenderer } from '@diagram-craft/canvas/effects/sketch';
import { Path } from '@diagram-craft/geometry/path';
import { Box } from '@diagram-craft/geometry/box';
import { Extent } from '@diagram-craft/geometry/extent';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DASH_PATTERNS } from '../dashPatterns';
import { DeepReadonly } from '@diagram-craft/utils/types';
import { Point } from '@diagram-craft/geometry/point';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { hash } from '@diagram-craft/utils/hash';
import { ArrowShape } from '../arrowShapes';
import { deepMerge } from '@diagram-craft/utils/object';
import { makeShadowFilter } from '../effects/shadow';

const defaultOnChange = (element: DiagramElement) => (text: string) => {
  UnitOfWork.execute(element.diagram, uow => {
    element.updateProps(props => {
      props.text ??= {};
      props.text.text = text;
    }, uow);
  });
};

type ShapeBuilderProps = {
  element: DiagramElement;
  elementProps: DeepReadonly<ElementProps>;
  isSingleSelected: boolean;
  onMouseDown: (e: MouseEvent) => void;
  onDoubleClick?: (e: MouseEvent) => void;
  style: Partial<CSSStyleDeclaration>;
};

type Opts = {
  map?: (n: VNode) => VNode;
  className?: string;
  style?: Partial<CSSStyleDeclaration>;
};

export class ShapeBuilder {
  nodes: VNode[] = [];
  controlPoints: ControlPoint[] = [];

  constructor(private readonly props: ShapeBuilderProps) {}

  add(vnode: VNode) {
    this.nodes.push(vnode);
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
    this.nodes.push(
      cmp.subComponent<ShapeTextProps>($cmp(ShapeText), {
        key: `text_${id}_${this.props.element.id}`,
        id: `text_${id}_${this.props.element.id}`,
        text: text ?? this.props.elementProps.text,
        bounds: bounds ?? this.props.element.bounds,
        onMouseDown: this.props.onMouseDown,
        onChange: defaultOnChange(this.props.element),
        onSizeChange: onSizeChange,
        isSingleSelected: this.props.isSingleSelected
      })
    );
  }

  boundaryPath(
    paths: Path[],
    props: NodeProps | undefined = undefined,
    textId: undefined | string = '1',
    opts?: Opts
  ) {
    opts ??= {};
    opts.map ??= a => a;
    opts.className ??= 'svg-node__boundary svg-node';
    opts.style ??= {};

    const bounds = this.props.element.bounds;

    const joinedPaths = this.processPath(props, opts, paths);

    this.nodes.push(
      ...joinedPaths
        .map(d => ({
          d: d.path,
          x: bounds.x.toString(),
          y: bounds.y.toString(),
          width: bounds.w.toString(),
          height: bounds.h.toString(),
          class: opts.className,
          style: toInlineCSS(d.style),
          on: {
            mousedown: this.props.onMouseDown,

            dblclick:
              this.props.onDoubleClick ?? (textId ? this.makeOnDblclickHandle(textId) : () => {})
          }
        }))
        .map(p => opts.map!(svg.path(p)))
    );
  }

  path(
    paths: Path[],
    props: ElementProps | DeepReadonly<ElementProps> | undefined = undefined,
    opts?: Opts
  ) {
    opts ??= {};
    opts.map ??= a => a;
    opts.style ??= {};

    const bounds = this.props.element.bounds;

    const joinedPaths = this.processPath(props, opts, paths);

    this.nodes.push(
      ...joinedPaths
        .map(p => ({
          d: p.path,
          x: bounds.x.toString(),
          y: bounds.y.toString(),
          width: bounds.w.toString(),
          height: bounds.h.toString(),
          class: opts.className,
          style: toInlineCSS(p.style) + '; pointer-events: none;'
        }))
        .map(p => opts.map!(svg.path(p)))
    );
  }

  edge(
    paths: Path[],
    props: ElementProps | DeepReadonly<ElementProps> | undefined = undefined,
    startArrow: ArrowShape | undefined = undefined,
    endArrow: ArrowShape | undefined = undefined,
    opts?: Opts
  ) {
    opts ??= {};
    opts.map ??= a => a;
    opts.style ??= {};
    opts.className ??= 'svg-edge';

    const style = deepMerge({}, this.props.style, props ? this.makeStyle(props) : {}, opts.style);

    const seed = hash(new TextEncoder().encode(this.props.element.id));
    const path = paths
      .map(p =>
        props?.effects?.sketch
          ? asDistortedSvgPath(p, seed, {
              passes: 2,
              amount: props.effects.sketchStrength ?? 0.1,
              unidirectional: true
            })
          : p.asSvgPath()
      )
      .join(', ');

    this.nodes.push(
      ...[
        svg.path({
          'class': opts.className,
          'd': path,
          'stroke': 'transparent',
          'stroke-width': 15
        }),
        svg.path({
          'class': opts.className,
          'd': path,
          'style': toInlineCSS(style),
          'marker-start': startArrow ? `url(#s_${this.props.element.id})` : '',
          'marker-end': endArrow ? `url(#e_${this.props.element.id})` : ''
        })
      ]
    );
  }

  controlPoint(p: Point, cb: ControlPointCallback) {
    this.controlPoints.push({ ...p, cb });
  }

  makeOnDblclickHandle(textId: string | undefined = '1') {
    return () => {
      const editable = this.getTextElement(textId);
      if (!editable) return;

      editable.contentEditable = 'true';
      editable.style.pointerEvents = 'auto';
      editable.onmousedown = (e: MouseEvent) => {
        if (editable.contentEditable === 'true') {
          e.stopPropagation();
        }
      };
      editable.focus();

      setTimeout(() => {
        document.execCommand('selectAll', false, undefined);
      }, 0);
    };
  }

  private getTextElement(textId: string | undefined) {
    return document
      .getElementById(`text_${textId}_${this.props.element.id}`)
      ?.getElementsByClassName('svg-node__text')
      .item(0) as HTMLDivElement | undefined | null;
  }

  private makeStyle(
    props: ElementProps | DeepReadonly<ElementProps>
  ): Partial<CSSStyleDeclaration> {
    const style: Partial<CSSStyleDeclaration> = {};
    style.strokeWidth = props.stroke!.width?.toString();
    style.stroke = props.stroke!.color;
    style.fill = props.fill!.color;
    style.strokeMiterlimit = props.stroke!.miterLimit?.toString();
    style.strokeLinecap = props.stroke!.lineCap;
    style.strokeLinejoin = props.stroke!.lineJoin;

    if (props.stroke!.pattern !== 'SOLID') {
      const p = DASH_PATTERNS[props.stroke!.pattern as unknown as keyof typeof DASH_PATTERNS];
      if (!p) {
        style.strokeDasharray = props.stroke!.pattern;
      } else {
        style.strokeDasharray = p(
          (props.stroke!.patternSize ?? 50) / 100,
          (props.stroke!.patternSpacing ?? 50) / 100
        );
      }
    }

    if (props.fill?.type === 'gradient') {
      const gradientId = `node-${this.props.element.id}-gradient`;
      style.fill = `url(#${gradientId})`;
    }

    if (props.shadow?.enabled) {
      style.filter = makeShadowFilter(props.shadow);
    }

    style.opacity = (props.effects?.opacity ?? 1).toString();

    return style;
  }

  private processPath(
    props: NodeProps | undefined,
    opts: {
      map?: (n: VNode) => VNode;
      className?: string;
      style?: Partial<CSSStyleDeclaration>;
    },
    paths: Path[]
  ) {
    const propsInEffect = props ?? (this.props.element.propsForRendering as NodeProps);
    const pathRenderer: PathRenderer = propsInEffect.effects?.sketch
      ? new SketchPathRenderer()
      : new DefaultPathRenderer();

    const style = deepMerge(
      {},
      this.props.style,
      props ? this.makeStyle(props) : {},
      opts.style ?? {}
    );

    const renderedPaths = paths.map(p =>
      pathRenderer.render(this.props.element, { path: p, style })
    );

    const joinedPaths: Array<{ path: string; style: Partial<CSSStyleDeclaration> }> = [];
    for (let i = 0; i < renderedPaths[0].length; i++) {
      joinedPaths.push({
        path: renderedPaths.map(p => p[i].path).join(', '),
        style: renderedPaths[0][i].style
      });
    }
    return joinedPaths;
  }
}
