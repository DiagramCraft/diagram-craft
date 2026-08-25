import { MultiSelect, MultiSelectItem } from '@diagram-craft/app-components/MultiSelect';
import { Select } from '@diagram-craft/app-components/Select';
import { TbX } from 'react-icons/tb';
import { Chip } from '../../../components/Chip';
import { UserGroupPicker } from '../../../components/UserGroupPicker';
import { usePrincipalLabel } from '../../../hooks/usePrincipalLabel';
import { formatDate } from '../../../utils/dateFormat';
import { formatCurrencyValue } from '../../../utils/currencyFormat';
import { relationIds } from '../../../lib/entityEditState';
import type { EntitySummary } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { ExternalMetadataResult } from '@arch-register/api-types/common';
import type { SupportedCurrency } from '@arch-register/api-types/workspaceConfigContract';
import type { RefLookup } from '../types/entityDetailTypes';
import styles from './EntityOverviewTab.module.css';
import sharedStyles from '../EntityDetailScreen.module.css';
import { EntityNavigationLink } from '../../../components/EntityNavigationLink';
import { ExternalMetadataIndicator } from '../../../components/ExternalMetadataIndicator';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { RelationRecordDraft } from '@arch-register/api-types/entityContract';
import { RelationRecordList } from './RelationRecordList';
import { TypedRelationFieldEditor } from './TypedRelationFieldEditor';
import { MultiValueEditor } from '../../../components/MultiValueEditor';
import { isMultiValuedScalarField } from '../../../lib/scalarFieldValues';
import { resolveEntityReference } from '../entityDetailHelpers';
import type { TypedRelationFieldEditState } from '../../../lib/entityEditState';
import { selectableEnumOptions } from '../../../utils/enumOptions';

const asPrincipal = (value: unknown): { principal_type?: string; principal_id?: string } =>
  (typeof value === 'object' && value !== null ? value : {}) as {
    principal_type?: string;
    principal_id?: string;
  };

const PrincipalChip = ({ value }: { value: unknown }) => {
  const resolveLabel = usePrincipalLabel();
  const principal = asPrincipal(value);
  if (!principal.principal_id) return <span className={sharedStyles.dim}>—</span>;
  return <Chip tone="ghost">{resolveLabel(principal) ?? principal.principal_id}</Chip>;
};

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

  const renderDisplay = () => {
    if (field.type === 'typedRelation') {
      const records = (
        field.direction === 'in' ? typedRelationsOutgoing : typedRelationsIncoming
      ).filter(record => record._schema.id === field.relationSchemaId);
      if (records.length === 0) return <span className={sharedStyles.dim}>—</span>;
      return (
        <RelationRecordList
          records={records}
          direction={field.direction === 'in' ? 'outgoing' : 'incoming'}
          relationSchema={relationSchemas.find(rs => rs.id === field.relationSchemaId)}
          workspaceId={workspaceSlug}
        />
      );
    }
    if (field.type === 'reference' || field.type === 'containment') {
      const ids = relationIds(value);
      if (ids.length === 0) return <span className={sharedStyles.dim}>—</span>;
      return (
        <>
          {ids.map((id, index) => {
            const ref = resolveEntityReference(id, field.schemaId, refLookup, referenceOptions);
            const label = ref?._name ?? ref?._slug ?? id;
            return (
              <span key={id}>
                {index > 0 && ', '}
                <EntityNavigationLink publicId={ref?._publicId ?? id} className={styles.propLink}>
                  {label}
                </EntityNavigationLink>
              </span>
            );
          })}
        </>
      );
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return <span className={sharedStyles.dim}>—</span>;
      if (field.type === 'select') {
        return (
          <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
            {value.map((item, index) => {
              const option = field.options.find(candidate => candidate.value === item);
              return (
                <Chip key={`${String(item)}-${index}`} tone="ghost">
                  {option?.label ?? String(item)}
                </Chip>
              );
            })}
          </span>
        );
      }
      if (field.type === 'boolean') {
        return <span>{value.map(item => (item ? 'Yes' : 'No')).join(', ')}</span>;
      }
      if (field.type === 'date') {
        return <span>{value.map(item => formatDate(item)).join(', ')}</span>;
      }
      if (field.type === 'currency') {
        return <span>{value.map(item => formatCurrencyValue(item)).join(', ')}</span>;
      }
      if (field.type === 'principal') {
        return (
          <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
            {value.map((item, index) => (
              <PrincipalChip key={index} value={item} />
            ))}
          </span>
        );
      }
      return <span>{value.map(item => String(item)).join(', ')}</span>;
    }
    if (value == null || value === '') return <span className={sharedStyles.dim}>—</span>;
    if (field.type === 'principal') return <PrincipalChip value={value} />;
    if (field.type === 'derived') {
      if (field.resultType === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
      if (field.resultType === 'currency') return <span>{formatCurrencyValue(value)}</span>;
      if (field.resultType === 'select') {
        const opt = field.options?.find(o => o.value === String(value));
        return <Chip tone="ghost">{opt?.label ?? String(value)}</Chip>;
      }
      return <span>{String(value)}</span>;
    }
    if (field.type === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
    if (field.type === 'select') {
      const opt = field.options.find(o => o.value === value);
      return <Chip tone="ghost">{opt?.label ?? String(value)}</Chip>;
    }
    if (field.type === 'date') return <span>{formatDate(value)}</span>;
    if (field.type === 'currency') return <span>{formatCurrencyValue(value)}</span>;
    return <span>{String(value)}</span>;
  };

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
        {field.name}
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
