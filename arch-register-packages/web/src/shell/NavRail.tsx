import styles from './NavRail.module.css';
import {
  TbHome, TbFolders, TbDatabase, TbCode, TbSearch,
  TbSparkles, TbWand,
} from 'react-icons/tb';
import type { ViewId } from '../layouts/viewId';

type NavItem = {
  id: string;
  icon: typeof TbHome;
  title: string;
  separator?: boolean;
};

const ITEMS: NavItem[] = [
  { id: 'home', icon: TbHome, title: 'Workspace overview' },
  { id: 'projects', icon: TbFolders, title: 'Projects' },
  { id: 'entities', icon: TbDatabase, title: 'Entities' },
  { id: 'model', icon: TbCode, title: 'Data model' },
  { id: 'search', icon: TbSearch, title: 'Search' },
  { id: 'assistant', icon: TbSparkles, title: 'AI Assistant', separator: true },
  { id: 'extract', icon: TbWand, title: 'AI Extract' },
];

const VIEW_TO_RAIL: Record<string, string> = {
  home: 'home',
  'project-detail': 'projects',
  'entity-browser': 'entities',
  'entity-detail': 'entities',
  'data-model': 'model',
  search: 'search',
  assistant: 'assistant',
  extract: 'extract',
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
            <div key={item.id}>
              {item.separator && <div className={styles.separator} />}
              <button
                type="button"
                title={item.title}
                className={`${styles.btn} ${active === item.id ? styles.active : ''}`}
                onClick={() => onPick(item.id)}
              >
                <Ic size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
