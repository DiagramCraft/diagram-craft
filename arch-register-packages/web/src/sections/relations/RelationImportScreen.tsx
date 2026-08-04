import { Fragment, useCallback, useRef, useState } from 'react';
import {
  TbAlertCircle,
  TbCheck,
  TbChevronRight,
  TbFileImport,
  TbFileUpload,
  TbUpload
} from 'react-icons/tb';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@diagram-craft/app-components/Button';
import { Select } from '@diagram-craft/app-components/Select';
import { Chip } from '../../components/Chip';
import { Table } from '../../components/table/Table';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useRelationSchemas } from '../../hooks/useRelationSchemas';
import {
  commitRelationCsvImport,
  downloadRelationCsvTemplate,
  parseRelationCsvImport,
  type RelationImportRow
} from '../../lib/relationCsv';
import { downloadBlob } from '../../lib/browserDownload';
import { relationKeys } from '../../queries/relations';
import { useQueryClient } from '@tanstack/react-query';
import styles from '../entities/ImportScreen.module.css';

type ImportPhase = 'upload' | 'parsing' | 'review' | 'done';

const STEPS = [
  { key: 'upload', label: 'Upload' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Import' }
] as const;

const Stepper = ({ phase }: { phase: ImportPhase }) => {
  const phaseIdx = phase === 'parsing' ? 0 : STEPS.findIndex(step => step.key === phase);
  return (
    <div className={styles.stepper}>
      {STEPS.map((step, index) => {
        const done = index < phaseIdx;
        const active = index === phaseIdx;
        return (
          <span key={step.key} className={styles.stepperItem}>
            {index > 0 && (
              <span className={`${styles.stepLine} ${done ? styles.stepLineDone : ''}`} />
            )}
            <span
              className={`${styles.step} ${active ? styles.stepActive : ''} ${done ? styles.stepDone : ''}`}
            >
              <span className={styles.stepNum}>{done ? <TbCheck size={10} /> : index + 1}</span>
              <span className={styles.stepLabel}>{step.label}</span>
            </span>
          </span>
        );
      })}
    </div>
  );
};

const formatRelationValue = (value: unknown) => {
  if (value == null || value === '') return '(empty)';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const relationFieldLabel = (key: string) =>
  ({
    _schemaId: 'Relation type',
    _inEntityId: 'In entity',
    _outEntityId: 'Out entity'
  })[key] ?? key;

const ExpandedDetail = ({ row }: { row: RelationImportRow }) => {
  if (!row.relation) return null;
  const entries = Object.entries(row.relation);

  return (
    <div className={styles.detailContainer}>
      <div className={styles.detailSection}>
        <div className={styles.sectionTitle}>Relation</div>
        <div className={styles.detailGrid}>
          {entries.map(([key, value]) => (
            <div key={key} className={styles.detailField}>
              <div className={styles.detailLabel}>{relationFieldLabel(key)}</div>
              <div className={styles.detailValue}>{formatRelationValue(value)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const RelationImportScreen = () => {
  const { workspaceSlug } = useWorkspaceContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: relationSchemas = [] } = useRelationSchemas(workspaceSlug);
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<ImportPhase>('upload');
  const [selectedSchemaId, setSelectedSchemaId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<RelationImportRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<{ created: number; updated: number } | null>(null);

  const selectedSchema = relationSchemas.find(schema => schema.id === selectedSchemaId);

  const goToRelations = useCallback(() => {
    navigate({
      to: '/$workspaceSlug/entities/relations',
      params: { workspaceSlug }
    });
  }, [navigate, workspaceSlug]);

  const handleDownloadTemplate = useCallback(async () => {
    if (!selectedSchema) return;
    try {
      const blob = await downloadRelationCsvTemplate(workspaceSlug, selectedSchema.id);
      downloadBlob(
        blob,
        `${selectedSchema.name.toLowerCase().replace(/\s+/g, '-')}-import-template.csv`
      );
    } catch (error) {
      console.error('Failed to download relation template:', error);
      alert('Failed to download relation template. Please try again.');
    }
  }, [selectedSchema, workspaceSlug]);

  const handleParse = useCallback(async () => {
    if (!file) return;
    setPhase('parsing');
    try {
      const parsed = await parseRelationCsvImport(workspaceSlug, await file.text());
      setRows(parsed.relations);
      setTotalRows(parsed.totalRows);
      setSelectedRows(
        new Set(
          parsed.relations
            .filter(row => row.errors.length === 0 && row.relation != null)
            .map(row => row.rowNumber)
        )
      );
      setExpandedRows(new Set());
      setPhase('review');
    } catch (error) {
      console.error('Failed to parse relation CSV:', error);
      alert('Failed to parse relation CSV. Please check the file format and try again.');
      setPhase('upload');
    }
  }, [file, workspaceSlug]);

  const toggleRow = (rowNumber: number) => {
    setSelectedRows(previous => {
      const next = new Set(previous);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  };

  const toggleExpand = (rowNumber: number) => {
    setExpandedRows(previous => {
      const next = new Set(previous);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  };

  const validRows = rows.filter(
    row => row.errors.length === 0 && row.relation != null && selectedRows.has(row.rowNumber)
  );
  const createCount = validRows.filter(row => !row.isUpdate).length;
  const updateCount = validRows.filter(row => row.isUpdate).length;
  const errorCount = rows.filter(row => row.errors.length > 0).length;

  const handleCommit = useCallback(async () => {
    if (validRows.length === 0) return;
    try {
      const imported = await commitRelationCsvImport(
        workspaceSlug,
        validRows.map(row => row.relation!).filter(Boolean)
      );
      setResult({ created: imported.created, updated: imported.updated });
      await queryClient.invalidateQueries({ queryKey: relationKeys.all });
      setPhase('done');
    } catch (error) {
      console.error('Failed to import relations:', error);
      alert('Failed to import relations. Please review the CSV and try again.');
    }
  }, [queryClient, validRows, workspaceSlug]);

  const reset = () => {
    setPhase('upload');
    setFile(null);
    setRows([]);
    setTotalRows(0);
    setSelectedRows(new Set());
    setExpandedRows(new Set());
    setResult(null);
  };

  return (
    <div className={styles.extract}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.eyebrow}>
            <TbFileImport size={11} /> Import
          </div>
          <div className={styles.title}>Import relations from CSV</div>
          <div className={styles.desc}>
            Download a relation type template, fill it with your relation data, and upload it back.
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
              onChange={value => setSelectedSchemaId(value ?? '')}
              placeholder="Select relation type…"
            >
              {relationSchemas.map(schema => (
                <Select.Item key={schema.id} value={schema.id}>
                  {schema.name}
                </Select.Item>
              ))}
            </Select.Root>
            <Button
              icon={<TbFileUpload size={12} />}
              onClick={handleDownloadTemplate}
              disabled={!selectedSchemaId}
              size="sm"
            >
              Download template
            </Button>
          </div>

          <div
            className={`${styles.dropzone} ${file ? styles.dropzoneHasFile : ''}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={event => event.preventDefault()}
            onDrop={event => {
              event.preventDefault();
              if (event.dataTransfer.files[0]) setFile(event.dataTransfer.files[0]);
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={event => event.target.files?.[0] && setFile(event.target.files[0])}
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
              onClick={handleParse}
              disabled={!file}
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
              {errorCount > 0 && (
                <span className={styles.errorBadge}>
                  <TbAlertCircle size={12} /> {errorCount} error{errorCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          <div className={styles.tableScroll}>
            <Table.Root scroll scrollY stickyHeader wrapClassName={styles.tableWrap}>
              <Table.Head>
                <Table.Row>
                  <Table.HeaderCell className={styles.thExp} />
                  <Table.HeaderCell />
                  <Table.HeaderCell>Row</Table.HeaderCell>
                  <Table.HeaderCell>Endpoints</Table.HeaderCell>
                  <Table.HeaderCell>Action</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {rows.map(row => {
                  const hasErrors = row.errors.length > 0;
                  const selected = selectedRows.has(row.rowNumber);
                  const expanded = expandedRows.has(row.rowNumber);
                  return (
                    <Fragment key={row.rowNumber}>
                      <Table.Row
                        muted={!selected || hasErrors}
                        className={expanded ? styles.rowExpanded : undefined}
                      >
                        <Table.Cell className={styles.tdExp}>
                          {row.relation && (
                            <Button
                              variant="icon-only"
                              size="sm"
                              className={expanded ? styles.expBtnOpen : undefined}
                              title={expanded ? 'Collapse' : 'Expand fields'}
                              onClick={() => toggleExpand(row.rowNumber)}
                            >
                              <TbChevronRight size={12} />
                            </Button>
                          )}
                        </Table.Cell>
                        <Table.CheckboxCell
                          aria-label={`Include row ${row.rowNumber}`}
                          checked={selected}
                          onChange={() => toggleRow(row.rowNumber)}
                          disabled={hasErrors}
                        />
                        <Table.Cell>{row.rowNumber}</Table.Cell>
                        <Table.Cell>
                          {row.relation ? (
                            <>
                              {String(row.relation._inEntityId ?? '')} →{' '}
                              {String(row.relation._outEntityId ?? '')}
                            </>
                          ) : (
                            <em>Invalid relation</em>
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          {row.isUpdate ? (
                            <Chip tone="ghost" dot="oklch(0.60 0.15 195)">
                              Update (Natural key)
                            </Chip>
                          ) : (
                            <Chip tone="ghost" dot="var(--green)">
                              Create
                            </Chip>
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          {hasErrors ? (
                            <span className={styles.errorList}>
                              {row.errors.map((error, index) => (
                                <span key={index} className={styles.errorItem}>
                                  <TbAlertCircle size={10} /> {error}
                                </span>
                              ))}
                            </span>
                          ) : (
                            <span className={styles.statusOk}>
                              <TbCheck size={10} /> Valid
                            </span>
                          )}
                        </Table.Cell>
                      </Table.Row>
                      {expanded && (
                        <Table.DetailRow className={styles.detailRow}>
                          <ExpandedDetail row={row} />
                        </Table.DetailRow>
                      )}
                    </Fragment>
                  );
                })}
              </Table.Body>
            </Table.Root>
          </div>

          <div className={styles.reviewFoot}>
            <Button onClick={() => setPhase('upload')}>Back</Button>
            <Button
              variant="primary"
              icon={<TbCheck size={12} />}
              disabled={validRows.length === 0}
              onClick={handleCommit}
            >
              Import {validRows.length} {validRows.length === 1 ? 'relation' : 'relations'}
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
            Imported {(result?.created ?? 0) + (result?.updated ?? 0)} relations
          </div>
          <div className={styles.doneSub}>Relations have been added to your workspace.</div>
          <div className={styles.doneList}>
            <div className={styles.doneItem}>
              <span className={styles.typeTag}>Created</span>
              <span className={styles.doneItemName}>{result?.created ?? 0} new relations</span>
              <TbCheck size={11} className={styles.doneItemCheck} />
            </div>
            <div className={styles.doneItem}>
              <span className={styles.typeTag}>Updated</span>
              <span className={styles.doneItemName}>{result?.updated ?? 0} relations</span>
              <TbCheck size={11} className={styles.doneItemCheck} />
            </div>
          </div>
          <div className={styles.doneActions}>
            <Button variant="primary" onClick={goToRelations}>
              View all relations
            </Button>
            <Button onClick={reset}>Import more</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RelationImportScreen;
