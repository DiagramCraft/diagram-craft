import React, { useState, useRef, useCallback } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  TbFileImport,
  TbFileUpload,
  TbCheck,
  TbUpload,
  TbChevronRight,
  TbX,
  TbAlertCircle,
  TbPlus
} from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Select } from '@diagram-craft/app-components/Select';
import styles from './ImportScreen.module.css';
import { useWorkspaceContext } from '../layouts/WorkspaceContext';
import { downloadCsvTemplate, parseCsvImport, commitCsvImport } from '../api';
import { entityKeys } from '../hooks/useEntities';
import { schemaKeys } from '../hooks/useSchemas';

type Phase = 'upload' | 'parsing' | 'review' | 'done';

type ParsedRow = {
  rowNumber: number;
  errors: string[];
  entity: Record<string, unknown> | null;
  accepted: boolean;
  expanded: boolean;
  isUpdate: boolean;
  existingId?: string;
  existingEntity?: Record<string, unknown> | null;
};

type CommittedEntity = {
  id: string;
  name: string;
};

const STEPS = [
  { key: 'upload', label: 'Upload' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Import' }
] as const;

const Stepper = ({ phase }: { phase: Phase }) => {
  const phaseIdx = phase === 'parsing' ? 0 : STEPS.findIndex(s => s.key === phase);
  return (
    <div className={styles.stepper}>
      {STEPS.map((s, i) => {
        const done = i < phaseIdx;
        const active = i === phaseIdx;
        return (
          <span key={s.key} className={styles.stepperItem}>
            {i > 0 && <span className={`${styles.stepLine} ${done ? styles.stepLineDone : ''}`} />}
            <span
              className={`${styles.step} ${active ? styles.stepActive : ''} ${done ? styles.stepDone : ''}`}
            >
              <span className={styles.stepNum}>{done ? <TbCheck size={10} /> : i + 1}</span>
              <span className={styles.stepLabel}>{s.label}</span>
            </span>
          </span>
        );
      })}
    </div>
  );
};

const ExpandedDetail = ({ row }: { row: ParsedRow }) => {
  if (!row.entity) return null;

  const formatFieldLabel = (key: string) => {
    if (key.startsWith('_')) {
      // Remove _ prefix and capitalize for metadata fields
      return key.substring(1).charAt(0).toUpperCase() + key.substring(2);
    }
    return key;
  };

  const formatValue = (value: unknown) => {
    if (value === undefined || value === null || value === '') {
      return <em className={styles.emptyValue}>(empty)</em>;
    }
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return String(value);
  };

  // For updates, show before/after comparison
  if (row.isUpdate && row.existingEntity) {
    const newEntity = row.entity;
    const oldEntity = row.existingEntity;
    
    // Get all keys from both entities
    const allKeys = new Set([
      ...Object.keys(newEntity),
      ...Object.keys(oldEntity)
    ]);
    
    // Separate metadata and custom fields
    const metadataKeys = Array.from(allKeys).filter(k => k.startsWith('_')).sort();
    const customKeys = Array.from(allKeys).filter(k => !k.startsWith('_')).sort();
    
    // Only show fields that have changed
    const changedMetadata = metadataKeys.filter(key => {
      const oldVal = oldEntity[key];
      const newVal = newEntity[key];
      return JSON.stringify(oldVal) !== JSON.stringify(newVal);
    });
    
    const changedCustom = customKeys.filter(key => {
      const oldVal = oldEntity[key];
      const newVal = newEntity[key];
      return JSON.stringify(oldVal) !== JSON.stringify(newVal);
    });
    
    if (changedMetadata.length === 0 && changedCustom.length === 0) {
      return <div className={styles.detailContainer}>No changes detected</div>;
    }
    
    return (
      <div className={styles.detailContainer}>
        {changedMetadata.length > 0 && (
          <div className={styles.detailSection}>
            <div className={styles.sectionTitle}>Metadata</div>
            {changedMetadata.map(key => (
              <div key={key} className={styles.detailFieldWide}>
                <div className={styles.detailLabel}>{formatFieldLabel(key)}</div>
                <div className={styles.comparisonRow}>
                  <div className={styles.beforeAfter}>
                    <div className={styles.beforeLabel}>Before:</div>
                    <div className={styles.oldValue}>{formatValue(oldEntity[key])}</div>
                  </div>
                  <div className={styles.beforeAfter}>
                    <div className={styles.afterLabel}>After:</div>
                    <div className={styles.newValue}>{formatValue(newEntity[key])}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {changedCustom.length > 0 && (
          <div className={styles.detailSection}>
            <div className={styles.sectionTitle}>Fields</div>
            {changedCustom.map(key => (
              <div key={key} className={styles.detailFieldWide}>
                <div className={styles.detailLabel}>{formatFieldLabel(key)}</div>
                <div className={styles.comparisonRow}>
                  <div className={styles.beforeAfter}>
                    <div className={styles.beforeLabel}>Before:</div>
                    <div className={styles.oldValue}>{formatValue(oldEntity[key])}</div>
                  </div>
                  <div className={styles.beforeAfter}>
                    <div className={styles.afterLabel}>After:</div>
                    <div className={styles.newValue}>{formatValue(newEntity[key])}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  
  // For creates, show all fields including metadata
  const allEntries = Object.entries(row.entity).filter(
    ([_k, v]) => v !== undefined && v !== '' && v !== null
  );
  
  // Separate metadata and custom fields
  const metadataEntries = allEntries.filter(([k]) => k.startsWith('_')).sort(([a], [b]) => a.localeCompare(b));
  const customEntries = allEntries.filter(([k]) => !k.startsWith('_')).sort(([a], [b]) => a.localeCompare(b));
  
  if (metadataEntries.length === 0 && customEntries.length === 0) return null;
  
  return (
    <div className={styles.detailContainer}>
      {metadataEntries.length > 0 && (
        <div className={styles.detailSection}>
          <div className={styles.sectionTitle}>Metadata</div>
          <div className={styles.detailGrid}>
            {metadataEntries.map(([key, value]) => (
              <div key={key} className={styles.detailField}>
                <div className={styles.detailLabel}>{formatFieldLabel(key)}</div>
                <div className={styles.detailValue}>{formatValue(value)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {customEntries.length > 0 && (
        <div className={styles.detailSection}>
          <div className={styles.sectionTitle}>Fields</div>
          <div className={styles.detailGrid}>
            {customEntries.map(([key, value]) => (
              <div key={key} className={styles.detailField}>
                <div className={styles.detailLabel}>{formatFieldLabel(key)}</div>
                <div className={styles.detailValue}>{formatValue(value)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const ImportScreen = () => {
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = useSearch({ strict: false }) as { type?: string };

  const [phase, setPhase] = useState<Phase>('upload');
  const [selectedSchemaId, setSelectedSchemaId] = useState<string>(search.type ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [validRows, setValidRows] = useState(0);
  const [committed, setCommitted] = useState<CommittedEntity[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const schemaName = schemas.find(s => s.id === selectedSchemaId)?.name ?? '';

  const handleDownloadTemplate = useCallback(async () => {
    if (!selectedSchemaId) return;
    try {
      const blob = await downloadCsvTemplate(workspaceSlug, selectedSchemaId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${schemaName.toLowerCase().replace(/\s+/g, '-')}-import-template.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download template:', error);
      alert('Failed to download template. Please try again.');
    }
  }, [workspaceSlug, selectedSchemaId, schemaName]);

  const runParse = useCallback(async () => {
    if (!file || !selectedSchemaId) return;
    setPhase('parsing');
    try {
      const text = await file.text();
      const result = await parseCsvImport(workspaceSlug, selectedSchemaId, text);
      setRows(
        result.entities.map(e => ({
          rowNumber: e.rowNumber,
          errors: e.errors,
          entity: e.entity,
          accepted: e.errors.length === 0,
          expanded: false,
          isUpdate: e.isUpdate,
          existingId: e.existingId,
          existingEntity: e.existingEntity
        }))
      );
      setTotalRows(result.totalRows);
      setValidRows(result.validRows);
      setPhase('review');
    } catch (error) {
      console.error('Failed to parse CSV:', error);
      alert('Failed to parse CSV. Please check the file format and try again.');
      setPhase('upload');
    }
  }, [workspaceSlug, selectedSchemaId, file]);

  const toggleRow = useCallback((rowNumber: number) => {
    setRows(rs => rs.map(r => (r.rowNumber === rowNumber ? { ...r, accepted: !r.accepted } : r)));
  }, []);

  const toggleExpand = useCallback((rowNumber: number) => {
    setRows(rs => rs.map(r => (r.rowNumber === rowNumber ? { ...r, expanded: !r.expanded } : r)));
  }, []);

  const commit = useCallback(async () => {
    const accepted = rows.filter(r => r.accepted && r.entity);
    try {
      const entities = accepted.map(r => ({ 
        ...r.entity!, 
        _schemaId: selectedSchemaId,
        _existingId: r.existingId 
      }));
      const result = await commitCsvImport(workspaceSlug, selectedSchemaId, entities);
      setCommitted(
        accepted.map((r, i) => ({
          id: result.ids[i] ?? `imported-${i}`,
          name: (r.entity!._name as string) ?? `Row ${r.rowNumber}`
        }))
      );
      await queryClient.invalidateQueries({ queryKey: entityKeys.all });
      await queryClient.invalidateQueries({ queryKey: schemaKeys.list(workspaceSlug) });
      setPhase('done');
    } catch (error) {
      console.error('Failed to import entities:', error);
      alert('Failed to import entities. Please try again.');
    }
  }, [rows, workspaceSlug, selectedSchemaId, queryClient]);

  const reset = useCallback(() => {
    setFile(null);
    setRows([]);
    setCommitted([]);
    setSelectedSchemaId('');
    setPhase('upload');
  }, []);

  const acceptedCount = rows.filter(r => r.accepted).length;
  const updateCount = rows.filter(r => r.accepted && r.isUpdate).length;
  const createCount = acceptedCount - updateCount;

  return (
    <div className={styles.extract}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.eyebrow}>
            <TbFileImport size={11} /> Import
          </div>
          <div className={styles.title}>Import entities from CSV</div>
          <div className={styles.desc}>
            Select an entity type, download a template, fill it with your data, and upload it back.
            Review the parsed data before importing.
          </div>
        </div>
        <Stepper phase={phase} />
      </div>

      {phase === 'upload' && (
        <div className={styles.inputPhase}>
          <div className={styles.uploadHeader}>
            <Select.Root
              value={selectedSchemaId}
              onChange={v => setSelectedSchemaId(v ?? '')}
              placeholder="Select entity type…"
            >
              {schemas.map(schema => (
                <Select.Item key={schema.id} value={schema.id}>
                  {schema.name}
                </Select.Item>
              ))}
            </Select.Root>
            <Button
              icon={<TbFileUpload size={12} />}
              onClick={handleDownloadTemplate}
              disabled={!selectedSchemaId}
              size={'sm'}
            >
              Download template
            </Button>
          </div>

          <div
            className={`${styles.dropzone} ${file ? styles.dropzoneHasFile : ''}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={e => e.target.files?.[0] && setFile(e.target.files[0])}
            />
            <div className={styles.dropIcon}>
              <TbUpload size={20} />
            </div>
            {file ? (
              <>
                <div className={styles.dropFileName}>{file.name}</div>
                <div className={styles.dropSub}>
                  {(file.size / 1024).toFixed(1)} KB · click to replace
                </div>
              </>
            ) : (
              <>
                <div className={styles.dropFileName}>Drop a CSV file or click to browse</div>
                <div className={styles.dropSub}>Must match the template format</div>
              </>
            )}
          </div>

          <div className={styles.inputFoot}>
            <Button
              variant="primary"
              icon={<TbFileImport size={12} />}
              onClick={runParse}
              disabled={!file || !selectedSchemaId}
            >
              Parse CSV
            </Button>
          </div>
        </div>
      )}

      {phase === 'parsing' && (
        <div className={styles.scanning}>
          <div className={styles.scanPulse}>
            <TbFileImport size={22} />
          </div>
          <div className={styles.scanTitle}>Parsing CSV…</div>
          <div className={styles.scanSub}>Validating data and checking for errors</div>
        </div>
      )}

      {phase === 'review' && (
        <div className={styles.reviewPhase}>
          <div className={styles.reviewBar}>
            <div className={styles.reviewBarL}>
              <b>{totalRows}</b> row{totalRows !== 1 ? 's' : ''} &middot;{' '}
              <span className={styles.sumAdd}>
                <b>{createCount}</b> to create
                {updateCount > 0 && (
                  <>
                    , <b>{updateCount}</b> to update
                  </>
                )}
              </span>
              {validRows < totalRows && (
                <span className={styles.errorBadge}>
                  <TbAlertCircle size={12} /> {totalRows - validRows} error
                  {totalRows - validRows !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          <div className={styles.tableScroll}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.thExp} />
                  <th className={styles.thCheck} />
                  <th>Row</th>
                  <th>Name</th>
                  <th>Action</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <React.Fragment key={r.rowNumber}>
                    <tr
                      className={`${r.accepted ? '' : styles.rowRejected} ${r.expanded ? styles.rowExpanded : ''}`}
                    >
                      <td className={styles.tdExp}>
                        {r.entity && (
                          <Button
                            variant="icon-only"
                            size="sm"
                            className={r.expanded ? styles.expBtnOpen : undefined}
                            title={r.expanded ? 'Collapse' : 'Expand fields'}
                            onClick={() => toggleExpand(r.rowNumber)}
                          >
                            <TbChevronRight size={12} />
                          </Button>
                        )}
                      </td>
                      <td className={styles.tdCheck}>
                        <input
                          type="checkbox"
                          checked={r.accepted}
                          onChange={() => toggleRow(r.rowNumber)}
                          disabled={r.errors.length > 0}
                        />
                      </td>
                      <td>{r.rowNumber}</td>
                      <td>{r.entity?._name ? String(r.entity._name) : <em>No name</em>}</td>
                      <td>
                        {r.isUpdate ? (
                          <span className={`${styles.actionPill} ${styles.actionUpdate}`}>
                            <TbCheck size={10} /> Update
                          </span>
                        ) : (
                          <span className={`${styles.actionPill} ${styles.actionAdd}`}>
                            <TbPlus size={10} /> Create
                          </span>
                        )}
                      </td>
                      <td>
                        {r.errors.length > 0 ? (
                          <span className={styles.errorList}>
                            {r.errors.map((err, i) => (
                              <span key={i} className={styles.errorItem}>
                                <TbAlertCircle size={10} /> {err}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span className={styles.statusOk}>
                            <TbCheck size={10} /> Valid
                          </span>
                        )}
                      </td>
                      <td>
                        {r.errors.length === 0 && (
                          <Button
                            variant="icon-only"
                            size="sm"
                            title={r.accepted ? 'Reject' : 'Accept'}
                            onClick={() => toggleRow(r.rowNumber)}
                          >
                            {r.accepted ? <TbX size={12} /> : <TbCheck size={12} />}
                          </Button>
                        )}
                      </td>
                    </tr>
                    {r.expanded && (
                      <tr className={styles.detailRow}>
                        <td colSpan={7}>
                          <ExpandedDetail row={r} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          </div>

          <div className={styles.reviewFoot}>
            <Button onClick={() => setPhase('upload')}>Back</Button>
            <Button
              variant="primary"
              icon={<TbCheck size={12} />}
              disabled={acceptedCount === 0}
              onClick={commit}
            >
              Import {acceptedCount} {acceptedCount === 1 ? 'entity' : 'entities'}
            </Button>
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className={styles.donePhase}>
          <div className={styles.doneCheck}>
            <TbCheck size={24} />
          </div>
          <div className={styles.doneTitle}>
            Imported {committed.length} {committed.length === 1 ? 'entity' : 'entities'}
          </div>
          <div className={styles.doneSub}>New entities have been added to your workspace.</div>
          <div className={styles.doneList}>
            {committed.slice(0, 10).map(e => (
              <div key={e.id} className={styles.doneItem}>
                <span className={styles.typeTag}>{schemaName}</span>
                <span className={styles.doneItemName}>{e.name}</span>
                <TbCheck size={11} className={styles.doneItemCheck} />
              </div>
            ))}
            {committed.length > 10 && (
              <div className={styles.doneMore}>and {committed.length - 10} more...</div>
            )}
          </div>
          <div className={styles.doneActions}>
            <Button
              variant="primary"
              onClick={() =>
                navigate({
                  to: '/$workspaceSlug/entities',
                  params: { workspaceSlug }
                })
              }
            >
              View in Entities
            </Button>
            <Button onClick={reset}>Import more</Button>
          </div>
        </div>
      )}
    </div>
  );
};
