import { ENTITY_TYPES } from '../data';
import styles from './TypeBadge.module.css';
import {
  TbBox, TbApi, TbServer, TbDatabase, TbCpu,
} from 'react-icons/tb';

const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  Component: TbCpu,
  Api: TbApi,
  Service: TbServer,
  Database: TbDatabase,
  Box: TbBox,
};

type TypeBadgeProps = {
  typeId: string;
  size?: number;
};

export const TypeBadge = ({ typeId, size = 18 }: TypeBadgeProps) => {
  const t = ENTITY_TYPES.find(x => x.id === typeId);
  if (!t) return null;
  const Ic = ICON_MAP[t.icon] ?? TbBox;
  return (
    <span
      className={styles.badge}
      title={t.name}
      style={{
        width: size,
        height: size,
        background: `color-mix(in oklch, ${t.color} 22%, transparent)`,
        color: t.color,
        borderColor: `color-mix(in oklch, ${t.color} 40%, transparent)`,
      }}
    >
      <Ic size={Math.round(size * 0.66)} />
    </span>
  );
};
