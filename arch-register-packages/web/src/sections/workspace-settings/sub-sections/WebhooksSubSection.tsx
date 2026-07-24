import { useEffect, useState } from 'react';
import { TbCopy, TbEdit, TbKey, TbPlus, TbTrash, TbWebhook } from 'react-icons/tb';
import type { Webhook, WebhookOperation } from '@arch-register/api-types/webhookContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { Button } from '@diagram-craft/app-components/Button';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { Table } from '../../../components/table/Table';
import { DropdownMenu, type MenuItem } from '../../../components/DropdownMenu';
import { Chip } from '../../../components/Chip';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { useWebhookOperations, useWebhooks, type WebhookInput } from '../../../hooks/useWebhooks';
import styles from './WebhooksSubSection.module.css';

const OPERATIONS: Array<{ value: WebhookOperation; label: string }> = [
  { value: 'create', label: 'Entity created' },
  { value: 'update', label: 'Entity updated' },
  { value: 'delete', label: 'Entity deleted' }
];

const EditorDialog = ({
  webhook,
  schemas,
  pending,
  error,
  onClose,
  onSave
}: {
  webhook: Webhook | 'new' | null;
  schemas: EntitySchema[];
  pending: boolean;
  error: Error | null;
  onClose: () => void;
  onSave: (input: WebhookInput) => void;
}) => {
  const [url, setUrl] = useState('');
  const [operations, setOperations] = useState<WebhookOperation[]>([]);
  const [schemaIds, setSchemaIds] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!webhook) return;
    setUrl(webhook === 'new' ? '' : webhook.url);
    setOperations(
      webhook === 'new' ? ['create', 'update', 'delete'] : webhook.event_filter.operations
    );
    setSchemaIds(webhook === 'new' ? [] : webhook.event_filter.schema_ids);
    setEnabled(webhook === 'new' ? true : webhook.enabled);
  }, [webhook]);

  if (!webhook) return null;
  const toggle = <T,>(values: T[], value: T) =>
    values.includes(value) ? values.filter(item => item !== value) : [...values, value];

  return (
    <Dialog
      open
      onClose={onClose}
      title={webhook === 'new' ? 'Create webhook' : 'Edit webhook'}
      width={560}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        {
          label: pending ? 'Saving…' : 'Save webhook',
          type: 'default',
          disabled: pending || url.trim() === '' || operations.length === 0,
          onClick: () =>
            onSave({ url, event_filter: { operations, schema_ids: schemaIds }, enabled })
        }
      ]}
    >
      <div className={styles.form}>
        <label className={styles.field}>
          <span className={styles.label}>Endpoint URL</span>
          <TextInput
            value={url}
            onChange={value => setUrl(value ?? '')}
            placeholder="https://example.com/webhook"
          />
          <span className={styles.hint}>
            HTTPS is required except for local development endpoints.
          </span>
        </label>
        <div className={styles.field}>
          <span className={styles.label}>Events</span>
          <div className={styles.checks}>
            {OPERATIONS.map(operation => (
              <label className={styles.check} key={operation.value}>
                <Checkbox
                  value={operations.includes(operation.value)}
                  onChange={() => setOperations(toggle(operations, operation.value))}
                />
                {operation.label}
              </label>
            ))}
          </div>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Entity types</span>
          <span className={styles.hint}>No selection sends events for every entity type.</span>
          <div className={styles.checks}>
            {schemas.map(schema => (
              <label className={styles.check} key={schema.id}>
                <Checkbox
                  value={schemaIds.includes(schema.id)}
                  onChange={() => setSchemaIds(toggle(schemaIds, schema.id))}
                />
                {schema.name}
              </label>
            ))}
          </div>
        </div>
        <label className={styles.check}>
          <Checkbox value={enabled} onChange={value => setEnabled(value ?? false)} /> Enabled
        </label>
        {error && <div className={styles.error}>{error.message}</div>}
      </div>
    </Dialog>
  );
};

const SecretDialog = ({ secret, onClose }: { secret: string | null; onClose: () => void }) =>
  secret ? (
    <Dialog
      open
      onClose={onClose}
      title="Webhook secret"
      sup="Copy this secret now"
      sub="It will not be shown again."
      buttons={[{ label: 'Done', type: 'default', onClick: onClose }]}
    >
      <div className={styles.secret}>
        <code>{secret}</code>
        <Button
          variant="secondary"
          icon={<TbCopy size={13} />}
          onClick={() => void navigator.clipboard?.writeText(secret)}
        >
          Copy
        </Button>
      </div>
    </Dialog>
  ) : null;

