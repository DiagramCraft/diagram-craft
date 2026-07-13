import styles from './TypeBadge.module.css';
import {
  TbBox,
  TbApi,
  TbServer,
  TbDatabase,
  TbCloud,
  TbLock,
  TbUsers,
  TbWorld,
  TbCpu,
  TbTopologyRing,
  TbFolder,
  TbTerminal,
  TbPlug,
  TbStack2,
  TbGitBranch,
  TbShield,
  TbCode,
  TbMessage,
  TbSettings,
  TbChartBar,
  TbBell,
  TbKey,
  TbMail,
  TbMapPin,
  TbClipboard,
  TbTag,
  TbLink,
  TbTruck,
  TbHeart,
  TbRocket,
  TbBuilding,
  TbPackage,
  TbPuzzle,
  TbWand,
  TbEye,
  TbFlame,
  TbSnowflake,
  TbCompass,
  TbAntenna,
  TbCertificate,
  TbBolt,
  TbPalette,
  TbMicroscope
} from 'react-icons/tb';
import type { SchemaIconId } from '../lib/schemaPresentation';

const ICON_MAP: Record<SchemaIconId, React.ComponentType<{ size: number }>> = {
  'box': TbBox,
  'api': TbApi,
  'server': TbServer,
  'database': TbDatabase,
  'cloud': TbCloud,
  'lock': TbLock,
  'users': TbUsers,
  'globe': TbWorld,
  'cpu': TbCpu,
  'network': TbTopologyRing,
  'folder': TbFolder,
  'terminal': TbTerminal,
  'plug': TbPlug,
  'layers': TbStack2,
  'git-branch': TbGitBranch,
  'shield': TbShield,
  'code': TbCode,
  'message': TbMessage,
  'settings': TbSettings,
  'chart': TbChartBar,
  'bell': TbBell,
  'key': TbKey,
  'mail': TbMail,
  'map-pin': TbMapPin,
  'clipboard': TbClipboard,
  'tag': TbTag,
  'link': TbLink,
  'truck': TbTruck,
  'heart': TbHeart,
  'rocket': TbRocket,
  'building': TbBuilding,
  'package': TbPackage,
  'puzzle': TbPuzzle,
  'wand': TbWand,
  'eye': TbEye,
  'flame': TbFlame,
  'snowflake': TbSnowflake,
  'compass': TbCompass,
  'antenna': TbAntenna,
  'certificate': TbCertificate,
  'bolt': TbBolt,
  'palette': TbPalette,
  'microscope': TbMicroscope
};

type TypeBadgeProps = {
  color: string;
  name?: string;
  size?: number;
  icon?: string | null;
};

export const TypeBadge = ({ color, name, size = 18, icon }: TypeBadgeProps) => {
  const IconComponent = (icon ? ICON_MAP[icon as SchemaIconId] : null) ?? TbBox;
  const iconSize = Math.round(size * 0.66);
  return (
    <span
      className={styles.badge}
      title={name}
      style={{
        width: size,
        height: size,
        background: `color-mix(in oklch, ${color} 22%, transparent)`,
        color: color,
        borderColor: `color-mix(in oklch, ${color} 40%, transparent)`
      }}
    >
      <IconComponent size={iconSize} />
    </span>
  );
};

export { ICON_MAP };
