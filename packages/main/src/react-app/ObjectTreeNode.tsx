import * as Tree from './components/Tree.tsx';
import { round } from '../utils/math.ts';

export const ObjectTreeNode = (props: Props) => {
  return Object.keys(props.obj).map(key => {
    const v = props.obj[key];
    if (v === null || v === undefined) {
      return (
        <Tree.Node key={key}>
          <Tree.NodeLabel>{key}</Tree.NodeLabel>
          <Tree.NodeValue>-</Tree.NodeValue>
        </Tree.Node>
      );
    }
    if (typeof v === 'number') {
      return (
        <Tree.Node key={key}>
          <Tree.NodeLabel>{key}</Tree.NodeLabel>
          <Tree.NodeValue>{round(v).toString()}</Tree.NodeValue>
        </Tree.Node>
      );
    }
    if (typeof v === 'string' || typeof v === 'boolean') {
      return (
        <Tree.Node key={key}>
          <Tree.NodeLabel>{key}</Tree.NodeLabel>
          <Tree.NodeValue>{v.toString()}</Tree.NodeValue>
        </Tree.Node>
      );
    }
    return (
      <Tree.Node key={key} isOpen={true}>
        <Tree.NodeLabel>{key}</Tree.NodeLabel>
        <Tree.Children>
          <ObjectTreeNode obj={v} />
        </Tree.Children>
      </Tree.Node>
    );
  });
};

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: any;
};
