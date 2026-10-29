import type { ReactNode } from 'react';
import { TbBell, TbKey, TbPalette, TbUser } from 'react-icons/tb';

export type AccountSectionId = 'profile' | 'appearance' | 'notifications' | 'api-tokens';

export const ACCOUNT_SECTIONS: {
  id: AccountSectionId;
  label: string;
  icon: ReactNode;
  /** Description shown under the page title */
  description: string;
}[] = [
  {
    id: 'profile',
    label: 'Profile',
    icon: <TbUser size={12} />,
    description: 'Review the account details associated with your current sign-in.'
  },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: <TbPalette size={12} />,
    description: 'Customize how your account is represented throughout the workspace.'
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: <TbBell size={12} />,
    description: 'Choose which notification types deliver in-app and by email.'
  },
  {
    id: 'api-tokens',
    label: 'API tokens',
    icon: <TbKey size={12} />,
    description: 'Manage the workspace-scoped tokens created by your account.'
  }
];

export const resolveAccountSection = (id: string | undefined) =>
  ACCOUNT_SECTIONS.find(section => section.id === id) ?? ACCOUNT_SECTIONS[0]!;
