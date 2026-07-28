import { useState } from 'react';

import { TbEye, TbGripVertical, TbSettings, TbSettingsCheck, TbDots } from 'react-icons/tb';

import { Button } from '@diagram-craft/app-components/Button';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Select } from '@diagram-craft/app-components/Select';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/Menu';

import type {
  DocumentField,
  DocumentFieldType,
  DocumentRequirement
} from '@arch-register/api-types/documentContract';

import { Chip } from '../../components/Chip';
import { FieldConfig } from '../../components/FieldConfig';

import { toFieldId } from '../../utils/fieldId';

import styles from './DocumentSettingsScreen.module.css';

import { FIELD_TYPE_OPTIONS, REQUIREMENT_OPTIONS, isLinkType } from './documentSettingsHelpers';
import { WorkflowConfigDialog } from './WorkflowConfigDialog';

const NOT_EXTERNAL = '__not_external__';

export const DocumentFieldRow = ({
  field,
  workspaceSlug,
  allFields,
  onUpdate,
  onRemove
}: {
  field: DocumentField;
  workspaceSlug: string;
  allFields: DocumentField[];
  onUpdate: (patch: Partial<DocumentField>) => void;
  onRemove: () => void;
}) => {
  const [idUserEdited, setIdUserEdited] = useState(() => field.id !== toFieldId(field.name));
  const [workflowDialogOpen, setWorkflowDialogOpen] = useState(false);

  if (field.retired) {
    return (
      <div className={`${styles.fieldRow} ${styles.fieldRowRetired}`}>
        <span className={styles.fieldHandle}>
          <TbGripVertical size={14} />
        </span>
        <span className={styles.fieldId}>{field.id}</span>
        <span>{field.name}</span>
        <span className="dim">{field.type}</span>
        <span className="dim">—</span>
        <span>
          <Chip tone="ghost">Retired</Chip>
        </span>
        <span className="dim">—</span>
        <button
          type="button"
          className={styles.iconBtn}
          title="Restore field"
          onClick={() => onUpdate({ retired: false })}
        >
          <TbEye size={13} />
        </button>
      </div>
    );
  }

  const options = (() => {
    if (field.type === 'enum') {
      return (
        <>
          <FormElement label="Values">
            <TextInput
              value={(field.enumOptions ?? [])
                .map(option => `${option.value}:${option.label}`)
                .join(', ')}
              placeholder="proposed:Proposed, accepted:Accepted"
              onChange={value => {
                const existing = new Map(
                  (field.enumOptions ?? []).map(option => [option.value, option])
                );
                onUpdate({
                  enumOptions: (value ?? '')
                    .split(',')
                    .map(option => option.trim())
                    .filter(Boolean)
                    .map(option => {
                      const [enumValue, ...label] = option.split(':');
                      const parsedValue = enumValue!.trim();
                      const prior = existing.get(parsedValue);
                      return {
                        value: parsedValue,
                        label: label.join(':').trim() === '' ? parsedValue : label.join(':').trim(),
                        ...(prior?.approval ? { approval: prior.approval } : {})
                      };
                    })
                });
              }}
            />
          </FormElement>
          <Button
            style={{ marginLeft: 'auto' }}
            icon={
              field.isStatus ? (
                <TbSettingsCheck size={12} color="var(--green)" />
              ) : (
                <TbSettings size={12} />
              )
            }
            title={field.isStatus ? 'Workflow enabled' : 'Workflow not configured'}
            onClick={() => setWorkflowDialogOpen(true)}
          >
            {field.isStatus ? 'Workflow enabled' : 'Configure workflow'}
          </Button>
          <WorkflowConfigDialog
            open={workflowDialogOpen}
            workspaceSlug={workspaceSlug}
            field={field}
            allFields={allFields}
            onClose={() => setWorkflowDialogOpen(false)}
            onSave={patch => {
              onUpdate(patch);
              setWorkflowDialogOpen(false);
            }}
          />
        </>
      );
    }
    if (isLinkType(field.type)) {
      return (
        <>
          <FormElement label="Min">
            <TextInput
              value={field.minCardinality === undefined ? '' : String(field.minCardinality)}
              placeholder="Min"
              onChange={value =>
                onUpdate({
                  minCardinality: value === '' || value === undefined ? undefined : Number(value)
                })
              }
            />
          </FormElement>
          <FormElement label="Max">
            <TextInput
              value={field.maxCardinality === undefined ? '' : String(field.maxCardinality)}
              placeholder="Max"
              onChange={value =>
                onUpdate({
                  maxCardinality: value === '' || value === undefined ? undefined : Number(value)
                })
              }
            />
          </FormElement>
          <FormElement label="Inverse label">
            <TextInput
              value={field.inverseName ?? ''}
              placeholder="Inverse label"
              onChange={value =>
                onUpdate({ inverseName: value?.trim() ? value.trim() : undefined })
              }
            />
          </FormElement>
        </>
      );
    }
    return undefined;
  })();

  return (
    <FieldConfig
      dragHandle
      options={options}
      menu={
        <MenuButton.Root>
          <MenuButton.Trigger
            element={
              <button type="button" className={styles.iconBtn}>
                <TbDots size={13} />
              </button>
            }
          />
          <MenuButton.Menu>
            <Menu.Item type="danger" onClick={onRemove}>
              Remove field
            </Menu.Item>
          </MenuButton.Menu>
        </MenuButton.Root>
      }
    >
      <FieldConfig.Cell label="Id" mono flexBasis={140}>
        <TextInput
          value={field.id}
          onChange={value => {
            setIdUserEdited(true);
            onUpdate({ id: value ?? field.id });
          }}
          style={{ width: '100%' }}
        />
      </FieldConfig.Cell>
      <FieldConfig.Cell label="Label" flexBasis={160}>
        <TextInput
          value={field.name}
          onChange={value => {
            const name = value ?? '';
            if (!idUserEdited) onUpdate({ name, id: toFieldId(name) });
            else onUpdate({ name });
          }}
          style={{ width: '100%' }}
        />
      </FieldConfig.Cell>
      <FieldConfig.Cell label="Type" flexBasis={130}>
        <Select.Root
          value={field.type}
          onChange={value =>
            value &&
            onUpdate({
              type: value as DocumentFieldType,
              ...(value === 'enum' ? {} : { isStatus: false })
            })
          }
          style={{ width: '100%' }}
        >
          {FIELD_TYPE_OPTIONS.map(option => (
            <Select.Item key={option.value} value={option.value}>
              {option.label}
            </Select.Item>
          ))}
        </Select.Root>
      </FieldConfig.Cell>
      <FieldConfig.Cell label="Completeness" flexBasis={120}>
        <Select.Root
          value={field.requirement}
          onChange={value => value && onUpdate({ requirement: value as DocumentRequirement })}
          style={{ width: '100%' }}
        >
          {REQUIREMENT_OPTIONS.map(option => (
            <Select.Item key={option.value} value={option.value}>
              {option.label}
            </Select.Item>
          ))}
        </Select.Root>
      </FieldConfig.Cell>
      <FieldConfig.Cell label="External" flexBasis={150}>
        <div style={{ display: 'grid', gap: 4 }}>
          <Select.Root
            value={field.external_kind ?? NOT_EXTERNAL}
            onChange={value =>
              onUpdate(
                value === NOT_EXTERNAL || !value
                  ? { external_kind: undefined, refresh_mode: undefined }
                  : { external_kind: value as DocumentField['external_kind'] }
              )
            }
            style={{ width: '100%' }}
          >
            <Select.Item value={NOT_EXTERNAL}>Not external</Select.Item>
            <Select.Item value="ai">AI</Select.Item>
            <Select.Item value="integration">Integration</Select.Item>
            <Select.Item value="automation">Automation</Select.Item>
          </Select.Root>
          {field.external_kind && (
            <Select.Root
              value={field.refresh_mode ?? 'on_change'}
              onChange={value =>
                onUpdate({
                  refresh_mode: (value ?? 'on_change') as DocumentField['refresh_mode']
                })
              }
              style={{ width: '100%' }}
            >
              <Select.Item value="on_change">On change</Select.Item>
              <Select.Item value="scheduled">Scheduled</Select.Item>
            </Select.Root>
          )}
        </div>
      </FieldConfig.Cell>
    </FieldConfig>
  );
};
