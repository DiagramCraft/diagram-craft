import { TbCheck, TbLink } from 'react-icons/tb';
import type {
  DocumentField,
  DocumentMetadata,
  DocumentType
} from '@arch-register/api-types/documentContract';
import { Chip } from '../../components/Chip';
import { TypeBadge } from '../../components/TypeBadge';
import { resolveDocumentTypeColor } from '../../lib/schemaPresentation';
import styles from './MarkdownPropertiesPanel.module.css';

type MarkdownPropertiesPanelProps = {
  documentTypeId: string | null;
  documentTypes: DocumentType[];
  fields: DocumentField[];
  metadata: DocumentMetadata;
  readOnly: boolean;
  onTypeChange: (id: string | null) => void;
  onValueChange: (fieldId: string, value: string | number | boolean | string[] | null | undefined) => void;
};

const fieldValue = (metadata: DocumentMetadata, field: DocumentField) => metadata[field.id];

const displayValue = (value: DocumentMetadata[string] | undefined) =>
  Array.isArray(value) ? value.join(', ') : value == null ? '' : String(value);

const isEmpty = (value: DocumentMetadata[string] | undefined) =>
  value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);

type Validation = { errors: Record<string, string>; warnings: Record<string, string> };

const validateDocMetadata = (fields: DocumentField[], metadata: DocumentMetadata): Validation => {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};
  fields.filter(field => !field.retired).forEach(field => {
    const value = fieldValue(metadata, field);
    if (field.requirement === 'required' && isEmpty(value)) {
      errors[field.id] = 'Required';
      return;
    }
    if (field.requirement === 'expected' && isEmpty(value)) {
      warnings[field.id] = 'Expected — usually filled in for this document type';
    }
  });
  return { errors, warnings };
};

const DocValueView = ({ field, value }: { field: DocumentField; value: DocumentMetadata[string] | undefined }) => {
  if (isEmpty(value)) return <span className="dim">—</span>;
  if (field.type === 'boolean') {
    return value ? (
      <Chip icon={<TbCheck size={10} style={{ color: 'var(--success-fg, #2e9e5b)' }} />}>Yes</Chip>
    ) : (
      <span className="dim">No</span>
    );
  }
  if (field.type === 'enum') return <Chip dot="var(--accent-fg)">{String(value)}</Chip>;
  if (field.type === 'entity_link' || field.type === 'document_link') {
    const links = Array.isArray(value) ? value : [value as string];
    return (
      <div className={styles.reflist}>
        {links.map((link, index) => (
          <Chip key={index} icon={<TbLink size={9} />}>{link}</Chip>
        ))}
      </div>
    );
  }
  return <span className={styles.readValue}>{displayValue(value)}</span>;
};

