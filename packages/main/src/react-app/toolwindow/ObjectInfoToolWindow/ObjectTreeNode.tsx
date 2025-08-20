import { Tree } from '@diagram-craft/app-components/Tree';
import { round } from '@diagram-craft/utils/math';

export const ObjectTreeNode = (props: Props) => {
  let keys: string[];
  try {
    keys = Object.keys(props.obj);
  } catch (error) {
    // Handle proxy objects with incomplete ownKeys trap
    keys = [];
  }
  
  return keys.map(key => {
    const v = props.obj[key];
    if (v === null || v === undefined) {
      return (
        <Tree.Node key={key}>
          <Tree.NodeLabel>{key}</Tree.NodeLabel>
          <Tree.NodeCell>-</Tree.NodeCell>
        </Tree.Node>
      );
    }
    if (typeof v === 'number') {
      return (
        <Tree.Node key={key}>
          <Tree.NodeLabel>{key}</Tree.NodeLabel>
          <Tree.NodeCell>{round(v).toString()}</Tree.NodeCell>
        </Tree.Node>
      );
    }
    if (typeof v === 'string' || typeof v === 'boolean') {
      return (
        <Tree.Node key={key}>
          <Tree.NodeLabel>{key}</Tree.NodeLabel>
          <Tree.NodeCell>{v.toString()}</Tree.NodeCell>
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
