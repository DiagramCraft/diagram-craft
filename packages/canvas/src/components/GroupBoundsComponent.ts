import { Component } from '../component/component';
import * as svg from '../component/vdom-svg';
import { Transform } from '../component/vdom-svg';
import { SelectionState } from '@diagram-craft/model/selectionState';

export class GroupBoundsComponent extends Component<Props> {
  render(props: Props) {
    const groups = [...props.selection.getParents()];
    return svg.g(
      {},
      ...groups.map(g =>
        svg.rectFromBox(g.bounds, {
          class: 'svg-selection__group-bounds',
          transform: Transform.rotate(g.bounds)
        })
      )
    );
  }
}

type Props = {
  selection: SelectionState;
};
