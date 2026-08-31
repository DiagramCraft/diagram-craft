import { useState, type RefCallback } from 'react';
import { Select } from '@diagram-craft/app-components/Select';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TbDots } from 'react-icons/tb';
import { FieldConfig } from '../../components/FieldConfig';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/Menu';
import { DerivedExpressionTestDialog } from '../../components/DerivedExpressionTestDialog';
import { FIELD_TYPES, type FieldType } from '../../lib/schemaPresentation';
import { toFieldId } from '../../utils/fieldId';
import type {
  EntitySchema,
  SchemaField,
  SchemaGroup
} from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import styles from './SchemaSettingsScreen.module.css';
import { ScalarCardinalityControls } from './ScalarCardinalityControls';
import {
  isScalarCardinalityField,
  scalarCardinalityPatchForRequirement
} from './scalarCardinality';

const NOT_EXTERNAL = '__not_external__';
const NO_GROUP = '__no_group__';

export const SchemaFieldRow = ({
  field,
  schemas,
  relationSchemas,
  enums,
  groups,
  onUpdate,
  onChangeType,
  onRemove,
  containmentDisabled,
  canEdit,
  dragHandleRef
}: {
  field: SchemaField;
  schemas: EntitySchema[];
  relationSchemas: RelationSchema[];
  enums: WorkspaceEnum[];
  groups: SchemaGroup[];
  onUpdate: (patch: Partial<SchemaField>) => void;
  onChangeType: (type: FieldType) => void;
  onRemove?: () => void;
  containmentDisabled: boolean;
  canEdit: boolean;
  dragHandleRef: RefCallback<HTMLElement>;
}) => {
  const [idUserEdited, setIdUserEdited] = useState(() => field.id !== toFieldId(field.name));
  const [expressionTestOpen, setExpressionTestOpen] = useState(false);

  const optionsDisplay = () => {
    if (field.type === 'select') {
      return (
        <>
          <ScalarCardinalityControls field={field} onUpdate={onUpdate} disabled={!canEdit} />
          <FormElement label="Enum">
            <Select.Root
              value={field.enumId ?? undefined}
              disabled={!canEdit}
              onChange={value => onUpdate({ enumId: value ?? '' } as Partial<SchemaField>)}
              placeholder="Select enum..."
            >
              {enums.map(e => (
                <Select.Item key={e.id} value={e.id}>
                  {e.name}
                </Select.Item>
              ))}
            </Select.Root>
          </FormElement>
        </>
      );
    }
    if (field.type === 'reference' || field.type === 'containment') {
      return (
        <>
          <FormElement
            label={field.type === 'reference' ? 'Reference target' : 'Containment target'}
          >
            <Select.Root
              value={field.schemaId ?? undefined}
              disabled={!canEdit}
              onChange={value => onUpdate({ schemaId: value ?? '' } as Partial<SchemaField>)}
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
                } as Partial<SchemaField>)
              }
              placeholder="e.g., belongs to, depends on"
            />
          </FormElement>
          {field.type === 'reference' && (
            <>
              <FormElement label="Min">
                <TextInput
                  value={String(field.minCount)}
                  disabled={!canEdit}
                  onChange={value => {
                    const next = Number(value ?? 0);
                    onUpdate({
                      minCount: Number.isNaN(next) ? 0 : Math.max(0, next)
                    } as Partial<SchemaField>);
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
                      onUpdate({ maxCount: -1 } as Partial<SchemaField>);
                      return;
                    }
                    const next = Number(raw);
                    onUpdate({
                      maxCount: Number.isNaN(next) ? -1 : Math.max(0, next)
                    } as Partial<SchemaField>);
                  }}
                  placeholder="Unbounded"
                />
              </FormElement>
            </>
          )}
        </>
      );
    }
    if (field.type === 'typedRelation') {
      return (
        <>
          <FormElement label="Relation type">
            <Select.Root
              value={field.relationSchemaId || undefined}
              disabled={!canEdit}
              onChange={value =>
                onUpdate({ relationSchemaId: value ?? '' } as Partial<SchemaField>)
              }
              placeholder="Select a relation type..."
            >
              {relationSchemas.map(rs => (
                <Select.Item key={rs.id} value={rs.id}>
                  {rs.name}
                </Select.Item>
              ))}
            </Select.Root>
          </FormElement>
          <FormElement label="Direction">
            <Select.Root
              value={field.direction}
              disabled={!canEdit}
              onChange={value =>
                onUpdate({ direction: (value ?? 'out') as 'in' | 'out' } as Partial<SchemaField>)
              }
            >
              <Select.Item value="out">Out (this entity is the "out" endpoint)</Select.Item>
              <Select.Item value="in">In (this entity is the "in" endpoint)</Select.Item>
            </Select.Root>
          </FormElement>
          <FormElement label="Min">
            <TextInput
              value={String(field.minCount)}
              disabled={!canEdit}
              onChange={value => {
                const next = Number(value ?? 0);
                onUpdate({
                  minCount: Number.isNaN(next) ? 0 : Math.max(0, Math.trunc(next))
                } as Partial<SchemaField>);
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
                  onUpdate({ maxCount: -1 } as Partial<SchemaField>);
                  return;
                }
                const next = Number(raw);
                onUpdate({
                  maxCount: Number.isNaN(next) ? -1 : Math.max(0, Math.trunc(next))
                } as Partial<SchemaField>);
              }}
              placeholder="Unbounded"
            />
          </FormElement>
        </>
      );
    }
    if (field.type === 'number') {
      return (
        <>
          <ScalarCardinalityControls field={field} onUpdate={onUpdate} disabled={!canEdit} />
          <FormElement label="Min">
            <TextInput
              value={field.min === undefined ? '' : String(field.min)}
              disabled={!canEdit}
              onChange={value => {
                const raw = value ?? '';
                if (raw.trim() === '') {
                  onUpdate({ min: undefined } as Partial<SchemaField>);
                  return;
                }
                const next = Number(raw);
                if (!Number.isNaN(next))
                  onUpdate({ min: Math.trunc(next) } as Partial<SchemaField>);
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
                  onUpdate({ max: undefined } as Partial<SchemaField>);
                  return;
                }
                const next = Number(raw);
                if (!Number.isNaN(next))
                  onUpdate({ max: Math.trunc(next) } as Partial<SchemaField>);
              }}
              placeholder="Unbounded"
            />
          </FormElement>
        </>
      );
    }
    if (
      field.type === 'text' ||
      field.type === 'longtext' ||
      field.type === 'boolean' ||
      field.type === 'date' ||
      field.type === 'currency' ||
      field.type === 'principal'
    ) {
      return <ScalarCardinalityControls field={field} onUpdate={onUpdate} disabled={!canEdit} />;
    }
    if (field.type === 'derived') {
      const referencesNow = /\b(?:entity|relation|assessment)\.now\b/.test(field.expression);
      return (
        <>
          <FormElement label="Result type">
            <Select.Root
              value={field.resultType}
              disabled={!canEdit}
              onChange={value =>
                onUpdate({
                  resultType: (value ?? 'text') as Extract<
                    SchemaField,
                    { type: 'derived' }
                  >['resultType']
                } as Partial<SchemaField>)
              }
            >
              <Select.Item value="text">Text</Select.Item>
              <Select.Item value="number">Number</Select.Item>
              <Select.Item value="currency">Currency</Select.Item>
              <Select.Item value="select">Select</Select.Item>
              <Select.Item value="boolean">Boolean</Select.Item>
              <Select.Item value="rating">Rating</Select.Item>
            </Select.Root>
          </FormElement>
          {field.resultType === 'select' && (
            <FormElement label="Enum">
              <Select.Root
                value={field.enumId ?? undefined}
                disabled={!canEdit}
                onChange={value => onUpdate({ enumId: value ?? '' } as Partial<SchemaField>)}
                placeholder="Select enum..."
              >
                {enums.map(e => (
                  <Select.Item key={e.id} value={e.id}>
                    {e.name}
                  </Select.Item>
                ))}
              </Select.Root>
            </FormElement>
          )}
          <FormElement label="Expression" style={{ width: 460, maxWidth: '100%' }}>
            <TextArea
              value={field.expression}
              disabled={!canEdit}
              onChange={value => {
                const expression = value ?? '';
                const stillTimeDependent = /\b(?:entity|relation|assessment)\.now\b/.test(
                  expression
                );
                onUpdate({
                  expression,
                  ...(field.recalc_interval && !stillTimeDependent
                    ? { recalc_interval: undefined }
                    : {})
                } as Partial<SchemaField>);
              }}
              rows={5}
              placeholder="entity.input_field"
              style={{ position: 'relative', width: '100%' }}
            />
          </FormElement>
          <FormElement
            label="Recalculation"
            hint={
              referencesNow
                ? 'How often the scan job recomputes this time-dependent value'
                : 'Only applies to expressions that use now'
            }
          >
            <Select.Root
              value={field.recalc_interval ?? 'daily'}
              disabled={!canEdit || !referencesNow}
              onChange={value =>
                onUpdate({
                  recalc_interval: (value ?? 'daily') as 'hourly' | 'daily'
                } as Partial<SchemaField>)
              }
            >
              <Select.Item value="daily">Daily</Select.Item>
              <Select.Item value="hourly">Hourly</Select.Item>
            </Select.Root>
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
        {field.type === 'derived' && (
          <Menu.Item onClick={() => setExpressionTestOpen(true)}>Test expression</Menu.Item>
        )}
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
    <>
      <FieldConfig dragHandleRef={dragHandleRef} options={optionsDisplay()} menu={menu}>
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
              if (value) onChangeType(value as FieldType);
            }}
            style={{ width: '100%' }}
          >
            {FIELD_TYPES.map(type => (
              <Select.Item
                key={type.value}
                value={type.value}
                disabled={type.value === 'containment' && containmentDisabled}
              >
                {type.label}
              </Select.Item>
            ))}
          </Select.Root>
        </FieldConfig.Cell>
        <FieldConfig.Cell label="Completeness" flexBasis={120}>
          <Select.Root
            value={field.requirementLevel ?? 'optional'}
            disabled={!canEdit || field.type === 'derived'}
            onChange={value => {
              const requirementLevel = (value ?? 'optional') as SchemaField['requirementLevel'];
              onUpdate({
                ...(isScalarCardinalityField(field)
                  ? scalarCardinalityPatchForRequirement(field, requirementLevel ?? 'optional')
                  : { requirementLevel }),
                ...(field.type === 'containment'
                  ? { minCount: requirementLevel === 'required' ? 1 : 0 }
                  : {})
              } as Partial<SchemaField>);
            }}
            style={{ width: '100%' }}
          >
            <Select.Item value="optional">Optional</Select.Item>
            <Select.Item value="expected">Expected</Select.Item>
            <Select.Item value="required">Required</Select.Item>
          </Select.Root>
        </FieldConfig.Cell>
        {field.type !== 'derived' && (
          <FieldConfig.Cell label="External" flexBasis={150}>
            <div style={{ display: 'grid', gap: 4 }}>
              <Select.Root
                value={field.external_kind ?? NOT_EXTERNAL}
                disabled={!canEdit}
                onChange={value =>
                  onUpdate(
                    value === NOT_EXTERNAL || !value
                      ? { external_kind: undefined, refresh_mode: undefined }
                      : { external_kind: value as SchemaField['external_kind'] }
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
                  disabled={!canEdit}
                  onChange={value =>
                    onUpdate({
                      refresh_mode: (value ?? 'on_change') as SchemaField['refresh_mode']
                    } as Partial<SchemaField>)
                  }
                  style={{ width: '100%' }}
                >
                  <Select.Item value="on_change">On change</Select.Item>
                  <Select.Item value="scheduled">Scheduled</Select.Item>
                </Select.Root>
              )}
            </div>
          </FieldConfig.Cell>
        )}
      </FieldConfig>
      {field.type === 'derived' && (
        <DerivedExpressionTestDialog
          open={expressionTestOpen}
          field={{ ...field, label: field.name }}
          expression={field.expression}
          onClose={() => setExpressionTestOpen(false)}
          onSave={expression => {
            onUpdate({ expression });
            setExpressionTestOpen(false);
          }}
        />
      )}
    </>
  );
};
