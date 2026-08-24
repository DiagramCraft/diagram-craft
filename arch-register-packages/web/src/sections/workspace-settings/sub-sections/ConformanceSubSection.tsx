import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  TbAlertTriangle,
  TbCheck,
  TbClock,
  TbEye,
  TbInfoCircle,
  TbListSearch,
  TbLock,
  TbPencil,
  TbPlayerPlay,
  TbPlus,
  TbRefresh,
  TbShieldCheck,
  TbSparkles
} from 'react-icons/tb';
import type {
  ConformanceCheck,
  ConformanceCheckDefinition,
  ConformanceCheckStatus,
  ConformanceEvaluationRun,
  ConformanceSeverity,
  ConformanceViolation,
  CreateConformanceCheck
} from '@arch-register/api-types/conformanceContract';
import { DOCUMENT_AI_READ_ONLY_TOOLS } from '@arch-register/api-types/conformanceContract';
import type { DocumentAiToolId } from '@arch-register/api-types/documentContract';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
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
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { Table } from '../../../components/table/Table';
import { Banner } from '../../../components/Banner';
import { Chip } from '../../../components/Chip';
import { Drawer } from '../../../components/Drawer';
import { EmptyState } from '../../../components/EmptyState';
import { FilterBuilder } from '../../../components/FilterBuilder';
import { FilterDropdown } from '../../../components/FilterDropdown';
import { LoadingState } from '../../../components/LoadingState';
import { Pagination } from '../../../components/Pagination';
import {
  buildEntityQueryFromBrowserFilters,
  entityQueryToBrowserFilters,
  getFilterValue,
  isBasicRepresentable
} from '../../entities/components/entityBrowserState';
import { formatDateTime } from '../../../utils/dateFormat';
import { useAiStatus } from '../../../hooks/useAiConfig';
import { useDismissibleMenu } from '../../../hooks/useDismissibleMenu';
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

const CHECK_TYPE_META: Record<
  CheckType,
  { label: string; description: string; icon: typeof TbClock }
> = {
  scheduled_validation: {
    label: 'Scheduled validation',
    description: 'Evaluate a validation expression against every entity of a schema.',
    icon: TbClock
  },
  query_policy: {
    label: 'Query policy',
    description: 'Identify entities matching a saved query.',
    icon: TbListSearch
  },
  ai_prompt: {
    label: 'AI prompt',
    description: 'AI-assisted yes/no conformance check on selected fields.',
    icon: TbSparkles
  }
};

const SEVERITY_META: Record<
  ConformanceSeverity,
  { icon: typeof TbAlertTriangle; color: string; label: string }
> = {
  error: { icon: TbAlertTriangle, color: 'var(--error-fg)', label: 'Error' },
  warning: { icon: TbInfoCircle, color: 'var(--warning-fg)', label: 'Warning' }
};

const SeverityBadge = ({ severity }: { severity: ConformanceSeverity }) => {
  const meta = SEVERITY_META[severity];
  const SeverityIcon = meta.icon;
  return (
    <span className={styles.severityBadge} style={{ color: meta.color }}>
      <SeverityIcon size={12} /> {meta.label}
    </span>
  );
};

const STATUS_META: Record<
  ConformanceCheckStatus,
  { icon: typeof TbAlertTriangle; dot: string; label: string }
> = {
  active: { icon: TbAlertTriangle, dot: 'var(--error-fg)', label: 'Active' },
  acknowledged: { icon: TbEye, dot: 'var(--cmp-fg-disabled)', label: 'Acknowledged' },
  resolved: { icon: TbCheck, dot: 'var(--success-fg, var(--green-9))', label: 'Resolved' },
  exempt: { icon: TbLock, dot: 'var(--accent-fg)', label: 'Exempt' }
};

const ViolationStatusChip = ({ status }: { status: ConformanceCheckStatus }) => {
  const meta = STATUS_META[status];
  const StatusIcon = meta.icon;
  return (
    <Chip tone="ghost" dot={meta.dot} icon={<StatusIcon size={11} />}>
      {meta.label}
    </Chip>
  );
};

