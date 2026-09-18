import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import { Button } from '@diagram-craft/app-components/Button';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TbPlus } from 'react-icons/tb';
import { Title } from '../../components/Title';
import { Table } from '../../components/table/Table';
import { StatusChip } from '../../components/StatusChip';
import { EntityPicker } from '../../components/EntityPicker';
import { RelationPicker } from '../../components/RelationPicker';
import {
  configureIntegrationSource,
  integrationSyncDashboardKey,
  integrationSyncDashboardQuery,
  relinkIntegrationSyncRecord,
  retryIntegrationSyncRun,
  stopManagingIntegrationSyncRecord
} from '../../queries/integrationSync';
import styles from '../../app/api-integration-catalog/sections/ApiIntegrationCatalogPlaceholderScreen.module.css';
import { useWorkspaceAuthorization } from '../../auth/WorkspaceAuthorizationContext';
import { useTeams } from '../../hooks/useWorkspaceConfig';

const dateLabel = (value: string | null) => (value ? new Date(value).toLocaleString() : '—');

type RelinkTarget = {
  id: string;
  externalKey: string;
  recordType: 'entity' | 'relation';
};

type StopManagingTarget = {
  id: string;
  externalKey: string;
  recordType: string;
};

type SelectedEntity = {
  id: string;
  _name: string;
  _schema?: { name?: string } | null;
};

type SourceEditor = {
  sourceKey: string;
  displayName: string;
  type: string;
  owner: string;
  status: 'active' | 'degraded' | 'paused';
};

