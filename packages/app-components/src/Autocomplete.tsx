import type { ReactNode, RefObject } from 'react';
import { useCallback, useImperativeHandle, useRef } from 'react';
import { Autocomplete as BaseUIAutocomplete } from '@base-ui/react/autocomplete';
import { useVirtualizer } from '@tanstack/react-virtual';
import { usePortal } from './PortalContext';
import styles from './Autocomplete.module.css';

export type AutocompleteProps<T> = {
  items: readonly T[];
  value: string;
  onValueChange: (value: string) => void;
  onSelect: (item: T) => void;
  getItemKey: (item: T) => string;
  getItemLabel: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  placeholder: string;
  ariaLabel: string;
  emptyMessage: string;
  loading?: boolean;
  errorMessage?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  inputClassName?: string;
};

type Virtualizer = ReturnType<typeof useVirtualizer<HTMLDivElement, Element>>;

const VirtualizedList = <T,>({
  getItemKey,
  renderItem,
  virtualizerRef,
  onSelect
}: Pick<AutocompleteProps<T>, 'getItemKey' | 'renderItem' | 'onSelect'> & {
  virtualizerRef: RefObject<Virtualizer | null>;
}) => {
  const filteredItems = BaseUIAutocomplete.useFilteredItems<T>();
  const scrollElementRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => 32,
    overscan: 8,
    paddingStart: 4,
    paddingEnd: 4,
    scrollPaddingStart: 4,
    scrollPaddingEnd: 4
  });

  useImperativeHandle(virtualizerRef, () => virtualizer);

  const setScrollElement = useCallback(
    (element: HTMLDivElement | null) => {
      scrollElementRef.current = element;
      if (element) virtualizer.measure();
    },
    [virtualizer]
  );

  if (filteredItems.length === 0) return null;

  return (
    <div ref={setScrollElement} className={styles.scroller} role="presentation">
      <div
        className={styles.virtualizedContent}
        role="presentation"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map(virtualItem => {
          const item = filteredItems[virtualItem.index];
          if (!item) return null;

          return (
            <BaseUIAutocomplete.Item
              key={getItemKey(item)}
              index={virtualItem.index}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              value={item}
              className={styles.item}
              aria-setsize={filteredItems.length}
              aria-posinset={virtualItem.index + 1}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                minHeight: virtualItem.size,
                transform: `translateY(${virtualItem.start}px)`
              }}
              onClick={() => onSelect(item)}
            >
              {renderItem(item)}
            </BaseUIAutocomplete.Item>
          );
        })}
      </div>
    </div>
  );
};

export const Autocomplete = <T,>(props: AutocompleteProps<T>) => {
  const portal = usePortal();
  const virtualizerRef = useRef<Virtualizer | null>(null);
  const hasQuery = props.value.trim().length > 0;

  return (
    <BaseUIAutocomplete.Root
      items={props.items}
      value={props.value}
      onValueChange={(value, details) => {
        if (details.reason !== 'item-press') props.onValueChange(value);
      }}
      itemToStringValue={props.getItemLabel}
      filter={null}
      virtualized
      open={hasQuery}
      onItemHighlighted={(_item, details) => {
        const virtualizer = virtualizerRef.current;
        if (!virtualizer) return;

        const isStart = details.index === 0;
        const isEnd = details.index === virtualizer.options.count - 1;
        if (details.reason === 'none' || (details.reason === 'keyboard' && (isStart || isEnd))) {
          queueMicrotask(() => {
            virtualizer.scrollToIndex(details.index, { align: isEnd ? 'start' : 'end' });
          });
        }
      }}
      disabled={props.disabled}
    >
      <BaseUIAutocomplete.Input
        autoFocus={props.autoFocus}
        aria-label={props.ariaLabel}
        placeholder={props.placeholder}
        value={props.value}
        className={props.inputClassName ?? styles.input}
      />
      <BaseUIAutocomplete.Portal container={portal}>
        <BaseUIAutocomplete.Positioner className={styles.positioner} sideOffset={2} align="start">
          <BaseUIAutocomplete.Popup className={styles.popup}>
            {props.loading && (
              <BaseUIAutocomplete.Status className={styles.status}>
                {'Searching…'}
              </BaseUIAutocomplete.Status>
            )}
            {!props.loading && props.errorMessage && (
              <BaseUIAutocomplete.Status className={styles.status}>
                {props.errorMessage}
              </BaseUIAutocomplete.Status>
            )}
            {!props.loading && !props.errorMessage && props.items.length === 0 && (
              <BaseUIAutocomplete.Empty className={styles.status}>
                {props.emptyMessage}
              </BaseUIAutocomplete.Empty>
            )}
            {!props.loading && !props.errorMessage && props.items.length > 0 && (
              <BaseUIAutocomplete.List className={styles.list}>
                <VirtualizedList
                  getItemKey={props.getItemKey}
                  renderItem={props.renderItem}
                  onSelect={props.onSelect}
                  virtualizerRef={virtualizerRef}
                />
              </BaseUIAutocomplete.List>
            )}
          </BaseUIAutocomplete.Popup>
        </BaseUIAutocomplete.Positioner>
      </BaseUIAutocomplete.Portal>
    </BaseUIAutocomplete.Root>
  );
};
