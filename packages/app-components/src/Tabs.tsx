import styles from './Tabs.module.css';
import React, { CSSProperties } from 'react';
import { Tabs as BaseUITabs } from '@base-ui/react/tabs';
import { TbChevronLeft, TbChevronRight } from 'react-icons/tb';

const Root = (props: RootProps) => {
  return (
    <BaseUITabs.Root
      className={styles.cTabs}
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
  if (props.overflow) {
    return <OverflowList>{props.children}</OverflowList>;
  }

  return <BaseUITabs.List className={styles.eList}>{props.children}</BaseUITabs.List>;
};

type ListProps = {
  children: React.ReactNode;
  overflow?: boolean;
};

type ScrollState = {
  hasOverflow: boolean;
  canScrollLeft: boolean;
  canScrollRight: boolean;
};

const INITIAL_SCROLL_STATE: ScrollState = {
  hasOverflow: false,
  canScrollLeft: false,
  canScrollRight: false
};

const OverflowList = (props: { children: React.ReactNode }) => {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = React.useState(INITIAL_SCROLL_STATE);

  const updateScrollState = React.useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const nextState: ScrollState = {
      hasOverflow: maxScrollLeft > 1,
      canScrollLeft: viewport.scrollLeft > 1,
      canScrollRight: viewport.scrollLeft < maxScrollLeft - 1
    };

    setScrollState(currentState => {
      if (
        currentState.hasOverflow === nextState.hasOverflow &&
        currentState.canScrollLeft === nextState.canScrollLeft &&
        currentState.canScrollRight === nextState.canScrollRight
      ) {
        return currentState;
      }
      return nextState;
    });
  }, []);

  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    updateScrollState();
    viewport.addEventListener('scroll', updateScrollState, { passive: true });

    if (typeof ResizeObserver === 'undefined') {
      return () => viewport.removeEventListener('scroll', updateScrollState);
    }

    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(viewport);
    if (listRef.current) resizeObserver.observe(listRef.current);

    return () => {
      viewport.removeEventListener('scroll', updateScrollState);
      resizeObserver.disconnect();
    };
  }, [updateScrollState]);

  const scroll = (direction: -1 | 1) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    viewport.scrollBy({
      left: direction * Math.max(viewport.clientWidth * 0.8, 1),
      behavior: 'smooth'
    });
  };

  return (
    <div className={styles.eOverflowContainer}>
      {scrollState.hasOverflow && (
        <button
          type="button"
          className={styles.eOverflowButton}
          aria-label="Scroll tabs left"
          disabled={!scrollState.canScrollLeft}
          onClick={() => scroll(-1)}
        >
          <TbChevronLeft />
        </button>
      )}
      <div ref={viewportRef} className={styles.eOverflowViewport}>
        <BaseUITabs.List ref={listRef} className={`${styles.eList} ${styles.eOverflowList}`}>
          {props.children}
        </BaseUITabs.List>
      </div>
      {scrollState.hasOverflow && (
        <button
          type="button"
          className={styles.eOverflowButton}
          aria-label="Scroll tabs right"
          disabled={!scrollState.canScrollRight}
          onClick={() => scroll(1)}
        >
          <TbChevronRight />
        </button>
      )}
    </div>
  );
};

const Trigger = (props: TriggerProps) => {
  return (
    <BaseUITabs.Tab className={styles.eTrigger} value={props.value} disabled={props.disabled}>
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
    <BaseUITabs.Panel className={styles.eContent} value={props.value} style={props.style ?? {}}>
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
