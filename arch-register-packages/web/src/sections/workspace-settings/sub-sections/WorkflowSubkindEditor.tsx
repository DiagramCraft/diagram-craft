import { useDocumentTypes } from '../../../hooks/useDocuments';
import { useSchemas } from '../../../hooks/useSchemas';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import type { GovernanceWorkflowCaseKind } from '@arch-register/api-types/governanceWorkflowConfigContract';
import styles from './WorkflowsSubSection.module.css';

export type WorkflowSubkindEditorProps = {
  workspaceSlug: string;
  caseKind: GovernanceWorkflowCaseKind;
  value: string | null;
  onChange: (value: string | null) => void;
};

export const DocumentStatusSubkindEditor = ({
  workspaceSlug,
  value,
  onChange
}: Omit<WorkflowSubkindEditorProps, 'caseKind'>) => {
  const { data: documentTypes = [] } = useDocumentTypes(workspaceSlug);
  const [documentTypeId, fieldId] = value?.split(':') ?? [];
  const documentType = documentTypes.find(type => type.id === documentTypeId);
  const enumFields =
    documentType?.fields.filter(field => field.type === 'enum' && !field.retired) ?? [];

  return (
    <div className={styles.subkindFields}>
      <FormElement label="Document type">
        <Select.Root
          value={documentTypeId ?? undefined}
          onChange={next => onChange(next ? `${next}:` : null)}
          placeholder="Select document type"
        >
          {documentTypes.map(type => (
            <Select.Item key={type.id} value={type.id}>
              {type.name}
            </Select.Item>
          ))}
        </Select.Root>
      </FormElement>
      <FormElement label="Status field">
        <Select.Root
          value={fieldId && enumFields.some(field => field.id === fieldId) ? fieldId : undefined}
          onChange={next => onChange(documentTypeId && next ? `${documentTypeId}:${next}` : value)}
          placeholder="Select enum field"
          disabled={!documentTypeId}
        >
          {enumFields.map(field => (
            <Select.Item key={field.id} value={field.id}>
              {field.name}
            </Select.Item>
          ))}
        </Select.Root>
      </FormElement>
    </div>
  );
};

export const EntitySchemaSubkindEditor = ({
  workspaceSlug,
  value,
  onChange
}: Omit<WorkflowSubkindEditorProps, 'caseKind'>) => {
  const { data: schemas = [] } = useSchemas(workspaceSlug);

  return (
    <FormElement label="Entity schema">
      <Select.Root
        value={value ?? undefined}
        onChange={next => onChange(next ?? null)}
        placeholder="Select entity schema"
      >
        {schemas.map(schema => (
          <Select.Item key={schema.id} value={schema.id}>
            {schema.name}
          </Select.Item>
        ))}
      </Select.Root>
    </FormElement>
  );
};

export const FieldDateReminderSubkindEditor = ({
  workspaceSlug,
  value,
  onChange
}: Omit<WorkflowSubkindEditorProps, 'caseKind'>) => {
  const { data: schemas = [] } = useSchemas(workspaceSlug);
  const [schemaId, fieldId] = value?.split(':') ?? [];
  const schema = schemas.find(item => item.id === schemaId);
  const dateFields = schema?.fields.filter(field => field.type === 'date' && !field.archived) ?? [];

  return (
    <div className={styles.subkindFields}>
      <FormElement label="Entity schema">
        <Select.Root
          value={schemaId ?? undefined}
          onChange={next => onChange(next ? `${next}:` : null)}
          placeholder="Select entity schema"
        >
          {schemas.map(item => (
            <Select.Item key={item.id} value={item.id}>
              {item.name}
            </Select.Item>
          ))}
        </Select.Root>
      </FormElement>
      <FormElement label="Date field">
        <Select.Root
          value={fieldId && dateFields.some(field => field.id === fieldId) ? fieldId : undefined}
          onChange={next => onChange(schemaId && next ? `${schemaId}:${next}` : value)}
          placeholder="Select date field"
          disabled={!schemaId}
        >
          {dateFields.map(field => (
            <Select.Item key={field.id} value={field.id}>
              {field.name}
            </Select.Item>
          ))}
        </Select.Root>
      </FormElement>
    </div>
  );
};

export const WorkflowSubkindEditor = ({
  workspaceSlug,
  caseKind,
  value,
  onChange
}: WorkflowSubkindEditorProps) => {
  if (caseKind.case_kind === 'document.status') {
    return (
      <DocumentStatusSubkindEditor
        workspaceSlug={workspaceSlug}
        value={value}
        onChange={onChange}
      />
    );
  }
  if (
    caseKind.case_kind === 'entity.change-case' ||
    caseKind.case_kind === 'entity.change-case.bulk' ||
    caseKind.case_kind === 'entity.deprecation'
  ) {
    return (
      <EntitySchemaSubkindEditor workspaceSlug={workspaceSlug} value={value} onChange={onChange} />
    );
  }
  if (caseKind.case_kind === 'field-date-reminder') {
    return (
      <FieldDateReminderSubkindEditor
        workspaceSlug={workspaceSlug}
        value={value}
        onChange={onChange}
      />
    );
  }
  return <div className={styles.emptyNote}>This workflow does not define a scope selector.</div>;
};
