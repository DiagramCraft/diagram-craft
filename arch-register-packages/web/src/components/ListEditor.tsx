import type { ReactNode, RefCallback } from 'react';
import { useId } from 'react';
import { TbChevronDown, TbChevronUp, TbGripVertical, TbPlus, TbTrash } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { FieldConfigList } from './FieldConfigList';
import { FormGroup } from './FormGroup';
import { useListEditor, type ListEditorApi } from './useListEditor';
import styles from './ListEditor.module.css';

const noopDragRef: RefCallback<HTMLElement> = () => undefined;

export type ListEditorItemContext<T> = {
  index: number;
  /** Ref for a drag handle. A no-op unless the list is draggable and enabled, so it is always safe to attach. */
  dragRef: RefCallback<HTMLElement>;
  update: (patch: Partial<T>) => void;
  replace: (item: T) => void;
  remove: () => void;
  /** Moves the item by `delta` positions (e.g. ±1 for keyboard-accessible controls). No-op when out of range or when reordering is off. */
  moveBy: (delta: number) => void;
};

type ControlledProps<T> = {
  /** Controlled mode: the list edits the array itself */
  onChange: (items: T[]) => void;
  createItem: () => T;
  /** Row key. Omit when items have no stable id (or an editable one); keys are then tracked internally. */
  getId?: (item: T) => string;
  operations?: false;
  onAdd?: never;
  onMove?: never;
  onRemove?: never;
};

type OperationsProps<T> = {
  operations: true;
  /** Operations mode: the owner applies add, move and remove itself (e.g. domain logic, grouped lists) */
  onAdd?: () => void;
  /** Required for reorderable lists */
  onMove?: (fromIndex: number, toIndex: number) => void;
  onRemove?: (item: T, index: number) => void;
  getId: (item: T) => string;
  onChange?: never;
  createItem?: never;
};

type BaseProps<T> = {
  items: T[];
  addLabel: string;
  /** Section label. When set, the list is wrapped in a FormGroup with the add button as its action; otherwise the add button sits below the list */
  label?: string;
  supplementaryLabel?: string;
  /** `none` renders the list without the section wrapper, for parents that draw their own header. Ignores `label`; the add button then sits below the list. */
  header?: 'section' | 'none';
  /** Replaces the default add button, e.g. a menu of item types; `false` shows no add control at all. Hidden when the list is disabled. */
  addControl?: ReactNode | false;
  /** Disables the add button while keeping it visible, e.g. when there is nothing to create an item from */
  addDisabled?: boolean;
  /** Shown when there are no items */
  emptyMessage?: string;
  /**
   * `row` is compact with controls inline; `card` gives each item room for a multi-line form;
   * `bare` renders `renderItem` as is, for items that bring their own handle, menu and box.
   */
  layout?: 'row' | 'card' | 'bare';
  /** `drag+buttons` adds up/down buttons next to the drag handle for keyboard-accessible reordering */
  reorder?: 'drag' | 'drag+buttons' | 'none';
  disabled?: boolean;
  canRemove?: (item: T, index: number) => boolean;
  maxItems?: number;
  /** Extra class on each item's outer element (handle, content and actions) */
  itemClassName?: string | ((item: T, ctx: ListEditorItemContext<T>) => string);
  /** Called when an item is clicked, e.g. to select it */
  onItemClick?: (item: T, ctx: ListEditorItemContext<T>) => void;
  /** Extra controls in the section header next to the add button (only with `label`) */
  headerActions?: ReactNode;
  renderItem: (item: T, ctx: ListEditorItemContext<T>) => ReactNode;
  /** Full-width content below the item's main row, inside the item (e.g. a divided details section) */
  renderFooter?: (item: T, ctx: ListEditorItemContext<T>) => ReactNode;
  /** Extra per-item controls shown before the remove button */
  renderActions?: (item: T, ctx: ListEditorItemContext<T>) => ReactNode;
  removeLabel?: string;
};

export type ListEditorProps<T> = BaseProps<T> & (ControlledProps<T> | OperationsProps<T>);

