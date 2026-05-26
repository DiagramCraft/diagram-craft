import styles from './NavRail.module.css';
import {
  TbHome, TbStack2, TbDatabase, TbCode, TbSearch,
} from 'react-icons/tb';
import type { ViewId } from '../routing';

const ITEMS = [
  { id: 'home' as const, icon: TbHome, title: 'Workspace overview' },
  { id: 'projects' as const, icon: TbStack2, title: 'Projects' },
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
};

export const NavRail = ({ view, onPick }: NavRailProps) => {
  const active = VIEW_TO_RAIL[view] ?? 'home';
  return (
    <div className={styles.rail}>
      <div className={styles.top}>
        {ITEMS.map(item => {
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
