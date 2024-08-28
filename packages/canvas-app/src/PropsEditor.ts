import { assert } from '@diagram-craft/utils/assert';

const propsEntries = {
  fill: {
    name: 'Fill',
    isSet: (props: NodeProps | EdgeProps) => {
      return !!props.fill;
    },
    pick: (props: NodeProps | EdgeProps) => {
      return { fill: props.fill };
    }
  }
};

export class PropsEditor<T> {
  constructor(
    private readonly editors: Record<keyof typeof propsEntries, T>,
    private readonly props?: NodeProps | EdgeProps
  ) {}

  getEntries() {
    const props = this.props;
    assert.present(props);

    return Object.entries(propsEntries)
      .filter(([, v]) => v.isSet(props))
      .map(([k, v]) => ({
        id: k,
        ...v,
        props: v.pick(props),
        editor: this.editors[k as keyof typeof propsEntries]
      }));
  }

  getAllEntries() {
    return Object.entries(propsEntries).map(([k, v]) => ({
      id: k,
      ...v,
      editor: this.editors[k as keyof typeof propsEntries]
    }));
  }
}
