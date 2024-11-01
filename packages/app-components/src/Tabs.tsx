import * as RadixTabs from '@radix-ui/react-tabs';
import styles from './Tabs.module.css';
import React, { CSSProperties } from 'react';

const Root = (props: RootProps) => {
  return (
    <RadixTabs.Root className={styles.cmpTabs} defaultValue={props.defaultValue}>
      {props.children}
    </RadixTabs.Root>
  );
};

type RootProps = {
  defaultValue?: string;
  children: React.ReactNode;
};

const List = (props: ListProps) => {
  return <RadixTabs.List className={styles.cmpTabsList}>{props.children}</RadixTabs.List>;
};

type ListProps = {
  children: React.ReactNode;
};

const Trigger = (props: TriggerProps) => {
  return (
    <RadixTabs.Trigger className={styles.cmpTabsTrigger} value={props.value}>
      {props.children}
    </RadixTabs.Trigger>
  );
};

type TriggerProps = {
  value: string;
  children: React.ReactNode;
};

const Content = (props: ContentProps) => {
  return (
    <RadixTabs.Content
      className={styles.cmpTabsContent}
      value={props.value}
      style={props.style ?? {}}
    >
      {props.children}
    </RadixTabs.Content>
  );
};

type ContentProps = {
  value: string;
  children: React.ReactNode;
  style?: CSSProperties;
};

export const Tabs = {
  Root,
  List,
  Trigger,
  Content
};
