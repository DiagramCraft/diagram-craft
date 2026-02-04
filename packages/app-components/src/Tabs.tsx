import styles from './Tabs.module.css';
import React, { CSSProperties } from 'react';
import { Tabs as BaseUITabs } from '@base-ui/react/tabs';

const Root = (props: RootProps) => {
  return (
    <BaseUITabs.Root
      className={styles.cmpTabs}
      value={props.value}
      defaultValue={props.defaultValue}
      onValueChange={props.onValueChange}
    >
      {props.children}
    </BaseUITabs.Root>
  );
};

type RootProps = {
  defaultValue?: string;
  value?: string;
  children: React.ReactNode;
  onValueChange?: (value: string) => void;
};

const List = (props: ListProps) => {
  return <BaseUITabs.List className={styles.cmpTabsList}>{props.children}</BaseUITabs.List>;
};

type ListProps = {
  children: React.ReactNode;
};

const Trigger = (props: TriggerProps) => {
  return (
    <BaseUITabs.Tab className={styles.cmpTabsTrigger} value={props.value} disabled={props.disabled}>
      {props.children}
    </BaseUITabs.Tab>
  );
};

type TriggerProps = {
  value: string;
  children: React.ReactNode;
  disabled?: boolean;
};

const Content = (props: ContentProps) => {
  return (
    <BaseUITabs.Panel
      className={styles.cmpTabsContent}
      value={props.value}
      style={props.style ?? {}}
    >
      {props.children}
    </BaseUITabs.Panel>
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
