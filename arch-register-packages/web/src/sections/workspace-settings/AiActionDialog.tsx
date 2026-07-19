import { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Select } from '@diagram-craft/app-components/Select';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { Button } from '@diagram-craft/app-components/Button';
import type {
  AiActionTestResult,
  DocumentListItem
} from '@arch-register/api-types/projectContract';
import {
  DOCUMENT_AI_READ_ONLY_TOOLS,
  type DocumentAiAction,
  type DocumentAiToolId,
  type DocumentField
} from '@arch-register/api-types/documentContract';
import { useDocumentList } from '../../hooks/useDocuments';
import { testDocumentAiAction } from '../../hooks/useDocumentAiActions';
import { SafeMarkdown } from '../../components/SafeMarkdown';
import { DialogContent, DialogSection } from '../markdown/editor/BlockDialog';
import styles from './AiActionDialog.module.css';

const KIND_LABELS: Record<DocumentAiAction['kind'], string> = {
  interactive: 'Interactive',
  metadata_generator: 'Metadata generator'
};

const ALL_TOOL_IDS: DocumentAiToolId[] = DOCUMENT_AI_READ_ONLY_TOOLS.map(tool => tool.id);

const isLinkType = (field: DocumentField) =>
  field.type === 'entity_link' || field.type === 'document_link';

const scopeLabel = (document: DocumentListItem) => {
  if (document.scope === 'project') return 'Project document';
  if (document.scope === 'entity') return 'Entity document';
  return 'Workspace document';
};

type MetadataOutput = {
  value: unknown;
  reason: string | null;
  findings: string[];
};

const parseMetadataOutput = (rawOutput: string, parsedValue: unknown): MetadataOutput | null => {
  try {
    const parsed: unknown = JSON.parse(rawOutput);
    if (typeof parsed !== 'object' || parsed === null || !('value' in parsed)) return null;

    const response = parsed as { value: unknown; reason?: unknown; findings?: unknown };
    return {
      value: response.value,
      reason: typeof response.reason === 'string' ? response.reason : null,
      findings: Array.isArray(response.findings)
        ? response.findings.filter((finding): finding is string => typeof finding === 'string')
        : []
    };
  } catch {
    return parsedValue === null ? null : { value: parsedValue, reason: null, findings: [] };
  }
};

