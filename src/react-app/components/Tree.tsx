import React, { createContext, ReactNode, useContext, useState } from 'react';
import { TbChevronDown, TbChevronRight } from 'react-icons/tb';
import { round } from '../../utils/math.ts';

const TreeContext = createContext<{ depth: number } | undefined>(undefined);

export const Tree = (props: TreeProps) => {
  return (
    <TreeContext.Provider value={{ depth: 0 }}>
      <div className={'cmp-tree'}>{props.children}</div>
    </TreeContext.Provider>
  );
};

type TreeProps = {
  children: React.ReactNode;
};

export const TreeNode = (props: TreeNodeProps) => {
  const [open, setOpen] = useState(props.isOpen);
  const ctx = useContext(TreeContext);
  return (
    <TreeContext.Provider value={{ depth: ctx!.depth + 1 }}>
      <div className={'cmp-tree__node'} data-depth={ctx!.depth}>
        <div className={'cmp-tree__node__label'}>
          <div className={'cmp-tree__node__label__toggle'}>
            {props.children && !open && (
              <button onClick={() => setOpen(true)}>
                <TbChevronRight />
              </button>
            )}
            {props.children && open && (
              <button onClick={() => setOpen(false)}>
                <TbChevronDown />
              </button>
            )}
          </div>

          {props.label}
        </div>
        <div className={'cmp-tree__node__value'}>{props.value}</div>
        <div className={'cmp-tree__node__action'}>{props.action}</div>
      </div>
      {open && props.children}
    </TreeContext.Provider>
  );
};

type TreeNodeProps = {
  label: string | ReactNode;
  value?: string;
  action?: string;
  isOpen?: boolean;
  children?: React.ReactNode;
};

// eslint-disable-next-line
export const ObjectTreeNode = (props: { obj: any }) => {
  return Object.keys(props.obj).map(key => {
    const v = props.obj[key];
    if (typeof v === 'number') {
      return <TreeNode key={key} label={key} value={round(v).toString()} />;
    }
    if (typeof v === 'string' || typeof v === 'boolean') {
      return <TreeNode key={key} label={key} value={v.toString()} />;
    }
    return (
      <TreeNode key={key} label={key} isOpen={true}>
        <ObjectTreeNode obj={v} />
      </TreeNode>
    );
  });
};
