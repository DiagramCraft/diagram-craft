import React, { JSXElementConstructor, ReactElement, ReactNode, useState } from 'react';
import { $c } from '@diagram-craft/utils/classname';
import * as Tabs from '@radix-ui/react-tabs';
import { assert, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import styles from './ToolWindow.module.css';
import { ErrorBoundary } from '../ErrorBoundary';

type RootProps = { children: React.ReactNode | React.ReactNode[]; defaultTab?: string };

const isReactElement = (
  element: ReactNode
): element is ReactElement<{ children?: ReactNode }, JSXElementConstructor<unknown>> =>
  element !== null && typeof element === 'object' && 'props' in element;

const Root = (props: RootProps) => {
  const [tab, setTab] = useState<string>(props.defaultTab ?? '');

  return (
    <Tabs.Root className={'cmp-tool-tabs'} value={tab} onValueChange={e => setTab(e)}>
      <Tabs.List className={$c('cmp-tool-tabs__tabs', { hidden: false })}>
        {React.Children.map(props.children, child => {
          assert.present(child);
          if (!isReactElement(child)) throw VERIFY_NOT_REACHED('Invalid element');
          assert.true(child.type === Tab);

          return (
            <Tabs.Trigger
              className="cmp-tool-tabs__tab-trigger util-vcenter"
              value={(child.props as TabProps).id}
            >
              {(child.props as TabProps).title}
            </Tabs.Trigger>
          );
        })}
      </Tabs.List>

      {props.children}
    </Tabs.Root>
  );
};

type TabProps = {
  children: React.ReactNode | React.ReactNode[];
  title: string;
  id: string;
};

const Tab = (props: TabProps) => {
  return <Tabs.Content value={props.id}>{props.children}</Tabs.Content>;
};

type TabContentProps = { children: React.ReactNode };

const TabContent = (props: TabContentProps) => {
  return <ErrorBoundary>{props.children}</ErrorBoundary>;
};

type TabActions = {
  children: React.ReactNode | React.ReactNode[];
};

const TabActions = (props: TabActions) => {
  return <div className={styles.tabActions}>{props.children}</div>;
};

export const ToolWindow = {
  Root: Root,
  Tab: Tab,
  TabContent: TabContent,
  TabActions: TabActions
};
