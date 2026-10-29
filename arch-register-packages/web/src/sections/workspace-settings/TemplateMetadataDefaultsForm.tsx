import type { DocumentMetadata, DocumentType } from '@arch-register/api-types/documentContract';
import { TemplateDefaultInput } from './TemplateDefaultInput';

import styles from './DocumentSettingsScreen.module.css';

const UNTYPED = '__untyped__';

export const pruneDefaultsForType = (
  defaults: DocumentMetadata,
  type: DocumentType | undefined
): DocumentMetadata => {
  const fieldIds = new Set((type?.fields ?? []).filter(f => !f.retired).map(f => f.id));
  return Object.fromEntries(Object.entries(defaults).filter(([key]) => fieldIds.has(key)));
};

export const TemplateMetadataDefaultsForm = ({
  documentTypeId,
  selectedType,
  defaults,
  onChange
}: {
  // '' = not chosen yet, UNTYPED = template for untyped Markdown
  documentTypeId: string;
  selectedType: DocumentType | undefined;
  defaults: DocumentMetadata;
  onChange: (next: DocumentMetadata) => void;
}) => {
  const patchDefault = (fieldId: string, value: DocumentMetadata[string] | null | undefined) => {
    const next = { ...defaults };
    if (value === undefined || value === null) delete next[fieldId];
    else next[fieldId] = value;
    onChange(next);
  };

  const fields = selectedType?.fields.filter(field => !field.retired) ?? [];

  return (
    <>
      <div className={styles.sectionLabel}>Structured metadata defaults</div>
      {documentTypeId === UNTYPED ? (
        <div className={styles.fieldEmpty}>Untyped Markdown has no metadata fields.</div>
      ) : selectedType ? (
        <div className={styles.defaultsGrid}>
          {fields.length === 0 ? (
            <div className={styles.fieldEmpty}>This document type has no fields.</div>
          ) : (
            fields.map(field => (
              <div key={field.id} className={styles.defaultRow}>
                <div className={styles.defaultLabel}>
                  <span>{field.name}</span>
                  {field.requirement === 'optional' && (
                    <span className={styles.optionalLabel}>(optional)</span>
                  )}
                </div>
                <TemplateDefaultInput
                  field={field}
                  value={defaults[field.id]}
                  onChange={value => patchDefault(field.id, value)}
                />
              </div>
            ))
          )}
        </div>
      ) : (
        <div className={styles.fieldEmpty}>Select a document type to set field defaults.</div>
      )}
    </>
  );
};
