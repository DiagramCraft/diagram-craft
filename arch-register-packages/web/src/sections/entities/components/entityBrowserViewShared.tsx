import { TbBookmark, TbCheck, TbCopy, TbTrash } from 'react-icons/tb';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { MenuItem } from '../../../components/DropdownMenu';
import type { BrowserEntityRecord, ProjectBrowserContext } from './entityBrowserState';

export type EntityBrowserBaseViewProps = {
  rows: BrowserEntityRecord[];
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  onEntityClick: (entityId: string) => void;
  onDelete: (entity: EntityRecord) => void;
  onClone: (entity: EntityRecord) => void;
  onManageCollections?: (entity: EntityRecord) => void;
  lifecycleStates: WorkspaceLifecycleState[];
  projectContext?: ProjectBrowserContext;
  readOnly?: boolean;
};

export const entityName = (entity: EntityRecord) => entity._name ?? entity._slug;

export const entityMenuItems = (
  entity: EntityRecord,
  onClone: (entity: EntityRecord) => void,
  onDelete: (entity: EntityRecord) => void,
  onManageCollections?: (entity: EntityRecord) => void
): MenuItem[] => {
  const items: MenuItem[] = [];
  if (entity.canCreateChild) {
    items.push({ label: 'Clone', icon: <TbCopy size={14} />, onClick: () => onClone(entity) });
  }
  if (entity.canDelete) {
    items.push({
      label: 'Delete',
      icon: <TbTrash size={14} />,
      danger: true,
      onClick: () => onDelete(entity)
    });
  }
  if (onManageCollections) {
    items.push({
      label: 'Collections…',
      icon: <TbBookmark size={14} />,
      onClick: () => onManageCollections(entity)
    });
  }
  return items;
};

export const projectEntityMenuItems = (
  entity: BrowserEntityRecord,
  projectContext: ProjectBrowserContext | undefined
): MenuItem[] => {
  if (!projectContext?.project.canEdit || entity._projectLink?.linked !== true) {
    return [];
  }

  return [
    {
      label: 'Plan future change',
      icon: <TbCheck size={14} />,
      onClick: () => projectContext.onPlanFutureChange(entity._uid)
    },
    {
      label: entity._projectLink.isDone ? 'Mark not done' : 'Mark done',
      icon: <TbCheck size={14} />,
      onClick: () => projectContext.onToggleDone(entity._uid, entity._projectLink?.isDone ?? false)
    },
    {
      label: 'Remove from project',
      icon: <TbTrash size={14} />,
      danger: true,
      onClick: () => projectContext.onRemoveEntity(entity._uid)
    }
  ];
};
