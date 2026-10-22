import { useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { TbInfoCircle, TbPlus } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import type { DocumentAiAction, DocumentField } from '@arch-register/api-types/documentContract';
import { useAiStatus } from '../../hooks/useAiConfig';
import { settingsSectionTarget } from '../../routes/settingsNavigation';
import { AiActionDialog } from './AiActionDialog';
import { DocumentAiActionRow } from './DocumentAiActionRow';
import styles from './DocumentSettingsScreen.module.css';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/settings/documents');

/** AI actions of a document type; owns the add/edit dialog state. */
export const DocumentAiActionsSection = ({
  workspaceSlug,
  documentTypeId,
  fields,
  aiActions,
  onChange
}: {
  workspaceSlug: string;
  documentTypeId: string | null;
  fields: DocumentField[];
  aiActions: DocumentAiAction[];
  onChange: (aiActions: DocumentAiAction[]) => void;
}) => {
  const navigate = routeApi.useNavigate();
  const { data: aiStatus, isLoading: aiStatusLoading } = useAiStatus(workspaceSlug);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentAiAction | null>(null);

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (action: DocumentAiAction) => {
    setEditing(action);
    setDialogOpen(true);
  };
  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };
  const removeAction = (actionId: string) =>
    onChange(aiActions.filter(action => action.id !== actionId));
  const saveAction = (action: DocumentAiAction) => {
    const exists = aiActions.some(item => item.id === action.id);
    onChange(
      exists
        ? aiActions.map(item => (item.id === action.id ? action : item))
        : [...aiActions, action]
    );
    closeDialog();
  };

  return (
    <>
      {!aiStatusLoading && !aiStatus?.configured && (
        <div className={styles.fieldsHead}>
          <div className={styles.sectionLabel}>AI Actions</div>
        </div>
      )}
      {!aiStatusLoading && !aiStatus?.configured && (
        <div className={styles.fieldsTable}>
          <div className={styles.fieldEmpty}>
            AI isn&apos;t configured for this workspace yet.{' '}
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => navigate(settingsSectionTarget(workspaceSlug, 'ai'))}
            >
              Set up AI
            </button>{' '}
            to define metadata generators and interactive actions for this document type.
          </div>
        </div>
      )}

      {aiStatus?.configured && (
        <>
          <div className={styles.fieldsHead}>
            <div className={styles.sectionLabel}>AI Actions</div>
            <Button variant="ghost" icon={<TbPlus size={11} />} onClick={openAdd}>
              Add AI action
            </Button>
          </div>

          {aiActions.length > 0 ? (
            <div className={styles.fieldsTable}>
              {aiActions.map(action => (
                <DocumentAiActionRow
                  key={action.id}
                  action={action}
                  onEdit={() => openEdit(action)}
                  onRemove={() => removeAction(action.id)}
                />
              ))}
            </div>
          ) : (
            <div className={styles.fieldsTable}>
              <div className={styles.fieldEmpty}>
                No AI actions defined yet. Click &quot;Add AI action&quot; to get started.
              </div>
            </div>
          )}
          <div className={styles.fieldsHint}>
            <TbInfoCircle size={11} />
            Interactive AI actions run a predefined prompt against the document body, metadata, and
            location using read-only tools, and show the result in the document sidebar. They cannot
            modify entities, documents, or metadata.
          </div>
        </>
      )}

      <AiActionDialog
        open={dialogOpen}
        onClose={closeDialog}
        onSave={saveAction}
        workspaceSlug={workspaceSlug}
        documentTypeId={documentTypeId}
        action={editing}
        fields={fields}
        claimedFieldIds={
          new Set(
            aiActions
              .filter(
                (other): other is Extract<DocumentAiAction, { kind: 'metadata_generator' }> =>
                  other.id !== editing?.id && other.kind === 'metadata_generator'
              )
              .map(other => other.outputFieldId)
          )
        }
      />
    </>
  );
};
