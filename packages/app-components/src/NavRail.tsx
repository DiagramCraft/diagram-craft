import React, { Fragment } from 'react';
import type { IconType } from 'react-icons';
import { Tooltip } from './Tooltip';
import styles from './NavRail.module.css';

export type NavRailItem = {
  id: string;
  icon: IconType;
  tooltip: React.ReactNode;
  extra?: React.ReactNode;
  separator?: boolean;
};

export type NavRailAction = {
  id: string;
  icon: IconType;
  tooltip: string;
  onClick: () => void;
};

type NavRailProps = {
  items: NavRailItem[];
  value: string | null;
  onChange: (id: string | null) => void;
  toggle?: boolean;
  side?: 'left' | 'right';
  onItemContextMenu?: (id: string, event: React.MouseEvent) => void;
  /** Plain action buttons rendered after the last item (not selectable), e.g. an add button. */
  actions?: NavRailAction[];
};

export const NavRail = ({
  items,
  value,
  onChange,
  toggle = false,
  side = 'left',
  onItemContextMenu,
  actions
}: NavRailProps) => {
  return (
    <div className={styles.cNavRail} data-side={side}>
      {items.map(item => {
        const Icon = item.icon;
        const isActive = value === item.id;
        return (
          <Fragment key={item.id}>
            {item.separator && <div className={styles.eSeparator} />}
            <div className={styles.eItem}>
              <Tooltip
                message={item.tooltip}
                element={
                  <button
                    type="button"
                    className={styles.eButton}
                    aria-label={typeof item.tooltip === 'string' ? item.tooltip : item.id}
                    aria-pressed={isActive}
                    onClick={() => onChange(toggle && isActive ? null : item.id)}
                    onContextMenu={
                      onItemContextMenu
                        ? event => {
                            event.preventDefault();
                            onItemContextMenu(item.id, event);
                          }
                        : undefined
                    }
                  >
                    <Icon size={16} />
                  </button>
                }
              />
              {item.extra}
            </div>
          </Fragment>
        );
      })}
      {actions && actions.length > 0 && <div className={styles.eSeparator} />}
      {actions?.map(action => {
        const Icon = action.icon;
        return (
          <div key={action.id} className={styles.eItem}>
            <Tooltip
              message={action.tooltip}
              element={
                <button
                  type="button"
                  className={styles.eButton}
                  aria-label={action.tooltip}
                  onClick={action.onClick}
                >
                  <Icon size={16} />
                </button>
              }
            />
          </div>
        );
      })}
    </div>
  );
};
