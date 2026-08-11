import { useEffect, useMemo, useState } from 'react';
import type { Baseline, CreateBaselineRequest } from '@arch-register/api-types/baselineContract';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useCreateBaseline } from '../../hooks/useBaselines';
import { ApiError } from '../../lib/http';
import styles from './CreateBaselineDialog.module.css';

const localDateTime = (date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

type Props = {
  open: boolean;
  workspaceSlug: string;
  scope: CreateBaselineRequest['scope'];
  query?: EntityQuery | null;
  scopeLabel: string;
  scopeDetail: string;
  defaultOwnerTeamId?: string | null;
  onClose: () => void;
  onCreated?: (baseline: Baseline) => void;
};

export const CreateBaselineDialog = ({
  open,
  workspaceSlug,
  scope,
  query,
  scopeLabel,
  scopeDetail,
  defaultOwnerTeamId,
  onClose,
  onCreated
}: Props) => {
  const { teams } = useWorkspaceContext();
  const createBaseline = useCreateBaseline(workspaceSlug);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [effectiveAt, setEffectiveAt] = useState(localDateTime);
  const [ownerTeamId, setOwnerTeamId] = useState('none');
  const [includePlannedChanges, setIncludePlannedChanges] = useState(true);
  const [includeOverdueChanges, setIncludeOverdueChanges] = useState(false);

  const orderedTeams = useMemo(
    () => [...teams].sort((left, right) => left.name.localeCompare(right.name)),
    [teams]
  );

  useEffect(() => {
    if (!open) return;
    setName('');
    setDescription('');
    setEffectiveAt(localDateTime());
    setOwnerTeamId(defaultOwnerTeamId ?? 'none');
    setIncludePlannedChanges(true);
    setIncludeOverdueChanges(false);
  }, [defaultOwnerTeamId, open]);

  const submit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || createBaseline.isPending) return;
    const trimmedDescription = description.trim();

    try {
      const created = await createBaseline.mutateAsync({
        name: trimmedName,
        description: trimmedDescription.length > 0 ? trimmedDescription : null,
        ownerTeamId: ownerTeamId === 'none' ? null : ownerTeamId,
        effectiveAt: new Date(effectiveAt).toISOString(),
        scope,
        query: query ?? null,
        includePlannedChanges,
        includeOverdueChanges
      });
      onCreated?.(created);
      onClose();
    } catch {
      // The mutation error is rendered below.
    }
  };

  const createError =
    createBaseline.error instanceof ApiError
      ? createBaseline.error.message
      : createBaseline.error
        ? 'Could not create baseline.'
        : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create architecture baseline"
      sub="Capture an immutable catalog snapshot for comparison and governance."
      width={520}
      buttons={[
        { label: 'Cancel', type: 'secondary', onClick: onClose },
        {
          label: createBaseline.isPending ? 'Capturing…' : 'Create baseline',
          type: 'default',
          onClick: () => void submit(),
          disabled: createBaseline.isPending || !name.trim()
        }
      ]}
    >
      <div className={styles.fields}>
        <div className={styles.scope}>
          <span className={styles.scopeLabel}>{scopeLabel}</span>
          <span className={styles.scopeDetail}>{scopeDetail}</span>
        </div>
        <FormElement label="Name" required>
          <TextInput
            value={name}
            onChange={value => setName(value ?? '')}
            placeholder="e.g. 2026 platform baseline"
            autoFocus
            maxLength={200}
          />
        </FormElement>
        <FormElement label="Description" required={false}>
          <TextArea
            value={description}
            onChange={value => setDescription(value ?? '')}
            placeholder="What does this snapshot represent?"
            maxLength={2000}
            allowMaximize={false}
          />
        </FormElement>
        <FormElement label="Effective date" required>
          <TextInput
            type="datetime-local"
            value={effectiveAt}
            onChange={value => setEffectiveAt(value ?? '')}
          />
        </FormElement>
        <FormElement label="Owner team" required={false}>
          <Select.Root value={ownerTeamId} onChange={value => setOwnerTeamId(value ?? 'none')}>
            <Select.Item value="none">No owner team</Select.Item>
            {orderedTeams.map(team => (
              <Select.Item key={team.id} value={team.id}>
                {team.name}
              </Select.Item>
            ))}
          </Select.Root>
        </FormElement>
        <div className={styles.options}>
          <label className={styles.option}>
            <Checkbox
              value={includePlannedChanges}
              onChange={value => setIncludePlannedChanges(value ?? false)}
            />
            Include planned changes
          </label>
          <label className={styles.option}>
            <Checkbox
              value={includeOverdueChanges}
              onChange={value => setIncludeOverdueChanges(value ?? false)}
            />
            Include overdue changes
          </label>
        </div>
        {createError && <div className={styles.error}>{createError}</div>}
      </div>
    </Dialog>
  );
};
