import React, {
  createContext,
  JSXElementConstructor,
  ReactElement,
  ReactNode,
  useContext,
  useState
} from 'react';
import { TbChevronDown, TbChevronRight } from 'react-icons/tb';
import { propsUtils } from '@diagram-craft/utils/propsUtils';
import styles from './Tree.module.css';

const isReactElement = (
  element: ReactNode
): element is ReactElement<{ children?: ReactNode }, JSXElementConstructor<unknown>> =>
  element !== null && typeof element === 'object' && 'props' in element;

type TreeContextType = {
  depth: number;
  open?: boolean;
  setOpen?: (b: boolean) => void;
  hasChildren?: boolean;
};

const TreeContext = createContext<TreeContextType | undefined>(undefined);

const Root = React.forwardRef<HTMLDivElement, RootProps>((props, ref) => {
  return (
    <TreeContext.Provider value={{ depth: 0 }}>
      <div
        {...propsUtils.filterDomProperties(props)}
        className={`${styles.cmpTree} ${props.className ?? ''}`}
        ref={ref}
      >
        {props.children}
      </div>
    </TreeContext.Provider>
  );
});

type RootProps = {
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

const Node = (props: NodeProps) => {
  const [open, setOpen] = useState(props.isOpen);
  const ctx = useContext(TreeContext);

  const hasChildren = React.Children.toArray(props.children).some(
    child => isReactElement(child) && child.type.name === 'Children'
  );

  return (
    <TreeContext.Provider value={{ depth: ctx!.depth + 1, open, setOpen, hasChildren }}>
      <div
        {...propsUtils.filterDomProperties(props)}
        className={`${styles.cmpTreeNode} ${props.className ?? ''}`}
        data-depth={ctx!.depth}
        onClick={props.onClick}
        style={{ cursor: props.onClick ? 'pointer' : 'default' }}
      >
        {React.Children.map(props.children, child => {
          return isReactElement(child) && child.type.name === 'Children' ? null : child;
        })}
      </div>
      {open &&
        React.Children.map(props.children, child => {
          return isReactElement(child) && child.type.name === 'Children'
            ? child.props.children
            : null;
        })}
    </TreeContext.Provider>
  );
};

type NodeProps = {
  isOpen?: boolean;
  children?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

const NodeLabel = (props: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) => {
  const ctx = useContext(TreeContext)!;
  return (
    <div
      {...propsUtils.filterDomProperties(props)}
      className={`${styles.cmpTreeNodeLabel} ${props.className ?? ''}`}
    >
      <div className={styles.cmpTreeNodeLabelToggle}>
        {ctx.hasChildren && !ctx.open && (
          <button onClick={() => ctx.setOpen!(true)}>
            <TbChevronRight />
          </button>
        )}
        {ctx.hasChildren && ctx.open && (
          <button onClick={() => ctx.setOpen!(false)}>
            <TbChevronDown />
          </button>
        )}
      </div>
      {props.children}
    </div>
  );
};

const NodeValue = (props: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      {...propsUtils.filterDomProperties(props)}
      {...propsUtils.filterDomProperties(props)}
      className={`${styles.cmpTreeNodeValue} ${props.className ?? ''}`}
    >
      {props.children}
    </div>
  );
};

const NodeAction = (
  props: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>
) => {
  return (
    <div
      {...propsUtils.filterDomProperties(props)}
      className={`${styles.cmpTreeNodeAction} ${props.className ?? ''}`}
    >
      {props.children}
    </div>
  );
};

const Children = (props: { children: React.ReactNode }) => {
  return props.children;
};

export const Tree = {
  Root,
  Node,
  NodeAction,
  NodeValue,
  NodeLabel,
  Children
};
