import { useDraft } from '../useDraft';
import { MutationError } from '../MutationError';
import { SaveBarButtons } from '../SaveBarButtons';
import { Fragment, useCallback } from 'react';
import styles from './LifecycleSubSection.module.css';
import { Button } from '@diagram-craft/app-components/Button';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Select } from '@diagram-craft/app-components/Select';
import { LIFECYCLE_COLOR_PRESETS } from '@arch-register/api-types/colors';
import { SettingsBlock, SettingsBlockField } from '../SettingsBlock';
import { SectionActions } from '../SectionActions';
import { TbPlus, TbTrash } from 'react-icons/tb';
import { useUpdateLifecycleStates } from '../../../hooks/useWorkspaceConfig';
import { Workspace, WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';

type EditLifecycleState = {
  id: string;
  label: string;
  color: string;
  is_deprecated_state: boolean;
};

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

  const updateState = (index: number, patch: Partial<EditLifecycleState>) =>
    setStates(prev => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const setDeprecatedStateById = (id: string) =>
    setStates(prev => prev.map(s => ({ ...s, is_deprecated_state: s.id === id })));

  const deprecatedStateId = states.find(s => s.is_deprecated_state)?.id ?? '';

  const removeState = (index: number) => setStates(prev => prev.filter((_, i) => i !== index));

  const addState = () =>
    setStates(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label: '',
        color: 'var(--cmp-fg-disabled)',
        is_deprecated_state: false
      }
    ]);

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
        <div className={styles.fieldGrid}>
          {states.map((s, i) => (
            <Fragment key={s.id}>
              <TextInput
                value={s.label}
                onChange={value => updateState(i, { label: value ?? '' })}
                placeholder="Label (e.g. Production)"
              />

              <div className={styles.swatches}>
                {COLOR_PRESETS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    onClick={() => updateState(i, { color: c.value })}
                    className={`${styles.swatch} ${s.color === c.value ? styles.swatchActive : ''}`}
                    style={{ background: c.value }}
                  />
                ))}
              </div>
              <Button variant="danger" onClick={() => removeState(i)} style={{ padding: '0 6px' }}>
                <TbTrash size={12} />
              </Button>
              {i < states.length - 1 && (
                <div
                  style={{
                    gridColumn: '1 / 5',
                    borderBottom: '1px dashed var(--panel-border)',
                    margin: '4px 0'
                  }}
                />
              )}
            </Fragment>
          ))}
        </div>
        <div className={styles.addRow}>
          <Button icon={<TbPlus size={12} />} onClick={addState}>
            Add state
          </Button>
        </div>
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
