import * as RadixAccordion from '@radix-ui/react-accordion';
import { TbChevronDown } from 'react-icons/tb';
import React from 'react';
import styles from './Accordion.module.css';
import { extractDataAttributes } from './utils';

const Root = (props: RootProps) => {
  return (
    // @ts-ignore
    <RadixAccordion.Root
      className={styles.cmpAccordion}
      type={props.type}
      disabled={props.disabled}
      value={props.value}
      defaultValue={props.defaultValue}
      onValueChange={props.onValueChange}
    >
      {props.children}
    </RadixAccordion.Root>
  );
};

type RootProps = {
  disabled?: boolean;
  children: React.ReactNode;
} & (
  | {
      type: 'single';
      value?: string;
      defaultValue?: string;
      onValueChange?: (v: string) => void;
    }
  | {
      type: 'multiple';
      value?: string[];
      defaultValue?: string[];
      onValueChange?: (v: string[]) => void;
    }
);

const Item = (props: ItemProps) => {
  return (
    <RadixAccordion.Item className={styles.cmpAccordionItem} value={props.value}>
      {props.children}
    </RadixAccordion.Item>
  );
};

type ItemProps = {
  value: string;
  children: React.ReactNode;
};

const ItemHeader = React.forwardRef<HTMLButtonElement, ItemHeaderProps>((props, forwardedRef) => {
  return (
    <RadixAccordion.Header className={styles.cmpAccordionHeader}>
      <RadixAccordion.Trigger
        ref={forwardedRef}
        className={styles.cmpAccordionTrigger}
        {...extractDataAttributes(props)}
      >
        {props.children}
        <div className={styles.cmpAccordionChevron}>
          <TbChevronDown />
        </div>
      </RadixAccordion.Trigger>
    </RadixAccordion.Header>
  );
});

type ItemHeaderProps = {
  children: React.ReactNode;
};

const ItemHeaderButtons = (props: ItemHeaderButtonsProps) => {
  return (
    <div className={styles.cmpAccordionHeaderBtn} onClick={e => e.preventDefault()}>
      {props.children}
    </div>
  );
};

type ItemHeaderButtonsProps = {
  children: React.ReactNode;
};

const ItemContent = (props: ItemContentProps) => {
  return (
    <RadixAccordion.Content
      className={styles.cmpAccordionContent}
      // @ts-ignore
      forceMount={props.forceMount ?? false}
    >
      <div className={styles.cmpAccordionContentText}>{props.children}</div>
    </RadixAccordion.Content>
  );
};

type ItemContentProps = {
  children: React.ReactNode;
  forceMount?: boolean;
};

export const Accordion = {
  Root,
  ItemHeader,
  ItemHeaderButtons,
  ItemContent,
  Item
};
