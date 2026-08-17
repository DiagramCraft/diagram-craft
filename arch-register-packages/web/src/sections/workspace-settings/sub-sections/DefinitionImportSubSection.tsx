import { useMemo, useState } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TbAlertCircle, TbCheck, TbEye, TbLoader } from 'react-icons/tb';
import type {
  DefinitionImportPreview,
  DefinitionImportRename,
  DefinitionImportSelection,
  DefinitionImportSource
} from '@arch-register/api-types/workspaceContract';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { orpcClient } from '../../../lib/orpcClient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  definitionImportSourcesQuery,
  invalidateDefinitionImportQueries
} from '../../../queries/definitionImports';
import styles from './ExportImportSubSection.module.css';

const sourceKey = (source: DefinitionImportSource) => `${source.kind}:${source.id}`;

const emptySelection: DefinitionImportSelection = {
  schemas: [],
  enums: [],
  documentTypes: [],
  relationSchemas: [],
  fieldGroups: [],
  dashboard: false
};

const selectionKinds = [
  'schemas',
  'enums',
  'documentTypes',
  'relationSchemas',
  'fieldGroups'
] as const;

const kindLabels: Record<(typeof selectionKinds)[number], string> = {
  schemas: 'Schemas',
  enums: 'Enums',
  documentTypes: 'Active document types',
  relationSchemas: 'Relation schemas',
  fieldGroups: 'Field groups'
};

const summaryLabels: Record<(typeof selectionKinds)[number], string> = {
  schemas: 'schemas',
  enums: 'enums',
  documentTypes: 'document types',
  relationSchemas: 'relation schemas',
  fieldGroups: 'field groups'
};

const typeLabels: Record<(typeof selectionKinds)[number], string> = {
  schemas: 'Schema',
  enums: 'Enum',
  documentTypes: 'Document type',
  relationSchemas: 'Relation schema',
  fieldGroups: 'Field group'
};

const conflictKindByKind: Record<(typeof selectionKinds)[number], DefinitionImportRename['kind']> =
  {
    schemas: 'schema',
    enums: 'enum',
    documentTypes: 'documentType',
    relationSchemas: 'relationSchema',
    fieldGroups: 'fieldGroup'
  };

