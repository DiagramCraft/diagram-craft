import { useState } from 'react';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { Button } from '@diagram-craft/app-components/Button';
import { Select } from '@diagram-craft/app-components/Select';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { TbPackageExport, TbTrash } from 'react-icons/tb';
import {
  useBaseline,
  useBaselineDiff,
  useBaselines,
  useDeleteBaseline,
  useSupersedeBaseline
} from '../../hooks/useBaselines';
import { downloadBlob } from '../../lib/browserDownload';
import { ApiError } from '../../lib/http';
import { Table } from '../../components/table/Table';
import { Title } from '../../components/Title';
import styles from './BaselineDetailScreen.module.css';

const formatDate = (value: string) => new Date(value).toLocaleString();

type BaselineTab = 'entities' | 'relations' | 'compare';

type BaselineDetailViewProps = {
  workspaceSlug: string;
  baselineId: string;
  onDeleted?: () => void;
};

export const BaselineDetailView = ({
  workspaceSlug,
  baselineId,
  onDeleted
}: BaselineDetailViewProps) => {
  const { data: baseline, isLoading, error } = useBaseline(workspaceSlug, baselineId);
  const { data: baselines = [] } = useBaselines(workspaceSlug);
  const diff = useBaselineDiff(workspaceSlug);
  const deleteBaseline = useDeleteBaseline(workspaceSlug);
  const supersede = useSupersedeBaseline(workspaceSlug);
  const [compareId, setCompareId] = useState('');
  const [activeTab, setActiveTab] = useState<BaselineTab>('entities');
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [comparison, setComparison] = useState<Awaited<ReturnType<typeof diff.mutateAsync>> | null>(
    null
  );

  if (isLoading)
    return (
      <div className={styles.screen}>
        <p className={styles.subtitle}>Loading baseline…</p>
      </div>
    );
  if (!baseline)
    return (
      <div className={styles.screen}>
        <p className={styles.error}>
          {error instanceof ApiError ? error.message : 'Baseline not found'}
        </p>
      </div>
    );

  const actionError = [diff.error, deleteBaseline.error, supersede.error].find(Boolean);
  const download = () => {
    const filename = baseline.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    downloadBlob(
      new Blob([JSON.stringify(baseline, null, 2)], { type: 'application/json' }),
      `${filename.length > 0 ? filename : 'baseline'}.json`
    );
  };
  const compare = async () => {
    setComparison(
      await diff.mutateAsync({
        from: { kind: 'baseline', id: baseline.id },
        to: compareId ? { kind: 'baseline', id: compareId } : { kind: 'current' }
      })
    );
  };
  const remove = async () => {
    if (deleteBaseline.isPending) return;
    try {
      await deleteBaseline.mutateAsync(baseline.id);
      setDeleteConfirmationOpen(false);
      onDeleted?.();
    } catch {
      // The mutation error is rendered below.
    }
  };
  const markSuperseded = async () => {
    if (!compareId) return;
    await supersede.mutateAsync({ id: baseline.id, replacementId: compareId });
  };

  return (
    <div className={styles.screen}>
      <Title
        title={baseline.name}
        description={baseline.description ?? 'Read-only architecture baseline'}
        buttons={
          <>
            <Button onClick={download} icon={<TbPackageExport size={12} />}>
              Export JSON
            </Button>
            <Button
              onClick={() => setDeleteConfirmationOpen(true)}
              disabled={deleteBaseline.isPending}
              variant="danger"
              icon={<TbTrash size={12} />}
            >
              Remove
            </Button>
          </>
        }
      />

      <section className={`${styles.panel} ${styles.metadataPanel}`}>
        <dl className={styles.metadata}>
          <div>
            <dt>Status</dt>
            <dd>{baseline.status}</dd>
          </div>
          <div>
            <dt>Effective date</dt>
            <dd>{formatDate(baseline.effectiveAt)}</dd>
          </div>
          <div>
            <dt>Scope</dt>
            <dd>{baseline.scope.source.kind.replace('_', ' ')}</dd>
          </div>
          <div>
            <dt>Records</dt>
            <dd>
              {baseline.entityCount} entities · {baseline.relationCount} relations
            </dd>
          </div>
        </dl>
        {actionError && (
          <div className={styles.error}>
            {actionError instanceof ApiError
              ? actionError.message
              : 'Could not complete baseline action'}
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <Tabs.Root value={activeTab} onValueChange={value => setActiveTab(value as BaselineTab)}>
          <Tabs.List aria-label="Baseline details">
            <Tabs.Trigger value="entities">Entities</Tabs.Trigger>
            <Tabs.Trigger value="relations">Relations</Tabs.Trigger>
            <Tabs.Trigger value="compare">Compare</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="entities" style={{ height: 'auto' }}>
            <div className={styles.tabContent}>
              {baseline.entities.length === 0 ? (
                <p className={styles.subtitle}>No entities were captured.</p>
              ) : (
                <Table.Root scroll>
                  <Table.Head>
                    <Table.Row>
                      <Table.HeaderCell>Name</Table.HeaderCell>
                      <Table.HeaderCell>Schema</Table.HeaderCell>
                      <Table.HeaderCell>Owner</Table.HeaderCell>
                      <Table.HeaderCell>Lifecycle</Table.HeaderCell>
                    </Table.Row>
                  </Table.Head>
                  <Table.Body>
                    {baseline.entities.map(entity => (
                      <Table.Row key={entity._uid}>
                        <Table.Cell>{entity._name}</Table.Cell>
                        <Table.Cell>{entity._schema.name}</Table.Cell>
                        <Table.Cell>{entity._owner?.name ?? '—'}</Table.Cell>
                        <Table.Cell>{entity._lifecycle?.name ?? '—'}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              )}
            </div>
          </Tabs.Content>

          <Tabs.Content value="relations" style={{ height: 'auto' }}>
            <div className={styles.tabContent}>
              {baseline.relations.length === 0 ? (
                <p className={styles.subtitle}>No relations were captured.</p>
              ) : (
                <Table.Root scroll>
                  <Table.Head>
                    <Table.Row>
                      <Table.HeaderCell>From</Table.HeaderCell>
                      <Table.HeaderCell>Relation</Table.HeaderCell>
                      <Table.HeaderCell>To</Table.HeaderCell>
                    </Table.Row>
                  </Table.Head>
                  <Table.Body>
                    {baseline.relations.map(relation => (
                      <Table.Row key={relation._uid}>
                        <Table.Cell>{relation._in.name}</Table.Cell>
                        <Table.Cell>{relation._schema.name}</Table.Cell>
                        <Table.Cell>{relation._out.name}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              )}
            </div>
          </Tabs.Content>

          <Tabs.Content value="compare" style={{ height: 'auto' }}>
            <div className={styles.tabContent}>
              <div className={styles.toolbar}>
                <Select.Root
                  style={{ maxWidth: '30%' }}
                  value={compareId}
                  onChange={value => setCompareId(value ?? '')}
                >
                  <Select.Item value="">Compare with current state</Select.Item>
                  {baselines
                    .filter(candidate => candidate.id !== baseline.id)
                    .map(candidate => (
                      <Select.Item key={candidate.id} value={candidate.id}>
                        {candidate.name}
                      </Select.Item>
                    ))}
                </Select.Root>
                <Button size="sm" onClick={compare} disabled={diff.isPending}>
                  {diff.isPending ? 'Comparing…' : 'Compare'}
                </Button>
                {compareId && (
                  <Button size="sm" onClick={markSuperseded} disabled={supersede.isPending}>
                    {supersede.isPending ? 'Updating…' : 'Mark superseded'}
                  </Button>
                )}
              </div>
              {comparison ? (
                <>
                  <p className={styles.counts}>
                    {comparison.added.length} added · {comparison.removed.length} removed ·{' '}
                    {comparison.changed.length} changed entities ·{' '}
                    {comparison.relations.added.length +
                      comparison.relations.removed.length +
                      comparison.relations.changed.length}{' '}
                    relation changes
                  </p>
                  {(comparison.added.length > 0 ||
                    comparison.removed.length > 0 ||
                    comparison.changed.length > 0) && (
                    <Table.Root scroll>
                      <Table.Head>
                        <Table.Row>
                          <Table.HeaderCell>Entity</Table.HeaderCell>
                          <Table.HeaderCell>Change</Table.HeaderCell>
                        </Table.Row>
                      </Table.Head>
                      <Table.Body>
                        {comparison.added.map(entity => (
                          <Table.Row key={`added-${entity._uid}`}>
                            <Table.Cell>{entity._name}</Table.Cell>
                            <Table.Cell>Added</Table.Cell>
                          </Table.Row>
                        ))}
                        {comparison.removed.map(entity => (
                          <Table.Row key={`removed-${entity._uid}`}>
                            <Table.Cell>{entity._name}</Table.Cell>
                            <Table.Cell>Removed</Table.Cell>
                          </Table.Row>
                        ))}
                        {comparison.changed.map(entry => {
                          const changedFields = Object.keys(entry.diff).join(', ');
                          return (
                            <Table.Row key={`changed-${entry.entity._uid}`}>
                              <Table.Cell>{entry.entity._name}</Table.Cell>
                              <Table.Cell>
                                {changedFields.length > 0 ? changedFields : 'Restricted changes'}
                              </Table.Cell>
                            </Table.Row>
                          );
                        })}
                      </Table.Body>
                    </Table.Root>
                  )}
                </>
              ) : null}
            </div>
          </Tabs.Content>
        </Tabs.Root>
      </section>

      <DeleteConfirmationDialog
        open={deleteConfirmationOpen}
        title="Remove baseline?"
        message={
          <>
            The baseline <b>{baseline.name}</b> will be removed from the workspace.
          </>
        }
        detail="Historical evidence will be retained."
        confirmLabel="Remove baseline"
        onConfirm={() => void remove()}
        onCancel={() => setDeleteConfirmationOpen(false)}
      />
    </div>
  );
};
