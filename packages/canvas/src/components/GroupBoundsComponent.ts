import { Component } from '../component/component';
import * as svg from '../component/vdom-svg';
import { Transforms } from '../component/vdom-svg';
import { Selection } from '@diagram-craft/model/selection';

export class GroupBoundsComponent extends Component<Props> {
  render(props: Props) {
    const groups = [...props.selection.getParents()];
    return svg.g(
      {},
      ...groups.map(g =>
        svg.rectFromBox(g.bounds, {
          class: 'svg-selection__group-bounds',
          transform: Transforms.rotate(g.bounds)
        })
      )
    );
  }
}

type Props = {
  selection: Selection;
};
