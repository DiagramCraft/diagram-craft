import { Banner } from '../../../components/Banner';
import { EntityPicker } from '../../../components/EntityPicker';
import { useEntity } from '../../../hooks/useEntities';
import styles from './MergeWizardDialog.module.css';

type Props = {
  workspaceId: string;
  sourceEntityId: string;
  sourceEntityName: string;
  sourceSchemaId: string;
  sourceSchemaName: string;
  targetEntityId: string;
  onSelectTarget: (entityId: string) => void;
  previewError: string | null;
};

export const MergeTargetPicker = ({
  workspaceId,
  sourceEntityId,
  sourceEntityName,
  sourceSchemaId,
  sourceSchemaName,
  targetEntityId,
  onSelectTarget,
  previewError
}: Props) => {
  const { data: targetEntity } = useEntity(workspaceId, targetEntityId);

  return (
    <div className={styles.section}>
      <div className={styles.sourceSummary}>
        Merging <b>{sourceEntityName}</b> ({sourceSchemaName}) into another {sourceSchemaName}.
        The source will be retired; the target keeps the merged data.
      </div>
      <div className={styles.sectionTitle}>Target entity</div>
      <EntityPicker
        selectedEntityId={targetEntityId}
        selectedEntity={targetEntity}
        onSelectEntity={entity => onSelectTarget(entity._publicId)}
        onClearEntity={() => onSelectTarget('')}
        schemaId={sourceSchemaId}
        excludeEntityId={sourceEntityId}
      />
      {previewError && <Banner variant="error">{previewError}</Banner>}
    </div>
  );
};