const RUN_STATUS_META: Record<ConformanceEvaluationRun['status'], { tone: string; label: string }> =
  {
    succeeded: { tone: 'var(--success-fg, var(--green-9))', label: 'Succeeded' },
    running: { tone: 'var(--accent-fg)', label: 'Running…' },
    failed: { tone: 'var(--error-fg)', label: 'Failed' }
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

const defaultEntityQuery: EntityQuery = { root: { kind: 'and', children: [] } };
const defaultQuery = JSON.stringify(defaultEntityQuery, null, 2);

type QueryEditMode = 'basic' | 'advanced';

const AddCheckMenu = ({
  aiConfigured,
  onSelect
}: {
  aiConfigured: boolean;
  onSelect: (type: CheckType) => void;
}) => {
  const { open, setOpen, ref } = useDismissibleMenu<HTMLDivElement>();

  return (
    <div className={styles.addMenuWrap} ref={ref}>
      <Button variant="primary" icon={<TbPlus size={12} />} onClick={() => setOpen(o => !o)}>
        Add check
      </Button>
      {open && (
        <div className={styles.addMenu}>
          {(Object.keys(CHECK_TYPE_META) as CheckType[]).map(type => {
            const meta = CHECK_TYPE_META[type];
            const TypeIcon = meta.icon;
            const disabled = type === 'ai_prompt' && !aiConfigured;
            return (
              <button
                key={type}
                type="button"
                className={styles.addMenuItem}
                disabled={disabled}
                onClick={() => {
                  setOpen(false);
                  onSelect(type);
                }}
              >
                <TypeIcon size={14} />
                <span className={styles.addMenuItemText}>
                  <span className={styles.menuItemName}>{meta.label}</span>
                  <span className={styles.menuItemDesc}>
                    {disabled ? 'AI is not configured for this workspace.' : meta.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const CheckDialog = ({
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
}: {
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
}) => {
  const [type, setType] = useState<CheckType>('scheduled_validation');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<ConformanceSeverity>('error');
  const [schemaId, setSchemaId] = useState(schemas[0]?.id ?? '');
  const [fieldId, setFieldId] = useState('');
  const [expression, setExpression] = useState('');
  const [message, setMessage] = useState('Entity does not conform');
  const [queryMode, setQueryMode] = useState<QueryEditMode>('basic');
  const [queryConditions, setQueryConditions] = useState<FilterCondition[]>([]);
  const [queryJson, setQueryJson] = useState(defaultQuery);
  const [queryJsonError, setQueryJsonError] = useState<string | null>(null);
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
    setType(initialType);
    setName('');
    setDescription('');
    setSeverity('error');
    setSchemaId(schemas[0]?.id ?? '');
    setFieldId('');
    setExpression('');
    setMessage('Entity does not conform');
    setQueryMode('basic');
    setQueryConditions([]);
    setQueryJson(defaultQuery);
    setQueryJsonError(null);
    setPrompt('Does this entity conform to the stated architecture policy?');
    setFieldIds([]);
    setTools([]);
    setGovernanceEnabled(false);
    setGovernanceResolution('acknowledge');
    setEnabled(true);
  }, [initialType, schemas]);

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
    setQueryMode('basic');
    setQueryConditions([]);
    setQueryJson(defaultQuery);
    setQueryJsonError(null);
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
      setQueryMode(isBasicRepresentable(definition.query) ? 'basic' : 'advanced');
      setQueryConditions(entityQueryToBrowserFilters(definition.query).conditions);
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
    if (queryMode === 'basic') {
      const query = buildEntityQueryFromBrowserFilters({
        typeFilter: null,
        conditions: queryConditions
      });
      return {
        type,
        query,
        message: message.trim() || 'Entity does not conform',
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
    queryConditions,
    queryJson,
    queryMode,
    schemaId,
    tools,
    type
  ]);

  const switchToAdvanced = () => {
    setQueryJson(
      JSON.stringify(
        buildEntityQueryFromBrowserFilters({ typeFilter: null, conditions: queryConditions }),
        null,
        2
      )
    );
    setQueryJsonError(null);
    setQueryMode('advanced');
  };

  const applyBasicConversion = (query: EntityQuery) => {
    setQueryConditions(entityQueryToBrowserFilters(query).conditions);
    setQueryMode('basic');
  };

  const switchToBasic = () => {
    let parsed: EntityQuery;
    try {
      parsed = JSON.parse(queryJson) as EntityQuery;
    } catch {
      setQueryJsonError('Enter valid JSON before switching to the visual builder.');
      return;
    }
    setQueryJsonError(null);
    if (
      isBasicRepresentable(parsed) ||
      window.confirm(
        'This query uses grouping, NOT, or relation traversal that the visual builder ' +
          "can't represent. Switching will keep only the parts it supports and drop the rest."
      )
    ) {
      applyBasicConversion(parsed);
    }
  };

  const handleQueryJsonChange = (value: string) => {
    setQueryJson(value);
    try {
      JSON.parse(value);
      setQueryJsonError(null);
    } catch {
      setQueryJsonError('Invalid JSON.');
    }
  };

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
        <div className={styles.notice}>
          {CHECK_TYPE_META[type].label} — {CHECK_TYPE_META[type].description}
        </div>
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
            {queryMode === 'basic' ? (
              <div className={styles.filter}>
                <FilterBuilder
                  conditions={queryConditions}
                  onChange={setQueryConditions}
                  schemas={schemas}
                  lifecycleStates={lifecycleStates}
                  owners={owners}
                  enums={enums}
                  selectedSchemaId={getFilterValue(queryConditions, '_schemaId')}
                  getFieldGroupAccess={getFieldGroupAccess}
                  headerActions={
                    <Button variant="secondary" size="sm" onClick={switchToAdvanced}>
                      Advanced
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className={styles.form + ' ' + styles.filter}>
                <div className={styles.queryHeader}>
                  <span className={styles.dsectionLabel}>Entity query conditions</span>
                  <Button variant="secondary" size="sm" onClick={switchToBasic}>
                    Use visual builder
                  </Button>
                </div>
                <textarea
                  className={styles.textarea}
                  value={queryJson}
                  onChange={event => handleQueryJsonChange(event.target.value)}
                />
                {queryJsonError && (
                  <div className={styles.advancedError}>
                    <TbAlertTriangle size={12} /> {queryJsonError}
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

const ViolationDrawer = ({
  violation,
  schemas,
  teams,
  canManageWorkspaces,
  onRequestExempt,
  onClose
}: {
  violation: ConformanceViolation;
  schemas: EntitySchema[];
  teams: { id: string; name: string }[];
  canManageWorkspaces: boolean;
  onRequestExempt: () => void;
  onClose: () => void;
}) => {
  const schemaName =
    schemas.find(schema => schema.id === violation.schema_id)?.name ?? violation.schema_id ?? '—';
  const ownerName = teams.find(team => team.id === violation.owner_team_id)?.name ?? 'No owner';

  const steps: ConformanceCheckStatus[] = [
    'active',
    'acknowledged',
    violation.status === 'exempt' ? 'exempt' : 'resolved'
  ];
  const currentIdx =
    violation.status === 'active' ? 0 : violation.status === 'acknowledged' ? 1 : 2;

  const canExempt =
    canManageWorkspaces && (violation.status === 'active' || violation.status === 'acknowledged');

  return (
    <Drawer
      onClose={onClose}
      eyebrow={<span className="dim">Violation</span>}
      title={violation.entity_name ?? violation.entity_id}
      badges={
        <>
          <Chip tone="ghost">{schemaName}</Chip>
          <Chip tone="ghost">Owner: {ownerName}</Chip>
        </>
      }
      footer={
        canExempt ? (
          <Button variant="primary" onClick={onRequestExempt}>
            Exempt…
          </Button>
        ) : undefined
      }
    >
      <div className={styles.dsectionLabel}>Lifecycle</div>
      <div className={styles.lifecycle}>
        {steps.map((step, index) => {
          const meta = STATUS_META[step];
          const StepIcon = meta.icon;
          const done = index <= currentIdx;
          return (
            <span className={styles.lcStep} key={step}>
              {index > 0 && <span className={`${styles.lcLine} ${done ? styles.lcDone : ''}`} />}
              <span className={`${styles.lcDot} ${done ? styles.lcDone : ''}`}>
                <StepIcon size={11} />
              </span>
              <span className={`${styles.lcLabel} ${done ? styles.lcDone : ''}`}>{meta.label}</span>
            </span>
          );
        })}
      </div>

      <div className={styles.dsectionLabel}>Details</div>
      <dl className={styles.kv}>
        <dt>Status</dt>
        <dd>
          <ViolationStatusChip status={violation.status} />
        </dd>
        <dt>Severity</dt>
        <dd>
          <SeverityBadge severity={violation.severity} />
        </dd>
        <dt>Check</dt>
        <dd>{violation.check_name}</dd>
        <dt>Source type</dt>
        <dd>{CHECK_TYPE_META[violation.source_type].label}</dd>
        <dt>Message</dt>
        <dd>{violation.message}</dd>
        <dt>Last seen</dt>
        <dd>{formatDateTime(violation.last_seen_at)}</dd>
        {violation.exemption && (
          <>
            <dt>Exempted</dt>
            <dd>{formatDateTime(violation.exemption.created_at)}</dd>
            <dt>Reason</dt>
            <dd>{violation.exemption.reason}</dd>
            {violation.exemption.expires_at && (
              <>
                <dt>Expires</dt>
                <dd>{formatDateTime(violation.exemption.expires_at)}</dd>
              </>
            )}
          </>
        )}
        {violation.resolved_at && (
          <>
            <dt>Resolved</dt>
            <dd>{formatDateTime(violation.resolved_at)}</dd>
          </>
        )}
      </dl>
    </Drawer>
  );
};

const ExemptDialog = ({
  violation,
  pending,
  onSubmit,
  onClose
}: {
  violation: ConformanceViolation;
  pending: boolean;
  onSubmit: (reason: string, expiresAt: string | null) => void;
  onClose: () => void;
}) => {
  const [reason, setReason] = useState('Exempted by workspace administrator');
  const [expiresAt, setExpiresAt] = useState('');

  return (
    <Dialog
      open
      onClose={onClose}
      title="Exempt violation"
      sub={violation.entity_name ?? violation.entity_id}
      width={420}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        {
          label: pending ? 'Exempting…' : 'Exempt',
          type: 'default',
          disabled: !reason.trim() || pending,
          onClick: () =>
            onSubmit(reason.trim(), expiresAt ? new Date(expiresAt).toISOString() : null)
        }
      ]}
    >
      <div className={styles.exemptForm}>
        <FormElement label="Reason">
          <TextInput
            value={reason}
            onChange={value => setReason(value ?? '')}
            placeholder="Why is this violation exempt?"
          />
        </FormElement>
        <FormElement label="Expires (optional)">
          <TextInput type="date" value={expiresAt} onChange={value => setExpiresAt(value ?? '')} />
        </FormElement>
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
  const { canManageWorkspaces, getFieldGroupAccess } = useWorkspaceAuthorization(workspaceSlug);
  const { data: aiStatus } = useAiStatus(workspaceSlug);
  const {
    data: checks = [],
    isLoading: checksLoading,
    isError: checksError
  } = useConformanceChecks(workspaceSlug);
  const { data: summary } = useConformanceSummary(workspaceSlug);
  const { data: runs = [] } = useConformanceRuns(workspaceSlug);
  const { teams, lifecycleStates, enums } = useWorkspaceContext();
  const [tab, setTab] = useState<Tab>('checks');
  const [status, setStatus] = useState<'' | ConformanceCheckStatus>('active');
  const [checkId, setCheckId] = useState('');
  const [schemaId, setSchemaId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [severity, setSeverity] = useState<'' | ConformanceSeverity>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCheck, setEditingCheck] = useState<ConformanceCheck | null>(null);
  const [initialType, setInitialType] = useState<CheckType>('scheduled_validation');
  const [openViolationId, setOpenViolationId] = useState<string | null>(null);
  const [exemptViolationId, setExemptViolationId] = useState<string | null>(null);
  const createCheck = useCreateConformanceCheck(workspaceSlug);
  const updateCheck = useUpdateConformanceCheck(workspaceSlug);
  const deleteCheck = useDeleteConformanceCheck(workspaceSlug);
  const runConformance = useRunConformance(workspaceSlug);
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const { data: violations } = useConformanceViolations(workspaceSlug, {
    checkId: checkId || undefined,
    schemaId: schemaId || undefined,
    ownerId: ownerId || undefined,
    status: status || undefined,
    severity: severity || undefined,
    limit: pageSize,
    offset
  });
  const exemptViolation = useExemptConformanceViolation(workspaceSlug);

  const handleAddCheck = useCallback((type: CheckType) => {
    setEditingCheck(null);
    setInitialType(type);
    setDialogOpen(true);
  }, []);

  const aiConfigured = aiStatus?.configured === true;

  useEffect(() => {
    onActionsChange(
      canManageWorkspaces ? (
        <AddCheckMenu aiConfigured={aiConfigured} onSelect={handleAddCheck} />
      ) : undefined
    );
    return () => onActionsChange(undefined);
  }, [aiConfigured, canManageWorkspaces, handleAddCheck, onActionsChange]);

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
  const findViolation = (id: string | null) =>
    id ? (violations?.items.find(item => item.id === id) ?? null) : null;
  const openViolation = findViolation(openViolationId);
  const exemptTarget = findViolation(exemptViolationId);

  return (
    <div className={styles.stack}>
      {summary && (
        <div className={styles.summary}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryValue}>{summary.active}</div>
            <div className={styles.summaryLabel}>Active violations</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={`${styles.summaryValue} ${styles.toneDanger}`}>{summary.errors}</div>
            <div className={styles.summaryLabel}>Errors</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={`${styles.summaryValue} ${styles.toneWarn}`}>{summary.warnings}</div>
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
          <div className={styles.summaryCard}>
            <div className={styles.summaryValue} style={{ fontSize: 13 }}>
              {summary.lastRunAt ? formatDateTime(summary.lastRunAt) : 'Never'}
            </div>
            <div className={styles.summaryLabel}>Last completed evaluation</div>
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
          <Banner variant="neutral">
            Conformance checks are centrally managed and run on demand or on a schedule, unlike
            schema validation, which checks entities immediately on save. Results here persist for
            review, acknowledgement, or exemption.
          </Banner>
          {canManageWorkspaces && (
            <div className={styles.toolbar}>
              <Button
                size="sm"
                icon={<TbRefresh size={12} />}
                disabled={runConformance.isPending}
                onClick={() => runConformance.mutate(undefined)}
              >
                Run workspace scan
              </Button>
            </div>
          )}
          {checksLoading ? (
            <LoadingState text="Loading conformance checks…" size="sm" />
          ) : checksError ? (
            <div className={styles.error}>Conformance checks could not be loaded.</div>
          ) : checks.length === 0 ? (
            <EmptyState
              framed
              icon={<TbShieldCheck size={24} />}
              title="No checks configured"
              subtitle="Conformance checks are centrally managed rules that evaluate entities against architectural and governance expectations. Add a scheduled validation, a query policy, or an AI prompt check to start finding violations across the workspace."
              action={
                canManageWorkspaces ? (
                  <AddCheckMenu aiConfigured={aiConfigured} onSelect={handleAddCheck} />
                ) : undefined
              }
            />
          ) : (
            <div className={styles.tableWrap}>
              <Table.Root layout="fixed">
                <Table.Head>
                  <Table.Row>
                    <Table.HeaderCell>Name</Table.HeaderCell>
                    <Table.HeaderCell>Type</Table.HeaderCell>
                    <Table.HeaderCell>Severity</Table.HeaderCell>
                    <Table.HeaderCell width={80}>Enabled</Table.HeaderCell>
                    <Table.HeaderCell width={80}>Revision</Table.HeaderCell>
                    <Table.HeaderCell width={230}>Actions</Table.HeaderCell>
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {checks.map(check => {
                    const TypeIcon = CHECK_TYPE_META[check.definition.type].icon;
                    return (
                      <Table.Row key={check.id}>
                        <Table.Cell>
                          <div>{check.name}</div>
                          <div className={styles.muted}>
                            {check.description ?? 'No description'}
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <span className={styles.typeTag}>
                            <TypeIcon size={12} /> {CHECK_TYPE_META[check.definition.type].label}
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <SeverityBadge severity={check.severity} />
                        </Table.Cell>
                        <Table.Cell>
                          <input type="checkbox" checked={check.enabled} readOnly />
                        </Table.Cell>
                        <Table.Cell>
                          <span className={styles.revision}>v{check.revision}</span>
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
                    );
                  })}
                </Table.Body>
              </Table.Root>
            </div>
          )}
        </section>
      )}

      {tab === 'violations' && (
        <section className={styles.section}>
          <div className={styles.filterRow}>
            <FilterDropdown
              label="Status"
              value={status}
              onChange={value => {
                setStatus(value as '' | ConformanceCheckStatus);
                setOffset(0);
              }}
              options={STATUS_OPTIONS}
            />
            <FilterDropdown
              label="Severity"
              value={severity}
              onChange={value => {
                setSeverity(value as '' | ConformanceSeverity);
                setOffset(0);
              }}
              options={SEVERITY_OPTIONS}
            />
            <FilterDropdown
              label="Check"
              value={checkId}
              onChange={value => {
                setCheckId(value);
                setOffset(0);
              }}
              options={[
                { value: '', label: 'All checks' },
                ...checks.map(check => ({ value: check.id, label: check.name }))
              ]}
            />
            <FilterDropdown
              label="Schema"
              value={schemaId}
              onChange={value => {
                setSchemaId(value);
                setOffset(0);
              }}
              options={[
                { value: '', label: 'All schemas' },
                ...schemas.map(schema => ({ value: schema.id, label: schema.name }))
              ]}
            />
            <FilterDropdown
              label="Owner"
              value={ownerId}
              onChange={value => {
                setOwnerId(value);
                setOffset(0);
              }}
              options={[
                { value: '', label: 'All owners' },
                ...teams.map(team => ({ value: team.id, label: team.name }))
              ]}
            />
          </div>
          {!violations ? (
            <LoadingState text="Loading violations…" size="sm" />
          ) : violations.items.length === 0 ? (
            <div className={styles.empty}>No violations match the current filter.</div>
          ) : (
            <div className={styles.vlist}>
              {violations.items.map(violation => {
                const violationSchemaName =
                  schemas.find(schema => schema.id === violation.schema_id)?.name ??
                  violation.schema_id ??
                  '—';
                const violationOwnerName =
                  teams.find(team => team.id === violation.owner_team_id)?.name ?? 'No owner';
                return (
                  <div
                    key={violation.id}
                    className={styles.vrow}
                    onClick={() => setOpenViolationId(violation.id)}
                  >
                    <div className={styles.vrowMain}>
                      <div className={styles.vrowHead}>
                        <span className={styles.vrowEntity}>
                          {violation.entity_name ?? violation.entity_id}
                        </span>
                        <SeverityBadge severity={violation.severity} />
                      </div>
                      <div className={styles.vrowMsg}>{violation.message}</div>
                      <div className={styles.vrowMeta}>
                        <span>{violation.check_name}</span>
                        <span>·</span>
                        <span>{violationSchemaName}</span>
                        <span>·</span>
                        <span>Owner: {violationOwnerName}</span>
                        <span>·</span>
                        <span>Last seen {formatDateTime(violation.last_seen_at)}</span>
                      </div>
                    </div>
                    <div className={styles.vrowSide}>
                      <ViolationStatusChip status={violation.status} />
                      {violation.status === 'exempt' && violation.exemption?.expires_at && (
                        <span className={styles.muted}>
                          expires {formatDateTime(violation.exemption.expires_at)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              <Pagination
                pageSize={pageSize}
                onPageSizeChange={size => {
                  setPageSize(size);
                  setOffset(0);
                }}
                canGoPrev={offset > 0}
                canGoNext={offset + pageSize < (violations.total ?? 0)}
                onPrev={() => setOffset(Math.max(0, offset - pageSize))}
                onNext={() => setOffset(offset + pageSize)}
              />
            </div>
          )}
        </section>
      )}

      {tab === 'runs' && (
        <section className={styles.section}>
          {runs.length === 0 ? (
            <div className={styles.empty}>No evaluation runs yet.</div>
          ) : (
            <div className={styles.tableWrap}>
              <Table.Root layout="fixed">
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
                      <Table.Cell>
                        <Chip tone="ghost" dot={RUN_STATUS_META[run.status].tone}>
                          {RUN_STATUS_META[run.status].label}
                        </Chip>
                      </Table.Cell>
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
        initialType={initialType}
        schemas={schemas}
        lifecycleStates={lifecycleStates}
        owners={teams}
        enums={enums}
        getFieldGroupAccess={getFieldGroupAccess}
        aiConfigured={aiConfigured}
        onSubmit={handleSubmit}
        pending={createCheck.isPending || updateCheck.isPending}
        error={(createCheck.error ?? updateCheck.error) as Error | null}
      />

      {openViolation && (
        <ViolationDrawer
          violation={openViolation}
          schemas={schemas}
          teams={teams}
          canManageWorkspaces={canManageWorkspaces}
          onRequestExempt={() => {
            setExemptViolationId(openViolation.id);
            setOpenViolationId(null);
          }}
          onClose={() => setOpenViolationId(null)}
        />
      )}

      {exemptTarget && (
        <ExemptDialog
          violation={exemptTarget}
          pending={exemptViolation.isPending}
          onSubmit={(reason, expiresAt) =>
            exemptViolation.mutate(
              { id: exemptTarget.id, body: { reason, expiresAt } },
              { onSuccess: () => setExemptViolationId(null) }
            )
          }
          onClose={() => setExemptViolationId(null)}
        />
      )}
    </div>
  );
};
