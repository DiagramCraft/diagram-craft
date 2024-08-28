import { assert } from '@diagram-craft/utils/assert';
import { deepIsEmpty } from '@diagram-craft/utils/object';

export type EditorRegistry<E> = Record<
  string,
  {
    editor: E;
    name: string;
    pick: (props: NodeProps | EdgeProps) => Partial<NodeProps | EdgeProps>;
  }
>;

/**
 * Supports editing of ElementProps using partial editors.
 * It provides methods to retrieve entries for editing and to retrieve all registered editors.
 */
export class PropsEditor<E> {
  constructor(
    private readonly editors: EditorRegistry<E>,
    private readonly props?: NodeProps | EdgeProps
  ) {}

  getEntries() {
    const props = this.props;
    assert.present(props);

    return Object.entries(this.editors)
      .map(([k, e]) => ({ ...e, kind: k, props: e.pick(props) }))
      .filter(e => !deepIsEmpty(e.props));
  }

  getAllEntries() {
    return Object.entries(this.editors).map(([k, e]) => ({ ...e, kind: k }));
  }
}
