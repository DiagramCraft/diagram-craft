import type { ReactNode } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { TypeBadge } from '../../../components/TypeBadge';
import { StatusChip } from '../../../components/StatusChip';
import { TbEdit, TbDots, TbTrash, TbCopy, TbBell, TbPinned, TbBookmark } from 'react-icons/tb';
import { DropdownMenu, type MenuItem } from '../../../components/DropdownMenu';
import type { EntityChangeApproval } from '@arch-register/api-types/entityChangeContract';
import type { DeprecationCase } from '@arch-register/api-types/entityDeprecationContract';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import { Title } from '../../../components/Title';
import { getEntityDetailMenuActions } from './entityDetailHeaderHelpers';
import styles from '../EntityDetailScreen.module.css';

type Props = {
  entity: EntityRecord;
  entityName: string;
  schema: EntitySchema | null;
  schemaColor: string;
  lifecycleStates: WorkspaceLifecycleState[];
  changeApproval?: EntityChangeApproval | null;
  deprecation?: DeprecationCase | null;
  editing: boolean;
  isWatched: boolean;
  isPinned: boolean;
  approvalRequired: boolean;
  isSaving: boolean;
  saveConfirmOpen: boolean;
  watchPending: boolean;
  pinPending: boolean;
  onHome: () => void;
  onEntities: () => void;
  onToggleWatch: () => void;
  onTogglePin: () => void;
  onStartEdit: () => void;
  onDelete: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onViewJson: () => void;
  onOpenCollections: () => void;
  onProposeDeprecation: () => void;
  onClone: () => void;
};

export const EntityDetailHeader = ({
  entity,
  entityName,
  schema,
  schemaColor,
  lifecycleStates,
  changeApproval,
  deprecation,
  editing,
  isWatched,
  isPinned,
  approvalRequired,
  isSaving,
  saveConfirmOpen,
  watchPending,
  pinPending,
  onHome,
  onEntities,
  onToggleWatch,
  onTogglePin,
  onStartEdit,
  onDelete,
  onCancelEdit,
  onSaveEdit,
  onViewJson,
  onOpenCollections,
  onProposeDeprecation,
  onClone
}: Props) => {
  const menuActions = getEntityDetailMenuActions({
    canEdit: entity.canEdit,
    canCreateChild: entity.canCreateChild,
    canDelete: entity.canDelete,
    deprecationPolicyRequired: schema?.deprecation_policy === 'required',
    hasDeprecation: deprecation != null
  });
  const menuItems: MenuItem[] = menuActions.map(action => {
    switch (action) {
      case 'viewJson':
        return { label: 'View JSON', onClick: onViewJson };
      case 'collections':
        return {
          label: 'Collections…',
          icon: <TbBookmark size={14} />,
          onClick: onOpenCollections
        };
      case 'proposeDeprecation':
        return { label: 'Propose deprecation…', onClick: onProposeDeprecation };
      case 'clone':
        return { label: 'Clone', icon: <TbCopy size={14} />, onClick: onClone };
      case 'delete':
        return { label: 'Delete', icon: <TbTrash size={14} />, danger: true, onClick: onDelete };
    }
  });

  const chips: ReactNode =
    entity._lifecycle || changeApproval || deprecation ? (
      <>
        {entity._lifecycle && (
          <StatusChip value={entity._lifecycle.id} lifecycleStates={lifecycleStates} />
        )}
        {entity._targetLifecycle &&
          entity._lifecycle &&
          entity._targetLifecycle.id !== entity._lifecycle.id && (
            <>
              <span>→</span>
              <StatusChip value={entity._targetLifecycle.id} lifecycleStates={lifecycleStates} />
            </>
          )}
        {changeApproval && (
          <span>
            {changeApproval.revisions.at(-1)?.status === 'changes_requested'
              ? 'Changes requested'
              : 'Approval pending'}
          </span>
        )}
        {deprecation && (
          <span>
            {deprecation.overdue
              ? `Deprecation overdue (${deprecation.targetDate})`
              : deprecation.phase === 'scheduled'
                ? `Scheduled for deprecation (${deprecation.targetDate})`
                : 'Deprecation proposed'}
          </span>
        )}
      </>
    ) : undefined;

  return (
    <div className={styles.head}>
      <Title
        breadcrumb={[
          { label: 'Home', onClick: onHome },
          { label: 'Entities', onClick: onEntities }
        ]}
        icon={<TypeBadge color={schemaColor} name={schema?.name} icon={schema?.icon} size={32} />}
        eyebrow={schema?.name ?? 'Entity'}
        title={entityName}
        chips={chips}
        description={entity._description}
        toggleButtons={
          !editing ? (
            <>
              <button
                type="button"
                className={`${styles.watchBtn} ${isWatched ? styles.watchBtnActive : ''}`}
                onClick={onToggleWatch}
                disabled={watchPending}
                title={isWatched ? 'Unwatch entity' : 'Watch entity'}
                aria-label={isWatched ? 'Unwatch entity' : 'Watch entity'}
              >
                <TbBell size={16} />
              </button>
              <button
                type="button"
                className={`${styles.watchBtn} ${isPinned ? styles.watchBtnActive : ''}`}
                onClick={onTogglePin}
                disabled={pinPending}
                title={isPinned ? 'Unpin entity' : 'Pin entity'}
                aria-label={isPinned ? 'Unpin entity' : 'Pin entity'}
              >
                <TbPinned size={16} />
              </button>
            </>
          ) : undefined
        }
        buttons={
          !editing ? (
            entity.canEdit ? (
              <Button icon={<TbEdit size={12} />} onClick={onStartEdit}>
                Edit
              </Button>
            ) : undefined
          ) : (
            <>
              {entity.canDelete && (
                <Button variant="danger" icon={<TbTrash size={12} />} onClick={onDelete}>
                  Delete
                </Button>
              )}
              <Button onClick={onCancelEdit}>Cancel</Button>
              <Button variant="primary" onClick={onSaveEdit} disabled={isSaving || saveConfirmOpen}>
                {isSaving ? 'Saving...' : approvalRequired ? 'Request approval' : 'Save'}
              </Button>
            </>
          )
        }
        menu={
          menuItems.length > 0 ? (
            <DropdownMenu
              trigger={
                <button type="button" className={styles.iconBtn} aria-label="Entity actions">
                  <TbDots size={14} />
                </button>
              }
              items={menuItems}
            />
          ) : undefined
        }
      />
    </div>
  );
};
