import React, {
  createContext,
  JSXElementConstructor,
  ReactElement,
  ReactNode,
  useContext,
  useState
} from 'react';
import { TbChevronDown, TbChevronRight } from 'react-icons/tb';
import { propsUtils } from '../propsUtils.ts';

const isReactElement = (
  element: ReactNode
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): element is ReactElement<any, JSXElementConstructor<any>> =>
  element !== null && typeof element === 'object' && 'props' in element;

type TreeContextType = {
  depth: number;
  open?: boolean;
  setOpen?: (b: boolean) => void;
  hasChildren?: boolean;
};

const TreeContext = createContext<TreeContextType | undefined>(undefined);

export const Root = (props: RootProps) => {
  return (
    <TreeContext.Provider value={{ depth: 0 }}>
      <div
        {...propsUtils.filterDomProperties(props)}
        className={`cmp-tree ${props.className ?? ''}`}
      >
        {props.children}
      </div>
    </TreeContext.Provider>
  );
};

type RootProps = {
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

export const Node = (props: NodeProps) => {
  const [open, setOpen] = useState(props.isOpen);
  const ctx = useContext(TreeContext);

  const hasChildren = React.Children.toArray(props.children).some(
    child => isReactElement(child) && child.type.name === 'Children'
  );

  return (
    <TreeContext.Provider value={{ depth: ctx!.depth + 1, open, setOpen, hasChildren }}>
      <div
        {...propsUtils.filterDomProperties(props)}
        className={`cmp-tree__node ${props.className ?? ''}`}
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

export const NodeLabel = (
  props: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>
) => {
  const ctx = useContext(TreeContext)!;
  return (
    <div
      {...propsUtils.filterDomProperties(props)}
      className={`cmp-tree__node__label ${props.className ?? ''}`}
    >
      <div className={'cmp-tree__node__label__toggle'}>
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

export const NodeValue = (
  props: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>
) => {
  return (
    <div
      {...propsUtils.filterDomProperties(props)}
      {...propsUtils.filterDomProperties(props)}
      className={`cmp-tree__node__value ${props.className ?? ''}`}
    >
      {props.children}
    </div>
  );
};

export const NodeAction = (
  props: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>
) => {
  return (
    <div
      {...propsUtils.filterDomProperties(props)}
      className={`cmp-tree__node__action ${props.className ?? ''}`}
    >
      {props.children}
    </div>
  );
};

export const Children = (props: { children: React.ReactNode }) => {
  return props.children;
};
