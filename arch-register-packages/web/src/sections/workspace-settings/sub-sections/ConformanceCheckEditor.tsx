import { useEffect, useMemo, useRef, useState } from 'react';
import { TbAlertTriangle } from 'react-icons/tb';
import type {
  ConformanceCheck,
  CreateConformanceCheck
} from '@arch-register/api-types/conformanceContract';
import { DOCUMENT_AI_READ_ONLY_TOOLS } from '@arch-register/api-types/conformanceContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type {
  WorkspaceLifecycleState,
  WorkspaceOwnerOption
} from '@arch-register/api-types/workspaceContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import type { FieldGroupAccess, FieldGroupAccessControl } from '@arch-register/permissions';
import { Button } from '@diagram-craft/app-components/Button';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { FilterBuilder } from '../../../components/FilterBuilder';
import { CHECK_TYPE_META } from '../../../components/ConformanceBadges';
import {
  buildEntityQueryFromBrowserFilters,
  entityQueryToBrowserFilters,
  getFilterValue,
  isBasicRepresentable
} from '../../entities/components/entityBrowserState';
import {
  createInitialConformanceCheckFormState,
  initializeConformanceCheckFormState,
  serializeConformanceCheckDefinition,
  serializeConformanceCheckForm,
  type CheckType,
  type ConformanceCheckFormState
} from './conformanceCheckEditorState';
import styles from './ConformanceSubSection.module.css';

export type ConformanceCheckEditorProps = {
  open: boolean;
  onClose: () => void;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  owners: WorkspaceOwnerOption[];
  enums: WorkspaceEnum[];
  getFieldGroupAccess: (accessControl: FieldGroupAccessControl | undefined) => FieldGroupAccess;
  aiConfigured: boolean;
  check: ConformanceCheck | null;
  initialType: CheckType;
  onSubmit: (body: CreateConformanceCheck) => void;
  pending: boolean;
  error: Error | null;
};

