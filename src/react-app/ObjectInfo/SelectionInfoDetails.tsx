import { SelectionState } from '../../model/selectionState.ts';
import { ObjectTreeNode, Tree, TreeNode } from '../components/Tree.tsx';

export const SelectionInfoDetails = (props: { obj: SelectionState }) => {
  return (
    <div style={{ margin: '-0.5rem' }}>
      <Tree>
        <TreeNode label={'bounds'}>
          <ObjectTreeNode obj={props.obj.bounds} />
        </TreeNode>
      </Tree>
    </div>
  );
};
