import type { Dispatch, SetStateAction } from 'react';
import { DateInput } from '@diagram-craft/app-components/DateInput';
import { Chip } from '../../../components/Chip';
import { slugifyEntityName } from '../../../lib/entityEditState';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { LayoutMetadataSlot } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import styles from './EntityOverviewTab.module.css';

const MetaPropRow = ({
  label,
  value,
  editing,
  editValue,
  onChange,
  selectOptions,
  type = 'text'
}: {
  label: string;
  value: string;
  editing?: boolean;
  editValue?: string;
  onChange?: (v: string) => void;
  selectOptions?: Array<{ value: string; label: string }>;
  type?: 'text' | 'date';
}) => (
  <div className={styles.metaPropRow}>
    <span className={styles.metaPropLabel}>{label}</span>
    <span className={styles.metaPropValue}>
      {editing && onChange ? (
        selectOptions ? (
          <select
            className={styles.selectInline}
            value={editValue ?? ''}
            onChange={e => onChange(e.target.value)}
          >
            {selectOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : type === 'date' ? (
          <DateInput
            value={editValue ?? ''}
            onChange={v => onChange(v ?? '')}
            style={{ width: '100%' }}
          />
        ) : (
          <input
            className={styles.inputInline}
            value={editValue ?? ''}
            onChange={e => onChange(e.target.value)}
          />
        )
      ) : (
        value
      )}
    </span>
  </div>
);

type MetadataBlockProps = {
  slot: LayoutMetadataSlot;
  entity: EntityRecord;
  editing: boolean;
  editState: Record<string, unknown>;
  setEditState: Dispatch<SetStateAction<Record<string, unknown>>>;
  teams: WorkspaceTeam[];
  lifecycleStates: WorkspaceLifecycleState[];
};

/** Renders one placeable metadata slot (name, slug, owner, etc). */
export const MetadataBlock = ({
  slot,
  entity,
  editing,
  editState,
  setEditState,
  teams,
  lifecycleStates
}: MetadataBlockProps) => {
  switch (slot) {
    case 'name':
      return (
        <MetaPropRow
          label="Name"
          value={entity._name ?? '—'}
          editing={editing}
          editValue={editState['_name'] as string}
          onChange={v => setEditState(s => ({ ...s, _name: v, _slug: slugifyEntityName(v) }))}
        />
      );
    case 'slug':
      return (
        <MetaPropRow
          label="Slug"
          value={entity._slug}
          editing={editing}
          editValue={editState['_slug'] as string}
          onChange={v => setEditState(s => ({ ...s, _slug: v }))}
        />
      );
    case 'description':
      if (!((entity._description != null && entity._description !== '') || editing)) return null;
      return (
        <div className={styles.metaPropRow}>
          <span className={styles.metaPropLabel}>Description</span>
          <span className={styles.metaPropValue}>
            {editing ? (
              <textarea
                className={styles.textareaInline}
                value={editState['_description'] as string}
                onChange={e => setEditState(s => ({ ...s, _description: e.target.value }))}
              />
            ) : (
              entity._description
            )}
          </span>
        </div>
      );
    case 'owner':
      return (
        <MetaPropRow
          label="Owner"
          value={entity._owner?.name ?? '—'}
          editing={editing}
          editValue={editState['_owner'] as string}
          onChange={v => setEditState(s => ({ ...s, _owner: v }))}
          selectOptions={[
            { value: '', label: '—' },
            ...teams.map(team => ({ value: team.id, label: team.name }))
          ]}
        />
      );
    case 'lifecycle':
      return (
        <MetaPropRow
          label="Lifecycle"
          value={entity._lifecycle?.name ?? '—'}
          editing={editing}
          editValue={editState['_lifecycle'] as string}
          onChange={v => setEditState(s => ({ ...s, _lifecycle: v }))}
          selectOptions={[
            { value: '', label: '—' },
            ...lifecycleStates.map(state => ({ value: state.id, label: state.label }))
          ]}
        />
      );
    case 'targetLifecycle':
      return (
        <MetaPropRow
          label="Target Lifecycle"
          value={entity._targetLifecycle?.name ?? '—'}
          editing={editing}
          editValue={editState['_targetLifecycle'] as string}
          onChange={v => setEditState(s => ({ ...s, _targetLifecycle: v }))}
          selectOptions={[
            { value: '', label: '—' },
            ...lifecycleStates.map(state => ({ value: state.id, label: state.label }))
          ]}
        />
      );
    case 'targetLifecycleDate':
      return (
        <MetaPropRow
          label="Target Date"
          value={entity._targetLifecycleDate ?? '—'}
          editing={editing}
          editValue={editState['_targetLifecycleDate'] as string}
          onChange={v => setEditState(s => ({ ...s, _targetLifecycleDate: v }))}
          type="date"
        />
      );
    case 'tags':
      if (!(entity._tags.length > 0 || editing)) return null;
      return (
        <div className={styles.metaPropRow}>
          <span className={styles.metaPropLabel}>Tags</span>
          <span className={styles.metaPropValue}>
            {editing ? (
              <input
                className={styles.inputInline}
                value={editState['_tags'] as string}
                onChange={e => setEditState(s => ({ ...s, _tags: e.target.value }))}
                placeholder="comma-separated"
              />
            ) : (
              <span className={styles.tags}>
                {entity._tags.map(t => (
                  <Chip key={t} tone="ghost">
                    {t}
                  </Chip>
                ))}
              </span>
            )}
          </span>
        </div>
      );
    case 'publicId':
      return <MetaPropRow label="Public ID" value={entity._publicId} />;
    case 'namespace':
      return <MetaPropRow label="Namespace" value={entity._namespace} />;
  }
};
