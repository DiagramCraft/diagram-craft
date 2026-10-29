import { TbExternalLink, TbLink, TbPin, TbPinnedOff } from 'react-icons/tb';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { MenuItem } from '../../../components/DropdownMenu';

/** The minimal entity shape the common actions need; pinned-entity records can supply it too. */
export type EntityRef = Pick<EntityRecord, '_uid' | '_publicId' | '_name' | '_slug'> & {
  _schema: { id: string };
};

export type EntityCommonActions = {
  open: (entity: EntityRef) => void;
  openInNewTab: (entity: EntityRef) => void;
  copyLink: (entity: EntityRef) => void;
  isPinned: (entity: EntityRef) => boolean;
  togglePin: (entity: EntityRef) => void;
};

export type EntityMenuOptions = {
  /** Common navigate/pin actions; omit to leave those entries out. */
  actions?: EntityCommonActions;
  /** Set to false where the entity cannot be pinned (e.g. graph nodes without a record). */
  pin?: boolean;
  /** Context-specific entries, placed between the common entries and the danger group. */
  extra?: MenuItem[];
  /** Entries that edit, merge or delete the entity, in canonical order. */
  edit?: MenuItem[];
  danger?: MenuItem[];
};

const withSeparator = (items: MenuItem[]): MenuItem[] =>
  items.map((item, idx) => (idx === 0 ? { ...item, separatorBefore: true } : item));

const pinItem = (entity: EntityRef, actions: EntityCommonActions): MenuItem =>
  actions.isPinned(entity)
    ? {
        id: 'unpin',
        label: 'Unpin',
        icon: <TbPinnedOff size={14} />,
        onClick: () => actions.togglePin(entity)
      }
    : {
        id: 'pin',
        label: 'Pin',
        icon: <TbPin size={14} />,
        onClick: () => actions.togglePin(entity)
      };

/**
 * Builds the menu for an entity in one canonical order: navigate, pin, edit, context-specific
 * extras, danger. Empty groups are dropped and groups are separated.
 */
export const buildEntityMenuItems = (
  entity: EntityRef,
  { actions, pin = true, edit = [], extra = [], danger = [] }: EntityMenuOptions
): MenuItem[] => {
  const navigate: MenuItem[] = actions
    ? [
        {
          id: 'open',
          label: 'Open',
          icon: <TbExternalLink size={14} />,
          onClick: () => actions.open(entity)
        },
        {
          id: 'open-new-tab',
          label: 'Open in new tab',
          icon: <TbExternalLink size={14} />,
          onClick: () => actions.openInNewTab(entity)
        },
        {
          id: 'copy-link',
          label: 'Copy link',
          icon: <TbLink size={14} />,
          onClick: () => actions.copyLink(entity)
        },
        ...(pin ? [pinItem(entity, actions)] : [])
      ]
    : [];

  return [navigate, edit, extra, danger]
    .filter(group => group.length > 0)
    .flatMap((group, idx) => (idx === 0 ? group : withSeparator(group)));
};
