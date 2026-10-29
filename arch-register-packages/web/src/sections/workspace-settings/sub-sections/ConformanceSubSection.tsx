import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { useCallback, useState } from 'react';
import { SectionActions } from '../SectionActions';
import {
  TbCheck,
  TbPencil,
  TbPlayerPause,
  TbPlayerPlay,
  TbPlus,
  TbRefresh,
  TbShieldCheck,
  TbTrash
} from 'react-icons/tb';
import type {
  ConformanceCheck,
  ConformanceCheckStatus,
  ConformanceEvaluationRun,
  ConformanceSeverity,
  ConformanceViolation,
  ConformanceViolationEvent,
  CreateConformanceCheck
} from '@arch-register/api-types/conformanceContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { Button } from '@diagram-craft/app-components/Button';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { Table } from '../../../components/table/Table';
import { Chip } from '../../../components/Chip';
import {
  CHECK_TYPE_META,
  SeverityBadge,
  ViolationStatusChip,
  STATUS_META
} from '../../../components/ConformanceBadges';
import { DropdownMenu, type MenuItem } from '../../../components/DropdownMenu';
import { Drawer } from '../../../components/Drawer';
import { ViewControls } from '../../../components/ViewControls';
import { LabeledSelect } from '../../../components/LabeledSelect';
import { LoadingState } from '../../../components/LoadingState';
import { QueryState } from '../QueryState';
import { Pagination } from '../../../components/Pagination';
import { formatDateTime } from '../../../utils/dateFormat';
import { useAiStatus } from '../../../hooks/useAiConfig';
import { useDismissibleMenu } from '../../../hooks/useDismissibleMenu';
import { useWorkspaceAuthorization } from '../../../auth/WorkspaceAuthorizationContext';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import {
  useConformanceChecks,
  useConformanceRuns,
  useConformanceSummary,
  useConformanceViolationEvents,
  useConformanceViolations,
  useCreateConformanceCheck,
  useDeleteConformanceCheck,
  useExemptConformanceViolation,
  useRevokeConformanceExemption,
  useRunConformance,
  useSetConformanceViolationStatus,
  useUpdateConformanceCheck
} from '../../../hooks/useConformance';
import { ConformanceCheckEditor } from './ConformanceCheckEditor';
import type { CheckType } from './conformanceCheckEditorState';
import styles from './ConformanceSubSection.module.css';

type Tab = 'checks' | 'violations' | 'runs';

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

const EVENT_TYPE_LABELS: Record<ConformanceViolationEvent['event_type'], string> = {
  observed: 'Observed',
  acknowledged: 'Acknowledged',
  resolved: 'Resolved',
  exempted: 'Exempted',
  exemption_revoked: 'Exemption revoked'
};

const ViolationTimeline = ({ events }: { events: ConformanceViolationEvent[] }) => {
  if (events.length === 0) return null;
  return (
    <>
      <div className={styles.dsectionLabel}>History</div>
      <ul className={styles.kv} style={{ display: 'block' }}>
        {events.map(item => (
          <li key={item.id} style={{ marginBottom: 8 }}>
            <strong>{EVENT_TYPE_LABELS[item.event_type]}</strong>{' '}
            <span className="dim">{formatDateTime(item.occurred_at)}</span>
          </li>
        ))}
      </ul>
    </>
  );
};

