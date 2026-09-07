import { useMemo } from 'react';
import { TbCheck } from 'react-icons/tb';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { LoadingState } from '../../../components/LoadingState';
import { useEntitiesByIds, useEntity } from '../../../hooks/useEntities';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useMergeWizardController } from '../useMergeWizardController';
import { collectReferenceFieldConflictIds } from '../mergeReviewState';
import { MergeTargetPicker } from './MergeTargetPicker';
import { MergeFieldConflictTable } from './MergeFieldConflictTable';
import { MergeImpactReview } from './MergeImpactReview';
import { MergeConfirmStep } from './MergeConfirmStep';
import { MergeResultStep } from './MergeResultStep';
import styles from './MergeWizardDialog.module.css';

const STEPS = [
  { key: 'pick-target', label: 'Target' },
  { key: 'review', label: 'Review' },
  { key: 'confirm', label: 'Confirm' },
  { key: 'done', label: 'Done' }
] as const;

type WizardPhase = (typeof STEPS)[number]['key'] | 'loading-preview' | 'executing';

const Stepper = ({ phase }: { phase: WizardPhase }) => {
  const normalized =
    phase === 'loading-preview' ? 'pick-target' : phase === 'executing' ? 'confirm' : phase;
  const phaseIdx = STEPS.findIndex(s => s.key === normalized);
  return (
    <div className={styles.stepper}>
      {STEPS.map((s, i) => {
        const done = i < phaseIdx;
        const active = i === phaseIdx;
        return (
          <span key={s.key} className={styles.stepperItem}>
            {i > 0 && <span className={`${styles.stepLine} ${done ? styles.stepLineDone : ''}`} />}
            <span
              className={`${styles.step} ${active ? styles.stepActive : ''} ${done ? styles.stepDone : ''}`}
            >
              <span className={styles.stepNum}>{done ? <TbCheck size={10} /> : i + 1}</span>
              <span className={styles.stepLabel}>{s.label}</span>
            </span>
          </span>
        );
      })}
    </div>
  );
};

type Props = {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  sourceEntityId: string;
  // Additional source entities to merge into the same target after this one succeeds, for the
  // bulk "Merge into…" entry point.
  queuedSourceIds?: string[];
  onNavigateToEntity: (entityPublicId: string) => void;
};

