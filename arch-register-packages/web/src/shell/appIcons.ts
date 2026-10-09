import type { IconType } from 'react-icons';
import {
  TbAffiliate,
  TbAlertTriangle,
  TbApi,
  TbArchive,
  TbBook,
  TbBuilding,
  TbChecklist,
  TbClipboardCheck,
  TbCoin,
  TbFileCertificate,
  TbGitPullRequest,
  TbGridDots,
  TbLayoutDashboard,
  TbListCheck,
  TbListDetails,
  TbPlugConnected,
  TbRoute,
  TbShieldCheck,
  TbTags,
  TbTargetArrow,
  TbUserShield
} from 'react-icons/tb';

/** Rail icons selectable by name on a dashboard (`icon`); unknown names fall back to the dashboard icon. */
const APP_ICONS: Record<string, IconType> = {
  TbAffiliate,
  TbAlertTriangle,
  TbApi,
  TbArchive,
  TbBook,
  TbBuilding,
  TbChecklist,
  TbClipboardCheck,
  TbCoin,
  TbFileCertificate,
  TbGitPullRequest,
  TbGridDots,
  TbLayoutDashboard,
  TbListCheck,
  TbListDetails,
  TbPlugConnected,
  TbRoute,
  TbShieldCheck,
  TbTags,
  TbTargetArrow,
  TbUserShield
};

/** Names selectable in the icon picker. */
export const APP_ICON_NAMES = Object.keys(APP_ICONS);

export const resolveAppIcon = (name: string | null | undefined): IconType =>
  (name ? APP_ICONS[name] : undefined) ?? TbLayoutDashboard;
