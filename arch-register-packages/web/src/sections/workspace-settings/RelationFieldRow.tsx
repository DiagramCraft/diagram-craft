import { useState } from 'react';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TbDots } from 'react-icons/tb';
import { FieldConfig } from '../../components/FieldConfig';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/Menu';
import { RELATION_FIELD_TYPES, type RelationFieldType } from '../../lib/schemaPresentation';
import { toFieldId } from '../../utils/fieldId';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type {
  RelationField,
  RelationSchemaGroup
} from '@arch-register/api-types/relationSchemaContract';
import styles from './SchemaSettingsScreen.module.css';

const NO_GROUP = '__no_group__';

export const RelationFieldRow = ({
  field,
  schemas,
  enums,
  groups,
  onUpdate,
  onChangeType,
  onRemove,
  canEdit
}: {
  field: RelationField;
  schemas: EntitySchema[];
  enums: { id: string; name: string }[];
  groups: RelationSchemaGroup[];
  onUpdate: (patch: Partial<RelationField>) => void;
  onChangeType: (type: RelationFieldType) => void;
  onRemove?: () => void;
  canEdit: boolean;
}) => {
  const [idUserEdited, setIdUserEdited] = useState(() => field.id !== toFieldId(field.name));

  const optionsDisplay = () => {
    if (field.type === 'select') {
      return (
        <FormElement label="Enum">
          <Select.Root
            value={field.enumId ?? undefined}
            disabled={!canEdit}
            onChange={value => onUpdate({ enumId: value ?? '' } as Partial<RelationField>)}
            placeholder="Select enum..."
          >
            {enums.map(e => (
              <Select.Item key={e.id} value={e.id}>
                {e.name}
              </Select.Item>
            ))}
          </Select.Root>
        </FormElement>
      );
    }
    if (field.type === 'number') {
      return (
        <>
          <FormElement label="Min">
            <TextInput
              value={field.min === undefined ? '' : String(field.min)}
              disabled={!canEdit}
              onChange={value => {
                const raw = value ?? '';
                if (raw.trim() === '') {
                  onUpdate({ min: undefined } as Partial<RelationField>);
                  return;
                }
                const next = Number(raw);
                if (!Number.isNaN(next))
                  onUpdate({ min: Math.trunc(next) } as Partial<RelationField>);
              }}
              placeholder="Unbounded"
            />
          </FormElement>
          <FormElement label="Max">
            <TextInput
              value={field.max === undefined ? '' : String(field.max)}
              disabled={!canEdit}
              onChange={value => {
                const raw = value ?? '';
                if (raw.trim() === '') {
                  onUpdate({ max: undefined } as Partial<RelationField>);
                  return;
                }
                const next = Number(raw);
                if (!Number.isNaN(next))
                  onUpdate({ max: Math.trunc(next) } as Partial<RelationField>);
              }}
              placeholder="Unbounded"
            />
          </FormElement>
        </>
      );
    }
    if (field.type === 'entityRelation') {
      return (
        <>
          <FormElement label="Target schema">
            <Select.Root
              value={field.schemaId ?? undefined}
              disabled={!canEdit}
              onChange={value => onUpdate({ schemaId: value ?? '' } as Partial<RelationField>)}
              placeholder="Select type..."
            >
              {schemas.map(s => (
                <Select.Item key={s.id} value={s.id}>
                  {s.name}
                </Select.Item>
              ))}
            </Select.Root>
          </FormElement>
          <FormElement label="Predicate">
            <TextInput
              value={field.predicate ?? ''}
              disabled={!canEdit}
              onChange={value =>
                onUpdate({
                  predicate: value?.trim() == null || value.trim() === '' ? undefined : value.trim()
                } as Partial<RelationField>)
              }
              placeholder="e.g., carries, references"
            />
          </FormElement>
          <FormElement label="Min">
            <TextInput
              value={String(field.minCount)}
              disabled={!canEdit}
              onChange={value => {
                const next = Number(value ?? 0);
                onUpdate({
                  minCount: Number.isNaN(next) ? 0 : Math.max(0, next)
                } as Partial<RelationField>);
              }}
            />
          </FormElement>
          <FormElement label="Max">
            <TextInput
              value={field.maxCount === -1 ? '' : String(field.maxCount)}
              disabled={!canEdit}
              onChange={value => {
                const raw = value ?? '';
                if (raw.trim() === '') {
                  onUpdate({ maxCount: -1 } as Partial<RelationField>);
                  return;
                }
                const next = Number(raw);
                onUpdate({
                  maxCount: Number.isNaN(next) ? -1 : Math.max(0, next)
                } as Partial<RelationField>);
              }}
              placeholder="Unbounded"
            />
          </FormElement>
        </>
      );
    }
    return undefined;
  };

  const menu = canEdit ? (
    <MenuButton.Root>
      <MenuButton.Trigger
        element={
          <button type="button" className={styles.iconBtn}>
            <TbDots size={13} />
          </button>
        }
      />
      <MenuButton.Menu>
        <Menu.SubMenu label="Move to group">
          <Menu.RadioGroup value={field.groupId ?? NO_GROUP}>
            <Menu.RadioItem value={NO_GROUP} onClick={() => onUpdate({ groupId: undefined })}>
              No group
            </Menu.RadioItem>
            {groups.map(group => (
              <Menu.RadioItem
                key={group.id}
                value={group.id}
                onClick={() => onUpdate({ groupId: group.id })}
              >
                {group.name}
              </Menu.RadioItem>
            ))}
          </Menu.RadioGroup>
        </Menu.SubMenu>
        {onRemove && (
          <>
            <Menu.Separator />
            <Menu.Item type="danger" onClick={onRemove}>
              Delete field
            </Menu.Item>
          </>
        )}
      </MenuButton.Menu>
    </MenuButton.Root>
  ) : undefined;

  return (
    <FieldConfig dragHandle options={optionsDisplay()} menu={menu}>
      <FieldConfig.Cell label="Id" mono flexBasis={160}>
        <TextInput
          value={field.id}
          disabled={!canEdit}
          onChange={value => {
            setIdUserEdited(true);
            onUpdate({ id: value ?? '' });
          }}
          style={{ width: '100%' }}
        />
      </FieldConfig.Cell>
      <FieldConfig.Cell label="Label" flexBasis={160}>
        <TextInput
          value={field.name}
          disabled={!canEdit}
          onChange={value => {
            const name = value ?? '';
            onUpdate(!idUserEdited ? { name, id: toFieldId(name) } : { name });
          }}
          style={{ width: '100%' }}
        />
      </FieldConfig.Cell>
      <FieldConfig.Cell label="Type" flexBasis={140}>
        <Select.Root
          value={field.type}
          disabled={!canEdit}
          onChange={value => {
            if (value) onChangeType(value as RelationFieldType);
          }}
          style={{ width: '100%' }}
        >
          {RELATION_FIELD_TYPES.map(type => (
            <Select.Item key={type.value} value={type.value}>
              {type.label}
            </Select.Item>
          ))}
        </Select.Root>
      </FieldConfig.Cell>
      <FieldConfig.Cell label="Completeness" flexBasis={120}>
        <Select.Root
          value={field.requirementLevel ?? 'optional'}
          disabled={!canEdit}
          onChange={value =>
            onUpdate({
              requirementLevel: (value ?? 'optional') as RelationField['requirementLevel']
            } as Partial<RelationField>)
          }
          style={{ width: '100%' }}
        >
          <Select.Item value="optional">Optional</Select.Item>
          <Select.Item value="expected">Expected</Select.Item>
          <Select.Item value="required">Required</Select.Item>
        </Select.Root>
      </FieldConfig.Cell>
    </FieldConfig>
  );
};