export const MergeWizardDialog = ({
  open,
  onClose,
  workspaceId,
  sourceEntityId,
  queuedSourceIds = [],
  onNavigateToEntity
}: Props) => {
  const controller = useMergeWizardController({
    workspaceId,
    sourceEntityId,
    queuedSourceIds
  });
  const { data: sourceEntity, isLoading: sourceLoading } = useEntity(
    workspaceId,
    controller.currentSourceId
  );
  const { data: targetEntity } = useEntity(workspaceId, controller.targetEntityId);
  const { schemas, teams, lifecycleStates } = useWorkspaceContext();
  const coreFieldLookups = useMemo(
    () => ({
      teamNames: new Map(teams.map(team => [team.id, team.name])),
      lifecycleLabels: new Map(lifecycleStates.map(state => [state.id, state.label]))
    }),
    [teams, lifecycleStates]
  );
  const sourceSchema = useMemo(
    () => schemas.find(s => s.id === sourceEntity?._schema.id) ?? null,
    [schemas, sourceEntity]
  );
  // Reference/containment field conflicts store the related entities' raw ids — resolve them to
  // display names instead of showing bare UUIDs in the field conflict table.
  const referenceIds = useMemo(
    () =>
      controller.preview
        ? collectReferenceFieldConflictIds(controller.preview.fieldConflicts, sourceSchema)
        : [],
    [controller.preview, sourceSchema]
  );
  const refLookup = useEntitiesByIds(workspaceId, referenceIds);

  const handleClose = () => {
    controller.reset();
    onClose();
  };

  const canGoNextFromReview = controller.preview != null && !controller.hasHardBlockers;
  const canConfirm =
    controller.preview != null &&
    controller.confirmText.trim() === (sourceEntity?._name ?? sourceEntity?._slug ?? '');

  const buttons = (() => {
    switch (controller.phase) {
      case 'pick-target':
      case 'loading-preview':
        return [
          { label: 'Cancel', type: 'cancel' as const, onClick: handleClose },
          {
            label: controller.isPreviewing ? 'Loading preview…' : 'Next',
            type: 'default' as const,
            disabled: !controller.targetEntityId || controller.isPreviewing,
            onClick: () => controller.runPreview()
          }
        ];
      case 'review':
        return [
          { label: 'Back', type: 'cancel' as const, onClick: () => controller.reset() },
          {
            label: 'Next',
            type: 'default' as const,
            disabled: !canGoNextFromReview,
            onClick: controller.goToConfirm
          }
        ];
      case 'confirm':
      case 'executing':
        return [
          { label: 'Back', type: 'cancel' as const, onClick: controller.backToReview },
          {
            label: controller.isExecuting ? 'Merging…' : 'Merge',
            type: 'danger' as const,
            disabled: !canConfirm || controller.isExecuting,
            onClick: controller.executeMerge
          }
        ];
      case 'done':
        return [];
    }
  })();

  return (
    <Dialog open={open} onClose={handleClose} title="Merge entity" width={900} buttons={buttons}>
      <Stepper phase={controller.phase} />
      <div className={styles.body}>
        {sourceLoading ? (
          <LoadingState text="Loading…" size="sm" />
        ) : (
          <>
            {(controller.phase === 'pick-target' || controller.phase === 'loading-preview') && (
              <MergeTargetPicker
                workspaceId={workspaceId}
                sourceEntityId={controller.currentSourceId}
                sourceEntityName={sourceEntity?._name ?? sourceEntity?._slug ?? ''}
                sourceSchemaId={sourceEntity?._schema.id ?? ''}
                sourceSchemaName={sourceEntity?._schema.name ?? ''}
                targetEntityId={controller.targetEntityId}
                onSelectTarget={controller.setTargetEntityId}
                previewError={controller.previewError}
              />
            )}

            {controller.phase === 'review' && controller.preview && (
              <>
                <MergeFieldConflictTable
                  conflicts={controller.preview.fieldConflicts}
                  resolutions={controller.resolutions.fieldResolutions}
                  onChange={controller.setFieldResolution}
                  schema={sourceSchema}
                  refLookup={refLookup}
                  coreFieldLookups={coreFieldLookups}
                />
                <MergeImpactReview
                  preview={controller.preview}
                  relationResolutions={controller.resolutions.relationResolutions}
                  sideTableResolutions={controller.resolutions.sideTableResolutions}
                  acknowledgedBlockers={controller.acknowledgedBlockers}
                  onRelationChange={controller.setRelationResolution}
                  onSideTableChange={controller.setSideTableResolution}
                  onToggleBlockerAck={controller.toggleBlockerAck}
                />
              </>
            )}

            {(controller.phase === 'confirm' || controller.phase === 'executing') &&
              controller.preview && (
                <MergeConfirmStep
                  preview={controller.preview}
                  sourceEntityName={sourceEntity?._name ?? sourceEntity?._slug ?? ''}
                  targetEntityName={targetEntity?._name ?? targetEntity?._slug ?? 'the target'}
                  confirmText={controller.confirmText}
                  onConfirmTextChange={controller.setConfirmText}
                  executeError={controller.executeError}
                  onRefreshAfterConflict={controller.refreshAfterConflict}
                />
              )}

            {controller.phase === 'done' && controller.mergeResult && (
              <MergeResultStep
                result={controller.mergeResult}
                remainingQueueCount={controller.remainingQueue.length}
                totalQueueCount={queuedSourceIds.length}
                onViewEntity={id => {
                  handleClose();
                  onNavigateToEntity(id);
                }}
                onMergeNext={controller.advanceQueue}
                onClose={handleClose}
              />
            )}
          </>
        )}
      </div>
    </Dialog>
  );
};
