import { SelectionState } from '../../model/selectionState.ts';
import { Angle } from '../../geometry/angle.ts';
import { Box } from '../../geometry/box.ts';
import { Component } from '../../base-ui/component.ts';
import * as svg from '../../base-ui/vdom-svg.ts';
import { useComponent } from '../../react-canvas-viewer/temp/useComponent.temp.ts';

class GroupBoundsComponent extends Component<Props> {
  render(props: Props) {
    const groups = props.selection.getParents();
    return svg.g(
      {},
      ...[...groups].map(g =>
        svg.rect({
          transform: `rotate(${Angle.toDeg(g.bounds.r)} ${Box.center(g.bounds).x} ${Box.center(g.bounds).y})`,
          x: g.bounds.x,
          y: g.bounds.y,
          class: 'svg-selection__group-bounds',
          width: g.bounds.w,
          height: g.bounds.h
        })
      )
    );
  }
}

// TODO: This can be rotated
export const GroupBounds = (props: Props) => {
  const ref = useComponent<Props, GroupBoundsComponent, SVGGElement>(
    () => new GroupBoundsComponent(),
    props
  );

  return <g ref={ref}></g>;
  /*
  const groups = props.selection.getParents();
  return [...groups].map(g => (
    <rect
      transform={`rotate(${Angle.toDeg(g.bounds.r)} ${Box.center(g.bounds).x} ${
        Box.center(g.bounds).y
      })`}
      key={g.id}
      x={g.bounds.x}
      y={g.bounds.y}
      className={'svg-selection__group-bounds'}
      width={g.bounds.w}
      height={g.bounds.h}
    />
  ));

 */
};

type Props = {
  selection: SelectionState;
};
