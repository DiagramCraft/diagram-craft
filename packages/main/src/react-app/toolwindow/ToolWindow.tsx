import React, { JSXElementConstructor, ReactElement, ReactNode, useEffect, useState } from 'react';
import { assert, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import styles from './ToolWindow.module.css';
import { ErrorBoundary } from '../ErrorBoundary';
import { Tabs } from '@diagram-craft/app-components/Tabs';

type RootProps = { children: React.ReactNode | React.ReactNode[]; defaultTab?: string };

const isReactElement = (
  element: ReactNode
): element is ReactElement<{ children?: ReactNode }, JSXElementConstructor<unknown>> =>
  element !== null && typeof element === 'object' && 'props' in element;

const Root = (props: RootProps) => {
  const [tab, setTab] = useState<string>(props.defaultTab ?? '');

  useEffect(() => {
    const ids: string[] = [];
    React.Children.forEach(props.children, child => {
      if (!child) return;
      if (!isReactElement(child)) return;
      assert.true(child.type === Tab);

      ids.push((child.props as TabProps).id);
    });

    if (!ids.includes(tab)) setTab(ids[0]);
  }, [props.children]);

  return (
    <Tabs.Root value={tab} onValueChange={e => setTab(e)}>
      <Tabs.List>
        {React.Children.map(props.children, child => {
          if (!child) return null;
          assert.present(child);
          if (!isReactElement(child)) throw VERIFY_NOT_REACHED('Invalid element');
          assert.true(child.type === Tab);

          return (
            <Tabs.Trigger value={(child.props as TabProps).id}>
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