export const AiActionDialog = ({
  open,
  onClose,
  onSave,
  workspaceSlug,
  documentTypeId,
  action,
  fields,
  claimedFieldIds
}: {
  open: boolean;
  onClose: () => void;
  onSave: (action: DocumentAiAction) => void;
  workspaceSlug: string;
  documentTypeId: string | null;
  action: DocumentAiAction | null;
  fields: DocumentField[];
  claimedFieldIds: ReadonlySet<string>;
}) => {
  const [draft, setDraft] = useState<DocumentAiAction | null>(null);
  const [query, setQuery] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<DocumentListItem | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [result, setResult] = useState<AiActionTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState<'edit' | 'test'>('edit');

  const eligibleFields = useMemo(
    () =>
      fields.filter(
        field => !field.retired && !isLinkType(field) && !claimedFieldIds.has(field.id)
      ),
    [claimedFieldIds, fields]
  );

  const { data: documents = [], isLoading: documentsLoading } = useDocumentList(
    workspaceSlug,
    { q: query, documentTypeId: documentTypeId ?? undefined, limit: 50 },
    { enabled: open && !!documentTypeId && !!query.trim() }
  );

  useEffect(() => {
    if (!open) return;
    setDraft(
      action
        ? { ...action, tools: action.tools ?? [...ALL_TOOL_IDS] }
        : {
            id: crypto.randomUUID(),
            name: '',
            kind: 'interactive',
            prompt: '',
            enabled: true,
            tools: [...ALL_TOOL_IDS]
          }
    );
    setQuery('');
    setSelectedDocument(null);
    setStreamingText('');
    setResult(null);
    setError(null);
    setRunning(false);
    setTab('edit');
  }, [action, open]);

  const updateKind = (kind: string | undefined) => {
    if (!draft || (kind !== 'interactive' && kind !== 'metadata_generator')) return;
    if (kind === 'interactive') {
      setDraft({
        id: draft.id,
        name: draft.name,
        prompt: draft.prompt,
        enabled: draft.enabled,
        tools: draft.tools,
        kind: 'interactive'
      });
      return;
    }
    setDraft({
      id: draft.id,
      name: draft.name,
      prompt: draft.prompt,
      enabled: draft.enabled,
      tools: draft.tools,
      kind: 'metadata_generator',
      outputFieldId:
        draft.kind === 'metadata_generator' && draft.outputFieldId
          ? draft.outputFieldId
          : (eligibleFields[0]?.id ?? '')
    });
  };

  const runTest = async () => {
    if (!draft || !documentTypeId || !selectedDocument || running) return;
    setRunning(true);
    setStreamingText('');
    setResult(null);
    setError(null);
    try {
      const next = await testDocumentAiAction(
        workspaceSlug,
        selectedDocument.file.id,
        documentTypeId,
        draft,
        delta => setStreamingText(current => current + delta)
      );
      setResult(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to test AI action');
    } finally {
      setRunning(false);
    }
  };

  const canSave =
    draft !== null &&
    draft.name.trim().length > 0 &&
    draft.prompt.trim().length > 0 &&
    (draft.kind !== 'metadata_generator' || draft.outputFieldId.length > 0);

  const saveDraft = () => {
    if (!draft) return;
    const selectedTools = draft.tools ?? ALL_TOOL_IDS;
    const nextDraft: DocumentAiAction = { ...draft, tools: [...selectedTools] };
    if (
      selectedTools.length === ALL_TOOL_IDS.length &&
      ALL_TOOL_IDS.every(toolId => selectedTools.includes(toolId))
    ) {
      delete nextDraft.tools;
    }
    onSave(nextDraft);
  };

  const displayOutput = result?.rawOutput ?? streamingText;
  const metadataOutput =
    result?.kind === 'metadata_generator'
      ? parseMetadataOutput(result.rawOutput, result.parsedValue)
      : null;
  const testDisabled =
    running ||
    !draft ||
    !documentTypeId ||
    !selectedDocument ||
    draft.name.trim().length === 0 ||
    draft.prompt.trim().length === 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={action ? 'Edit AI action' : 'Add AI action'}
      width="min(760px, calc(100vw - 48px))"
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        {
          label: action ? 'Save changes' : 'Add action',
          type: 'default',
          onClick: saveDraft,
          disabled: !canSave || running
        }
      ]}
    >
      {draft && (
        <DialogContent>
          <Tabs.Root value={tab} onValueChange={value => setTab(value as 'edit' | 'test')}>
            <Tabs.List aria-label="AI action dialog sections">
              <Tabs.Trigger value="edit">Edit action</Tabs.Trigger>
              <Tabs.Trigger value="test">Test action</Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="edit" style={{ height: 'auto' }}>
              <div className={styles.editContent}>
                <div className={styles.formGrid}>
                  <DialogSection label="Name">
                    <TextInput
                      value={draft.name}
                      onChange={value => setDraft({ ...draft, name: value ?? '' })}
                      placeholder="Action name"
                      style={{ width: '100%' }}
                    />
                  </DialogSection>
                  <DialogSection label="Type">
                    <Select.Root value={draft.kind} onChange={updateKind} style={{ width: '100%' }}>
                      {Object.entries(KIND_LABELS).map(([value, label]) => (
                        <Select.Item key={value} value={value}>
                          {label}
                        </Select.Item>
                      ))}
                    </Select.Root>
                  </DialogSection>
                </div>

                <DialogSection label="Prompt">
                  <TextArea
                    value={draft.prompt}
                    onChange={value => setDraft({ ...draft, prompt: value ?? '' })}
                    rows={5}
                    style={{ width: '100%' }}
                    placeholder="Instructions for the AI action"
                  />
                </DialogSection>

                <DialogSection label="Available tools">
                  <div className={styles.toolList}>
                    {DOCUMENT_AI_READ_ONLY_TOOLS.map(tool => (
                      <label key={tool.id} className={styles.toolRow}>
                        <Checkbox
                          value={draft.tools?.includes(tool.id) ?? true}
                          onChange={value => {
                            const selectedTools = draft.tools ?? ALL_TOOL_IDS;
                            const nextTools = value
                              ? [...selectedTools, tool.id]
                              : selectedTools.filter(toolId => toolId !== tool.id);
                            setDraft({ ...draft, tools: [...new Set(nextTools)] });
                          }}
                        />
                        <span>
                          <span className={styles.toolLabel}>{tool.label}</span>
                          <span className={styles.toolDescription}>{tool.description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className={styles.hint}>
                    The selected tools are still limited by the initiating user&apos;s permissions.
                    Select none to run this action without architecture tools.
                  </div>
                </DialogSection>

                {draft.kind === 'metadata_generator' && (
                  <DialogSection label="Output field">
                    {eligibleFields.length > 0 || draft.outputFieldId ? (
                      <Select.Root
                        value={draft.outputFieldId}
                        onChange={value => setDraft({ ...draft, outputFieldId: value ?? '' })}
                        style={{ width: '100%' }}
                      >
                        {eligibleFields
                          .concat(
                            fields.filter(
                              field =>
                                field.id === draft.outputFieldId && !eligibleFields.includes(field)
                            )
                          )
                          .map(field => (
                            <Select.Item key={field.id} value={field.id}>
                              {field.name}
                            </Select.Item>
                          ))}
                      </Select.Root>
                    ) : (
                      <div className={styles.hint}>
                        Add a text, long text, boolean, date, number, or enum field first.
                      </div>
                    )}
                  </DialogSection>
                )}

                <div className={styles.enabledRow}>
                  <Checkbox
                    value={draft.enabled}
                    onChange={value => setDraft({ ...draft, enabled: value ?? false })}
                  />
                  <span>Enabled for production</span>
                  {!draft.enabled && (
                    <span className={styles.hint}>Testing is still available.</span>
                  )}
                </div>
              </div>
            </Tabs.Content>

            <Tabs.Content value="test" style={{ height: 'auto' }}>
              <div className={styles.testHeader}>
                <div>
                  <div className={styles.testTitle}>Test the current action draft</div>
                  <div className={styles.hint}>
                    Choose an accessible document of this type. Testing does not save any changes.
                  </div>
                </div>
                <Button variant="primary" onClick={() => void runTest()} disabled={testDisabled}>
                  {running ? 'Testing…' : 'Test action'}
                </Button>
              </div>

              <DialogSection label="Test document">
                {!documentTypeId ? (
                  <div className={styles.hint}>
                    Save this document type before testing an action.
                  </div>
                ) : (
                  <>
                    {selectedDocument && !query && (
                      <button
                        type="button"
                        className={styles.selectedDocument}
                        onClick={() => setSelectedDocument(null)}
                      >
                        <span>{selectedDocument.file.name}</span>
                        <span className={styles.hint}>Clear</span>
                      </button>
                    )}
                    <TextInput
                      value={query}
                      onChange={value => setQuery(value ?? '')}
                      placeholder="Search documents of this type…"
                      style={{ width: '100%' }}
                    />
                    {query.trim() && (
                      <div className={styles.documentResults}>
                        {documentsLoading && <div className={styles.hint}>Searching…</div>}
                        {!documentsLoading && documents.length === 0 && (
                          <div className={styles.hint}>No matching documents found.</div>
                        )}
                        {documents.map(document => (
                          <button
                            type="button"
                            key={document.file.id}
                            className={styles.documentResult}
                            onClick={() => {
                              setSelectedDocument(document);
                              setQuery('');
                              setResult(null);
                              setStreamingText('');
                            }}
                          >
                            <span>{document.file.name}</span>
                            <span className={styles.hint}>{scopeLabel(document)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </DialogSection>

              {(running || displayOutput.length > 0 || error || result) && (
                <div className={styles.result}>
                  <div className={styles.resultTitle}>
                    {running ? 'Running test…' : 'Test result'}
                  </div>
                  {running && displayOutput.length === 0 && (
                    <div className={styles.hint}>Waiting for output…</div>
                  )}
                  {displayOutput.length > 0 && (
                    <div className={styles.output}>
                      {(result?.kind ?? draft.kind) === 'interactive' ? (
                        <SafeMarkdown text={displayOutput} />
                      ) : metadataOutput ? (
                        <div className={styles.metadataOutput}>
                          <div className={styles.metadataField}>
                            <div className={styles.metadataLabel}>Value</div>
                            <code className={styles.metadataValue}>
                              {JSON.stringify(metadataOutput.value)}
                            </code>
                          </div>
                          {metadataOutput.reason && (
                            <div className={styles.metadataField}>
                              <div className={styles.metadataLabel}>Reason</div>
                              <div>{metadataOutput.reason}</div>
                            </div>
                          )}
                          {metadataOutput.findings.length > 0 && (
                            <div className={styles.metadataField}>
                              <div className={styles.metadataLabel}>Findings</div>
                              <ul className={styles.metadataFindings}>
                                {metadataOutput.findings.map((finding, index) => (
                                  <li key={`${finding}-${index}`}>{finding}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ) : (
                        <pre>{displayOutput}</pre>
                      )}
                    </div>
                  )}
                  {error && <div className={styles.error}>{error}</div>}
                  {result && (
                    <>
                      <div className={styles.details}>
                        {result.provider} · {result.model} · {result.durationMs} ms ·{' '}
                        {result.status}
                      </div>
                      {result.kind === 'metadata_generator' &&
                        !metadataOutput &&
                        result.parsedValue !== null && (
                          <div className={styles.parsedValue}>
                            Parsed value: <code>{JSON.stringify(result.parsedValue)}</code>
                          </div>
                        )}
                      {result.errors.length > 0 && (
                        <div className={styles.errorList}>
                          {result.errors.map((message, index) => (
                            <div key={`${message}-${index}`}>{message}</div>
                          ))}
                        </div>
                      )}
                      {result.toolCalls.length > 0 && (
                        <div className={styles.details}>
                          Tools:{' '}
                          {result.toolCalls.map(tool => `${tool.name} (${tool.status})`).join(', ')}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </Tabs.Content>
          </Tabs.Root>
        </DialogContent>
      )}
    </Dialog>
  );
};
