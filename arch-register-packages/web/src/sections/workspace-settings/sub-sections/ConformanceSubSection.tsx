import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { TbPencil, TbPlayerPlay, TbPlus, TbRefresh, TbShieldCheck } from 'react-icons/tb';
import type {
  ConformanceCheck,
  ConformanceCheckDefinition,
  ConformanceCheckStatus,
  ConformanceSeverity,
  CreateConformanceCheck
} from '@arch-register/api-types/conformanceContract';
import { DOCUMENT_AI_READ_ONLY_TOOLS } from '@arch-register/api-types/conformanceContract';
import type { DocumentAiToolId } from '@arch-register/api-types/documentContract';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { Button } from '@diagram-craft/app-components/Button';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { Table } from '../../../components/table/Table';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { Chip } from '../../../components/Chip';
import { formatDateTime } from '../../../utils/dateFormat';
import { useAiStatus } from '../../../hooks/useAiConfig';
import { useWorkspaceAuthorization } from '../../../auth/WorkspaceAuthorizationContext';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import {
  useConformanceChecks,
  useConformanceRuns,
  useConformanceSummary,
  useConformanceViolations,
  useCreateConformanceCheck,
  useDeleteConformanceCheck,
  useExemptConformanceViolation,
  useRunConformance,
  useUpdateConformanceCheck
} from '../../../hooks/useConformance';
import styles from './ConformanceSubSection.module.css';

type CheckType = ConformanceCheckDefinition['type'];
type Tab = 'checks' | 'violations' | 'runs';

const CHECK_TYPE_LABELS: Record<CheckType, string> = {
  scheduled_validation: 'Scheduled validation',
  query_policy: 'Query policy',
  ai_prompt: 'AI prompt'
};

const STATUS_OPTIONS: Array<{ value: '' | ConformanceCheckStatus; label: string }> = [
  { value: '', label: 'Current and historical' },
  { value: 'active', label: 'Active' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'exempt', label: 'Exempt' },
  { value: 'resolved', label: 'Resolved' }
];

const SEVERITY_OPTIONS: Array<{ value: '' | ConformanceSeverity; label: string }> = [
  { value: '', label: 'All severities' },
  { value: 'error', label: 'Errors' },
  { value: 'warning', label: 'Warnings' }
];

const defaultQuery = JSON.stringify({ root: { kind: 'and', children: [] } }, null, 2);