export const DefinitionImportSubSection = () => {
  const { workspaceSlug, permissions } = useWorkspaceContext();
  const queryClient = useQueryClient();
  const [sourceKeyValue, setSourceKeyValue] = useState('');
  const [selection, setSelection] = useState<DefinitionImportSelection>(emptySelection);
  const [renames, setRenames] = useState<DefinitionImportRename[]>([]);
  const [preview, setPreview] = useState<DefinitionImportPreview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sourcesQuery = useQuery(
    definitionImportSourcesQuery(workspaceSlug, permissions.canAdministerWorkspace ?? false)
  );

  const source = useMemo(() => {
    return sourcesQuery.data?.find(
      item => sourceKey({ kind: item.kind, id: item.id }) === sourceKeyValue
    );
  }, [sourceKeyValue, sourcesQuery.data]);

  const previewMutation = useMutation({
    mutationFn: () =>
      orpcClient.workspaces.definitionImportPreview({
        params: { workspace: workspaceSlug },
        body: { source: { kind: source!.kind, id: source!.id }, selection, renames }
      }),
    onSuccess: result => {
      setPreview(result as DefinitionImportPreview);
      setRenames((result as DefinitionImportPreview).renames);
      setConfirmed(false);
      setError(null);
    },
    onError: mutationError =>
      setError(mutationError instanceof Error ? mutationError.message : 'Preview failed')
  });

  const executeMutation = useMutation({
    mutationFn: () =>
      orpcClient.workspaces.definitionImportExecute({
        params: { workspace: workspaceSlug },
        body: {
          source: preview!.source,
          selection: preview!.selection,
          renames: preview!.renames,
          schemas: preview!.schemas,
          enums: preview!.enums,
          documentTypes: preview!.documentTypes,
          relationSchemas: preview!.relationSchemas,
          fieldGroups: preview!.fieldGroups,
          dashboardWidgets: preview!.dashboardWidgets,
          keyPrefixRemaps: preview!.keyPrefixRemaps,
          fingerprint: preview!.fingerprint,
          confirmed: true
        }
      }),
    onSuccess: async () => {
      await invalidateDefinitionImportQueries(queryClient, workspaceSlug);
      setPreview(null);
      setSelection(emptySelection);
      setRenames([]);
      setConfirmed(false);
      setError(null);
    },
    onError: mutationError =>
      setError(mutationError instanceof Error ? mutationError.message : 'Import failed')
  });

  const toggle = (kind: (typeof selectionKinds)[number], id: string, value: boolean) => {
    setSelection(previous => ({
      ...previous,
      [kind]: value ? [...previous[kind], id] : previous[kind].filter(item => item !== id)
    }));
    setPreview(null);
    setConfirmed(false);
  };

  const toggleDashboard = (value: boolean) => {
    setSelection(previous => ({ ...previous, dashboard: value }));
    setPreview(null);
    setConfirmed(false);
  };

  if (!permissions.canAdministerWorkspace) {
    return (
      <div className={styles.warningNote}>
        Definition import requires workspace administrator access.
      </div>
    );
  }

  if (sourcesQuery.isLoading)
    return <div className={styles.warningNote}>Loading import sources…</div>;
  if (sourcesQuery.error) {
    return (
      <div className={styles.inlineError}>
        <TbAlertCircle size={13} />
        Unable to load import sources.
      </div>
    );
  }

  const canPreview = !!source && selectionKinds.some(kind => selection[kind].length > 0);
  const canExecute =
    !!preview && preview.errors.length === 0 && preview.conflicts.length === 0 && confirmed;

  return (
    <div className={styles.section}>
      <div className={styles.sectionBody}>
        <div className={styles.field}>
          <div className={styles.fieldLeft}>
            <div className={styles.fieldLabel}>Source</div>
            <div className={styles.fieldHint}>
              Choose one built-in template or an administered workspace.
            </div>
          </div>
          <div className={styles.fieldRight}>
            <Select.Root
              value={sourceKeyValue || undefined}
              placeholder="Select a source"
              onChange={value => {
                setSourceKeyValue(value ?? '');
                setSelection(emptySelection);
                setRenames([]);
                setPreview(null);
                setConfirmed(false);
              }}
            >
              {sourcesQuery.data?.map(item => (
                <Select.Item
                  key={sourceKey({ kind: item.kind, id: item.id })}
                  value={sourceKey({ kind: item.kind, id: item.id })}
                >
                  {item.kind === 'builtin'
                    ? `${item.category === 'cross-cutting' ? 'Cross-cutting concern' : 'Full template'}: `
                    : 'Workspace: '}
                  {item.name}
                </Select.Item>
              ))}
            </Select.Root>
          </div>
        </div>

        {source &&
          selectionKinds.map(kind => {
            const label = kindLabels[kind];
            const items = source[kind];
            return (
              <div className={styles.field} key={kind}>
                <div className={styles.fieldLeft}>
                  <div className={styles.fieldLabel}>{label}</div>
                  <div className={styles.fieldHint}>
                    Dependencies are added automatically during preview.
                  </div>
                </div>
                <div className={styles.fieldRight}>
                  <div className={styles.checkboxGroup}>
                    {items.map(item => (
                      <label className={styles.checkboxRow} key={item.id}>
                        <Checkbox
                          value={selection[kind].includes(item.id)}
                          onChange={value => toggle(kind, item.id, value ?? false)}
                        />
                        <span>{item.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

        {source && source.dashboardWidgets.length > 0 && (
          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>Dashboard layout</div>
              <div className={styles.fieldHint}>
                {source.category === 'cross-cutting'
                  ? `Add ${source.dashboardWidgets.length} widgets to a new ${source.name} dashboard.`
                  : `Optionally replace the default dashboard with ${source.dashboardWidgets.length} template widgets.`}
              </div>
            </div>
            <div className={styles.fieldRight}>
              <label className={styles.checkboxRow}>
                <Checkbox
                  value={selection.dashboard}
                  onChange={value => toggleDashboard(value ?? false)}
                />
                <span>Import dashboard layout</span>
              </label>
            </div>
          </div>
        )}

        {preview && (
          <div className={styles.field}>
            <div className={styles.fieldLeft}>
              <div className={styles.fieldLabel}>Preview</div>
              <div className={styles.fieldHint}>Review every object before creating anything.</div>
            </div>
            <div className={styles.fieldRight}>
              <div className={styles.summaryGrid}>
                {selectionKinds.map(kind => (
                  <div className={styles.summaryItem} key={kind}>
                    <span className={styles.summaryCount}>{preview[kind].length}</span>
                    <span className={styles.summaryLabel}>{summaryLabels[kind]}</span>
                  </div>
                ))}
                <div className={styles.summaryItem}>
                  <span className={styles.summaryCount}>{preview.dashboardWidgets.length}</span>
                  <span className={styles.summaryLabel}>dashboard widgets</span>
                </div>
              </div>
              {preview.errors.length > 0 && (
                <div className={styles.previewMessages}>
                  <div className={styles.inlineError}>
                    <TbAlertCircle size={13} />
                    {preview.errors.join('; ')}
                  </div>
                </div>
              )}
              <div className={styles.previewTable}>
                <div className={styles.previewTableHeader}>
                  <span>Name</span>
                  <span>Status</span>
                  <span>Rename</span>
                </div>
                {selectionKinds.flatMap(kind =>
                  preview[kind].map(item => {
                    const conflictKind = conflictKindByKind[kind];
                    const conflict = preview.conflicts.find(
                      candidate => candidate.kind === conflictKind && candidate.id === item.id
                    );
                    const rename = renames.find(
                      candidate => candidate.kind === conflictKind && candidate.id === item.id
                    );
                    const prefixRemap =
                      kind === 'schemas'
                        ? preview.keyPrefixRemaps.find(candidate => candidate.sourceId === item.id)
                        : undefined;
                    const typeLabel = typeLabels[kind];

                    return (
                      <div className={styles.previewTableRow} key={`${kind}:${item.id}`}>
                        <div className={styles.previewName}>
                          <span>{item.name}</span>
                          <span className={styles.previewType}>{typeLabel}</span>
                        </div>
                        <div className={styles.previewStatus}>
                          <span
                            className={
                              conflict
                                ? styles.previewStatusConflict
                                : item.dependency
                                  ? styles.previewStatusDependency
                                  : styles.previewStatusReady
                            }
                          >
                            {conflict && <TbAlertCircle size={13} />}
                            {conflict
                              ? `Conflict with ${conflict.existingName}`
                              : item.dependency
                                ? 'Dependency'
                                : 'Selected'}
                          </span>
                          {prefixRemap && (
                            <span className={styles.previewStatusDetail}>
                              Prefix {prefixRemap.from} → {prefixRemap.to}
                            </span>
                          )}
                        </div>
                        <div className={styles.previewRename}>
                          {conflict ? (
                            <TextInput
                              value={rename?.name ?? ''}
                              placeholder="New name"
                              onChange={value => {
                                const name = value ?? '';
                                setRenames(previous => [
                                  ...previous.filter(
                                    candidate =>
                                      !(
                                        candidate.kind === conflict.kind &&
                                        candidate.id === conflict.id
                                      )
                                  ),
                                  ...(name.trim()
                                    ? [{ kind: conflict.kind, id: conflict.id, name }]
                                    : [])
                                ]);
                              }}
                            />
                          ) : (
                            <span className={styles.previewRenameEmpty}>—</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {preview.conflicts.length > 0 && (
                <div className={styles.warningNote}>
                  Enter a unique new name for each conflict, then preview again.
                </div>
              )}
              {preview.errors.length === 0 && preview.conflicts.length === 0 && (
                <label className={styles.checkboxRow} style={{ marginTop: 12 }}>
                  <Checkbox value={confirmed} onChange={value => setConfirmed(value ?? false)} />
                  <span>I confirm that these definitions will be created in this workspace.</span>
                </label>
              )}
            </div>
          </div>
        )}

        <div className={styles.actionRow}>
          {error && (
            <div className={styles.inlineError}>
              <TbAlertCircle size={13} />
              {error}
            </div>
          )}
          <div className={styles.actionButtons}>
            <Button
              onClick={() => previewMutation.mutate()}
              disabled={!canPreview || previewMutation.isPending || executeMutation.isPending}
              icon={previewMutation.isPending ? <TbLoader size={13} /> : <TbEye size={13} />}
            >
              {previewMutation.isPending ? 'Preparing preview…' : 'Preview import'}
            </Button>
            <Button
              onClick={() => executeMutation.mutate()}
              disabled={!canExecute || executeMutation.isPending}
              icon={executeMutation.isPending ? <TbLoader size={13} /> : <TbCheck size={13} />}
            >
              {executeMutation.isPending ? 'Importing…' : 'Confirm and import'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
