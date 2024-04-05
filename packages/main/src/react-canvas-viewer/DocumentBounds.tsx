import { useDiagram } from '../react-app/context/DiagramContext.ts';
import { Component } from '../base-ui/component.ts';
import { Diagram } from '../model/diagram.ts';
import * as svg from '../base-ui/vdom-svg.ts';
import { toInlineCSS } from '../base-ui/vdom.ts';
import { useComponent } from './temp/useComponent.temp.ts';

type Props = {
  diagram: Diagram;
};

export class DocumentBoundsComponent extends Component<Props> {
  render(props: Props) {
    const diagram = props.diagram;

    // TODO: Should we really pass diagram as props and not in the constructor
    this.effectManager.add(() => {
      const cb = this.redraw.bind(this);
      diagram.on('change', cb);
      return () => diagram.off('change', cb);
    }, [diagram]);

    const style: Partial<CSSStyleDeclaration> = {};

    if (diagram.props.background?.color) {
      style.fill = diagram.props.background.color;
    }

    return svg.rect({
      class: 'svg-doc-bounds',
      x: diagram.canvas.x,
      y: diagram.canvas.y,
      width: diagram.canvas.w,
      height: diagram.canvas.h,
      style: toInlineCSS(style)
    });
  }
}

export const DocumentBounds = () => {
  const diagram = useDiagram();

  const ref = useComponent<Props, DocumentBoundsComponent, SVGGElement>(
    () => new DocumentBoundsComponent(),
    { diagram }
  );

  return <g ref={ref}></g>;

  /*  const diagram = useDiagram();
  const { x, y, w, h } = diagram.canvas;

  const redraw = useRedraw();
  useEventListener(diagram, 'change', redraw);

  const style: CSSProperties = {};

  if (diagram.props.background?.color) {
    style.fill = diagram.props.background.color;
  }

  return <rect className="svg-doc-bounds" x={x} y={y} width={w} height={h} style={style} />;

 */
};
