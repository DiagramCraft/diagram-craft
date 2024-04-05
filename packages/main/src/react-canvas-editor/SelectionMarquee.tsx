import { Angle } from '../geometry/angle.ts';
import { SelectionState } from '../model/selectionState.ts';
import { Component } from '../base-ui/component.ts';
import * as svg from '../base-ui/vdom-svg.ts';
import { useComponent } from '../react-canvas-viewer/temp/useComponent.temp.ts';

export class SelectionMarqueeComponent extends Component<Props> {
  render(props: Props) {
    // TODO: Is selection static, so we can pass it through the constructor
    this.effectManager.add(() => {
      const cb = this.redraw.bind(this);
      props.selection.marquee.on('change', cb);
      return () => props.selection.marquee.off('change', cb);
    }, [props.selection.marquee]);

    const bounds = props.selection.marquee.bounds;
    if (!bounds) return svg.g({});

    return svg.g(
      {},
      svg.rect({
        class: 'svg-marquee',
        x: bounds.x,
        y: bounds.y,
        width: bounds.w,
        height: bounds.h
      }),
      ...(props.selection.marquee.pendingElements?.map(e =>
        svg.rect({
          class: 'svg-marquee__element',
          x: e.bounds.x,
          y: e.bounds.y,
          width: e.bounds.w,
          height: e.bounds.h,
          transform: `rotate(${Angle.toDeg(e.bounds.r)} ${e.bounds.x + e.bounds.w / 2} ${
            e.bounds.y + e.bounds.h / 2
          })`
        })
      ) ?? [])
    );
  }
}

export const SelectionMarquee = (props: Props) => {
  const ref = useComponent<Props, SelectionMarqueeComponent, SVGGElement>(
    () => new SelectionMarqueeComponent(),
    props
  );

  return <g ref={ref}></g>;
  /*

  const redraw = useRedraw();

  useImperativeHandle(ref, () => {
    return {
      repaint: () => {
        redraw();
      }
    };
  });

  useEventListener(props.selection.marquee, 'change', redraw);

  const bounds = props.selection.marquee.bounds;
  if (!bounds) return null;

  return (
    <>
      <rect
        className={'svg-marquee'}
        x={bounds.x}
        y={bounds.y}
        width={bounds.w}
        height={bounds.h}
      />

      {props.selection.marquee.pendingElements?.map(e => (
        <rect
          key={e.id}
          className={'svg-marquee__element'}
          x={e.bounds.x}
          y={e.bounds.y}
          width={e.bounds.w}
          height={e.bounds.h}
          transform={`rotate(${Angle.toDeg(e.bounds.r)} ${e.bounds.x + e.bounds.w / 2} ${
            e.bounds.y + e.bounds.h / 2
          })`}
        />
      ))}
    </>
  );*/
};

type Props = {
  selection: SelectionState;
};