export const WebhooksSubSection = ({
  workspaceSlug,
  schemas
}: {
  workspaceSlug: string;
  schemas: EntitySchema[];
}) => {
  const { data: webhooks = [], isLoading, error } = useWebhooks(workspaceSlug);
  const operations = useWebhookOperations(workspaceSlug);
  const [editor, setEditor] = useState<Webhook | 'new' | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [rotateId, setRotateId] = useState<string | null>(null);

  const save = async (input: WebhookInput) => {
    if (editor === 'new') {
      const created = await operations.create.mutateAsync(input);
      setSecret(created.secret);
    } else if (editor) {
      await operations.update.mutateAsync({ id: editor.id, ...input });
    }
    setEditor(null);
  };

  return (
    <div className={styles.container}>
      <div className={styles.intro}>
        <span>
          Signed deliveries are queued for the job server and retried on temporary failures.
        </span>
        <Button variant="primary" icon={<TbPlus size={13} />} onClick={() => setEditor('new')}>
          New webhook
        </Button>
      </div>
      {error ? (
        <div className={styles.error}>Webhooks could not be loaded.</div>
      ) : isLoading ? (
        <LoadingState text="Loading webhooks…" size="sm" />
      ) : webhooks.length === 0 ? (
        <EmptyState
          icon={<TbWebhook size={20} />}
          title="No webhooks"
          subtitle="Create an endpoint to receive entity change events."
        />
      ) : (
        <Table.Root>
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell>Endpoint</Table.HeaderCell>
              <Table.HeaderCell>Events</Table.HeaderCell>
              <Table.HeaderCell>Entity types</Table.HeaderCell>
              <Table.HeaderCell width={90}>State</Table.HeaderCell>
              <Table.HeaderCell />
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {webhooks.map(webhook => (
              <Table.Row key={webhook.id}>
                <Table.Cell>
                  <div className={styles.url}>{webhook.url}</div>
                </Table.Cell>
                <Table.Cell>{webhook.event_filter.operations.join(', ')}</Table.Cell>
                <Table.Cell>
                  {webhook.event_filter.schema_ids.length === 0
                    ? 'All'
                    : webhook.event_filter.schema_ids
                        .map(id => schemas.find(schema => schema.id === id)?.name ?? id)
                        .join(', ')}
                </Table.Cell>
                <Table.Cell>
                  <Chip
                    dot={webhook.enabled ? 'var(--green)' : 'var(--cmp-fg-disabled)'}
                    tone="ghost"
                  >
                    {webhook.enabled ? 'Enabled' : 'Disabled'}
                  </Chip>
                </Table.Cell>
                <Table.ActionsCell>
                  <DropdownMenu
                    trigger={<Table.DotsButton aria-label={`Actions for ${webhook.url}`} />}
                    items={
                      [
                        {
                          label: 'Edit',
                          icon: <TbEdit size={14} />,
                          onClick: () => setEditor(webhook)
                        },
                        {
                          label: 'Rotate secret',
                          icon: <TbKey size={14} />,
                          onClick: () => setRotateId(webhook.id)
                        },
                        {
                          label: 'Delete',
                          icon: <TbTrash size={14} />,
                          danger: true,
                          onClick: () => setDeleteId(webhook.id)
                        }
                      ] satisfies MenuItem[]
                    }
                  />
                </Table.ActionsCell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      )}
      <EditorDialog
        webhook={editor}
        schemas={schemas}
        pending={operations.create.isPending || operations.update.isPending}
        error={(operations.create.error ?? operations.update.error) as Error | null}
        onClose={() => setEditor(null)}
        onSave={input => void save(input)}
      />
      <SecretDialog secret={secret} onClose={() => setSecret(null)} />
      <Dialog
        open={rotateId != null}
        onClose={() => setRotateId(null)}
        title="Rotate webhook secret?"
        sub="The current secret will stop signing new attempts, including queued deliveries."
        buttons={[
          { label: 'Cancel', type: 'cancel', onClick: () => setRotateId(null) },
          {
            label: operations.rotateSecret.isPending ? 'Rotating…' : 'Rotate secret',
            type: 'default',
            disabled: operations.rotateSecret.isPending,
            onClick: () => {
              if (!rotateId) return;
              void operations.rotateSecret.mutateAsync(rotateId).then(result => {
                setRotateId(null);
                setSecret(result.secret);
              });
            }
          }
        ]}
      >
        <div className={styles.hint}>Update the receiving system before sending more events.</div>
      </Dialog>
      <DeleteConfirmationDialog
        open={deleteId != null}
        title="Delete webhook?"
        message="Queued deliveries for this webhook will be skipped."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (!deleteId) return;
          void operations.remove.mutateAsync(deleteId).then(() => setDeleteId(null));
        }}
      />
    </div>
  );
};
