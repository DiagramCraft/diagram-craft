import { TbTrash } from 'react-icons/tb';

import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Select } from '@diagram-craft/app-components/Select';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';

import type { DocumentAiAction, DocumentField } from '@arch-register/api-types/documentContract';

import styles from './DocumentSettingsScreen.module.css';

import { isLinkType } from './documentSettingsHelpers';
const AI_ACTION_KIND_OPTIONS: { value: DocumentAiAction['kind']; label: string }[] = [
  { value: 'interactive', label: 'Interactive' },
  { value: 'metadata_generator', label: 'Metadata generator' }
];

export const DocumentAiActionRow = ({
  action,
  fields,
  claimedFieldIds,
  onUpdate,
  onRemove
}: {
  action: DocumentAiAction;
  fields: DocumentField[];
  claimedFieldIds: ReadonlySet<string>;
  onUpdate: (next: DocumentAiAction) => void;
  onRemove: () => void;
}) => {
  const eligibleFields = fields.filter(
    field => !field.retired && !isLinkType(field.type) && !claimedFieldIds.has(field.id)
  );

  const handleKindChange = (kind: string | undefined) => {
    if (kind === 'metadata_generator') {
      onUpdate({
        id: action.id,
        name: action.name,
        prompt: action.prompt,
        enabled: action.enabled,
        kind: 'metadata_generator',
        outputFieldId: eligibleFields[0]?.id ?? ''
      });
    } else if (kind === 'interactive') {
      onUpdate({
        id: action.id,
        name: action.name,
        prompt: action.prompt,
        enabled: action.enabled,
        kind: 'interactive'
      });
    }
  };

  return (
    <div className={styles.aiActionRow}>
      <TextInput
        value={action.name}
        onChange={value => onUpdate({ ...action, name: value ?? '' })}
        placeholder="Action name"
        style={{ width: '100%' }}
      />
      <Select.Root value={action.kind} onChange={handleKindChange} style={{ width: '100%' }}>
        {AI_ACTION_KIND_OPTIONS.map(option => (
          <Select.Item key={option.value} value={option.value}>
            {option.label}
          </Select.Item>
        ))}
      </Select.Root>
      <TextArea
        value={action.prompt}
        onChange={value => onUpdate({ ...action, prompt: value ?? '' })}
        rows={2}
        style={{ width: '100%' }}
      />
      <div>
        {action.kind === 'metadata_generator' &&
          (eligibleFields.length > 0 || action.outputFieldId ? (
            <Select.Root
              value={action.outputFieldId}
              onChange={fieldId => onUpdate({ ...action, outputFieldId: fieldId ?? '' })}
              style={{ width: '100%' }}
            >
              {eligibleFields
                .concat(
                  fields.filter(
                    field => field.id === action.outputFieldId && !eligibleFields.includes(field)
                  )
                )
                .map(field => (
                  <Select.Item key={field.id} value={field.id}>
                    {field.name}
                  </Select.Item>
                ))}
            </Select.Root>
          ) : (
            <div className="dim" style={{ fontSize: 11 }}>
              No eligible fields — add a text, long text, boolean, date, number, or enum field
              first.
            </div>
          ))}
      </div>
      <Checkbox
        value={action.enabled}
        onChange={value => onUpdate({ ...action, enabled: value ?? false })}
      />
      <button type="button" className={styles.iconBtn} onClick={onRemove}>
        <TbTrash size={13} />
      </button>
    </div>
  );
};

// =====================================================================
// Template editor
// =====================================================================
