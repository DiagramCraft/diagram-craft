import { useState } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { FormSection } from '@diagram-craft/app-components/FormSection';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { TbDownload, TbUpload, TbFileZip, TbAlertCircle } from 'react-icons/tb';
import { orpcClient } from '../../../lib/orpcClient';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import styles from './ExportImportSubSection.module.css';

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
  conflicts: any[];
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

export const ExportImportSubSection = () => {
  const { workspace } = useWorkspaceContext();
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

  const handleExport = async () => {
    if (!workspace) return;

    // Validation: At least one data type must be selected
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
          options: {
            include_content: exportOptions.include_content
          }
        }
      });

      // Create blob from response and trigger download
      const blob = response.body as Blob;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.headers['Content-Disposition']?.split('filename=')[1]?.replace(/"/g, '') || 
                   `workspace-${workspace.url_slug}-export.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
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
      // Validate file type
      if (!file.name.endsWith('.zip')) {
        setImportError('Please select a ZIP file');
        setImportFile(null);
        return;
      }

      // Validate file size (max 500MB)
      const maxSize = 500 * 1024 * 1024;
      if (file.size > maxSize) {
        setImportError(`File size exceeds maximum allowed size of 500MB (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
        setImportFile(null);
        return;
      }

      setImportFile(file);
      setImportError(null);
      setImportSummary(null);
      setImportStatus('idle');
      setImportId(null);
    }
  };

  const handleImportParse = async () => {
    if (!workspace || !importFile) return;

    setImportStatus('parsing');
    setImportError(null);

    try {
      const result = await orpcClient.workspaces.importParse({
        params: { workspace: workspace.url_slug },
        body: { file: importFile }
      }) as ImportParseResult;

      // Validate parse result
      if (!result.valid) {
        const errorMsg = result.errors.length > 0 
          ? `Invalid import file: ${result.errors.join(', ')}`
          : 'Invalid import file format';
        setImportError(errorMsg);
        setImportStatus('error');
        return;
      }

      // Store import_id if returned
      if ('import_id' in result) {
        setImportId(result.import_id!);
      } else {
        setImportError('Import ID not received from server');
        setImportStatus('error');
        return;
      }
      
      setImportSummary(result);
      setImportStatus('idle');
    } catch (error) {
      console.error('Import parse failed:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to parse import file. Please ensure the file is a valid workspace export.';
      setImportError(errorMessage);
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
          conflict_resolutions: {}, // Empty since we're overwriting
          options: {
            preserve_ids: false,
            update_references: true
          }
        }
      });

      // Check for errors in the result
      if (!result.success || result.errors.length > 0) {
        const errorMsg = result.errors.length > 0
          ? `Import completed with errors: ${result.errors.join(', ')}`
          : 'Import failed';
        setImportError(errorMsg);
        setImportStatus('error');
        return;
      }

      // Show warnings if any
      if (result.warnings.length > 0) {
        console.warn('Import warnings:', result.warnings);
      }

      setImportStatus('success');
      setImportFile(null);
      setImportSummary(null);
      setImportId(null);
      
      // Reload page to reflect imported data
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Import execute failed:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Import failed. The import session may have expired. Please try uploading the file again.';
      setImportError(errorMessage);
      setImportStatus('error');
    }
  };

  return (
    <div>
      {/* Export Section */}
      <FormSection title="Export Workspace">
        <p className="dim" style={{ marginBottom: '1rem' }}>
          Download a ZIP archive containing workspace data and content files.
        </p>
        <FormElement label="Data to Export">
          <div className={styles.checkboxGroup}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Checkbox
                value={exportOptions.include_config}
                onChange={v => setExportOptions(prev => ({ ...prev, include_config: v ?? false }))}
              />
              <span>Configuration (lifecycle states, teams, roles)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Checkbox
                value={exportOptions.include_schemas}
                onChange={v => setExportOptions(prev => ({ ...prev, include_schemas: v ?? false }))}
              />
              <span>Schemas (entity types and fields)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Checkbox
                value={exportOptions.include_entities}
                onChange={v => setExportOptions(prev => ({ ...prev, include_entities: v ?? false }))}
              />
              <span>Entities (catalog data)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Checkbox
                value={exportOptions.include_projects}
                onChange={v => setExportOptions(prev => ({ ...prev, include_projects: v ?? false }))}
              />
              <span>Projects (project metadata)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Checkbox
                value={exportOptions.include_content_nodes}
                onChange={v => setExportOptions(prev => ({ ...prev, include_content_nodes: v ?? false }))}
              />
              <span>Content Nodes (diagrams and markdown)</span>
            </label>
            {exportOptions.include_content_nodes && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '1.5rem' }}>
                <Checkbox
                  value={exportOptions.include_content}
                  onChange={v => setExportOptions(prev => ({ ...prev, include_content: v ?? false }))}
                />
                <span>Include actual content files</span>
              </label>
            )}
          </div>
        </FormElement>

        {exportError && (
          <div className={styles.errorMessage}>
            <TbAlertCircle size={16} />
            <span>{exportError}</span>
          </div>
        )}

        <Button
          onClick={handleExport}
          disabled={isExporting}
          icon={<TbDownload size={14} />}
        >
          {isExporting ? 'Exporting...' : 'Export Workspace'}
        </Button>
      </FormSection>

      {/* Import Section */}
      <FormSection title="Import Workspace">
        <p className="dim" style={{ marginBottom: '1rem' }}>
          Upload a ZIP archive to import data into this workspace. Existing data will be overwritten.
        </p>
        <FormElement label="Import File">
          <div className={styles.fileInput}>
            <input
              type="file"
              accept=".zip"
              onChange={handleFileSelect}
              disabled={importStatus === 'parsing' || importStatus === 'executing'}
            />
            {importFile && (
              <div className={styles.fileInfo}>
                <TbFileZip size={16} />
                <span>{importFile.name}</span>
                <span className="dim">({(importFile.size / 1024 / 1024).toFixed(2)} MB)</span>
              </div>
            )}
          </div>
        </FormElement>

        {importSummary && (
          <div className={styles.importSummary}>
            <h4>Import Preview</h4>
            <ul>
              {importSummary.summary.config && (
                <li>Configuration: {importSummary.summary.config.lifecycle_states} lifecycle states, {importSummary.summary.config.teams} teams, {importSummary.summary.config.roles} roles</li>
              )}
              {importSummary.summary.schemas && (
                <li>Schemas: {importSummary.summary.schemas.count}</li>
              )}
              {importSummary.summary.entities && (
                <li>Entities: {importSummary.summary.entities.count}</li>
              )}
              {importSummary.summary.projects && (
                <li>Projects: {importSummary.summary.projects.count}</li>
              )}
              {importSummary.summary.content_nodes && (
                <li>Content nodes: {importSummary.summary.content_nodes.count}</li>
              )}
            </ul>
          </div>
        )}

        {importError && (
          <div className={styles.errorMessage}>
            <TbAlertCircle size={16} />
            <span>{importError}</span>
          </div>
        )}

        {importStatus === 'success' && (
          <div className={styles.successMessage}>
            Import completed successfully! Reloading page...
          </div>
        )}

        <div className={styles.importActions}>
          {!importSummary && importFile && (
            <Button
              onClick={handleImportParse}
              disabled={importStatus === 'parsing'}
              icon={<TbUpload size={14} />}
            >
              {importStatus === 'parsing' ? 'Parsing...' : 'Preview Import'}
            </Button>
          )}
          {importSummary && (
            <Button
              onClick={handleImportExecute}
              disabled={importStatus === 'executing'}
              variant="primary"
              icon={<TbUpload size={14} />}
            >
              {importStatus === 'executing' ? 'Importing...' : 'Import Now'}
            </Button>
          )}
        </div>

        <div className={styles.warning}>
          <TbAlertCircle size={16} />
          <span>
            <strong>Warning:</strong> Importing will overwrite existing data in this workspace.
            This action cannot be undone.
          </span>
        </div>
      </FormSection>
    </div>
  );
};
