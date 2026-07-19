import { useState, type ReactNode } from 'react';
import {
  TbCheck,
  TbChevronRight,
  TbInfoCircle,
  TbLink,
  TbPlus,
  TbSparkles,
  TbX
} from 'react-icons/tb';
import { Link } from '@tanstack/react-router';
import type {
  DocumentField,
  DocumentGeneratedMetadata,
  DocumentGeneratedMetadataResult,
  DocumentAiAction,
  DocumentMetadata,
  DocumentType
} from '@arch-register/api-types/documentContract';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { Chip } from '../../components/Chip';
import { TypeBadge } from '../../components/TypeBadge';
import { HoverCard } from '../../components/HoverCard';
import { DocumentHoverCardBody } from '../../components/DocumentHoverCardBody';
import {
  HoverCardDescription,
  HoverCardRows,
  HoverCardTitle,
  TooltipChip,
  TooltipChips,
  TooltipRow
} from '../../components/HoverCardParts';
import { useContentFile } from '../../hooks/useContentScope';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { resolveDocumentTypeColor } from '../../lib/schemaPresentation';
import {
  asEntityPublicId,
  asProjectPublicId,
  entityMarkdownRoute,
  projectMarkdownRoute,
  workspaceMarkdownRoute
} from '../../routes/publicObjectRoutes';
import { EntityLink } from './mdx-components/inlines/entity-link/EntityLink';
import { MarkdownEntityLinkDialog } from './MarkdownEntityLinkDialog';
import { MarkdownDocumentLinkDialog } from './MarkdownDocumentLinkDialog';
import styles from './MarkdownPropertiesPanel.module.css';

const UNTYPED = '__untyped__';
const UNSET = '__unset__';

type MarkdownPropertiesPanelProps = {
  documentTypeId: string | null;
  documentTypes: DocumentType[];
  fields: DocumentField[];
  metadata: DocumentMetadata;
  generatedMetadata: DocumentGeneratedMetadata;
  readOnly: boolean;
  attemptedSave?: boolean;
  onTypeChange: (id: string | null) => void;
  onValueChange: (
    fieldId: string,
    value: string | number | boolean | string[] | null | undefined
  ) => void;
};

const fieldValue = (metadata: DocumentMetadata, field: DocumentField) => metadata[field.id];

const displayValue = (value: DocumentMetadata[string] | undefined) =>
  Array.isArray(value) ? value.join(', ') : value == null ? '' : String(value);

const isEmpty = (value: DocumentMetadata[string] | undefined) =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0);

const valueCount = (value: DocumentMetadata[string] | undefined) => {
  if (isEmpty(value)) return 0;
  return Array.isArray(value) ? value.length : 1;
};

const DocumentLink = ({ documentId }: { documentId: string }) => {
  const { workspaceSlug } = useWorkspaceContext();
  const { data: document, isLoading, isError } = useContentFile(workspaceSlug, documentId);

  if (isLoading) return <span className="dim">Loading…</span>;
  if (isError || !document) return <span className="dim">Document unavailable</span>;

  const route = document.project_id
    ? projectMarkdownRoute(
        workspaceSlug,
        asProjectPublicId(document.project_public_id ?? document.project_id),
        document.id,
        { mode: 'preview' }
      )
    : document.entity_id
      ? entityMarkdownRoute(workspaceSlug, asEntityPublicId(document.entity_id), document.id, {
          mode: 'preview'
        })
      : workspaceMarkdownRoute(workspaceSlug, document.id, { mode: 'preview' });

  return (
    <HoverCard
      content={
        <DocumentHoverCardBody
          name={document.name}
          path={document.path}
          commentCount={document.comment_count}
          unresolvedCommentCount={document.unresolved_comment_count}
        />
      }
    >
      <Link {...route} className={styles.documentLink} onClick={event => event.stopPropagation()}>
        {document.name}
      </Link>
    </HoverCard>
  );
};

const STATUS_LABEL: Record<DocumentGeneratedMetadataResult['status'], string> = {
  success: 'Generated',
  failed: 'Generation failed',
  outdated: 'Outdated'
};

const formatTimestamp = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
};