const ViolationDrawer = ({
  violation,
  schemas,
  teams,
  canManageWorkspaces,
  governanceEnabled,
  onRequestExempt,
  onRevokeExemption,
  revokePending,
  onSetStatus,
  setStatusPending,
  onClose
}: {
  violation: ConformanceViolation;
  schemas: EntitySchema[];
  teams: { id: string; name: string }[];
  canManageWorkspaces: boolean;
  governanceEnabled: boolean;
  onRequestExempt: () => void;
  onRevokeExemption: () => void;
  revokePending: boolean;
  onSetStatus: (status: 'acknowledged' | 'resolved') => void;
  setStatusPending: boolean;
  onClose: () => void;
}) => {
  const schemaName =
    schemas.find(schema => schema.id === violation.schema_id)?.name ?? violation.schema_id ?? '—';
  const ownerName = teams.find(team => team.id === violation.owner_team_id)?.name ?? 'No owner';
  const { data: events = [] } = useConformanceViolationEvents(violation.workspace, violation.id);

  const steps: ConformanceCheckStatus[] = [
    'active',
    'acknowledged',
    violation.status === 'exempt' ? 'exempt' : 'resolved'
  ];
  const currentIdx =
    violation.status === 'active' ? 0 : violation.status === 'acknowledged' ? 1 : 2;

  const canExempt =
    canManageWorkspaces && (violation.status === 'active' || violation.status === 'acknowledged');
  const canRevoke = canManageWorkspaces && violation.exemption != null;
  // Manual acknowledge/resolve only makes sense when there's no governance case already driving
  // the violation's status via its check's governance.resolution config.
  const canSetStatusManually =
    canManageWorkspaces &&
    !governanceEnabled &&
    (violation.status === 'active' || violation.status === 'acknowledged');

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
        canExempt || canRevoke || canSetStatusManually ? (
          <div style={{ display: 'flex', gap: '8px' }}>
            {canSetStatusManually && violation.status === 'active' && (
              <Button onClick={() => onSetStatus('acknowledged')} disabled={setStatusPending}>
                Acknowledge
              </Button>
            )}
            {canSetStatusManually && (
              <Button onClick={() => onSetStatus('resolved')} disabled={setStatusPending}>
                Resolve
              </Button>
            )}
            {canRevoke && (
              <Button onClick={onRevokeExemption} disabled={revokePending}>
                Revoke exemption
              </Button>
            )}
            {canExempt && (
              <Button variant="primary" onClick={onRequestExempt}>
                Exempt…
              </Button>
            )}
          </div>
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

      <ViolationTimeline events={events} />
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
  schemas
}: {
  workspaceSlug: string;
  schemas: EntitySchema[];
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
  const [deleteCheckTarget, setDeleteCheckTarget] = useState<ConformanceCheck | null>(null);
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
  const revokeExemption = useRevokeConformanceExemption(workspaceSlug);
  const setViolationStatus = useSetConformanceViolationStatus(workspaceSlug);

  const handleAddCheck = useCallback((type: CheckType) => {
    setEditingCheck(null);
    setInitialType(type);
    setDialogOpen(true);
  }, []);

  const aiConfigured = aiStatus?.configured === true;

  const openEdit = (check: ConformanceCheck) => {
    setEditingCheck(check);
    setDialogOpen(true);
  };

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
  const openViolationGovernanceEnabled =
    checks.find(check => check.id === openViolation?.check_id)?.definition.governance?.enabled ??
    false;

  return (
    <>
      <SectionActions>
        {canManageWorkspaces && (
          <>
            <Button
              icon={<TbRefresh size={12} />}
              disabled={runConformance.isPending}
              onClick={() => runConformance.mutate(undefined)}
            >
              Run workspace scan
            </Button>
            <AddCheckMenu aiConfigured={aiConfigured} onSelect={handleAddCheck} />
          </>
        )}
      </SectionActions>
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
              <div className={styles.summaryValue}>
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
            <QueryState
              isLoading={checksLoading}
              error={checksError}
              isEmpty={checks.length === 0}
              subject="conformance checks"
              empty={{
                framed: true,
                icon: <TbShieldCheck size={24} />,
                title: 'No checks configured',
                subtitle:
                  'Conformance checks are centrally managed rules that evaluate entities against architectural and governance expectations. Add a scheduled validation, a query policy, or an AI prompt check to start finding violations across the workspace.',
                action: canManageWorkspaces ? (
                  <AddCheckMenu aiConfigured={aiConfigured} onSelect={handleAddCheck} />
                ) : undefined
              }}
            >
              <div className={styles.tableWrap}>
                <Table.Root layout="fixed">
                  <Table.Head>
                    <Table.Row>
                      <Table.HeaderCell>Name</Table.HeaderCell>
                      <Table.HeaderCell>Type</Table.HeaderCell>
                      <Table.HeaderCell>Severity</Table.HeaderCell>
                      <Table.HeaderCell width={110}>Status</Table.HeaderCell>
                      <Table.HeaderCell width={80}>Revision</Table.HeaderCell>
                      {canManageWorkspaces && <Table.HeaderCell width={48} />}
                    </Table.Row>
                  </Table.Head>
                  <Table.Body>
                    {checks.map(check => {
                      const TypeIcon = CHECK_TYPE_META[check.definition.type].icon;
                      return (
                        <Table.Row
                          key={check.id}
                          onClick={canManageWorkspaces ? () => openEdit(check) : undefined}
                        >
                          <Table.Cell>
                            <div className={styles.title}>{check.name}</div>
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
                            <Chip
                              dot={check.enabled ? 'var(--green)' : 'var(--cmp-fg-disabled)'}
                              tone="ghost"
                            >
                              {check.enabled ? 'Enabled' : 'Disabled'}
                            </Chip>
                          </Table.Cell>
                          <Table.Cell>
                            <span className={styles.revision}>v{check.revision}</span>
                          </Table.Cell>
                          {canManageWorkspaces && (
                            <Table.ActionsCell>
                              <DropdownMenu
                                trigger={
                                  <Table.DotsButton aria-label={`Actions for ${check.name}`} />
                                }
                                items={
                                  [
                                    {
                                      label: 'Edit',
                                      icon: <TbPencil size={14} />,
                                      onClick: () => openEdit(check)
                                    },
                                    {
                                      label: 'Run',
                                      icon: <TbPlayerPlay size={14} />,
                                      onClick: () => runConformance.mutate(check.id)
                                    },
                                    {
                                      label: check.enabled ? 'Disable' : 'Enable',
                                      icon: check.enabled ? (
                                        <TbPlayerPause size={14} />
                                      ) : (
                                        <TbCheck size={14} />
                                      ),
                                      onClick: () =>
                                        updateCheck.mutate({
                                          id: check.id,
                                          body: { enabled: !check.enabled }
                                        })
                                    },
                                    {
                                      label: 'Delete',
                                      icon: <TbTrash size={14} />,
                                      danger: true,
                                      onClick: () => setDeleteCheckTarget(check)
                                    }
                                  ] satisfies MenuItem[]
                                }
                              />
                            </Table.ActionsCell>
                          )}
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table.Root>
              </div>
            </QueryState>
          </section>
        )}

        {tab === 'violations' && (
          <section className={styles.section}>
            <ViewControls padding="none">
              <LabeledSelect
                label="Status"
                value={status}
                onChange={value => {
                  setStatus(value as '' | ConformanceCheckStatus);
                  setOffset(0);
                }}
                options={STATUS_OPTIONS}
              />
              <LabeledSelect
                label="Severity"
                value={severity}
                onChange={value => {
                  setSeverity(value as '' | ConformanceSeverity);
                  setOffset(0);
                }}
                options={SEVERITY_OPTIONS}
              />
              <LabeledSelect
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
              <LabeledSelect
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
              <LabeledSelect
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
            </ViewControls>
            <div style={{ height: '8px' }}></div>
            {!violations ? (
              <LoadingState text="Loading violations…" size="sm" />
            ) : violations.items.length === 0 ? (
              <div className={styles.empty}>No violations match the current filter.</div>
            ) : (
              <div className={styles.vlist}>
                <div className={styles.tableWrap}>
                  <Table.Root layout="fixed">
                    <Table.Head>
                      <Table.Row>
                        <Table.HeaderCell>Entity</Table.HeaderCell>
                        <Table.HeaderCell width={90}>Severity</Table.HeaderCell>
                        <Table.HeaderCell width={140}>Status</Table.HeaderCell>
                        <Table.HeaderCell>Message</Table.HeaderCell>
                        <Table.HeaderCell>Check</Table.HeaderCell>
                        <Table.HeaderCell width={130}>Schema</Table.HeaderCell>
                        <Table.HeaderCell width={130}>Owner</Table.HeaderCell>
                        <Table.HeaderCell width={150}>Last seen</Table.HeaderCell>
                      </Table.Row>
                    </Table.Head>
                    <Table.Body>
                      {violations.items.map(violation => {
                        const violationSchemaName =
                          schemas.find(schema => schema.id === violation.schema_id)?.name ??
                          violation.schema_id ??
                          '—';
                        const violationOwnerName =
                          teams.find(team => team.id === violation.owner_team_id)?.name ??
                          'No owner';
                        return (
                          <Table.Row
                            key={violation.id}
                            onClick={() => setOpenViolationId(violation.id)}
                          >
                            <Table.Cell>{violation.entity_name ?? violation.entity_id}</Table.Cell>
                            <Table.Cell>
                              <SeverityBadge severity={violation.severity} />
                            </Table.Cell>
                            <Table.Cell>
                              <ViolationStatusChip status={violation.status} />
                              {violation.status === 'exempt' && violation.exemption?.expires_at && (
                                <div className={styles.muted}>
                                  expires {formatDateTime(violation.exemption.expires_at)}
                                </div>
                              )}
                            </Table.Cell>
                            <Table.Cell>{violation.message}</Table.Cell>
                            <Table.Cell>{violation.check_name}</Table.Cell>
                            <Table.Cell>{violationSchemaName}</Table.Cell>
                            <Table.Cell>{violationOwnerName}</Table.Cell>
                            <Table.Cell>{formatDateTime(violation.last_seen_at)}</Table.Cell>
                          </Table.Row>
                        );
                      })}
                    </Table.Body>
                  </Table.Root>
                </div>
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
                            ? (checks.find(check => check.id === run.check_id)?.name ??
                              run.check_id)
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

        <DeleteConfirmationDialog
          open={deleteCheckTarget != null}
          title="Delete conformance check?"
          message={`'${deleteCheckTarget?.name ?? ''}' will be permanently deleted.`}
          onCancel={() => setDeleteCheckTarget(null)}
          onConfirm={() => {
            if (!deleteCheckTarget) return;
            deleteCheck.mutate(deleteCheckTarget.id, {
              onSettled: () => setDeleteCheckTarget(null)
            });
          }}
        />
        <ConformanceCheckEditor
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
            governanceEnabled={openViolationGovernanceEnabled}
            onRequestExempt={() => {
              setExemptViolationId(openViolation.id);
              setOpenViolationId(null);
            }}
            onRevokeExemption={() => revokeExemption.mutate(openViolation.id)}
            revokePending={revokeExemption.isPending}
            onSetStatus={statusValue =>
              setViolationStatus.mutate({ id: openViolation.id, status: statusValue })
            }
            setStatusPending={setViolationStatus.isPending}
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
    </>
  );
};
