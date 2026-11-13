import { Button } from '@diagram-craft/app-components/Button';
import { TbArrowBackUp } from 'react-icons/tb';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useRollbackToVersion, useSchemaDraft } from '../../../hooks/useSchemaDraft';

export type RollbackTarget = {
  kind: 'entity_schema' | 'relation_schema' | 'document_type' | 'enum' | 'field_group' | 'category';
  itemId: string;
};

/**
 * Stages a draft that restores the item to the given version. Nothing goes live until the draft
 * is reviewed and published; data migrations are not reversed.
 */
export const RollbackButton = ({
  target,
  version,
  isLatest
}: {
  target: RollbackTarget;
  version: number;
  /** The newest version equals the live item, so restoring it only matters to discard a draft. */
  isLatest: boolean;
}) => {
  const { workspaceSlug, permissions } = useWorkspaceContext();
  const rollback = useRollbackToVersion(workspaceSlug);
  const { data: draft } = useSchemaDraft(workspaceSlug);
  const staged = (draft?.items ?? []).some(
    item => item.kind === target.kind && item.item_id === target.itemId
  );
  if (!permissions.canEditSchemas || (isLatest && !staged)) return null;

  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      {rollback.isSuccess && (
        <span className="dim" style={{ fontSize: 12 }}>
          Staged in the draft — review and publish to apply
        </span>
      )}
      {rollback.isError && (
        <span role="alert" style={{ fontSize: 12, color: 'var(--error-fg)' }}>
          {rollback.error instanceof Error ? rollback.error.message : 'Could not stage rollback'}
        </span>
      )}
      <Button
        size="sm"
        icon={<TbArrowBackUp size={13} />}
        disabled={rollback.isPending}
        onClick={() => rollback.mutate({ ...target, version })}
        data-testid={`rollback-version-${version}`}
      >
        Restore
      </Button>
    </span>
  );
};