const AiMetadataResultBody = ({
  action,
  result
}: {
  action: DocumentAiAction;
  result: DocumentGeneratedMetadataResult | undefined;
}) => (
  <>
    <HoverCardTitle>{action.name}</HoverCardTitle>
    {!result ? (
      <HoverCardDescription>No generated result yet.</HoverCardDescription>
    ) : (
      <>
        <TooltipChips>
          <TooltipChip
            style={
              result.status === 'outdated'
                ? { color: 'var(--warning-fg, #b8860b)' }
                : result.status === 'failed'
                  ? { color: 'var(--danger-fg, #c94a4a)' }
                  : undefined
            }
          >
            {STATUS_LABEL[result.status]}
          </TooltipChip>
        </TooltipChips>
        {result.explanation && <HoverCardDescription>{result.explanation}</HoverCardDescription>}
        {result.findings.length > 0 && (
          <ul className={styles.aiFindingsList}>
            {result.findings.map((finding, index) => (
              <li key={index}>{finding}</li>
            ))}
          </ul>
        )}
        {result.failureNotice && (
          <HoverCardDescription>{result.failureNotice}</HoverCardDescription>
        )}
        <HoverCardRows>
          <TooltipRow label="Generated" value={formatTimestamp(result.generatedAt)} />
          <TooltipRow label="Assessed revision" value={result.sourceRevision} />
          <TooltipRow label="Generator version" value={result.generatorVersion} />
        </HoverCardRows>
      </>
    )}
  </>
);

const AiMetadataIndicator = ({
  action,
  result
}: {
  action: DocumentAiAction;
  result: DocumentGeneratedMetadataResult | undefined;
}) => (
  <HoverCard content={<AiMetadataResultBody action={action} result={result} />}>
    <button
      type="button"
      className={styles.aiIndicator}
      aria-label={`AI-generated value — ${result ? STATUS_LABEL[result.status] : 'no result yet'}`}
    >
      <TbSparkles size={11} />
    </button>
  </HoverCard>
);

type Validation = { errors: Record<string, string>; warnings: Record<string, string> };

export const validateDocMetadata = (
  fields: DocumentField[],
  metadata: DocumentMetadata
): Validation => {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};
  fields
    .filter(field => !field.retired)
    .forEach(field => {
      const value = fieldValue(metadata, field);
      const count = valueCount(value);
      if (field.requirement === 'required' && count === 0) {
        errors[field.id] = 'Required';
        return;
      }
      if (count > 0) {
        if (field.minCardinality != null && count < field.minCardinality) {
          errors[field.id] = `Needs at least ${field.minCardinality}`;
        } else if (field.maxCardinality != null && count > field.maxCardinality) {
          errors[field.id] = `At most ${field.maxCardinality} allowed`;
        }
      }
      if (field.requirement === 'expected' && count === 0) {
        warnings[field.id] = 'Expected — usually filled in for this document type';
      }
    });
  return { errors, warnings };
};

export const DocValueView = ({
  field,
  value
}: {
  field: DocumentField;
  value: DocumentMetadata[string] | undefined;
}) => {
  if (isEmpty(value)) return <span className="dim">—</span>;
  if (field.type === 'boolean') {
    return value ? (
      <Chip icon={<TbCheck size={10} style={{ color: 'var(--success-fg, #2e9e5b)' }} />}>Yes</Chip>
    ) : (
      <span className="dim">No</span>
    );
  }
  if (field.type === 'enum') return <Chip dot="var(--accent-fg)">{String(value)}</Chip>;
  if (field.type === 'entity_link') {
    const links = Array.isArray(value) ? value : [value as string];
    return (
      <div className={styles.reflist}>
        {links.map((link, index) => (
          <Chip key={index} icon={<TbLink size={9} />}>
            <EntityLink id={link} />
          </Chip>
        ))}
      </div>
    );
  }
  if (field.type === 'document_link') {
    const links = Array.isArray(value) ? value : [value as string];
    return (
      <div className={styles.reflist}>
        {links.map((link, index) => (
          <Chip key={index} icon={<TbLink size={9} />}>
            <DocumentLink documentId={link} />
          </Chip>
        ))}
      </div>
    );
  }
  return <span className={styles.readValue}>{displayValue(value)}</span>;
};

type MetadataDiff = {
  key: string;
  previous: DocumentMetadata[string] | undefined;
  next: DocumentMetadata[string] | undefined;
};

const MetadataDiffValue = ({
  marker,
  variant,
  children
}: {
  marker: '−' | '+';
  variant: 'removed' | 'added';
  children: ReactNode;
}) => (
  <div
    className={`${styles.diffValue} ${variant === 'removed' ? styles.diffRemoved : styles.diffAdded}`}
  >
    <span className={styles.diffMarker}>{marker}</span>
    <div className={styles.diffContent}>{children}</div>
  </div>
);

