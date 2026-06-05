import React, { useState, useRef, useCallback } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  TbFileImport,
  TbFileUpload,
  TbCheck,
  TbUpload,
  TbChevronRight,
  TbAlertCircle,
  TbPlus
} from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Select } from '@diagram-craft/app-components/Select';
import { Chip } from '../components/Chip';
import { DropdownMenu } from '../components/DropdownMenu';
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
  hasChanges: boolean;
  matchType: 'id' | 'slug' | 'name' | 'none';
  nameMatches: Array<{ id: string; name: string; slug?: string; namespace?: string }>;
  userChoice?: 'update' | 'create'; // User's decision for name matches
  existingId?: string;
  existingEntity?: Record<string, unknown> | null;
  constraintViolations?: Array<{
    type: 'duplicate_slug' | 'wrong_workspace' | 'wrong_schema';
    message: string;
  }>;
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

// Helper to normalize values for comparison (treat empty string, null, undefined as equivalent)
const normalizeValue = (val: unknown) => {
  if (val === '' || val === null || val === undefined) return null;
  return val;
};

// Helper to detect if an update has actual changes
const hasActualChanges = (newEntity: Record<string, unknown>, oldEntity: Record<string, unknown>): boolean => {
  const newEntityKeys = Object.keys(newEntity);
  const fieldsToCompare = newEntityKeys.filter(k => !['_existingId', '_schemaId'].includes(k));
  
  return fieldsToCompare.some(key => {
    const oldVal = normalizeValue(oldEntity[key]);
    const newVal = normalizeValue(newEntity[key]);
    return JSON.stringify(oldVal) !== JSON.stringify(newVal);
  });
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
    
    // Only compare fields that are present in the new entity (from CSV)
    // This excludes internal fields and fields not in the CSV
    const newEntityKeys = Object.keys(newEntity);
    
    // Filter out internal fields that shouldn't be shown in comparison
    const fieldsToCompare = newEntityKeys.filter(k => 
      !['_existingId', '_schemaId'].includes(k)
    );
    
    // Separate metadata and custom fields
    const metadataKeys = fieldsToCompare.filter(k => k.startsWith('_')).sort();
    const customKeys = fieldsToCompare.filter(k => !k.startsWith('_')).sort();
    
    // Helper to normalize values for comparison (treat empty string, null, undefined as equivalent)
    const normalizeValue = (val: unknown) => {
      if (val === '' || val === null || val === undefined) return null;
      return val;
    };
    
    // Only show fields that have changed
    const changedMetadata = metadataKeys.filter(key => {
      const oldVal = normalizeValue(oldEntity[key]);
      const newVal = normalizeValue(newEntity[key]);
      return JSON.stringify(oldVal) !== JSON.stringify(newVal);
    });
    
    const changedCustom = customKeys.filter(key => {
      const oldVal = normalizeValue(oldEntity[key]);
      const newVal = normalizeValue(newEntity[key]);
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
        result.entities.map(e => {
          const matchType = e.matchType || 'none';
          const hasChanges = e.isUpdate && e.entity && e.existingEntity 
            ? hasActualChanges(e.entity, e.existingEntity)
            : true; // Creates always have "changes"
          
          // For name matches, don't auto-accept - require user decision
          const needsUserDecision = matchType === 'name';
          
          // Don't auto-accept if there are constraint violations
          const hasConstraintViolations = (e.constraintViolations?.length ?? 0) > 0;
          
          return {
            rowNumber: e.rowNumber,
            errors: e.errors,
            entity: e.entity,
            accepted: e.errors.length === 0 && hasChanges && !needsUserDecision && !hasConstraintViolations,
            expanded: false,
            isUpdate: e.isUpdate,
            hasChanges,
            matchType,
            nameMatches: e.nameMatches || [],
            userChoice: undefined, // User hasn't made a choice yet
            existingId: e.existingId,
            existingEntity: e.existingEntity,
            constraintViolations: e.constraintViolations
          };
        })
      );
      setTotalRows(result.totalRows);
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

  const setUserChoice = useCallback((rowNumber: number, choice: 'update' | 'create') => {
    setRows(rs => rs.map(r => {
      if (r.rowNumber === rowNumber) {
        return { 
          ...r, 
          userChoice: choice,
          accepted: true, // Auto-accept once user makes a choice
          isUpdate: choice === 'update'
        };
      }
      return r;
    }));
  }, []);

  const commit = useCallback(async () => {
    const accepted = rows.filter(r => r.accepted && r.entity);
    try {
      const entities = accepted.map(r => {
        const entity: Record<string, unknown> = {
          ...r.entity!,
          _schemaId: selectedSchemaId
        };
        
        // Only include _existingId if:
        // 1. It's an ID-based match (matchType === 'id'), OR
        // 2. It's a slug-based match (matchType === 'slug'), OR
        // 3. It's a name-based match AND user chose 'update'
        if (r.matchType === 'id' || r.matchType === 'slug' || (r.matchType === 'name' && r.userChoice === 'update')) {
          entity._existingId = r.existingId ?? r.nameMatches[0]?.id;
        }
        
        return entity;
      });
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
              {(() => {
                const errorCount = rows.filter(r => r.errors.length > 0).length;
                const constraintCount = rows.filter(r => (r.constraintViolations?.length ?? 0) > 0).length;
                const decisionCount = rows.filter(r => r.matchType === 'name' && !r.userChoice).length;
                
                return (
                  <>
                    {errorCount > 0 && (
                      <span className={styles.errorBadge}>
                        <TbAlertCircle size={12} /> {errorCount} error{errorCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {constraintCount > 0 && (
                      <span className={styles.errorBadge}>
                        <TbAlertCircle size={12} /> {constraintCount} constraint violation{constraintCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {decisionCount > 0 && (
                      <span className={styles.errorBadge} style={{ background: 'oklch(0.65 0.15 40 / 0.1)' }}>
                        <TbAlertCircle size={12} /> {decisionCount} decision{decisionCount !== 1 ? 's' : ''} required
                      </span>
                    )}
                  </>
                );
              })()}
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
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <React.Fragment key={r.rowNumber}>
                    <tr
                      className={`${r.accepted || (r.matchType === 'name' && !r.userChoice) ? '' : styles.rowRejected} ${r.expanded ? styles.rowExpanded : ''}`}
                    >
                      <td className={styles.tdExp}>
                        {r.entity && (r.hasChanges || r.matchType === 'name' || !r.isUpdate) && (
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
                        {r.matchType === 'name' && !r.userChoice ? (
                          <DropdownMenu
                            trigger={
                              <button type="button" className={styles.chipButton}>
                                <Chip tone="ghost" dot="oklch(0.65 0.15 40)">
                                  <TbAlertCircle size={10} /> Decision Required
                                </Chip>
                              </button>
                            }
                            items={[
                              {
                                label: 'Update existing entity',
                                icon: <TbCheck size={12} />,
                                onClick: () => setUserChoice(r.rowNumber, 'update'),
                                disabled: r.constraintViolations?.some(v => 
                                  v.type === 'wrong_workspace' || v.type === 'wrong_schema'
                                )
                              },
                              {
                                label: 'Create new entity',
                                icon: <TbPlus size={12} />,
                                onClick: () => setUserChoice(r.rowNumber, 'create'),
                                disabled: r.constraintViolations?.some(v => 
                                  v.type === 'duplicate_slug'
                                )
                              },
                            ]}
                          />
                        ) : r.isUpdate && !r.hasChanges ? (
                          <Chip tone="ghost" dot="var(--cmp-fg-disabled)">
                            No Changes
                          </Chip>
                        ) : r.matchType === 'id' ? (
                          <Chip tone="ghost" dot="oklch(0.60 0.15 195)">
                            Update (ID)
                          </Chip>
                        ) : r.matchType === 'slug' ? (
                          <Chip tone="ghost" dot="oklch(0.60 0.15 195)">
                            Update (Slug)
                          </Chip>
                        ) : r.isUpdate ? (
                          <Chip tone="ghost" dot="oklch(0.60 0.15 195)">
                            Update
                          </Chip>
                        ) : (
                          <Chip tone="ghost" dot="var(--green)">
                            Create
                          </Chip>
                        )}
                      </td>
                      <td>
                        {r.errors.length > 0 || (r.constraintViolations && r.constraintViolations.length > 0) ? (
                          <span className={styles.errorList}>
                            {r.errors.map((err, i) => (
                              <span key={i} className={styles.errorItem}>
                                <TbAlertCircle size={10} /> {err}
                              </span>
                            ))}
                            {r.constraintViolations?.map((violation, i) => (
                              <span key={`cv-${i}`} className={styles.errorItem}>
                                <TbAlertCircle size={10} /> {violation.message}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span className={styles.statusOk}>
                            <TbCheck size={10} /> Valid
                          </span>
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
