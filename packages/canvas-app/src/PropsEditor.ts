import { assert } from '@diagram-craft/utils/assert';
import { deepIsEmpty } from '@diagram-craft/utils/object';

type Entry<E, T> = {
  editor: E;
  name: string;
  type: T;
  pick: (props: NodeProps | EdgeProps) => Partial<NodeProps | EdgeProps>;
};
export type EditorRegistry<E, T> = Record<string, Entry<E, T>>;

/**
 * Supports editing of ElementProps using partial editors.
 * It provides methods to retrieve entries for editing and to retrieve all registered editors.
 */
export class PropsEditor<E, T> {
  constructor(
    private readonly editors: EditorRegistry<E, T>,
    private readonly props?: NodeProps | EdgeProps
  ) {}

  getEntries() {
    const props = this.props;
    assert.present(props);

    return Object.entries(this.editors)
      .map(([k, e]) => ({ ...e, kind: k, props: e.pick(props) }))
      .filter(e => !deepIsEmpty(e.props));
  }

  getAllEntries(filter: (e: Entry<E, T>) => boolean = () => true) {
    return Object.entries(this.editors)
      .filter(([, e]) => filter(e))
      .map(([k, e]) => ({ ...e, kind: k }));
  }
}