export const MarkdownPropertiesDiffPanel = ({
  documentTypes,
  previousDocumentTypeId,
  previousMetadata,
  nextDocumentTypeId,
  nextMetadata,
  changes
}: {
  documentTypes: DocumentType[];
  previousDocumentTypeId: string | null;
  previousMetadata: DocumentMetadata;
  nextDocumentTypeId: string | null;
  nextMetadata: DocumentMetadata;
  changes: MetadataDiff[];
}) => {
  const previousType = documentTypes.find(type => type.id === previousDocumentTypeId);
  const nextType = documentTypes.find(type => type.id === nextDocumentTypeId);
  const headerType = nextType ?? previousType;
  const headerTypeIndex = headerType
    ? documentTypes.findIndex(type => type.id === headerType.id)
    : -1;
  const typeChanged = previousDocumentTypeId !== nextDocumentTypeId;

  const valueView = (
    field: DocumentField | undefined,
    value: DocumentMetadata[string] | undefined
  ) =>
    field ? (
      <DocValueView field={field} value={value} />
    ) : isEmpty(value) ? (
      <span className="dim">—</span>
    ) : (
      <span className={styles.readValue}>{displayValue(value)}</span>
    );

  return (
    <div className={styles.panel}>
      <div className={`${styles.header} ${styles.staticHeader}`}>
        <TbChevronRight
          size={10}
          className={styles.chevron}
          style={{ transform: 'rotate(90deg)' }}
        />
        {headerType && (
          <TypeBadge
            color={resolveDocumentTypeColor(headerType, headerTypeIndex)}
            name={headerType.name}
            icon={headerType.icon}
            size={18}
          />
        )}
        <span className={styles.title}>Properties</span>
        <span className="dim" style={{ fontSize: 11 }}>
          Metadata changes
        </span>
      </div>

      <div className={styles.body}>
        {typeChanged && (
          <div className={styles.row}>
            <div className={styles.label}>Document type</div>
            <div className={styles.value}>
              <div className={styles.diffValues}>
                <MetadataDiffValue marker="−" variant="removed">
                  {previousType?.name ?? 'Untyped Markdown'}
                </MetadataDiffValue>
                <MetadataDiffValue marker="+" variant="added">
                  {nextType?.name ?? 'Untyped Markdown'}
                </MetadataDiffValue>
              </div>
            </div>
          </div>
        )}

        {changes.map(change => {
          const previousField = previousType?.fields.find(field => field.id === change.key);
          const nextField = nextType?.fields.find(field => field.id === change.key);
          const field = nextField ?? previousField;

          return (
            <div key={change.key} className={styles.row}>
              <div className={styles.label}>{field?.name ?? change.key}</div>
              <div className={styles.value}>
                <div className={styles.diffValues}>
                  <MetadataDiffValue marker="−" variant="removed">
                    {valueView(previousField ?? field, previousMetadata[change.key])}
                  </MetadataDiffValue>
                  <MetadataDiffValue marker="+" variant="added">
                    {valueView(nextField ?? field, nextMetadata[change.key])}
                  </MetadataDiffValue>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const DocValueEdit = ({
  field,
  value,
  onChange
}: {
  field: DocumentField;
  value: DocumentMetadata[string] | undefined;
  onChange: (value: string | number | boolean | string[] | null | undefined) => void;
}) => {
  const [entityDialogOpen, setEntityDialogOpen] = useState(false);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);

  if (field.type === 'long_text') {
    return (
      <TextArea
        style={{ width: '100%', maxWidth: 260 }}
        value={displayValue(value)}
        rows={3}
        onChange={next => onChange(next ?? null)}
      />
    );
  }
  if (field.type === 'enum') {
    return (
      <Select.Root
        value={typeof value === 'string' ? value : UNSET}
        onChange={next => onChange(next === UNSET ? null : (next ?? null))}
        style={{ width: '100%', maxWidth: 260 }}
      >
        <Select.Item value={UNSET}>Select…</Select.Item>
        {(field.enumOptions ?? []).map(option => (
          <Select.Item key={option.value} value={option.value}>
            {option.label}
          </Select.Item>
        ))}
      </Select.Root>
    );
  }
  if (field.type === 'boolean') {
    return (
      <Select.Root
        value={typeof value === 'boolean' ? String(value) : UNSET}
        onChange={next => onChange(next === UNSET || next == null ? null : next === 'true')}
        style={{ width: '100%', maxWidth: 260 }}
      >
        <Select.Item value={UNSET}>Select…</Select.Item>
        <Select.Item value="true">True</Select.Item>
        <Select.Item value="false">False</Select.Item>
      </Select.Root>
    );
  }
  if (field.type === 'number') {
    return (
      <TextInput
        type="number"
        style={{ width: '100%', maxWidth: 260 }}
        value={typeof value === 'number' ? String(value) : ''}
        onChange={next => onChange(next === undefined || next === '' ? null : Number(next))}
      />
    );
  }
  if (field.type === 'entity_link' || field.type === 'document_link') {
    const links = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
    return (
      <div className={styles.linkEdit}>
        {links.map((link, index) => (
          <Chip key={index} icon={<TbLink size={9} />}>
            {field.type === 'entity_link' ? (
              <EntityLink id={link} />
            ) : (
              <DocumentLink documentId={link} />
            )}
            <button
              type="button"
              className={styles.chipRemove}
              onClick={() => onChange(links.filter((_, i) => i !== index))}
            >
              <TbX size={8} />
            </button>
          </Chip>
        ))}
        <button
          type="button"
          className={styles.linkAdd}
          onClick={() =>
            field.type === 'entity_link' ? setEntityDialogOpen(true) : setDocumentDialogOpen(true)
          }
        >
          <TbPlus size={9} />
        </button>
        {field.type === 'entity_link' && (
          <MarkdownEntityLinkDialog
            open={entityDialogOpen}
            onClose={() => setEntityDialogOpen(false)}
            onConfirm={entityId => onChange([...links, entityId])}
          />
        )}
        {field.type === 'document_link' && (
          <MarkdownDocumentLinkDialog
            open={documentDialogOpen}
            onClose={() => setDocumentDialogOpen(false)}
            onConfirm={fileId => onChange([...links, fileId])}
          />
        )}
      </div>
    );
  }
  return (
    <TextInput
      type={field.type === 'date' ? 'date' : 'text'}
      style={{ width: '100%', maxWidth: 260 }}
      value={typeof value === 'string' ? value : ''}
      onChange={next => onChange(next ?? null)}
    />
  );
};

export const MarkdownPropertiesPanel = ({
  documentTypeId,
  documentTypes,
  fields,
  metadata,
  generatedMetadata,
  readOnly,
  attemptedSave = false,
  onTypeChange,
  onValueChange
}: MarkdownPropertiesPanelProps) => {
  const [collapsed, setCollapsed] = useState(documentTypeId == null);
  const activeFields = fields.filter(field => !field.retired);
  const retiredFields = fields.filter(field => field.retired && metadata[field.id] !== undefined);
  const hasMetadata = Object.keys(metadata).length > 0;
  const fieldsToRender =
    documentTypeId == null
      ? fields.filter(field => metadata[field.id] !== undefined)
      : activeFields;
  const knownFieldIds = new Set(fields.map(field => field.id));
  const unreviewedMetadata = Object.entries(metadata).filter(
    ([fieldId]) => !knownFieldIds.has(fieldId)
  );
  const documentType = documentTypes.find(type => type.id === documentTypeId) ?? null;
  const typeColor = documentType
    ? resolveDocumentTypeColor(
        documentType,
        documentTypes.findIndex(type => type.id === documentType.id)
      )
    : 'var(--cmp-fg-disabled)';
  const { errors, warnings } = validateDocMetadata(fields, metadata);
  const showErrors = readOnly || attemptedSave;
  const errorCount = Object.keys(errors).length;
  const generatorByFieldId = new Map(
    (documentType?.aiActions ?? [])
      .filter(
        (action): action is Extract<DocumentAiAction, { kind: 'metadata_generator' }> =>
          action.kind === 'metadata_generator'
      )
      .map(action => [action.outputFieldId, action])
  );

  return (
    <div className={styles.panel}>
      <button type="button" className={styles.header} onClick={() => setCollapsed(value => !value)}>
        <TbChevronRight
          size={10}
          className={styles.chevron}
          style={{ transform: collapsed ? 'none' : 'rotate(90deg)' }}
        />
        {documentType && (
          <TypeBadge
            color={typeColor}
            name={documentType.name}
            icon={documentType.icon}
            size={18}
          />
        )}
        <span className={styles.title}>Properties</span>
        {documentType && (
          <span className="dim" style={{ fontSize: 11, marginTop: '2px' }}>
            {documentType.name}
          </span>
        )}
        <div style={{ flex: 1 }} />
        {showErrors && errorCount > 0 && (
          <span className={styles.errorPill}>
            {errorCount} {errorCount === 1 ? 'issue' : 'issues'}
          </span>
        )}
      </button>

      {!collapsed && (
        <div className={styles.body}>
          <div className={styles.row}>
            <div className={styles.label}>Document type</div>
            <div className={styles.value}>
              {readOnly ? (
                <span className={styles.readValue}>{documentType?.name ?? 'Untyped Markdown'}</span>
              ) : (
                <Select.Root
                  value={documentTypeId ?? UNTYPED}
                  onChange={next => onTypeChange(next === UNTYPED || next == null ? null : next)}
                  style={{ width: '100%', maxWidth: 260 }}
                >
                  <Select.Item value={UNTYPED}>Untyped Markdown</Select.Item>
                  {documentTypes.map(type => (
                    <Select.Item key={type.id} value={type.id}>
                      {type.name}
                    </Select.Item>
                  ))}
                </Select.Root>
              )}
            </div>
          </div>

          {documentTypeId == null && !hasMetadata ? (
            <div className="dim" style={{ fontSize: 11, padding: '6px 0' }}>
              This is a legacy untyped Markdown document.
            </div>
          ) : fieldsToRender.length === 0 ? (
            <div className="dim" style={{ fontSize: 11, padding: '6px 0' }}>
              {documentTypeId == null
                ? 'Remove the remaining metadata values before removing the document type.'
                : 'This document type has no editable fields.'}
            </div>
          ) : (
            fieldsToRender.map(field => {
              const value = fieldValue(metadata, field);
              const error = showErrors ? errors[field.id] : undefined;
              const warning = warnings[field.id];
              const generatorAction = generatorByFieldId.get(field.id);
              const isAiManaged = generatorAction !== undefined;
              return (
                <div key={field.id} className={`${styles.row} ${error ? styles.rowError : ''}`}>
                  <div className={styles.label}>
                    <span>{field.name}</span>
                    {field.requirement === 'optional' && (
                      <span className={styles.optionalLabel}>(optional)</span>
                    )}
                  </div>
                  <div className={styles.value}>
                    <div className={styles.aiValueRow}>
                      {readOnly || isAiManaged ? (
                        <DocValueView field={field} value={value} />
                      ) : (
                        <DocValueEdit
                          field={field}
                          value={value}
                          onChange={v => onValueChange(field.id, v)}
                        />
                      )}
                      {isAiManaged && (
                        <AiMetadataIndicator
                          action={generatorAction}
                          result={generatedMetadata[field.id]}
                        />
                      )}
                    </div>
                    {error && <div className={styles.error}>{error}</div>}
                    {!error && warning && <div className={styles.warning}>{warning}</div>}
                  </div>
                </div>
              );
            })
          )}

          {documentTypeId == null && hasMetadata && (
            <div className="dim" style={{ fontSize: 11, padding: '6px 0' }}>
              Remove these metadata values before removing the document type.
            </div>
          )}

          {retiredFields.length > 0 && (
            <div className="dim" style={{ marginTop: 10, fontSize: 10 }}>
              Retired fields are preserved for history:{' '}
              {retiredFields.map(field => field.name).join(', ')}.
            </div>
          )}
          {unreviewedMetadata.length > 0 && (
            <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 600 }}>Metadata requiring review</div>
              <div className="dim" style={{ fontSize: 10 }}>
                These values are not defined by the selected document type. Remove them before
                completing this migration.
              </div>
              {unreviewedMetadata.map(([fieldId, value]) => {
                const shownValue = displayValue(value);
                return (
                  <div
                    key={fieldId}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}
                  >
                    <code style={{ flex: 1 }}>
                      {fieldId} = {shownValue === '' ? '—' : shownValue}
                    </code>
                    {!readOnly && (
                      <button type="button" onClick={() => onValueChange(fieldId, undefined)}>
                        Remove
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!readOnly && attemptedSave && errorCount > 0 && (
        <div className={styles.saveBanner}>
          <TbInfoCircle size={12} />
          <span>
            Fix {errorCount} {errorCount === 1 ? 'property' : 'properties'} before saving — required
            fields and cardinality rules must be satisfied.
          </span>
        </div>
      )}
    </div>
  );
};