const CheckDialog = ({
  open,
  onClose,
  schemas,
  aiConfigured,
  check,
  onSubmit,
  pending,
  error
}: {
  open: boolean;
  onClose: () => void;
  schemas: EntitySchema[];
  aiConfigured: boolean;
  check: ConformanceCheck | null;
  onSubmit: (body: CreateConformanceCheck) => void;
  pending: boolean;
  error: Error | null;
}) => {
  const [type, setType] = useState<CheckType>('scheduled_validation');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<ConformanceSeverity>('error');
  const [schemaId, setSchemaId] = useState(schemas[0]?.id ?? '');
  const [fieldId, setFieldId] = useState('');
  const [expression, setExpression] = useState('');
  const [message, setMessage] = useState('Entity does not conform');
  const [queryJson, setQueryJson] = useState(defaultQuery);
  const [prompt, setPrompt] = useState(
    'Does this entity conform to the stated architecture policy?'
  );
  const [fieldIds, setFieldIds] = useState<string[]>([]);
  const [tools, setTools] = useState<DocumentAiToolId[]>([]);
  const [governanceEnabled, setGovernanceEnabled] = useState(false);
  const [governanceResolution, setGovernanceResolution] = useState<'acknowledge' | 'resolve'>(
    'acknowledge'
  );
  const [enabled, setEnabled] = useState(true);
  const schema = schemas.find(candidate => candidate.id === schemaId) ?? schemas[0];

  const reset = useCallback(() => {
    setType('scheduled_validation');
    setName('');
    setDescription('');
    setSeverity('error');
    setSchemaId(schemas[0]?.id ?? '');
    setFieldId('');
    setExpression('');
    setMessage('Entity does not conform');
    setQueryJson(defaultQuery);
    setPrompt('Does this entity conform to the stated architecture policy?');
    setFieldIds([]);
    setTools([]);
    setGovernanceEnabled(false);
    setGovernanceResolution('acknowledge');
    setEnabled(true);
  }, [schemas]);

  useEffect(() => {
    if (!open) return;
    if (!check) {
      reset();
      return;
    }

    const definition = check.definition;
    setType(definition.type);
    setName(check.name);
    setDescription(check.description ?? '');
    setSeverity(check.severity);
    setEnabled(check.enabled);
    setSchemaId(schemas[0]?.id ?? '');
    setFieldId('');
    setExpression('');
    setMessage('Entity does not conform');
    setQueryJson(defaultQuery);
    setPrompt('Does this entity conform to the stated architecture policy?');
    setFieldIds([]);
    setTools([]);
    setGovernanceEnabled(definition.governance?.enabled ?? false);
    setGovernanceResolution(definition.governance?.resolution ?? 'acknowledge');

    if (definition.type === 'scheduled_validation') {
      setSchemaId(definition.schemaId);
      setFieldId(definition.fieldId ?? '');
      setExpression(definition.expression);
      setMessage(definition.message);
    } else if (definition.type === 'query_policy') {
      setQueryJson(JSON.stringify(definition.query, null, 2));
      setMessage(definition.message);
    } else {
      setSchemaId(definition.schemaId);
      setPrompt(definition.prompt);
      setFieldIds(definition.fieldIds);
      setTools(definition.tools ?? []);
    }
  }, [check, open, reset, schemas]);

  const definition = useMemo<ConformanceCheckDefinition | null>(() => {
    if (type === 'scheduled_validation') {
      if (!schemaId || !expression.trim()) return null;
      return {
        type,
        schemaId,
        expression: expression.trim(),
        message: message.trim() || 'Entity does not conform',
        ...(fieldId ? { fieldId } : {}),
        governance: { enabled: governanceEnabled, resolution: governanceResolution }
      };
    }
    if (type === 'ai_prompt') {
      if (!schemaId || !prompt.trim() || fieldIds.length === 0 || !aiConfigured) return null;
      return {
        type,
        schemaId,
        prompt: prompt.trim(),
        fieldIds,
        tools,
        governance: { enabled: governanceEnabled, resolution: governanceResolution }
      };
    }
    try {
      const query = JSON.parse(queryJson) as EntityQuery;
      return {
        type,
        query,
        message: message.trim() || 'Entity does not conform',
        governance: { enabled: governanceEnabled, resolution: governanceResolution }
      };
    } catch {
      return null;
    }
  }, [
    aiConfigured,
    expression,
    fieldId,
    fieldIds,
    governanceEnabled,
    governanceResolution,
    message,
    prompt,
    queryJson,
    schemaId,
    tools,
    type
  ]);

  const submit = () => {
    if (!definition || !name.trim()) return;
    onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      severity,
      enabled,
      definition
    });
  };

  if (!open) return null;
  return (
    <Dialog
      open
      onClose={() => {
        reset();
        onClose();
      }}
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
          disabled: pending || !definition || !name.trim(),
          onClick: submit
        }
      ]}
    >
      <div className={styles.form}>
        <FormElement label="Check type">
          <Select.Root value={type} onChange={value => setType(value as CheckType)}>
            <Select.Item value="scheduled_validation">Scheduled validation</Select.Item>
            <Select.Item value="query_policy">Query policy</Select.Item>
            <Select.Item value="ai_prompt" disabled={!aiConfigured}>
              AI prompt {!aiConfigured ? '(AI unavailable)' : ''}
            </Select.Item>
          </Select.Root>
        </FormElement>
        <FormElement label="Name">
          <TextInput value={name} onChange={value => setName(value ?? '')} />
        </FormElement>
        <FormElement label="Description">
          <TextInput value={description} onChange={value => setDescription(value ?? '')} />
        </FormElement>
        <FormElement label="Severity">
          <Select.Root
            value={severity}
            onChange={value => setSeverity(value as ConformanceSeverity)}
          >
            <Select.Item value="error">Error</Select.Item>
            <Select.Item value="warning">Warning</Select.Item>
          </Select.Root>
        </FormElement>
        <FormElement label="Status">
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={event => setEnabled(event.target.checked)}
            />
            <span>Enabled</span>
          </label>
        </FormElement>

        {type !== 'query_policy' && (
          <FormElement label="Entity schema">
            <Select.Root value={schemaId} onChange={value => setSchemaId(value ?? '')}>
              {schemas.map(item => (
                <Select.Item key={item.id} value={item.id}>
                  {item.name}
                </Select.Item>
              ))}
            </Select.Root>
          </FormElement>
        )}

        {type === 'scheduled_validation' && (
          <>
            <FormElement label="Bonsai expression">
              <textarea
                className={styles.textarea}
                value={expression}
                onChange={event => setExpression(event.target.value)}
                placeholder="entity.lifecycle != null"
              />
            </FormElement>
            <FormElement label="Violation message">
              <TextInput value={message} onChange={value => setMessage(value ?? '')} />
            </FormElement>
            <FormElement label="Diagnostic field (optional)">
              <Select.Root value={fieldId} onChange={value => setFieldId(value ?? '')}>
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

        {type === 'query_policy' && (
          <>
            <FormElement label="Violation message">
              <TextInput value={message} onChange={value => setMessage(value ?? '')} />
            </FormElement>
            <FormElement label="EntityQuery JSON">
              <textarea
                className={styles.textarea}
                value={queryJson}
                onChange={event => setQueryJson(event.target.value)}
              />
            </FormElement>
          </>
        )}

        {type === 'ai_prompt' && (
          <>
            <div className={`${styles.notice} ${!aiConfigured ? styles.warning : ''}`}>
              AI checks send only the selected fields and selected read-only tools to the configured
              workspace AI provider.
            </div>
            <FormElement label="Conformance prompt">
              <textarea
                className={styles.textarea}
                value={prompt}
                onChange={event => setPrompt(event.target.value)}
              />
            </FormElement>
            <FormElement label="Fields available to AI">
              <div className={styles.fieldList}>
                {(schema?.fields ?? []).map(field => (
                  <label className={styles.check} key={field.id}>
                    <input
                      type="checkbox"
                      checked={fieldIds.includes(field.id)}
                      onChange={event =>
                        setFieldIds(current =>
                          event.target.checked
                            ? [...current, field.id]
                            : current.filter(id => id !== field.id)
                        )
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
                      checked={tools.includes(tool.id)}
                      onChange={event =>
                        setTools(current =>
                          event.target.checked
                            ? [...current, tool.id]
                            : current.filter(id => id !== tool.id)
                        )
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
              checked={governanceEnabled}
              onChange={event => setGovernanceEnabled(event.target.checked)}
            />
            <span>Create a governance task for each violation</span>
          </label>
          {governanceEnabled && (
            <Select.Root
              value={governanceResolution}
              onChange={value => setGovernanceResolution(value as 'acknowledge' | 'resolve')}
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

export const ConformanceSubSection = ({
  workspaceSlug,
  schemas,
  onActionsChange
}: {
  workspaceSlug: string;
  schemas: EntitySchema[];
  onActionsChange: (actions: ReactNode | undefined) => void;
}) => {
  const { canManageWorkspaces } = useWorkspaceAuthorization(workspaceSlug);
  const { data: aiStatus } = useAiStatus(workspaceSlug);
  const {
    data: checks = [],
    isLoading: checksLoading,
    isError: checksError
  } = useConformanceChecks(workspaceSlug);
  const { data: summary } = useConformanceSummary(workspaceSlug);
  const { data: runs = [] } = useConformanceRuns(workspaceSlug);
  const { teams } = useWorkspaceContext();
  const [tab, setTab] = useState<Tab>('checks');
  const [status, setStatus] = useState<'' | ConformanceCheckStatus>('active');
  const [checkId, setCheckId] = useState('');
  const [schemaId, setSchemaId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [severity, setSeverity] = useState<'' | ConformanceSeverity>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCheck, setEditingCheck] = useState<ConformanceCheck | null>(null);
  const createCheck = useCreateConformanceCheck(workspaceSlug);
  const updateCheck = useUpdateConformanceCheck(workspaceSlug);
  const deleteCheck = useDeleteConformanceCheck(workspaceSlug);
  const runConformance = useRunConformance(workspaceSlug);
  const [offset, setOffset] = useState(0);
  const { data: violations } = useConformanceViolations(workspaceSlug, {
    checkId: checkId || undefined,
    schemaId: schemaId || undefined,
    ownerId: ownerId || undefined,
    status: status || undefined,
    severity: severity || undefined,
    limit: 50,
    offset
  });
  const exemptViolation = useExemptConformanceViolation(workspaceSlug);

  const openCreateDialog = useCallback(() => {
    setEditingCheck(null);
    setDialogOpen(true);
  }, []);

  useEffect(() => {
    onActionsChange(
      canManageWorkspaces ? (
        <Button variant="primary" icon={<TbPlus size={12} />} onClick={openCreateDialog}>
          Add check
        </Button>
      ) : undefined
    );
    return () => onActionsChange(undefined);
  }, [canManageWorkspaces, onActionsChange, openCreateDialog]);

  const handleSubmit = (body: CreateConformanceCheck) => {
    if (editingCheck) {
      updateCheck.mutate(
        { id: editingCheck.id, body },
        {
          onSuccess: () => {
            setDialogOpen(false);
            setEditingCheck(null);
          }
        }
      );
      return;
    }
    createCheck.mutate(body, {
      onSuccess: () => {
        setDialogOpen(false);
        setEditingCheck(null);
      }
    });
  };
  const pageCount = Math.max(1, Math.ceil((violations?.total ?? 0) / 50));
  const currentPage = Math.floor(offset / 50) + 1;

  return (
    <div className={styles.stack}>
      {summary && (
        <div className={styles.summary}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryValue}>{summary.active}</div>
            <div className={styles.summaryLabel}>Active violations</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryValue}>{summary.errors}</div>
            <div className={styles.summaryLabel}>Errors</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryValue}>{summary.warnings}</div>
            <div className={styles.summaryLabel}>Warnings</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryValue}>{summary.acknowledged}</div>
            <div className={styles.summaryLabel}>Acknowledged</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryValue}>{summary.exempt}</div>
            <div className={styles.summaryLabel}>Exempt</div>
          </div>
        </div>
      )}
      <Tabs.Root value={tab} onValueChange={value => setTab(value as Tab)}>
        <Tabs.List>
          <Tabs.Trigger value="checks">Checks ({checks.length})</Tabs.Trigger>
          <Tabs.Trigger value="violations">Violations ({violations?.total ?? 0})</Tabs.Trigger>
          <Tabs.Trigger value="runs">Evaluation runs ({runs.length})</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>

      {tab === 'checks' && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <div className={styles.sectionTitle}>Managed checks</div>
              <div className={styles.sectionSub}>
                Central scheduled checks are independent of schema on-save rules.
              </div>
            </div>
            {canManageWorkspaces && (
              <div className={styles.actions}>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<TbPlayerPlay size={13} />}
                  disabled={runConformance.isPending}
                  onClick={() => runConformance.mutate(undefined)}
                >
                  Run workspace scan
                </Button>
              </div>
            )}
          </div>
          {checksLoading ? (
            <LoadingState text="Loading conformance checks…" size="sm" />
          ) : checksError ? (
            <div className={styles.error}>Conformance checks could not be loaded.</div>
          ) : checks.length === 0 ? (
            <EmptyState compact title="No centrally managed checks yet." />
          ) : (
            <div className={styles.tableWrap}>
              <Table.Root layout="fixed" bordered={false}>
                <Table.Head>
                  <Table.Row>
                    <Table.HeaderCell>Name</Table.HeaderCell>
                    <Table.HeaderCell>Type</Table.HeaderCell>
                    <Table.HeaderCell>Severity</Table.HeaderCell>
                    <Table.HeaderCell>Status</Table.HeaderCell>
                    <Table.HeaderCell width={230}>Actions</Table.HeaderCell>
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {checks.map(check => (
                    <Table.Row key={check.id}>
                      <Table.Cell>
                        <div>{check.name}</div>
                        <div className={styles.muted}>{check.description ?? 'No description'}</div>
                      </Table.Cell>
                      <Table.Cell>{CHECK_TYPE_LABELS[check.definition.type]}</Table.Cell>
                      <Table.Cell>
                        <Chip>{check.severity}</Chip>
                      </Table.Cell>
                      <Table.Cell>
                        {check.enabled ? 'Enabled' : 'Disabled'} · rev {check.revision}
                      </Table.Cell>
                      <Table.Cell>
                        {canManageWorkspaces && (
                          <div className={styles.actions}>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<TbPencil size={12} />}
                              onClick={() => {
                                setEditingCheck(check);
                                setDialogOpen(true);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<TbPlayerPlay size={12} />}
                              onClick={() => runConformance.mutate(check.id)}
                            >
                              Run
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (window.confirm(`Delete '${check.name}'?`))
                                  deleteCheck.mutate(check.id);
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </div>
          )}
        </section>
      )}

      {tab === 'violations' && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <div className={styles.sectionTitle}>Violation history</div>
              <div className={styles.sectionSub}>
                Only violations for entities visible to the current member are shown.
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={<TbRefresh size={13} />}
              onClick={() => setOffset(0)}
            >
              Refresh
            </Button>
          </div>
          <div className={styles.filterRow}>
            <Select.Root
              value={status}
              onChange={value => {
                setStatus((value ?? '') as '' | ConformanceCheckStatus);
                setOffset(0);
              }}
            >
              {STATUS_OPTIONS.map(option => (
                <Select.Item key={option.value} value={option.value}>
                  {option.label}
                </Select.Item>
              ))}
            </Select.Root>
            <Select.Root
              value={severity}
              onChange={value => {
                setSeverity((value ?? '') as '' | ConformanceSeverity);
                setOffset(0);
              }}
            >
              {SEVERITY_OPTIONS.map(option => (
                <Select.Item key={option.value} value={option.value}>
                  {option.label}
                </Select.Item>
              ))}
            </Select.Root>
            <Select.Root
              value={checkId}
              onChange={value => {
                setCheckId(value ?? '');
                setOffset(0);
              }}
            >
              <Select.Item value="">All checks</Select.Item>
              {checks.map(check => (
                <Select.Item key={check.id} value={check.id}>
                  {check.name}
                </Select.Item>
              ))}
            </Select.Root>
            <Select.Root
              value={schemaId}
              onChange={value => {
                setSchemaId(value ?? '');
                setOffset(0);
              }}
            >
              <Select.Item value="">All schemas</Select.Item>
              {schemas.map(schema => (
                <Select.Item key={schema.id} value={schema.id}>
                  {schema.name}
                </Select.Item>
              ))}
            </Select.Root>
            <Select.Root
              value={ownerId}
              onChange={value => {
                setOwnerId(value ?? '');
                setOffset(0);
              }}
            >
              <Select.Item value="">All owners</Select.Item>
              {teams.map(team => (
                <Select.Item key={team.id} value={team.id}>
                  {team.name}
                </Select.Item>
              ))}
            </Select.Root>
          </div>
          {!violations ? (
            <LoadingState text="Loading violations…" size="sm" />
          ) : violations.items.length === 0 ? (
            <div className={styles.empty}>No violations match the current filter.</div>
          ) : (
            <div className={styles.tableWrap}>
              <Table.Root layout="fixed" bordered={false}>
                <Table.Head>
                  <Table.Row>
                    <Table.HeaderCell>Entity</Table.HeaderCell>
                    <Table.HeaderCell>Check / source</Table.HeaderCell>
                    <Table.HeaderCell>Schema / owner</Table.HeaderCell>
                    <Table.HeaderCell>Severity</Table.HeaderCell>
                    <Table.HeaderCell>Status</Table.HeaderCell>
                    <Table.HeaderCell>Last seen</Table.HeaderCell>
                    <Table.HeaderCell width={100}>Action</Table.HeaderCell>
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {violations.items.map(violation => (
                    <Table.Row key={violation.id}>
                      <Table.Cell>
                        <div>{violation.entity_name ?? violation.entity_id}</div>
                        <div className={styles.muted}>{violation.message}</div>
                      </Table.Cell>
                      <Table.Cell>
                        <div>{violation.check_name}</div>
                        <div className={styles.muted}>
                          {CHECK_TYPE_LABELS[violation.source_type]}
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <div>
                          {schemas.find(schema => schema.id === violation.schema_id)?.name ??
                            violation.schema_id ??
                            '—'}
                        </div>
                        <div className={styles.muted}>
                          {teams.find(team => team.id === violation.owner_team_id)?.name ??
                            'No owner'}
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <Chip>{violation.severity}</Chip>
                      </Table.Cell>
                      <Table.Cell>
                        {violation.status}
                        {violation.exemption ? ` · ${violation.exemption.reason}` : ''}
                      </Table.Cell>
                      <Table.Cell>{formatDateTime(violation.last_seen_at)}</Table.Cell>
                      <Table.Cell>
                        {canManageWorkspaces &&
                          (violation.status === 'active' ||
                            violation.status === 'acknowledged') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                exemptViolation.mutate({
                                  id: violation.id,
                                  body: { reason: 'Exempted by workspace administrator' }
                                })
                              }
                            >
                              Exempt
                            </Button>
                          )}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
              <div className={styles.filterRow}>
                <span className={styles.muted}>
                  Page {currentPage} of {pageCount}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - 50))}
                >
                  Previous
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={currentPage >= pageCount}
                  onClick={() => setOffset(offset + 50)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === 'runs' && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <div className={styles.sectionTitle}>Evaluation runs</div>
              <div className={styles.sectionSub}>
                Detailed violation records live separately from the generic job-run summary.
              </div>
            </div>
          </div>
          {runs.length === 0 ? (
            <div className={styles.empty}>No evaluation runs yet.</div>
          ) : (
            <div className={styles.tableWrap}>
              <Table.Root layout="fixed" bordered={false}>
                <Table.Head>
                  <Table.Row>
                    <Table.HeaderCell>Started</Table.HeaderCell>
                    <Table.HeaderCell>Scope</Table.HeaderCell>
                    <Table.HeaderCell>Status</Table.HeaderCell>
                    <Table.HeaderCell>Checked</Table.HeaderCell>
                    <Table.HeaderCell>Violations</Table.HeaderCell>
                    <Table.HeaderCell>Error</Table.HeaderCell>
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {runs.map(run => (
                    <Table.Row key={run.id}>
                      <Table.Cell>{formatDateTime(run.started_at)}</Table.Cell>
                      <Table.Cell>
                        {run.check_id
                          ? (checks.find(check => check.id === run.check_id)?.name ?? run.check_id)
                          : 'Workspace scan'}
                      </Table.Cell>
                      <Table.Cell>{run.status}</Table.Cell>
                      <Table.Cell>{run.checked_count}</Table.Cell>
                      <Table.Cell>{run.violation_count}</Table.Cell>
                      <Table.Cell>{run.error ?? '—'}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </div>
          )}
        </section>
      )}

      <CheckDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditingCheck(null);
        }}
        check={editingCheck}
        schemas={schemas}
        aiConfigured={aiStatus?.configured === true}
        onSubmit={handleSubmit}
        pending={createCheck.isPending || updateCheck.isPending}
        error={(createCheck.error ?? updateCheck.error) as Error | null}
      />
      <div className={styles.muted}>
        <TbShieldCheck size={13} /> Last completed run:{' '}
        {summary?.lastRunAt ? formatDateTime(summary.lastRunAt) : 'never'}
      </div>
    </div>
  );
};