export const MarkdownPropertiesPanel = ({
  documentTypeId,
  documentTypes,
  fields,
  metadata,
  readOnly,
  onTypeChange,
  onValueChange
}: MarkdownPropertiesPanelProps) => {
  const activeFields = fields.filter(field => !field.retired);
  const retiredFields = fields.filter(field => field.retired && metadata[field.id] !== undefined);
  const knownFieldIds = new Set(fields.map(field => field.id));
  const unreviewedMetadata = Object.entries(metadata).filter(([fieldId]) => !knownFieldIds.has(fieldId));
  const documentType = documentTypes.find(type => type.id === documentTypeId) ?? null;
  const typeColor = documentType
    ? resolveDocumentTypeColor(documentType, documentTypes.findIndex(type => type.id === documentType.id))
    : 'var(--cmp-fg-disabled)';
  const { errors, warnings } = validateDocMetadata(fields, metadata);
  const errorCount = Object.keys(errors).length;

  return (
    <details open className={styles.panel}>
      <summary className={styles.summary}>
        {documentType && <TypeBadge color={typeColor} name={documentType.name} icon={documentType.icon} size={18} />}
        <span className={styles.title}>Properties</span>
        {documentType && <span className="dim" style={{ fontSize: 11 }}>{documentType.name}</span>}
        <div style={{ flex: 1 }} />
        {errorCount > 0 && <Chip>{errorCount} {errorCount === 1 ? 'issue' : 'issues'}</Chip>}
      </summary>
      <div className={styles.body}>
        <div className={styles.typeRow}>
          <select
            value={documentTypeId ?? ''}
            disabled={readOnly}
            onChange={event => onTypeChange(event.target.value || null)}
            aria-label="Document type"
          >
            <option value="">Untyped Markdown</option>
            {documentTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
          </select>
        </div>
        {documentTypeId == null ? (
          <div className="dim" style={{ fontSize: 11 }}>This is a legacy untyped Markdown document.</div>
        ) : activeFields.length === 0 ? (
          <div className="dim" style={{ fontSize: 11 }}>This document type has no editable fields.</div>
        ) : (
          <div className={styles.grid}>
            {activeFields.map(field => {
              const value = fieldValue(metadata, field);
              const required = field.requirement === 'required';
              const error = errors[field.id];
              const warning = warnings[field.id];
              const label = (
                <span className={styles.label}>
                  <span>{field.name}</span>
                  {required && <span className={styles.requiredDot} title="Required" />}
                </span>
              );
              if (readOnly) {
                return (
                  <div key={field.id} className={styles.field}>
                    <div className="dim" style={{ fontSize: 10 }}>{label}</div>
                    <DocValueView field={field} value={value} />
                  </div>
                );
              }
              const control = (() => {
                if (field.type === 'long_text') {
                  return <textarea value={displayValue(value)} rows={3} onChange={event => onValueChange(field.id, event.target.value || null)} />;
                }
                if (field.type === 'enum') {
                  return (
                    <select value={typeof value === 'string' ? value : ''} onChange={event => onValueChange(field.id, event.target.value || null)}>
                      <option value="">Select…</option>
                      {(field.enumOptions ?? []).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  );
                }
                if (field.type === 'boolean') {
                  return (
                    <select value={typeof value === 'boolean' ? String(value) : ''} onChange={event => onValueChange(field.id, event.target.value === '' ? null : event.target.value === 'true')}>
                      <option value="">Select…</option>
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </select>
                  );
                }
                if (field.type === 'number') {
                  return <input type="number" value={typeof value === 'number' ? value : ''} onChange={event => onValueChange(field.id, event.target.value === '' ? null : Number(event.target.value))} />;
                }
                if (field.type === 'entity_link' || field.type === 'document_link') {
                  const links = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
                  return <input value={links.join(', ')} placeholder="IDs separated by commas" onChange={event => onValueChange(field.id, event.target.value.split(',').map(item => item.trim()).filter(Boolean))} />;
                }
                return <input type={field.type === 'date' ? 'date' : 'text'} value={typeof value === 'string' ? value : ''} onChange={event => onValueChange(field.id, event.target.value || null)} />;
              })();
              return (
                <label key={field.id} className={styles.field}>
                  {label}
                  {control}
                  {error && <div className={styles.error}>{error}</div>}
                  {!error && warning && <div className={styles.warning}>{warning}</div>}
                </label>
              );
            })}
          </div>
        )}
        {retiredFields.length > 0 && <div className="dim" style={{ marginTop: 10, fontSize: 10 }}>Retired fields are preserved for history: {retiredFields.map(field => field.name).join(', ')}.</div>}
        {unreviewedMetadata.length > 0 && (
          <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 600 }}>Metadata requiring review</div>
            <div className="dim" style={{ fontSize: 10 }}>These values are not defined by the selected document type. Remove them before completing this migration.</div>
            {unreviewedMetadata.map(([fieldId, value]) => (
              <div key={fieldId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                <code style={{ flex: 1 }}>{fieldId} = {displayValue(value) || '—'}</code>
                {!readOnly && <button type="button" onClick={() => onValueChange(fieldId, undefined)}>Remove</button>}
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
};
