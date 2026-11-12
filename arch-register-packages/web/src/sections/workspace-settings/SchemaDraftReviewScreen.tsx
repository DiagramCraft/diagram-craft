import { Fragment, useEffect, useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { Button } from '@diagram-craft/app-components/Button';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { TbRefresh } from 'react-icons/tb';
import type { SchemaDraftReview } from '@arch-register/api-types/schemaDraftContract';
import { Banner } from '../../components/Banner';
import { Chip } from '../../components/Chip';
import { Table } from '../../components/table/Table';
import { Page } from '../../components/Page';
import { Stack } from '../../components/Stack';
import { Title } from '../../components/Title';
import { LoadingState } from '../../components/LoadingState';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import {
  useReviewSchemaDraft,
  useSchemaDraft,
  useSchemaDraftRecordReview,
  useStageSchemaItem
} from '../../hooks/useSchemaDraft';
import {
  FieldMigrationDialog,
  type FieldMigrationChoices
} from '../../dialogs/FieldMigrationDialog';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/settings/schemas');

const KIND_LABELS: Record<string, string> = {
  entity_schema: 'Entity type',
  relation_schema: 'Relation type',
  document_type: 'Document type',
  enum: 'Enum',
  field_group: 'Field group',
  category: 'Category'
};

type ReviewTab = 'changes' | 'migrations' | 'findings';

const OP_LABELS = { create: 'New', update: 'Changed', delete: 'Deleted' } as const;

const Row = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, flexWrap: 'wrap' }}>
    {children}
  </div>
);

