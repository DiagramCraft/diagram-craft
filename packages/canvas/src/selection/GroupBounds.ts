import { SelectionState } from '@diagram-craft/model';
import { Angle } from '@diagram-craft/geometry/src/angle.ts';
import { Component } from '../component/component.ts';
import * as svg from '../component/vdom-svg.ts';
import { Box } from '@diagram-craft/geometry';

export class GroupBoundsComponent extends Component<Props> {
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

type Props = {
  selection: SelectionState;
};
