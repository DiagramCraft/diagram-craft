import { Children, useState, type ReactElement, type ReactNode } from 'react';
import styles from './Tabs.module.css';

type TabItemProps = { label?: string; children?: ReactNode };

export const Tabs = ({ children }: { children?: ReactNode }) => {
  const items = Children.toArray(children) as ReactElement<TabItemProps>[];
  const [active, setActive] = useState(0);
  // Clamp instead of storing a validated index: content can change (e.g. a
  // tab removed elsewhere in a live-editing preview) without this component
  // remounting, so the raw `active` state can point past the current length.
  const activeIndex = items.length === 0 ? 0 : Math.min(active, items.length - 1);

  return (
    <div className={styles.container} data-count={items.length}>
      <div className={styles.tabList} role="tablist">
        {items.map((item, idx) => (
          <button
            key={item.key ?? idx}
            type="button"
            role="tab"
            aria-selected={idx === activeIndex}
            className={`${styles.tabButton} ${idx === activeIndex ? styles.tabButtonActive : ''}`}
            onClick={() => setActive(idx)}
          >
            {item.props.label?.trim() ? item.props.label : `Tab ${idx + 1}`}
          </button>
        ))}
      </div>
      <div className={styles.panels}>{items[activeIndex]}</div>
    </div>
  );
};
