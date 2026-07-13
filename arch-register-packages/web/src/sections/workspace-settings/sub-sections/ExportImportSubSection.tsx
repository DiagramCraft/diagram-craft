import { useState } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { TbDownload, TbUpload, TbFileZip, TbAlertCircle, TbAlertTriangle } from 'react-icons/tb';
import { orpcClient } from '../../../lib/orpcClient';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import styles from './ExportImportSubSection.module.css';
import { downloadBlob } from '../../../lib/browserDownload';

type ImportConflict = {
  type: 'config' | 'schemas' | 'entities' | 'projects' | 'content_nodes';
  item_id: string;
  item_name: string;
  conflict_reason: 'duplicate_name' | 'duplicate_slug' | 'missing_dependency' | 'schema_mismatch';
  existing_item?: Record<string, unknown>;
  import_item: Record<string, unknown>;
  suggested_resolution: 'skip' | 'merge' | 'overwrite' | 'rename';
};

type ImportParseResult = {
  valid: boolean;
  version: string;
  source_workspace: { id: string; name: string; url_slug: string };
  available_data_types: string[];
  summary: {
    config?: { lifecycle_states: number; teams: number; roles: number };
    schemas?: { count: number; conflicts: number };
    entities?: { count: number; conflicts: number };
    projects?: { count: number; conflicts: number };
    content_nodes?: { count: number; conflicts: number };
  };
  conflicts: ImportConflict[];
  errors: string[];
  warnings: string[];
  import_id?: string;
};

type ExportOptions = {
  include_config: boolean;
  include_schemas: boolean;
  include_entities: boolean;
  include_projects: boolean;
  include_content_nodes: boolean;
  include_content: boolean;
};

type ImportStatus = 'idle' | 'uploading' | 'parsing' | 'executing' | 'success' | 'error';
type ConflictResolution = { action: 'skip' | 'merge' | 'overwrite' | 'rename'; new_name?: string };

