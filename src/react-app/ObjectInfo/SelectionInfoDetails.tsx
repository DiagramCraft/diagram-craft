import { SelectionState } from '../../model/selectionState.ts';
import * as Tree from '../components/Tree.tsx';
import { ObjectTreeNode } from '../components/ObjectTreeNode.tsx';

export const SelectionInfoDetails = (props: { obj: SelectionState }) => {
  return (
    <div style={{ margin: '-10px' }}>
      <Tree.Root>
        <Tree.Node>
          <Tree.NodeLabel>bounds</Tree.NodeLabel>
          <Tree.Children>
            <ObjectTreeNode obj={props.obj.bounds} />
          </Tree.Children>
        </Tree.Node>
      </Tree.Root>
    </div>
  );
};