export const IntegrationSyncScreen = () => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const [relinkTarget, setRelinkTarget] = useState<RelinkTarget | null>(null);
  const [stopManagingTarget, setStopManagingTarget] = useState<StopManagingTarget | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity | null>(null);
  const [selectedRelation, setSelectedRelation] = useState<RelationRecord | null>(null);
  const [sourceEditor, setSourceEditor] = useState<SourceEditor | null>(null);
  const { canManageWorkspaces } = useWorkspaceAuthorization(workspaceSlug);
  const { data: teams = [] } = useTeams(workspaceSlug, sourceEditor !== null);
  const dashboard = useQuery(integrationSyncDashboardQuery(workspaceSlug));
  const queryClient = useQueryClient();
  const retry = useMutation({
    mutationFn: (runId: string) => retryIntegrationSyncRun(workspaceSlug, runId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: integrationSyncDashboardKey(workspaceSlug) }),
    onError: error => window.alert(error instanceof Error ? error.message : String(error))
  });
  const relink = useMutation({
    mutationFn: (input: { id: string; recordId: string }) =>
      relinkIntegrationSyncRecord(workspaceSlug, input.id, input.recordId),
    onSuccess: () =>
      queryClient
        .invalidateQueries({ queryKey: integrationSyncDashboardKey(workspaceSlug) })
        .then(() => {
          setRelinkTarget(null);
          setSelectedEntity(null);
          setSelectedRelation(null);
        }),
    onError: error => window.alert(error instanceof Error ? error.message : String(error))
  });
  const saveSource = useMutation({
    mutationFn: (source: SourceEditor) =>
      configureIntegrationSource(workspaceSlug, source.sourceKey, {
        displayName: source.displayName,
        type: source.type,
        owner: source.owner.trim() === '' ? null : source.owner.trim(),
        ...(source.status !== 'degraded' ? { status: source.status } : {})
      }),
    onSuccess: () =>
      queryClient
        .invalidateQueries({ queryKey: integrationSyncDashboardKey(workspaceSlug) })
        .then(() => {
          setSourceEditor(null);
        }),
    onError: error => window.alert(error instanceof Error ? error.message : String(error))
  });
  const stopManaging = useMutation({
    mutationFn: (id: string) => stopManagingIntegrationSyncRecord(workspaceSlug, id),
    onSuccess: () =>
      queryClient
        .invalidateQueries({ queryKey: integrationSyncDashboardKey(workspaceSlug) })
        .then(() => {
          setStopManagingTarget(null);
        }),
    onError: error => window.alert(error instanceof Error ? error.message : String(error))
  });
  if (dashboard.isLoading) {
    return <div className={styles.empty}>Loading integration sync health…</div>;
  }

  const sources = dashboard.data?.sources ?? [];
  const runs = dashboard.data?.runs ?? [];
  const records = dashboard.data?.records ?? [];
  const recordsNeedingAttention = records.filter(record => record.state !== 'active');
  const closeRelinkDialog = () => {
    if (relink.isPending) return;
    setRelinkTarget(null);
    setSelectedEntity(null);
    setSelectedRelation(null);
  };
  const submitRelink = () => {
    if (!relinkTarget) return;
    const recordId =
      relinkTarget.recordType === 'relation' ? selectedRelation?._uid : selectedEntity?.id;
    if (!recordId) return;
    relink.mutate({ id: relinkTarget.id, recordId });
  };

  return (
    <div className={styles.screen}>
      <Title
        title="Integration sync"
        chips={<span>{sources.length} sources</span>}
        buttons={
          canManageWorkspaces ? (
            <Button
              variant="secondary"
              icon={<TbPlus size={13} />}
              onClick={() =>
                setSourceEditor({
                  sourceKey: '',
                  displayName: '',
                  type: '',
                  owner: '',
                  status: 'paused'
                })
              }
            >
              Add Source
            </Button>
          ) : undefined
        }
      />

      <p style={{ color: 'var(--base-fg-more-dim)', maxWidth: 760 }}>
        Sources are configured and approved here by workspace administrators. Integration clients
        can start runs only for configured sources that are active or degraded; paused sources are
        blocked.
      </p>

      <h3>Sources</h3>
      <Table.Root scroll stickyHeader>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Source</Table.HeaderCell>
            <Table.HeaderCell>Type</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
            <Table.HeaderCell>Last successful run</Table.HeaderCell>
            <Table.HeaderCell>Actions</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {sources.length === 0 ? (
            <Table.EmptyRow colSpan={5}>
              No integration sources have been configured yet.
            </Table.EmptyRow>
          ) : (
            sources.map(source => (
              <Table.Row key={source.id}>
                <Table.NameCell title={source.displayName} subtitle={source.sourceKey} />
                <Table.Cell>{source.type}</Table.Cell>
                <Table.Cell>
                  <StatusChip value={source.status} />
                </Table.Cell>
                <Table.Cell>{dateLabel(source.lastSuccessAt)}</Table.Cell>
                <Table.Cell>
                  {canManageWorkspaces && (
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setSourceEditor({
                          sourceKey: source.sourceKey,
                          displayName: source.displayName,
                          type: source.type,
                          owner: source.owner ?? '',
                          status: source.status
                        })
                      }
                    >
                      Edit
                    </Button>
                  )}
                </Table.Cell>
              </Table.Row>
            ))
          )}
        </Table.Body>
      </Table.Root>

      <h3>Recent runs</h3>
      <Table.Root scroll stickyHeader>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Source</Table.HeaderCell>
            <Table.HeaderCell>Coverage</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
            <Table.HeaderCell>Started</Table.HeaderCell>
            <Table.HeaderCell numeric>Changed</Table.HeaderCell>
            <Table.HeaderCell numeric>Failures</Table.HeaderCell>
            <Table.HeaderCell>Actions</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {runs.length === 0 ? (
            <Table.EmptyRow colSpan={7}>No sync runs have been recorded yet.</Table.EmptyRow>
          ) : (
            runs.map(run => (
              <Table.Row key={run.id}>
                <Table.Cell>{run.sourceKey}</Table.Cell>
                <Table.Cell>{run.coverage}</Table.Cell>
                <Table.Cell>
                  <StatusChip value={run.status} />
                </Table.Cell>
                <Table.Cell>{dateLabel(run.startedAt)}</Table.Cell>
                <Table.Cell numeric>{run.counts.created + run.counts.updated}</Table.Cell>
                <Table.Cell numeric>{run.counts.failed + run.failures.length}</Table.Cell>
                <Table.Cell>
                  {run.status === 'failed' && (
                    <Button
                      variant="secondary"
                      disabled={retry.isPending}
                      onClick={() => retry.mutate(run.id)}
                    >
                      Retry
                    </Button>
                  )}
                </Table.Cell>
              </Table.Row>
            ))
          )}
        </Table.Body>
      </Table.Root>

      <h3>Managed records needing attention</h3>
      <Table.Root scroll stickyHeader>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Source</Table.HeaderCell>
            <Table.HeaderCell>Type</Table.HeaderCell>
            <Table.HeaderCell>External key</Table.HeaderCell>
            <Table.HeaderCell>State</Table.HeaderCell>
            <Table.HeaderCell>Last seen</Table.HeaderCell>
            <Table.HeaderCell>Actions</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {recordsNeedingAttention.length === 0 ? (
            <Table.EmptyRow colSpan={6}>
              No stale, missing, orphaned, or failing records.
            </Table.EmptyRow>
          ) : (
            recordsNeedingAttention.map(record => (
              <Table.Row key={record.id}>
                <Table.Cell>{record.sourceKey}</Table.Cell>
                <Table.Cell>{record.recordType}</Table.Cell>
                <Table.Cell title={record.externalKey}>{record.externalKey}</Table.Cell>
                <Table.Cell>
                  <StatusChip value={record.state} />
                </Table.Cell>
                <Table.Cell>{dateLabel(record.lastSeenAt)}</Table.Cell>
                <Table.Cell>
                  {record.state === 'orphaned' &&
                    (record.recordType === 'entity' || record.recordType === 'relation') && (
                      <Button
                        variant="secondary"
                        disabled={relink.isPending}
                        onClick={() => {
                          setRelinkTarget({
                            id: record.id,
                            externalKey: record.externalKey,
                            recordType: record.recordType as 'entity' | 'relation'
                          });
                          setSelectedEntity(null);
                          setSelectedRelation(null);
                        }}
                      >
                        Relink
                      </Button>
                    )}
                  {record.state === 'orphaned' && (
                    <Button
                      variant="ghost"
                      disabled={stopManaging.isPending}
                      onClick={() =>
                        setStopManagingTarget({
                          id: record.id,
                          externalKey: record.externalKey,
                          recordType: record.recordType
                        })
                      }
                    >
                      Stop managing
                    </Button>
                  )}
                </Table.Cell>
              </Table.Row>
            ))
          )}
        </Table.Body>
      </Table.Root>

      <Dialog
        open={relinkTarget !== null}
        onClose={closeRelinkDialog}
        title={
          relinkTarget?.recordType === 'relation'
            ? 'Relink managed relation'
            : 'Relink managed entity'
        }
        sub={relinkTarget ? `External record: ${relinkTarget.externalKey}` : undefined}
        buttons={[
          {
            label: 'Cancel',
            type: 'cancel',
            disabled: relink.isPending,
            onClick: closeRelinkDialog
          },
          {
            label: relink.isPending
              ? 'Relinking…'
              : relinkTarget?.recordType === 'relation'
                ? 'Relink relation'
                : 'Relink entity',
            type: 'default',
            disabled:
              (relinkTarget?.recordType === 'relation'
                ? selectedRelation === null
                : selectedEntity === null) || relink.isPending,
            onClick: submitRelink
          }
        ]}
      >
        <FormElement
          label={
            relinkTarget?.recordType === 'relation' ? 'New catalog relation' : 'New catalog entity'
          }
          required
          hint={
            relinkTarget?.recordType === 'relation'
              ? 'Choose the relation that should receive this external record.'
              : 'Choose the entity that should receive this external record.'
          }
        >
          {relinkTarget?.recordType === 'relation' ? (
            <RelationPicker
              selectedRelationId={selectedRelation?._uid ?? ''}
              selectedRelation={selectedRelation}
              onSelectRelation={relation => setSelectedRelation(relation)}
              onClearRelation={() => setSelectedRelation(null)}
              enabled={relinkTarget !== null}
            />
          ) : (
            <EntityPicker
              selectedEntityId={selectedEntity?.id ?? ''}
              selectedEntity={selectedEntity}
              onSelectEntity={entity =>
                setSelectedEntity({
                  id: entity._publicId,
                  _name: entity._name,
                  _schema: entity._schema
                })
              }
              onClearEntity={() => setSelectedEntity(null)}
            />
          )}
        </FormElement>
      </Dialog>

      <DeleteConfirmationDialog
        open={stopManagingTarget !== null}
        title="Stop managing this record?"
        message={
          stopManagingTarget ? (
            <>
              Stop tracking <b>{stopManagingTarget.externalKey}</b> from this integration?
            </>
          ) : (
            ''
          )
        }
        detail="The catalog record will not be deleted. The integration tracking and external identity mapping will be removed."
        confirmLabel="Stop managing"
        onConfirm={() => {
          if (stopManagingTarget) stopManaging.mutate(stopManagingTarget.id);
        }}
        onCancel={() => {
          if (!stopManaging.isPending) setStopManagingTarget(null);
        }}
      />

      <Dialog
        open={sourceEditor !== null}
        onClose={() => {
          if (!saveSource.isPending) setSourceEditor(null);
        }}
        title={sourceEditor?.sourceKey ? 'Configure integration source' : 'Add integration source'}
        sub="Only workspace settings administrators can approve a source for synchronization."
        buttons={[
          {
            label: 'Cancel',
            type: 'cancel',
            disabled: saveSource.isPending,
            onClick: () => setSourceEditor(null)
          },
          {
            label: saveSource.isPending ? 'Saving…' : 'Save source',
            type: 'default',
            disabled:
              saveSource.isPending ||
              sourceEditor === null ||
              sourceEditor.sourceKey.trim() === '' ||
              sourceEditor.displayName.trim() === '' ||
              sourceEditor.type.trim() === '',
            onClick: () => {
              if (sourceEditor) saveSource.mutate(sourceEditor);
            }
          }
        ]}
      >
        {sourceEditor && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <FormElement
              label="Source key"
              required
              hint="Stable identifier used by the integration client."
            >
              <TextInput
                value={sourceEditor.sourceKey}
                disabled={sourceEditor.sourceKey !== ''}
                onChange={value => setSourceEditor({ ...sourceEditor, sourceKey: value ?? '' })}
                placeholder="backstage-github-example"
              />
            </FormElement>
            <FormElement label="Display name" required>
              <TextInput
                value={sourceEditor.displayName}
                onChange={value => setSourceEditor({ ...sourceEditor, displayName: value ?? '' })}
                placeholder="Backstage catalog"
              />
            </FormElement>
            <FormElement label="Type" required>
              <TextInput
                value={sourceEditor.type}
                onChange={value => setSourceEditor({ ...sourceEditor, type: value ?? '' })}
                placeholder="backstage"
              />
            </FormElement>
            <FormElement label="Owner team">
              <Select.Root
                value={sourceEditor.owner || undefined}
                onChange={value => setSourceEditor({ ...sourceEditor, owner: value ?? '' })}
                placeholder="—"
              >
                {teams.map(team => (
                  <Select.Item key={team.id} value={team.id}>
                    {team.name}
                  </Select.Item>
                ))}
              </Select.Root>
            </FormElement>
            <FormElement
              label="Status"
              required
              hint="Degraded is system-managed. Paused sources remain configured but cannot start or submit sync work."
            >
              <Select.Root
                value={sourceEditor.status === 'degraded' ? undefined : sourceEditor.status}
                onChange={value =>
                  setSourceEditor({
                    ...sourceEditor,
                    status: (value ?? 'paused') as 'active' | 'paused'
                  })
                }
                placeholder={
                  sourceEditor.status === 'degraded'
                    ? 'Degraded — managed automatically'
                    : undefined
                }
              >
                <Select.Item value="active">Active — approved for syncing</Select.Item>
                <Select.Item value="paused">Paused — syncing blocked</Select.Item>
              </Select.Root>
            </FormElement>
          </div>
        )}
      </Dialog>
    </div>
  );
};
