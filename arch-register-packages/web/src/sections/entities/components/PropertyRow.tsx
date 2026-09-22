import { MultiSelect, MultiSelectItem } from '@diagram-craft/app-components/MultiSelect';
import { Select } from '@diagram-craft/app-components/Select';
import { TbX } from 'react-icons/tb';
import { Chip } from '../../../components/Chip';
import { UserGroupPicker } from '../../../components/UserGroupPicker';
import { usePrincipalLabel } from '../../../hooks/usePrincipalLabel';
import { formatDate } from '../../../utils/dateFormat';
import { relationIds } from '../../../lib/entityEditState';
import type { EntitySummary } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { ExternalMetadataResult } from '@arch-register/api-types/common';
import type { SupportedCurrency } from '@arch-register/api-types/workspaceConfigContract';
import type { RefLookup } from '../types/entityDetailTypes';
import styles from './EntityOverviewTab.module.css';
import { ExternalMetadataIndicator } from '../../../components/ExternalMetadataIndicator';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { RelationRecordDraft } from '@arch-register/api-types/entityContract';
import { TypedRelationFieldEditor } from './TypedRelationFieldEditor';
import { MultiValueEditor } from '../../../components/MultiValueEditor';
import { isMultiValuedScalarField } from '../../../lib/scalarFieldValues';
import type { TypedRelationFieldEditState } from '../../../lib/entityEditState';
import { selectableEnumOptions } from '../../../utils/enumOptions';
import { asPrincipal, renderEntityFieldDisplayValue } from './entityFieldDisplay';

