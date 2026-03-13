import { TbChevronDown } from 'react-icons/tb';
import React from 'react';
import styles from './Accordion.module.css';
import { extractDataAttributes } from './utils';
import { Accordion as BaseUIAccordion } from '@base-ui/react/accordion';
import { mustExist } from '@diagram-craft/utils/assert';

const asArray = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : undefined);

const Root = (props: RootProps) => {
  return (
    <BaseUIAccordion.Root
      className={styles.cAccordion}
      multiple={props.type === 'multiple'}
      disabled={props.disabled}
      value={asArray(props.value)}
      defaultValue={asArray(props.defaultValue)}
      onValueChange={v =>
        props.type === 'single' ? props.onValueChange?.(v[0]) : props.onValueChange?.(v)
      }
    >
      {props.children}
    </BaseUIAccordion.Root>
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
    <BaseUIAccordion.Item className={styles.eItem} value={props.value}>
      {props.children}
    </BaseUIAccordion.Item>
  );
};

type ItemProps = {
  value: string;
  children: React.ReactNode;
};

const ItemHeader = React.forwardRef<HTMLButtonElement, ItemHeaderProps>((props, forwardedRef) => {
  return (
    <BaseUIAccordion.Header className={styles.eHeader}>
      <BaseUIAccordion.Trigger
        ref={forwardedRef}
        className={styles.eTrigger}
        {...extractDataAttributes(props)}
      >
        {props.children}
        <div className={styles.eChevron}>
          <TbChevronDown />
        </div>
      </BaseUIAccordion.Trigger>
    </BaseUIAccordion.Header>
  );
});

type ItemHeaderProps = {
  children: React.ReactNode;
};

const ItemHeaderButtons = (props: ItemHeaderButtonsProps) => {
  return (
    <div className={styles.eHeaderBtn} onClick={e => e.preventDefault()}>
      {props.children}
    </div>
  );
};

type ItemHeaderButtonsProps = {
  children: React.ReactNode;
};

const ItemContent = (props: ItemContentProps) => {
  return (
    <BaseUIAccordion.Panel className={styles.eContent} keepMounted={props.forceMount ?? false}>
      <div className={styles.eContentText}>{props.children}</div>
    </BaseUIAccordion.Panel>
  );
};

type ItemContentProps = {
  children: React.ReactNode;
  forceMount?: boolean;
};

const getAccordion = (e: HTMLElement) => {
  const accordionItem = e.closest(`.${mustExist(styles.eItem)}`) as HTMLElement;
  const accordionContent = accordionItem.querySelector(`.${mustExist(styles.eContent)}`) as HTMLElement;
  const accordionHeader = accordionItem.querySelector(`.${mustExist(styles.eHeader)}`) as HTMLElement;

  return { accordionItem, accordionContent, accordionHeader };
};

export const Accordion = {
  Root,
  ItemHeader,
  ItemHeaderButtons,
  ItemContent,
  Item,
  getAccordion
};
