import { useDraft } from '../useDraft';
import { MutationError } from '../MutationError';
import { SaveBarButtons } from '../SaveBarButtons';
import { useCallback } from 'react';
import styles from './LifecycleSubSection.module.css';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Select } from '@diagram-craft/app-components/Select';
import { LIFECYCLE_COLOR_PRESETS } from '@arch-register/api-types/colors';
import { SettingsBlock, SettingsBlockField } from '../SettingsBlock';
import { SectionActions } from '../SectionActions';
import { ListEditor } from '../../../components/ListEditor';
import { useUpdateLifecycleStates } from '../../../hooks/useWorkspaceConfig';
import { Workspace, WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';

const buildLifecycleStateDraft = (lifecycleStates: WorkspaceLifecycleState[]) =>
  lifecycleStates.map(state => ({
    id: state.id,
    label: state.label,
    color: state.color,
    is_deprecated_state: state.is_deprecated_state ?? false
  }));

const COLOR_PRESETS = LIFECYCLE_COLOR_PRESETS;

export const LifecycleSubSection = ({
  workspace,
  lifecycleStates
}: {
  workspace: Workspace;
  lifecycleStates: WorkspaceLifecycleState[];
}) => {
  const {
    draft: states,
    setDraft: setStates,
    dirty: isDirty,
    reset: handleCancel
  } = useDraft(lifecycleStates, buildLifecycleStateDraft);

  const updateLifecycleStatesMutation = useUpdateLifecycleStates(workspace.url_slug);

  const handleSave = useCallback(async () => {
    try {
      if (isDirty) {
        await updateLifecycleStatesMutation.mutateAsync(
          states.map((s, i) => ({
            id: s.id.trim() === '' ? crypto.randomUUID() : s.id.trim(),
            label: s.label,
            color: s.color,
            sort_order: i,
            is_deprecated_state: s.is_deprecated_state
          }))
        );
      }
    } catch {
      // The error is surfaced below through the mutation state
    }
  }, [states, isDirty, updateLifecycleStatesMutation]);

  const setDeprecatedStateById = (id: string) =>
    setStates(prev => prev.map(s => ({ ...s, is_deprecated_state: s.id === id })));

  const deprecatedStateId = states.find(s => s.is_deprecated_state)?.id ?? '';

  return (
    <>
      <SectionActions>
        <SaveBarButtons
          dirty={isDirty}
          pending={updateLifecycleStatesMutation.isPending}
          onCancel={handleCancel}
          onSave={handleSave}
        />
      </SectionActions>
      <MutationError error={updateLifecycleStatesMutation.error} />
      <SettingsBlock
        title="Lifecycle states"
        description="Define the lifecycle stages an entity can be in. Each state has a display label and a color."
      >
        <ListEditor
          items={states}
          onChange={setStates}
          getId={s => s.id}
          createItem={() => ({
            id: crypto.randomUUID(),
            label: '',
            color: 'var(--cmp-fg-disabled)',
            is_deprecated_state: false
          })}
          addLabel="Add state"
          renderItem={(s, { update }) => (
            <div className={styles.stateRow}>
              <TextInput
                value={s.label}
                onChange={value => update({ label: value ?? '' })}
                placeholder="Label (e.g. Production)"
              />
              <div className={styles.swatches}>
                {COLOR_PRESETS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    onClick={() => update({ color: c.value })}
                    className={`${styles.swatch} ${s.color === c.value ? styles.swatchActive : ''}`}
                    style={{ background: c.value }}
                  />
                ))}
              </div>
            </div>
          )}
        />
      </SettingsBlock>

      <SettingsBlock title="Deprecated state">
        <SettingsBlockField
          label="Deprecated state"
          hint="Entities move to this lifecycle state when a deprecation is finalized."
        >
          <Select.Root
            value={deprecatedStateId}
            placeholder="None"
            onChange={v => setDeprecatedStateById(v ?? '')}
          >
            <Select.Item value="">None</Select.Item>
            {states.map(s => (
              <Select.Item key={s.id} value={s.id}>
                {s.label.trim() === '' ? 'Untitled state' : s.label.trim()}
              </Select.Item>
            ))}
          </Select.Root>
        </SettingsBlockField>
      </SettingsBlock>
    </>
  );
};