const PrincipalEditor = ({
  value,
  onChange
}: {
  value: unknown;
  onChange: (value: unknown) => void;
}) => {
  const resolveLabel = usePrincipalLabel();
  const principal = asPrincipal(value);
  const kind: 'user' | 'team' = principal.principal_type === 'team' ? 'team' : 'user';

  if (principal.principal_id) {
    return (
      <Chip tone="ghost">
        <span>{resolveLabel(principal) ?? principal.principal_id}</span>
        <button
          type="button"
          aria-label="Clear"
          onClick={() => onChange(undefined)}
          style={{
            marginLeft: 4,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            padding: 0
          }}
        >
          <TbX size={10} />
        </button>
      </Chip>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <Select.Root
        value={kind}
        onChange={next => onChange({ principal_type: next ?? 'user', principal_id: '' })}
        style={{ width: 100 }}
      >
        <Select.Item value="user">User</Select.Item>
        <Select.Item value="team">Team</Select.Item>
      </Select.Root>
      <UserGroupPicker
        kind={kind}
        onSelect={item => onChange({ principal_type: item.kind, principal_id: item.id })}
        placeholder={kind === 'user' ? 'Search users…' : 'Search teams…'}
      />
    </div>
  );
};

export const PropertyRow = ({
  field,
  label,
  value,
  editing,
  editValue,
  onChange,
  refLookup,
  referenceOptions,
  hasError,
  externalMeta,
  typedRelationsOutgoing,
  typedRelationsIncoming,
  relationSchemas,
  currencyOptions,
  defaultCurrency,
  workspaceSlug,
  typedRelationFieldState,
  onTypedRelationCreate,
  onTypedRelationRemoveDraft,
  onTypedRelationUpdateField,
  onTypedRelationToggleRemove
}: {
  field: EntitySchema['fields'][number];
  label?: string;
  value: unknown;
  editing: boolean;
  editValue: unknown;
  onChange: (v: unknown) => void;
  refLookup: RefLookup;
  referenceOptions: Record<string, EntitySummary[]>;
  hasError?: boolean;
  externalMeta?: ExternalMetadataResult;
  typedRelationsOutgoing: RelationRecord[];
  typedRelationsIncoming: RelationRecord[];
  relationSchemas: RelationSchema[];
  currencyOptions: SupportedCurrency[];
  defaultCurrency: string;
  workspaceSlug: string;
  typedRelationFieldState: TypedRelationFieldEditState;
  onTypedRelationCreate: (draft: RelationRecordDraft) => void;
  onTypedRelationRemoveDraft: (index: number) => void;
  onTypedRelationUpdateField: (relationUid: string, fieldId: string, value: unknown) => void;
  onTypedRelationToggleRemove: (relationUid: string) => void;
}) => {
  const resolvePrincipalLabel = usePrincipalLabel();
  const isExternal = field.external_kind !== undefined;
  const isDerived = field.type === 'derived';
  // Inline editing of typedRelation instances lands separately; render read-only for now.
  const isTypedRelation = field.type === 'typedRelation';
  const renderEditor = () => {
    if (field.type === 'reference') {
      const candidates = referenceOptions[field.schemaId] ?? [];
      const availableItems: MultiSelectItem[] = candidates.map(entity => ({
        value: entity._uid,
        label: entity._name ?? entity._slug
      }));
      return (
        <MultiSelect
          selectedValues={relationIds(editValue)}
          availableItems={availableItems}
          onSelectionChange={onChange}
          placeholder={`Search ${field.name.toLowerCase()}...`}
          style={{ width: '100%' }}
        />
      );
    }
    if (field.type === 'containment') {
      const candidates = referenceOptions[field.schemaId] ?? [];
      return (
        <select
          className={styles.selectInline}
          value={relationIds(editValue)[0] ?? ''}
          onChange={e => onChange(e.target.value ? [e.target.value] : [])}
        >
          <option value="">—</option>
          {candidates.map(e => (
            <option key={e._uid} value={e._uid}>
              {e._name ?? e._slug}
            </option>
          ))}
        </select>
      );
    }
    if (isMultiValuedScalarField(field)) {
      const renderItem = (item: unknown, _index: number, update: (value: unknown) => void) => {
        if (field.type === 'select') {
          return (
            <select
              className={styles.selectInline}
              value={typeof item === 'string' ? item : ''}
              onChange={event => update(event.target.value)}
            >
              <option value="">—</option>
              {selectableEnumOptions(field.options, item).map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          );
        }
        if (field.type === 'longtext') {
          return (
            <textarea
              className={styles.textareaInline}
              value={typeof item === 'string' ? item : ''}
              onChange={event => update(event.target.value)}
            />
          );
        }
        if (field.type === 'boolean') {
          return (
            <input
              type="checkbox"
              checked={item === true}
              onChange={e => update(e.target.checked)}
            />
          );
        }
        if (field.type === 'date') {
          return (
            <input
              className={styles.inputInline}
              type="date"
              value={typeof item === 'string' ? item : ''}
              onChange={event => update(event.target.value)}
            />
          );
        }
        if (field.type === 'currency') {
          const currencyValue =
            typeof item === 'object' && item !== null && !Array.isArray(item)
              ? (item as { amount?: number; currency?: string })
              : {};
          return (
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                className={styles.inputInline}
                type="number"
                step="0.01"
                value={currencyValue.amount ?? ''}
                onChange={event =>
                  update({
                    amount: event.target.value === '' ? undefined : Number(event.target.value),
                    currency: currencyValue.currency ?? defaultCurrency
                  })
                }
              />
              <Select.Root
                value={currencyValue.currency ?? defaultCurrency}
                onChange={next =>
                  update({ amount: currencyValue.amount, currency: (next ?? '').toUpperCase() })
                }
                placeholder="Currency"
                style={{ width: 130 }}
              >
                {currencyOptions.map(currency => (
                  <Select.Item key={currency.code} value={currency.code}>
                    {currency.code} — {currency.label}
                  </Select.Item>
                ))}
              </Select.Root>
            </div>
          );
        }
        if (field.type === 'principal') {
          return <PrincipalEditor value={item} onChange={update} />;
        }
        if (field.type === 'number') {
          return (
            <input
              className={styles.inputInline}
              type="number"
              step="1"
              min={field.min}
              max={field.max}
              value={typeof item === 'number' ? item : ''}
              onChange={event =>
                update(event.target.value === '' ? '' : Math.trunc(event.target.valueAsNumber))
              }
            />
          );
        }
        return (
          <input
            className={styles.inputInline}
            value={typeof item === 'string' ? item : ''}
            onChange={event => update(event.target.value)}
          />
        );
      };
      return (
        <MultiValueEditor
          value={editValue}
          onChange={onChange}
          createValue={() =>
            field.type === 'boolean'
              ? false
              : field.type === 'currency'
                ? { amount: undefined, currency: defaultCurrency }
                : field.type === 'number'
                  ? ''
                  : ''
          }
          renderItem={renderItem}
        />
      );
    }
    if (field.type === 'select') {
      return (
        <select
          className={styles.selectInline}
          value={(editValue as string) ?? ''}
          onChange={e => onChange(e.target.value)}
        >
          <option value="">—</option>
          {selectableEnumOptions(field.options, editValue).map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }
    if (field.type === 'longtext') {
      return (
        <textarea
          className={styles.textareaInline}
          value={(editValue as string) ?? ''}
          onChange={e => onChange(e.target.value)}
        />
      );
    }
    if (field.type === 'boolean') {
      return (
        <input type="checkbox" checked={!!editValue} onChange={e => onChange(e.target.checked)} />
      );
    }
    if (field.type === 'date') {
      return (
        <input
          className={styles.inputInline}
          type="date"
          value={(editValue as string) ?? ''}
          onChange={e => onChange(e.target.value)}
        />
      );
    }
    if (field.type === 'currency') {
      const currencyValue =
        typeof editValue === 'object' && editValue !== null && !Array.isArray(editValue)
          ? (editValue as { amount?: number; currency?: string })
          : {};
      return (
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            className={styles.inputInline}
            type="number"
            step="0.01"
            value={currencyValue.amount ?? ''}
            onChange={e =>
              onChange({
                amount: e.target.value === '' ? undefined : Number(e.target.value),
                currency: currencyValue.currency ?? defaultCurrency
              })
            }
          />
          <Select.Root
            value={currencyValue.currency ?? defaultCurrency}
            onChange={next =>
              onChange({ amount: currencyValue.amount, currency: (next ?? '').toUpperCase() })
            }
            placeholder="Currency"
            style={{ width: 130 }}
          >
            {currencyOptions.map(currency => (
              <Select.Item key={currency.code} value={currency.code}>
                {currency.code} — {currency.label}
              </Select.Item>
            ))}
          </Select.Root>
        </div>
      );
    }
    if (field.type === 'number') {
      return (
        <input
          className={styles.inputInline}
          type="number"
          step="1"
          min={field.min}
          max={field.max}
          value={editValue === undefined || editValue === null ? '' : (editValue as number)}
          onChange={e =>
            onChange(e.target.value === '' ? undefined : Math.trunc(e.target.valueAsNumber))
          }
        />
      );
    }
    if (field.type === 'principal') {
      return <PrincipalEditor value={editValue} onChange={onChange} />;
    }
    return (
      <input
        className={styles.inputInline}
        value={(editValue as string) ?? ''}
        onChange={e => onChange(e.target.value)}
      />
    );
  };

  const renderDisplay = () =>
    renderEntityFieldDisplayValue(field, value, {
      refLookup,
      referenceOptions,
      typedRelationsOutgoing,
      typedRelationsIncoming,
      relationSchemas,
      workspaceSlug,
      formatDateValue: formatDate,
      resolvePrincipalLabel,
      asChip: true
    });

  const typeLabel = field.type.charAt(0).toUpperCase() + field.type.slice(1);

  const renderTypedRelationEditor = () => {
    if (field.type !== 'typedRelation') return null;
    const records = (
      field.direction === 'in' ? typedRelationsOutgoing : typedRelationsIncoming
    ).filter(record => record._schema.id === field.relationSchemaId);
    return (
      <TypedRelationFieldEditor
        workspaceId={workspaceSlug}
        field={field}
        relationSchema={relationSchemas.find(rs => rs.id === field.relationSchemaId)}
        existingRecords={records}
        fieldState={typedRelationFieldState}
        onCreate={onTypedRelationCreate}
        onRemoveDraft={onTypedRelationRemoveDraft}
        onUpdateField={onTypedRelationUpdateField}
        onToggleRemove={onTypedRelationToggleRemove}
      />
    );
  };

  return (
    <div className={`${styles.propRow} ${hasError ? styles.propRowError : ''}`}>
      <div className={styles.propLabel}>
        {label ?? field.name}
        <span className={styles.propType}>{typeLabel}</span>
        {field.requirementLevel === 'optional' && (
          <span className={styles.propOptional}>(optional)</span>
        )}
        {field.requirementLevel === 'expected' && (
          <span className={styles.propExpected}>Expected</span>
        )}
      </div>
      <div
        className={styles.propValue}
        style={hasError ? { flexDirection: 'column', alignItems: 'flex-start' } : undefined}
      >
        {editing && isTypedRelation
          ? renderTypedRelationEditor()
          : editing && !isExternal && !isDerived
            ? renderEditor()
            : renderDisplay()}
        {isExternal && (
          <ExternalMetadataIndicator kind={field.external_kind!} result={externalMeta} />
        )}
        {hasError && <span className={styles.propErrorMsg}>This field is required</span>}
      </div>
    </div>
  );
};
