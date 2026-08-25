import { useEffect, useRef, type ReactNode, type RefCallback } from 'react';
import { useDrag, useDragLayer, useDrop } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';
import styles from './FieldConfigList.module.css';

const ITEM_TYPE = 'field-config-row';

type DragItem = {
  id: string;
  index: number;
  listId: string;
  width: number;
};

export type FieldConfigDragHandle = {
  ref: RefCallback<HTMLElement>;
  isDragging: boolean;
};

const noopDragHandleRef: RefCallback<HTMLElement> = () => undefined;

type FieldConfigListRowProps<T> = {
  item: T;
  index: number;
  listId: string;
  getId: (item: T) => string;
  onReorder: (fromIndex: number, toIndex: number) => void;
  renderItem: (item: T, index: number, drag: FieldConfigDragHandle) => ReactNode;
};

const FieldConfigListRow = <T,>({
  item,
  index,
  listId,
  getId,
  onReorder,
  renderItem
}: FieldConfigListRowProps<T>) => {
  const rowRef = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag<DragItem, unknown, { isDragging: boolean }>({
    type: ITEM_TYPE,
    item: () => ({
      id: getId(item),
      index,
      listId,
      width: rowRef.current?.getBoundingClientRect().width ?? 0
    }),
    collect: monitor => ({ isDragging: monitor.isDragging() })
  });

  const [, drop] = useDrop<DragItem>({
    accept: ITEM_TYPE,
    hover: (dragged, monitor) => {
      if (dragged.listId !== listId) return;
      if (!rowRef.current) return;
      const dragIndex = dragged.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;

      const hoverBounds = rowRef.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBounds.bottom - hoverBounds.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientY = clientOffset.y - hoverBounds.top;

      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

      onReorder(dragIndex, hoverIndex);
      dragged.index = hoverIndex;
    }
  });

  drop(rowRef);

  // Suppress the browser's native HTML5 drag image: capturing it can misrender as a
  // full-page screenshot inside transformed/scrolled ancestors. FieldConfigList renders
  // its own floating preview via useDragLayer instead (see below).
  useEffect(() => {
    preview(getEmptyImage(), { captureDraggingState: true });
  }, [preview]);

  const dragHandleRef: RefCallback<HTMLElement> = node => {
    drag(node);
  };

  return (
    <div ref={rowRef} className={styles.row} style={{ opacity: isDragging ? 0.4 : 1 }}>
      {renderItem(item, index, { ref: dragHandleRef, isDragging })}
    </div>
  );
};

export type FieldConfigListProps<T> = {
  items: T[];
  getId: (item: T) => string;
  onReorder: (fromIndex: number, toIndex: number) => void;
  renderItem: (item: T, index: number, drag: FieldConfigDragHandle) => ReactNode;
  listId: string;
};

export const FieldConfigList = <T,>({
  items,
  getId,
  onReorder,
  renderItem,
  listId
}: FieldConfigListProps<T>) => {
  const { draggedItem, currentOffset } = useDragLayer(monitor => ({
    draggedItem: monitor.getItemType() === ITEM_TYPE ? (monitor.getItem() as DragItem) : null,
    currentOffset: monitor.getSourceClientOffset()
  }));

  const draggedListItem =
    draggedItem && draggedItem.listId === listId
      ? items.find(item => getId(item) === draggedItem.id)
      : undefined;

  return (
    <>
      {items.map((item, index) => (
        <FieldConfigListRow
          key={getId(item)}
          item={item}
          index={index}
          listId={listId}
          getId={getId}
          onReorder={onReorder}
          renderItem={renderItem}
        />
      ))}
      {draggedListItem && currentOffset && (
        <div
          className={styles.dragPreview}
          style={{
            transform: `translate(${currentOffset.x}px, ${currentOffset.y}px)`,
            width: draggedItem!.width || undefined
          }}
        >
          {renderItem(draggedListItem, items.indexOf(draggedListItem), {
            ref: noopDragHandleRef,
            isDragging: true
          })}
        </div>
      )}
    </>
  );
};
