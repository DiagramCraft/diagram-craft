import { TbBookmark, TbCheck, TbCopy, TbGitMerge, TbTrash } from 'react-icons/tb';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { MenuItem } from '../../../components/DropdownMenu';
import { buildEntityMenuItems, type EntityCommonActions } from './entityMenu';
import type { BrowserEntityRecord, ProjectBrowserContext } from './entityBrowserState';

export type EntityBrowserBaseViewProps = {
  rows: BrowserEntityRecord[];
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  onEntityClick: (entityId: string) => void;
  onDelete: (entity: EntityRecord) => void;
  onClone: (entity: EntityRecord) => void;
  onManageCollections?: (entity: EntityRecord) => void;
  onMerge?: (entity: EntityRecord) => void;
  lifecycleStates: WorkspaceLifecycleState[];
  projectContext?: ProjectBrowserContext;
  readOnly?: boolean;
};

export const entityName = (entity: EntityRecord) => entity._name ?? entity._slug;

type EntityMenuHandlers = Pick<
  EntityBrowserBaseViewProps,
  'onClone' | 'onDelete' | 'onManageCollections' | 'onMerge' | 'projectContext'
>;

/** Menu shared by the table, cards and tree views, in the canonical shared entity-menu order. */
export const browserEntityMenuItems = (
  entity: BrowserEntityRecord,
  { onClone, onDelete, onManageCollections, onMerge, projectContext }: EntityMenuHandlers,
  actions: EntityCommonActions
): MenuItem[] => {
  const edit: MenuItem[] = [];
  if (onManageCollections) {
    edit.push({
      id: 'collections',
      label: 'Collections…',
      icon: <TbBookmark size={14} />,
      onClick: () => onManageCollections(entity)
    });
  }
  if (entity.canCreateChild) {
    edit.push({
      id: 'clone',
      label: 'Clone',
      icon: <TbCopy size={14} />,
      onClick: () => onClone(entity)
    });
  }

  const danger: MenuItem[] = [];
  // Merge requires the same admin_entity permission as delete, so it's gated on the same flag.
  if (onMerge && entity.canDelete) {
    danger.push({
      id: 'merge',
      label: 'Merge…',
      icon: <TbGitMerge size={14} />,
      onClick: () => onMerge(entity)
    });
  }
  if (entity.canDelete) {
    danger.push({
      id: 'delete',
      label: 'Delete',
      icon: <TbTrash size={14} />,
      danger: true,
      onClick: () => onDelete(entity)
    });
  }

  return buildEntityMenuItems(entity, {
    actions,
    edit,
    extra: projectEntityMenuItems(entity, projectContext),
    danger
  });
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
      id: 'plan-change',
      label: 'Plan change',
      icon: <TbCheck size={14} />,
      onClick: () => projectContext.onPlanFutureChange(entity._uid)
    },
    {
      id: 'toggle-done',
      label: entity._projectLink.isDone ? 'Mark not done' : 'Mark done',
      icon: <TbCheck size={14} />,
      onClick: () => projectContext.onToggleDone(entity._uid, entity._projectLink?.isDone ?? false)
    },
    {
      id: 'remove-from-project',
      label: 'Remove from project',
      icon: <TbTrash size={14} />,
      danger: true,
      onClick: () => projectContext.onRemoveEntity(entity._uid)
    }
  ];
};
