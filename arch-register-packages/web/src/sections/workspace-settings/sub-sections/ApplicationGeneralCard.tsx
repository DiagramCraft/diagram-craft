import { SaveBarButtons } from '../SaveBarButtons';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { MutationError } from '../MutationError';
import { SettingsBlock, SettingsBlockField } from '../SettingsBlock';
import { ColorPicker } from '../../../components/ColorPicker';
import { LoadingState } from '../../../components/LoadingState';
import { useApplications, useUpdateApplication } from '../../../hooks/useApplications';

type GeneralDraft = { name: string; description: string; accentColor: string | null };

/** Name, description, accent color of a single workspace application. */
export const ApplicationGeneralCard = ({
  workspaceSlug,
  applicationKey,
  onActionsChange
}: {
  workspaceSlug: string;
  applicationKey: string;
  /** Hoists Cancel / Save changes to the screen header. */
  onActionsChange: (actions: ReactNode | undefined) => void;
}) => {
  const { data: applications, isLoading } = useApplications(workspaceSlug);
  const application = useMemo(
    () => applications?.find(candidate => candidate.key === applicationKey),
    [applications, applicationKey]
  );
  const updateApplication = useUpdateApplication(workspaceSlug);

  const saved = useMemo<GeneralDraft>(
    () => ({
      name: application?.name ?? '',
      description: application?.description ?? '',
      accentColor: application?.accentColor ?? null
    }),
    [application]
  );
  const [draft, setDraft] = useState<GeneralDraft>(saved);

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
      <SaveBarButtons
        dirty={dirty}
        pending={busy}
        canSave={valid}
        onCancel={() => setDraft(saved)}
        onSave={save}
      />
    );
  }, [dirty, valid, busy, saved, save, onActionsChange]);

  useEffect(() => () => onActionsChange(undefined), [onActionsChange]);

  if (isLoading) return <LoadingState text="Loading application…" size="sm" />;
  if (!application) return null;

  return (
    <>
      <MutationError error={updateApplication.error} />
      <SettingsBlock title="Identity" description="How this application appears to members.">
        <SettingsBlockField label="Name">
          <TextInput
            value={draft.name}
            onChange={value => setDraft(current => ({ ...current, name: value ?? '' }))}
            style={{ maxWidth: 340 }}
          />
        </SettingsBlockField>
        <SettingsBlockField label="Description" align="top">
          <TextInput
            value={draft.description}
            onChange={value => setDraft(current => ({ ...current, description: value ?? '' }))}
            style={{ maxWidth: 540 }}
          />
        </SettingsBlockField>
        <SettingsBlockField label="Accent color">
          <ColorPicker
            value={draft.accentColor}
            onChange={accentColor => setDraft(current => ({ ...current, accentColor }))}
            size="small"
          />
        </SettingsBlockField>
      </SettingsBlock>
    </>
  );
};