export const ConformanceCheckEditor = ({
  open,
  onClose,
  schemas,
  lifecycleStates,
  owners,
  enums,
  getFieldGroupAccess,
  aiConfigured,
  check,
  initialType,
  onSubmit,
  pending,
  error
}: ConformanceCheckEditorProps) => {
  const [form, setForm] = useState<ConformanceCheckFormState>(() =>
    createInitialConformanceCheckFormState({
      initialType,
      defaultSchemaId: schemas[0]?.id ?? ''
    })
  );
  const checkRef = useRef(check);
  const schemasRef = useRef(schemas);
  checkRef.current = check;
  schemasRef.current = schemas;
  const checkId = check?.id;

  useEffect(() => {
    if (!open || checkRef.current?.id !== checkId) return;
    setForm(
      initializeConformanceCheckFormState({
        check: checkRef.current,
        initialType,
        defaultSchemaId: schemasRef.current[0]?.id ?? ''
      })
    );
  }, [open, checkId, initialType]);

  const updateForm = <K extends keyof ConformanceCheckFormState>(
    key: K,
    value: ConformanceCheckFormState[K]
  ) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const firstSchemaId = schemas[0]?.id;
  useEffect(() => {
    if (!open || checkRef.current != null || form.schemaId || firstSchemaId == null) return;
    setForm(current => ({ ...current, schemaId: firstSchemaId }));
  }, [firstSchemaId, form.schemaId, open]);

  const definition = useMemo(
    () => serializeConformanceCheckDefinition(form, aiConfigured),
    [aiConfigured, form]
  );
  const schema = schemas.find(candidate => candidate.id === form.schemaId) ?? schemas[0];

  const switchToAdvanced = () => {
    updateForm(
      'queryJson',
      JSON.stringify(
        buildEntityQueryFromBrowserFilters({
          typeFilter: null,
          conditions: form.queryConditions
        }),
        null,
        2
      )
    );
    updateForm('queryJsonError', null);
    updateForm('queryMode', 'advanced');
  };

  const switchToBasic = () => {
    let parsed: ReturnType<typeof JSON.parse>;
    try {
      parsed = JSON.parse(form.queryJson);
    } catch {
      updateForm('queryJsonError', 'Enter valid JSON before switching to the visual builder.');
      return;
    }
    updateForm('queryJsonError', null);
    if (
      isBasicRepresentable(parsed) ||
      window.confirm(
        'This query uses grouping, NOT, or relation traversal that the visual builder ' +
          "can't represent. Switching will keep only the parts it supports and drop the rest."
      )
    ) {
      setForm(current => ({
        ...current,
        queryConditions: entityQueryToBrowserFilters(parsed).conditions,
        queryMode: 'basic'
      }));
    }
  };

  const handleQueryJsonChange = (value: string) => {
    setForm(current => ({
      ...current,
      queryJson: value,
      queryJsonError: isValidJson(value) ? null : 'Invalid JSON.'
    }));
  };

  const submit = () => {
    const body = serializeConformanceCheckForm(form, aiConfigured);
    if (!body) return;
    onSubmit(body);
  };

  if (!open) return null;
  return (
    <Dialog
      open
      onClose={onClose}
      title={check ? 'Edit conformance check' : 'Add conformance check'}
      width={560}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        {
          label: pending
            ? check
              ? 'Saving…'
              : 'Creating…'
            : check
              ? 'Save changes'
              : 'Create check',
          type: 'default',
          disabled: pending || definition == null || !form.name.trim(),
          onClick: submit
        }
      ]}
    >
      <div className={styles.form}>
        <div className={styles.notice}>
          {CHECK_TYPE_META[form.type].label} — {CHECK_TYPE_META[form.type].description}
        </div>
        <FormElement label="Name">
          <TextInput value={form.name} onChange={value => updateForm('name', value ?? '')} />
        </FormElement>
        <FormElement label="Description">
          <TextInput
            value={form.description}
            onChange={value => updateForm('description', value ?? '')}
          />
        </FormElement>
        <FormElement label="Severity">
          <Select.Root
            value={form.severity}
            onChange={value =>
              updateForm('severity', value as ConformanceCheckFormState['severity'])
            }
          >
            <Select.Item value="error">Error</Select.Item>
            <Select.Item value="warning">Warning</Select.Item>
          </Select.Root>
        </FormElement>
        <FormElement label="Status">
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={event => updateForm('enabled', event.target.checked)}
            />
            <span>Enabled</span>
          </label>
        </FormElement>

        {form.type !== 'query_policy' && (
          <FormElement label="Entity schema">
            <Select.Root
              value={form.schemaId}
              onChange={value => updateForm('schemaId', value ?? '')}
            >
              {schemas.map(item => (
                <Select.Item key={item.id} value={item.id}>
                  {item.name}
                </Select.Item>
              ))}
            </Select.Root>
          </FormElement>
        )}

        {form.type === 'scheduled_validation' && (
          <>
            <FormElement label="Bonsai expression">
              <textarea
                className={styles.textarea}
                value={form.expression}
                onChange={event => updateForm('expression', event.target.value)}
                placeholder="entity.lifecycle != null"
              />
            </FormElement>
            <FormElement label="Violation message">
              <TextInput
                value={form.message}
                onChange={value => updateForm('message', value ?? '')}
              />
            </FormElement>
            <FormElement label="Diagnostic field (optional)">
              <Select.Root
                value={form.fieldId}
                onChange={value => updateForm('fieldId', value ?? '')}
              >
                <Select.Item value="">No field</Select.Item>
                {(schema?.fields ?? []).map(field => (
                  <Select.Item key={field.id} value={field.id}>
                    {field.name}
                  </Select.Item>
                ))}
              </Select.Root>
            </FormElement>
          </>
        )}

        {form.type === 'query_policy' && (
          <>
            <FormElement label="Violation message">
              <TextInput
                value={form.message}
                onChange={value => updateForm('message', value ?? '')}
              />
            </FormElement>
            {form.queryMode === 'basic' ? (
              <div className={styles.filter}>
                <FilterBuilder
                  conditions={form.queryConditions}
                  onChange={conditions => updateForm('queryConditions', conditions)}
                  schemas={schemas}
                  lifecycleStates={lifecycleStates}
                  owners={owners}
                  enums={enums}
                  selectedSchemaId={getFilterValue(form.queryConditions, '_schemaId')}
                  getFieldGroupAccess={getFieldGroupAccess}
                  headerActions={
                    <Button variant="secondary" size="sm" onClick={switchToAdvanced}>
                      Advanced
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className={`${styles.form} ${styles.filter}`}>
                <div className={styles.queryHeader}>
                  <span className={styles.dsectionLabel}>Entity query conditions</span>
                  <Button variant="secondary" size="sm" onClick={switchToBasic}>
                    Use visual builder
                  </Button>
                </div>
                <textarea
                  className={styles.textarea}
                  value={form.queryJson}
                  onChange={event => handleQueryJsonChange(event.target.value)}
                />
                {form.queryJsonError && (
                  <div className={styles.advancedError}>
                    <TbAlertTriangle size={12} /> {form.queryJsonError}
                  </div>
                )}
                <div className={styles.muted}>
                  Advanced mode exposes the underlying EntityQuery JSON for query shapes the visual
                  builder doesn&apos;t support (grouping, NOT, relation traversal).
                </div>
              </div>
            )}
          </>
        )}

        {form.type === 'ai_prompt' && (
          <>
            <div className={`${styles.notice} ${!aiConfigured ? styles.warning : ''}`}>
              AI checks send only the selected fields and selected read-only tools to the configured
              workspace AI provider.
            </div>
            <FormElement label="Conformance prompt">
              <textarea
                className={styles.textarea}
                value={form.prompt}
                onChange={event => updateForm('prompt', event.target.value)}
              />
            </FormElement>
            <FormElement label="Fields available to AI">
              <div className={styles.fieldList}>
                {(schema?.fields ?? []).map(field => (
                  <label className={styles.check} key={field.id}>
                    <input
                      type="checkbox"
                      checked={form.fieldIds.includes(field.id)}
                      onChange={event =>
                        setForm(current => ({
                          ...current,
                          fieldIds: event.target.checked
                            ? [...current.fieldIds, field.id]
                            : current.fieldIds.filter(id => id !== field.id)
                        }))
                      }
                    />
                    <span>
                      {field.name}
                      <span className={styles.checkDescription}>{field.id}</span>
                    </span>
                  </label>
                ))}
              </div>
            </FormElement>
            <FormElement label="Read-only AI tools">
              <div className={styles.toolList}>
                {DOCUMENT_AI_READ_ONLY_TOOLS.map(tool => (
                  <label className={styles.check} key={tool.id}>
                    <input
                      type="checkbox"
                      checked={form.tools.includes(tool.id)}
                      onChange={event =>
                        setForm(current => ({
                          ...current,
                          tools: event.target.checked
                            ? [...current.tools, tool.id]
                            : current.tools.filter(id => id !== tool.id)
                        }))
                      }
                    />
                    <span>
                      {tool.label}
                      <span className={styles.checkDescription}>{tool.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </FormElement>
          </>
        )}
        <FormElement label="Governance case">
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={form.governanceEnabled}
              onChange={event => updateForm('governanceEnabled', event.target.checked)}
            />
            <span>Create a governance task for each violation</span>
          </label>
          {form.governanceEnabled && (
            <Select.Root
              value={form.governanceResolution}
              onChange={value =>
                updateForm(
                  'governanceResolution',
                  value as ConformanceCheckFormState['governanceResolution']
                )
              }
            >
              <Select.Item value="acknowledge">Acknowledge the violation</Select.Item>
              <Select.Item value="resolve">Resolve the violation</Select.Item>
            </Select.Root>
          )}
        </FormElement>
        {error && <div className={styles.error}>{error.message}</div>}
      </div>
    </Dialog>
  );
};

const isValidJson = (value: string): boolean => {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
};