export const ExportImportSubSection = () => {
  const { workspace } = useWorkspaceContext();
  const [tab, setTab] = useState<'export' | 'import'>('export');

  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    include_config: true,
    include_schemas: true,
    include_entities: true,
    include_projects: true,
    include_content_nodes: true,
    include_content: true
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [importError, setImportError] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importSummary, setImportSummary] = useState<ImportParseResult | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [conflictResolutions, setConflictResolutions] = useState<
    Record<string, ConflictResolution>
  >({});

  const handleExport = async () => {
    if (!workspace) return;

    const include: Array<'config' | 'schemas' | 'entities' | 'projects' | 'content_nodes'> = [];
    if (exportOptions.include_config) include.push('config');
    if (exportOptions.include_schemas) include.push('schemas');
    if (exportOptions.include_entities) include.push('entities');
    if (exportOptions.include_projects) include.push('projects');
    if (exportOptions.include_content_nodes) include.push('content_nodes');

    if (include.length === 0) {
      setExportError('Please select at least one data type to export');
      return;
    }

    setIsExporting(true);
    setExportError(null);

    try {
      const response = await orpcClient.workspaces.export({
        params: { workspace: workspace.url_slug },
        body: {
          include,
          options: { include_content: exportOptions.include_content }
        }
      });

      const blob = response.body as Blob;
      const filename =
        response.headers['Content-Disposition']?.split('filename=')[1]?.replace(/"/g, '') ??
        `workspace-${workspace.url_slug}-export.zip`;
      downloadBlob(blob, filename);
    } catch (error) {
      console.error('Export failed:', error);
      setExportError(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.zip')) {
        setImportError('Please select a ZIP file');
        setImportFile(null);
        return;
      }

      const maxSize = 500 * 1024 * 1024;
      if (file.size > maxSize) {
        setImportError(
          `File size exceeds maximum allowed size of 500MB (${(file.size / 1024 / 1024).toFixed(2)}MB)`
        );
        setImportFile(null);
        return;
      }

      setImportFile(file);
      setImportError(null);
      setImportSummary(null);
      setImportStatus('idle');
      setImportId(null);
      setConflictResolutions({});
    }
  };

  const handleImportParse = async () => {
    if (!workspace || !importFile) return;

    setImportStatus('parsing');
    setImportError(null);

    try {
      const result = (await orpcClient.workspaces.importParse({
        params: { workspace: workspace.url_slug },
        body: { file: importFile }
      })) as ImportParseResult;

      if (!result.valid) {
        setImportError(
          result.errors.length > 0
            ? `Invalid import file: ${result.errors.join(', ')}`
            : 'Invalid import file format'
        );
        setImportStatus('error');
        return;
      }

      if ('import_id' in result) {
        setImportId(result.import_id!);
      } else {
        setImportError('Import ID not received from server');
        setImportStatus('error');
        return;
      }

      setImportSummary(result);
      setConflictResolutions({});
      setImportStatus('idle');
    } catch (error) {
      console.error('Import parse failed:', error);
      setImportError(
        error instanceof Error
          ? error.message
          : 'Failed to parse import file. Please ensure the file is a valid workspace export.'
      );
      setImportStatus('error');
    }
  };

  const handleImportExecute = async () => {
    if (!workspace || !importId) {
      setImportError('Import session expired. Please upload the file again.');
      return;
    }

    setImportStatus('executing');
    setImportError(null);

    try {
      const result = await orpcClient.workspaces.importExecute({
        params: { workspace: workspace.url_slug },
        body: {
          import_id: importId,
          include: ['config', 'schemas', 'entities', 'projects', 'content_nodes'],
          conflict_resolutions: conflictResolutions,
          options: { preserve_ids: false, update_references: true }
        }
      });

      if (!result.success || result.errors.length > 0) {
        setImportError(
          result.errors.length > 0
            ? `Import completed with errors: ${result.errors.join(', ')}`
            : 'Import failed'
        );
        setImportStatus('error');
        return;
      }

      if (result.warnings.length > 0) {
        console.warn('Import warnings:', result.warnings);
      }

      setImportStatus('success');
      setImportFile(null);
      setImportSummary(null);
      setImportId(null);
      setConflictResolutions({});

      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      console.error('Import execute failed:', error);
      setImportError(
        error instanceof Error
          ? error.message
          : 'Import failed. The import session may have expired. Please try uploading the file again.'
      );
      setImportStatus('error');
    }
  };

  const busy = importStatus === 'parsing' || importStatus === 'executing';
  const unresolvedConflicts =
    importSummary?.conflicts.filter(conflict => {
      const resolution = conflictResolutions[conflict.item_id];
      return !resolution || (resolution.action === 'rename' && !resolution.new_name?.trim());
    }) ?? [];

  return (
    <div className={styles.blockList}>
      <Tabs.Root value={tab} onValueChange={v => setTab(v as 'export' | 'import')}>
        <Tabs.List>
          <Tabs.Trigger value="export">Export</Tabs.Trigger>
          <Tabs.Trigger value="import">Import</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>

      {tab === 'export' && (
        <div className={styles.section}>
          <div className={styles.sectionBody}>
            <div className={styles.field}>
              <div className={styles.fieldLeft}>
                <div className={styles.fieldLabel}>Include</div>
                <div className={styles.fieldHint}>
                  Select the data types to include in the export.
                </div>
              </div>
              <div className={styles.fieldRight}>
                <div className={styles.checkboxGroup}>
                  <label className={styles.checkboxRow}>
                    <Checkbox
                      value={exportOptions.include_config}
                      onChange={v =>
                        setExportOptions(prev => ({ ...prev, include_config: v ?? false }))
                      }
                    />
                    <span>Configuration</span>
                    <span className={styles.checkboxHint}>lifecycle states, teams, roles</span>
                  </label>
                  <label className={styles.checkboxRow}>
                    <Checkbox
                      value={exportOptions.include_schemas}
                      onChange={v =>
                        setExportOptions(prev => ({ ...prev, include_schemas: v ?? false }))
                      }
                    />
                    <span>Schemas</span>
                    <span className={styles.checkboxHint}>entity types and fields</span>
                  </label>
                  <label className={styles.checkboxRow}>
                    <Checkbox
                      value={exportOptions.include_entities}
                      onChange={v =>
                        setExportOptions(prev => ({ ...prev, include_entities: v ?? false }))
                      }
                    />
                    <span>Entities</span>
                    <span className={styles.checkboxHint}>catalog data</span>
                  </label>
                  <label className={styles.checkboxRow}>
                    <Checkbox
                      value={exportOptions.include_projects}
                      onChange={v =>
                        setExportOptions(prev => ({ ...prev, include_projects: v ?? false }))
                      }
                    />
                    <span>Projects</span>
                    <span className={styles.checkboxHint}>project metadata</span>
                  </label>
                  <label className={styles.checkboxRow}>
                    <Checkbox
                      value={exportOptions.include_content_nodes}
                      onChange={v =>
                        setExportOptions(prev => ({ ...prev, include_content_nodes: v ?? false }))
                      }
                    />
                    <span>Content nodes</span>
                    <span className={styles.checkboxHint}>diagrams and markdown</span>
                  </label>
                  {exportOptions.include_content_nodes && (
                    <label className={`${styles.checkboxRow} ${styles.checkboxRowNested}`}>
                      <Checkbox
                        value={exportOptions.include_content}
                        onChange={v =>
                          setExportOptions(prev => ({ ...prev, include_content: v ?? false }))
                        }
                      />
                      <span>Include content files</span>
                      <span className={styles.checkboxHint}>actual diagram and document data</span>
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.actionRow}>
              {exportError && (
                <div className={styles.inlineError}>
                  <TbAlertCircle size={13} />
                  <span>{exportError}</span>
                </div>
              )}
              <Button onClick={handleExport} disabled={isExporting} icon={<TbDownload size={13} />}>
                {isExporting ? 'Exporting…' : 'Export workspace'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {tab === 'import' && (
        <div className={styles.section}>
          <div className={styles.sectionBody}>
            <div className={styles.field}>
              <div className={styles.fieldLeft}>
                <div className={styles.fieldLabel}>Import file</div>
                <div className={styles.fieldHint}>
                  Select a ZIP file previously exported from a workspace. Maximum 500&thinsp;MB.
                </div>
              </div>
              <div className={styles.fieldRight}>
                <div className={styles.fileDropArea}>
                  <TbFileZip size={16} className={styles.fileDropIcon} />
                  {importFile ? (
                    <span className={styles.fileName}>{importFile.name}</span>
                  ) : (
                    <span className={styles.filePlaceholder}>No file selected</span>
                  )}
                  {importFile && (
                    <span className={styles.fileSize}>
                      {(importFile.size / 1024 / 1024).toFixed(1)}&thinsp;MB
                    </span>
                  )}
                  <label className={styles.fileBrowse}>
                    Browse
                    <input
                      type="file"
                      accept=".zip"
                      onChange={handleFileSelect}
                      disabled={busy}
                      className={styles.fileInputHidden}
                    />
                  </label>
                </div>
              </div>
            </div>

            {importSummary && (
              <div className={styles.field}>
                <div className={styles.fieldLeft}>
                  <div className={styles.fieldLabel}>Preview</div>
                  <div className={styles.fieldHint}>Items found in the archive.</div>
                </div>
                <div className={styles.fieldRight}>
                  <div className={styles.summaryGrid}>
                    {importSummary.summary.config && (
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryCount}>
                          {importSummary.summary.config.lifecycle_states +
                            importSummary.summary.config.teams +
                            importSummary.summary.config.roles}
                        </span>
                        <span className={styles.summaryLabel}>config items</span>
                      </div>
                    )}
                    {importSummary.summary.schemas && (
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryCount}>
                          {importSummary.summary.schemas.count}
                        </span>
                        <span className={styles.summaryLabel}>schemas</span>
                      </div>
                    )}
                    {importSummary.summary.entities && (
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryCount}>
                          {importSummary.summary.entities.count}
                        </span>
                        <span className={styles.summaryLabel}>entities</span>
                      </div>
                    )}
                    {importSummary.summary.projects && (
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryCount}>
                          {importSummary.summary.projects.count}
                        </span>
                        <span className={styles.summaryLabel}>projects</span>
                      </div>
                    )}
                    {importSummary.summary.content_nodes && (
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryCount}>
                          {importSummary.summary.content_nodes.count}
                        </span>
                        <span className={styles.summaryLabel}>content nodes</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {importSummary && importSummary.conflicts.length > 0 && (
              <div className={styles.field}>
                <div className={styles.fieldLeft}>
                  <div className={styles.fieldLabel}>Conflicts</div>
                  <div className={styles.fieldHint}>
                    Choose how each matching item should be handled.
                  </div>
                </div>
                <div className={styles.fieldRight}>
                  <div className={styles.checkboxGroup}>
                    {importSummary.conflicts.map(conflict => (
                      <label key={conflict.item_id} className={styles.checkboxRow}>
                        <span>{conflict.item_name}</span>
                        <select
                          value={conflictResolutions[conflict.item_id]?.action ?? ''}
                          onChange={event =>
                            setConflictResolutions(previous => ({
                              ...previous,
                              [conflict.item_id]: {
                                action: event.target.value as ConflictResolution['action']
                              }
                            }))
                          }
                          disabled={busy}
                        >
                          <option value="" disabled>
                            Choose resolution
                          </option>
                          <option value="skip">Skip</option>
                          <option value="merge">Merge</option>
                          <option value="overwrite">Overwrite</option>
                          <option value="rename">Rename</option>
                        </select>
                        {conflictResolutions[conflict.item_id]?.action === 'rename' && (
                          <input
                            value={conflictResolutions[conflict.item_id]?.new_name ?? ''}
                            onChange={event =>
                              setConflictResolutions(previous => ({
                                ...previous,
                                [conflict.item_id]: {
                                  action: 'rename',
                                  new_name: event.target.value
                                }
                              }))
                            }
                            placeholder="New name"
                            disabled={busy}
                          />
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className={styles.actionRow}>
              {importError && (
                <div className={styles.inlineError}>
                  <TbAlertCircle size={13} />
                  <span>{importError}</span>
                </div>
              )}
              {importStatus === 'success' && (
                <div className={styles.inlineSuccess}>Import completed. Reloading…</div>
              )}
              <div className={styles.actionButtons}>
                {!importSummary && importFile && (
                  <Button
                    onClick={handleImportParse}
                    disabled={importStatus === 'parsing'}
                    icon={<TbUpload size={13} />}
                  >
                    {importStatus === 'parsing' ? 'Parsing…' : 'Preview import'}
                  </Button>
                )}
                {importSummary && (
                  <Button
                    onClick={handleImportExecute}
                    disabled={importStatus === 'executing' || unresolvedConflicts.length > 0}
                    variant="primary"
                    icon={<TbUpload size={13} />}
                  >
                    {importStatus === 'executing' ? 'Importing…' : 'Import now'}
                  </Button>
                )}
              </div>
              <div className={styles.warningNote}>
                <TbAlertTriangle size={13} />
                <span>Importing will overwrite existing data. This cannot be undone.</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