export const SchemaDraftReviewScreen = () => {
  const navigate = routeApi.useNavigate();
  const { workspaceSlug } = useWorkspaceContext();
  const review = useReviewSchemaDraft(workspaceSlug);
  const stage = useStageSchemaItem(workspaceSlug);
  const { data: draft } = useSchemaDraft(workspaceSlug);
  const [tab, setTab] = useState<ReviewTab>('changes');
  const [resolving, setResolving] = useState<SchemaDraftReview['migrations'][number] | null>(null);
  const stagedKeys = new Set((draft?.items ?? []).map(i => `${i.kind}:${i.item_id}`));
  const run = review.mutate;
  const result = review.data;
  const records = useSchemaDraftRecordReview(workspaceSlug, result?.recordValidation.jobRunId);

  useEffect(() => {
    run();
  }, [run]);

  // Polling stops after ~1 minute; tell the user when the job never started.
  const [waitedTooLong, setWaitedTooLong] = useState(false);
  const jobRunId = result?.recordValidation.jobRunId;
  useEffect(() => {
    setWaitedTooLong(false);
    if (!jobRunId) return;
    const timer = setTimeout(() => setWaitedTooLong(true), 62_000);
    return () => clearTimeout(timer);
  }, [jobRunId]);

  const resolve = async (choices: FieldMigrationChoices) => {
    const migration = resolving;
    const item = draft?.items.find(
      i => i.kind === migration?.kind && i.item_id === migration?.itemId
    );
    if (!migration || !item) return;
    const fieldMigrations = Object.fromEntries(
      Object.entries(choices).map(([fieldId, action]) => [
        fieldId,
        {
          action,
          ...(action === 'rename'
            ? { renameTo: migration.unresolved.find(c => c.fieldId === fieldId)?.renamedToId }
            : {})
        }
      ])
    );
    const payload = { ...((item.payload ?? {}) as Record<string, unknown>), fieldMigrations };
    await stage.mutateAsync({ kind: item.kind, itemId: item.item_id, op: item.op, payload });
    setResolving(null);
    run();
  };

  return (
    <Page>
      <Title
        breadcrumb={[
          {
            label: 'Home',
            onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } })
          },
          { label: 'Settings' }
        ]}
        title="Review draft"
        titleTestId="schema-draft-review"
        description="See what publishing the schema draft would change and break."
        buttons={
          <Button icon={<TbRefresh size={13} />} onClick={() => run()}>
            Refresh
          </Button>
        }
      />

      {review.isPending && <LoadingState text="Reviewing draft…" />}
      {review.isError && <div role="alert">Could not review the draft.</div>}

      {result && (
        <>
          <Row>
            <Chip color={result.summary.blocking ? 'var(--error-fg)' : undefined}>
              {result.summary.blocking} blocking
            </Chip>
            <Chip>{result.summary.warnings} warnings</Chip>
            <Chip color={result.summary.unresolvedMigrations ? 'var(--warning-fg)' : undefined}>
              {result.summary.unresolvedMigrations} migration decisions needed
            </Chip>
          </Row>

          <section data-testid="review-records">
            <Stack size="sm">
              {(records.isPending ||
                records.data?.status === 'queued' ||
                records.data?.status === 'running') &&
                (waitedTooLong ? (
                  <Banner variant="warning">
                    Still waiting for the job server to pick up the validation. Is it running?
                    Refresh to retry.
                  </Banner>
                ) : (
                  <LoadingState text="Validating existing records…" />
                ))}
              {records.data?.status === 'failed' && (
                <Banner variant="error">{records.data.error ?? 'Validation failed'}</Banner>
              )}
              {records.data?.stale && (
                <Banner variant="warning">
                  The draft changed while validating; refresh to re-run.
                </Banner>
              )}
              {records.data?.status === 'succeeded' && !records.data.stale && (
                <>
                  <Banner variant={records.data.problemCount > 0 ? 'warning' : 'info'}>
                    Checked {records.data.entitiesChecked} entities and{' '}
                    {records.data.relationsChecked} relations: {records.data.problemCount} problems.
                  </Banner>
                  {records.data.groups.length > 0 && (
                    <Table.Root>
                      <Table.Head>
                        <Table.Row>
                          <Table.HeaderCell>Count</Table.HeaderCell>
                          <Table.HeaderCell>Schema</Table.HeaderCell>
                          <Table.HeaderCell>Field</Table.HeaderCell>
                          <Table.HeaderCell>Problem</Table.HeaderCell>
                        </Table.Row>
                      </Table.Head>
                      <Table.Body>
                        {records.data.groups.map((g, i) => (
                          <Fragment key={i}>
                            <Table.Row>
                              <Table.Cell>
                                <Chip>{g.count}</Chip>
                              </Table.Cell>
                              <Table.Cell>
                                <strong>{g.schemaName}</strong>
                              </Table.Cell>
                              <Table.Cell>{g.fieldName ?? '—'}</Table.Cell>
                              <Table.Cell>{g.problem.replace(/_/g, ' ')}</Table.Cell>
                            </Table.Row>
                            <Table.DetailRow>
                              {g.examples.map(e => (
                                <div key={e.recordId} style={{ fontSize: 12 }}>
                                  {e.recordId}: {e.message}
                                </div>
                              ))}
                            </Table.DetailRow>
                          </Fragment>
                        ))}
                      </Table.Body>
                    </Table.Root>
                  )}
                </>
              )}
            </Stack>
          </section>

          <Tabs.Root value={tab} onValueChange={v => setTab(v as ReviewTab)}>
            <Tabs.List>
              <Tabs.Trigger value="changes">Changes ({result.items.length})</Tabs.Trigger>
              <Tabs.Trigger value="migrations">
                Field migrations ({result.migrations.length})
              </Tabs.Trigger>
              <Tabs.Trigger value="findings">Conflicts ({result.findings.length})</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="changes">
              <div data-testid="review-changes">
                {result.items.length === 0 && <div>The draft is empty.</div>}
                {result.items.length > 0 && (
                  <Table.Root>
                    <Table.Head>
                      <Table.Row>
                        <Table.HeaderCell>Change</Table.HeaderCell>
                        <Table.HeaderCell>Kind</Table.HeaderCell>
                        <Table.HeaderCell>Name</Table.HeaderCell>
                      </Table.Row>
                    </Table.Head>
                    <Table.Body>
                      {result.items.map(item => (
                        <Table.Row key={`${item.kind}:${item.itemId}`}>
                          <Table.Cell>
                            <Chip>{OP_LABELS[item.op]}</Chip>
                          </Table.Cell>
                          <Table.Cell>{KIND_LABELS[item.kind]}</Table.Cell>
                          <Table.Cell>
                            <strong>{item.name ?? item.liveName ?? item.itemId}</strong>
                            {item.op === 'update' &&
                              item.liveName &&
                              item.name &&
                              item.liveName !== item.name && <span> (was “{item.liveName}”)</span>}
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                )}
              </div>
            </Tabs.Content>
            <Tabs.Content value="migrations">
              <div data-testid="review-migrations">
                {result.migrations.length === 0 && <div>No field migrations required.</div>}
                {result.migrations.length > 0 && (
                  <Table.Root>
                    <Table.Head>
                      <Table.Row>
                        <Table.HeaderCell>Status</Table.HeaderCell>
                        <Table.HeaderCell>Field</Table.HeaderCell>
                        <Table.HeaderCell>Change</Table.HeaderCell>
                        <Table.HeaderCell>Details</Table.HeaderCell>
                      </Table.Row>
                    </Table.Head>
                    <Table.Body>
                      {result.migrations.map(m => (
                        <Fragment key={`${m.kind}:${m.itemId}`}>
                          <Table.GroupHeaderRow colSpan={4}>
                            <Row>
                              <strong style={{ flex: 1 }}>
                                {m.name} ({m.recordCount} records)
                              </strong>
                              {m.unresolved.length > 0 &&
                                !stagedKeys.has(`${m.kind}:${m.itemId}`) && (
                                  <span>Decide in the changed field group</span>
                                )}
                              {m.unresolved.length > 0 &&
                                stagedKeys.has(`${m.kind}:${m.itemId}`) && (
                                  <Button onClick={() => setResolving(m)}>Resolve decisions</Button>
                                )}
                            </Row>
                          </Table.GroupHeaderRow>
                          {m.hardBlocks.map(c => (
                            <Table.Row key={`b:${c.fieldId}`}>
                              <Table.Cell>
                                <Chip color="var(--error-fg)">Blocked</Chip>
                              </Table.Cell>
                              <Table.Cell>{c.fieldName}</Table.Cell>
                              <Table.Cell>{c.kind}</Table.Cell>
                              <Table.Cell>{c.message}</Table.Cell>
                            </Table.Row>
                          ))}
                          {m.unresolved.map(c => (
                            <Table.Row key={`u:${c.fieldId}`}>
                              <Table.Cell>
                                <Chip color="var(--warning-fg)">Needs decision</Chip>
                              </Table.Cell>
                              <Table.Cell>{c.fieldName}</Table.Cell>
                              <Table.Cell>{c.kind}</Table.Cell>
                              <Table.Cell>{c.recordCount} records with data</Table.Cell>
                            </Table.Row>
                          ))}
                          {m.resolved.map(c => (
                            <Table.Row key={`r:${c.fieldId}`}>
                              <Table.Cell>
                                <Chip>Resolved</Chip>
                              </Table.Cell>
                              <Table.Cell>{c.fieldName}</Table.Cell>
                              <Table.Cell>{c.kind}</Table.Cell>
                              <Table.Cell>{c.decision}</Table.Cell>
                            </Table.Row>
                          ))}
                        </Fragment>
                      ))}
                    </Table.Body>
                  </Table.Root>
                )}
              </div>
            </Tabs.Content>
            <Tabs.Content value="findings">
              <div data-testid="review-findings">
                {result.findings.length === 0 && <div>No conflicts found.</div>}
                {result.findings.length > 0 && (
                  <Table.Root>
                    <Table.Head>
                      <Table.Row>
                        <Table.HeaderCell>Severity</Table.HeaderCell>
                        <Table.HeaderCell>Category</Table.HeaderCell>
                        <Table.HeaderCell>Affected</Table.HeaderCell>
                        <Table.HeaderCell>Message</Table.HeaderCell>
                      </Table.Row>
                    </Table.Head>
                    <Table.Body>
                      {result.findings.map((f, i) => (
                        <Table.Row key={i}>
                          <Table.Cell>
                            <Chip
                              color={
                                f.severity === 'blocking' ? 'var(--error-fg)' : 'var(--warning-fg)'
                              }
                            >
                              {f.severity === 'blocking' ? 'Blocking' : 'Warning'}
                            </Chip>
                          </Table.Cell>
                          <Table.Cell>{f.category.replace(/_/g, ' ')}</Table.Cell>
                          <Table.Cell>
                            <strong>{f.subject.name}</strong>
                          </Table.Cell>
                          <Table.Cell>{f.message}</Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                )}
              </div>
            </Tabs.Content>
          </Tabs.Root>
        </>
      )}

      <FieldMigrationDialog
        open={resolving != null}
        itemNoun={resolving?.kind === 'document_type' ? 'document' : 'record'}
        subjectLabel={resolving?.kind === 'document_type' ? 'document type' : 'schema'}
        pendingChanges={(resolving?.unresolved ?? [])
          .filter(c => c.kind === 'removed' || c.kind === 'renamed')
          .map(c => ({
            fieldId: c.fieldId,
            fieldName: c.fieldName,
            kind: c.kind as 'removed' | 'renamed',
            renamedToId: c.renamedToId,
            entityCount: c.recordCount
          }))}
        onCancel={() => setResolving(null)}
        onConfirm={choices => void resolve(choices)}
      />
    </Page>
  );
};
