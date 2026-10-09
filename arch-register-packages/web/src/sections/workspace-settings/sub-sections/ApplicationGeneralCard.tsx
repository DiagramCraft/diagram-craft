import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Banner } from '../../../components/Banner';
import { ColorPicker } from '../../../components/ColorPicker';
import { LoadingState } from '../../../components/LoadingState';
import {
  useApplications,
  useDeleteApplication,
  useUpdateApplication
} from '../../../hooks/useApplications';

type GeneralDraft = { name: string; description: string; accentColor: string | null };

/** Name, description, accent color and deletion of a single workspace application. */
export const ApplicationGeneralCard = ({
  workspaceSlug,
  applicationKey,
  onActionsChange,
  onDeleted
}: {
  workspaceSlug: string;
  applicationKey: string;
  /** Hoists Cancel / Save changes to the screen header. */
  onActionsChange: (actions: ReactNode | undefined) => void;
  onDeleted: () => void;
}) => {
  const { data: applications, isLoading } = useApplications(workspaceSlug);
  const application = useMemo(
    () => applications?.find(candidate => candidate.key === applicationKey),
    [applications, applicationKey]
  );
  const updateApplication = useUpdateApplication(workspaceSlug);
  const deleteApplication = useDeleteApplication(workspaceSlug);

  const saved = useMemo<GeneralDraft>(
    () => ({
      name: application?.name ?? '',
      description: application?.description ?? '',
      accentColor: application?.accentColor ?? null
    }),
    [application]
  );
  const [draft, setDraft] = useState<GeneralDraft>(saved);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => setDraft(saved), [saved]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const valid = draft.name.trim() !== '';
  const busy = updateApplication.isPending;
  const applicationId = application?.id;

  const save = useCallback(async () => {
    if (!applicationId) return;
    await updateApplication.mutateAsync({
      id: applicationId,
      body: {
        name: draft.name.trim(),
        description: draft.description.trim(),
        accentColor: draft.accentColor
      }
    });
  }, [applicationId, draft, updateApplication.mutateAsync]);

  useEffect(() => {
    onActionsChange(
      <>
        <Button disabled={!dirty || busy} onClick={() => setDraft(saved)}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!dirty || !valid || busy} onClick={() => void save()}>
          {busy ? 'Saving...' : 'Save changes'}
        </Button>
      </>
    );
  }, [dirty, valid, busy, saved, save, onActionsChange]);

  useEffect(() => () => onActionsChange(undefined), [onActionsChange]);

  if (isLoading) return <LoadingState text="Loading application…" size="sm" />;
  if (!application) return null;

  const error = updateApplication.error ?? deleteApplication.error;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', paddingTop: '1rem' }}>
      {error && (
        <Banner variant="error">
          {error instanceof Error ? error.message : 'Failed to update the application.'}
        </Banner>
      )}

      <FormElement label="Name" required>
        <TextInput
          value={draft.name}
          onChange={value => setDraft(current => ({ ...current, name: value ?? '' }))}
        />
      </FormElement>
      <FormElement label="Description">
        <TextInput
          value={draft.description}
          onChange={value => setDraft(current => ({ ...current, description: value ?? '' }))}
        />
      </FormElement>
      <FormElement label="Accent color">
        <ColorPicker
          value={draft.accentColor}
          onChange={accentColor => setDraft(current => ({ ...current, accentColor }))}
          size="small"
        />
      </FormElement>

      <div>
        <Button variant="danger" onClick={() => setDeleteOpen(true)}>
          Delete application
        </Button>
      </div>

      <DeleteConfirmationDialog
        open={deleteOpen}
        title="Delete application?"
        message={
          <>
            The application <b>{application.name}</b> and all of its dashboards will be permanently
            deleted.
          </>
        }
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() =>
          deleteApplication.mutate(application.id, {
            onSuccess: () => {
              setDeleteOpen(false);
              onDeleted();
            },
            onError: () => setDeleteOpen(false)
          })
        }
      />
    </div>
  );
};
