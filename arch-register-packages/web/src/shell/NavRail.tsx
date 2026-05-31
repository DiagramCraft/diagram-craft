import styles from './NavRail.module.css';
import {
  TbHome, TbFolders, TbDatabase, TbCode, TbSearch,
} from 'react-icons/tb';
import type { ViewId } from '../layouts/viewId';

const ITEMS = [
  { id: 'home' as const, icon: TbHome, title: 'Workspace overview' },
  { id: 'projects' as const, icon: TbFolders, title: 'Projects' },
  { id: 'entities' as const, icon: TbDatabase, title: 'Entities' },
  { id: 'model' as const, icon: TbCode, title: 'Data model' },
  { id: 'search' as const, icon: TbSearch, title: 'Search' },
];

const VIEW_TO_RAIL: Record<string, string> = {
  home: 'home',
  'project-detail': 'projects',
  'entity-browser': 'entities',
  'entity-detail': 'entities',
  'data-model': 'model',
  search: 'search',
};

type NavRailProps = {
  view: ViewId;
  onPick: (id: string) => void;
  visibleItemIds?: string[];
};

export const NavRail = ({ view, onPick, visibleItemIds }: NavRailProps) => {
  const active = VIEW_TO_RAIL[view] ?? 'home';
  const visible = visibleItemIds != null ? ITEMS.filter(item => visibleItemIds.includes(item.id)) : ITEMS;
  return (
    <div className={styles.rail}>
      <div className={styles.top}>
        {visible.map(item => {
          const Ic = item.icon;
          return (
            <button
              type="button"
              key={item.id}
              title={item.title}
              className={`${styles.btn} ${active === item.id ? styles.active : ''}`}
              onClick={() => onPick(item.id)}
            >
              <Ic size={16} />
            </button>
          );
        })}
      </div>
    </div>
  );
};