export const ListEditor = <T,>(props: ListEditorProps<T>) => {
  const {
    items,
    getId,
    addLabel,
    addDisabled = false,
    label,
    supplementaryLabel,
    header = 'section',
    addControl,
    emptyMessage,
    layout = 'row',
    reorder = 'none',
    disabled = false,
    canRemove,
    maxItems,
    itemClassName,
    onItemClick,
    headerActions,
    renderItem,
    renderActions,
    renderFooter,
    removeLabel = 'Remove'
  } = props;

  const listId = useId();
  const operations = props.operations === true;
  const controlled = useListEditor(items, props.onChange ?? (() => undefined), getId);
  const list: ListEditorApi<T> = operations
    ? {
        ...controlled,
        keys: items.map(item => getId?.(item) ?? ''),
        append: () => props.onAdd?.(),
        move: (from, to) => props.onMove?.(from, to),
        remove: index => {
          const item = items[index];
          if (item !== undefined) props.onRemove?.(item, index);
        }
      }
    : controlled;
  const add = () => (operations ? props.onAdd?.() : controlled.append(props.createItem?.() as T));
  const entries = items.map((item, index) => ({
    key: list.keys[index] ?? String(index),
    item,
    index
  }));

  const addButton =
    !disabled && (maxItems === undefined || items.length < maxItems)
      ? addControl === false
        ? null
        : (addControl ?? (
            <Button size="xs" icon={<TbPlus size={11} />} onClick={add} disabled={addDisabled}>
              {addLabel}
            </Button>
          ))
      : null;
  const sectioned = header === 'section' && label !== undefined;

  const draggable = (reorder === 'drag' || reorder === 'drag+buttons') && !disabled;

  const renderEntry = (
    entry: (typeof entries)[number],
    dragRef?: React.RefCallback<HTMLElement>
  ) => (
    <ListEditorItem
      layout={layout}
      list={list}
      item={entry.item}
      index={entry.index}
      disabled={disabled}
      removable={
        (operations ? props.onRemove !== undefined : true) &&
        (canRemove ? canRemove(entry.item, entry.index) : true)
      }
      removeLabel={removeLabel}
      itemClassName={itemClassName}
      onItemClick={onItemClick}
      dragRef={draggable ? dragRef : undefined}
      count={items.length}
      moveButtons={reorder === 'drag+buttons' && !disabled}
      renderItem={renderItem}
      renderActions={renderActions}
      renderFooter={renderFooter}
    />
  );

  const body = (
    <div className={styles.root}>
      {items.length === 0 ? (
        emptyMessage && <div className={styles.emptyMessage}>{emptyMessage}</div>
      ) : draggable ? (
        <FieldConfigList
          items={entries}
          getId={entry => entry.key}
          listId={listId}
          onReorder={list.move}
          renderItem={(entry, _index, drag) => renderEntry(entry, drag.ref)}
        />
      ) : (
        entries.map(entry => <div key={entry.key}>{renderEntry(entry)}</div>)
      )}

      {!sectioned && addButton && <div className={styles.footer}>{addButton}</div>}
    </div>
  );

  if (!sectioned) return body;

  return (
    <FormGroup
      variant="section"
      label={label ?? ''}
      supplementaryLabel={supplementaryLabel}
      action={
        headerActions || addButton ? (
          <>
            {headerActions}
            {addButton}
          </>
        ) : undefined
      }
    >
      {body}
    </FormGroup>
  );
};

const ListEditorItem = <T,>(props: {
  layout: 'row' | 'card' | 'bare';
  list: ListEditorApi<T>;
  item: T;
  index: number;
  disabled: boolean;
  removable: boolean;
  removeLabel: string;
  itemClassName?: ListEditorProps<T>['itemClassName'];
  onItemClick?: ListEditorProps<T>['onItemClick'];
  dragRef?: React.RefCallback<HTMLElement>;
  count: number;
  moveButtons: boolean;
  renderItem: ListEditorProps<T>['renderItem'];
  renderActions?: ListEditorProps<T>['renderActions'];
  renderFooter?: ListEditorProps<T>['renderFooter'];
}) => {
  const { list, index, item } = props;
  const ctx: ListEditorItemContext<T> = {
    index,
    dragRef: props.dragRef ?? noopDragRef,
    update: patch => list.update(index, patch),
    replace: next => list.replace(index, next),
    remove: () => list.remove(index),
    moveBy: delta => {
      const to = index + delta;
      if (!props.dragRef || delta === 0 || to < 0 || to >= props.count) return;
      list.move(index, to);
    }
  };

  if (props.layout === 'bare') return <>{props.renderItem(item, ctx)}</>;

  return (
    <div
      className={`${styles.item} ${props.layout === 'card' ? styles.itemBox : ''} ${typeof props.itemClassName === 'function' ? props.itemClassName(item, ctx) : (props.itemClassName ?? '')}`}
      onClick={props.onItemClick ? () => props.onItemClick?.(item, ctx) : undefined}
    >
      <div
        className={`${styles.main} ${props.layout === 'card' ? styles.mainCard : styles.mainRow}`}
      >
        {props.dragRef && (
          <span ref={props.dragRef} className={styles.handle} title="Drag to reorder">
            <TbGripVertical size={14} />
          </span>
        )}
        <div className={styles.content}>{props.renderItem(item, ctx)}</div>
        {!props.disabled && (
          <div className={styles.actions}>
            {props.moveButtons && (
              <>
                <Button
                  variant="icon-only"
                  size="sm"
                  icon={<TbChevronUp size={12} />}
                  aria-label="Move up"
                  title="Move up"
                  disabled={index === 0}
                  onClick={() => ctx.moveBy(-1)}
                />
                <Button
                  variant="icon-only"
                  size="sm"
                  icon={<TbChevronDown size={12} />}
                  aria-label="Move down"
                  title="Move down"
                  disabled={index === props.count - 1}
                  onClick={() => ctx.moveBy(1)}
                />
              </>
            )}
            {props.renderActions?.(item, ctx)}
            {props.removable && (
              <Button
                variant="icon-only"
                size="sm"
                icon={<TbTrash size={12} />}
                aria-label={props.removeLabel}
                title={props.removeLabel}
                onClick={ctx.remove}
              />
            )}
          </div>
        )}
      </div>
      {props.renderFooter?.(item, ctx)}
    </div>
  );
};
