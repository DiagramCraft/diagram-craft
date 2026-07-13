import React from 'react';
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
import { Chip } from '../../components/Chip';
import { DropdownMenu } from '../../components/DropdownMenu';
import { Table } from '../../components/table/Table';
import styles from './ImportScreen.module.css';
import {
  formatImportFieldLabel,
  formatImportValue,
  getChangedImportFields,
  getImportDetailEntries,
  isEmptyImportValue,
  type ImportReviewRow
} from './importReviewState';
import { useImportController, type ImportPhase } from './useImportController';

type ParsedRow = ImportReviewRow;

const STEPS = [
  { key: 'upload', label: 'Upload' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Import' }
] as const;

const Stepper = ({ phase }: { phase: ImportPhase }) => {
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

  // For updates, show before/after comparison
  if (row.isUpdate && row.existingEntity) {
    const newEntity = row.entity;
    const oldEntity = row.existingEntity;

    const { metadata: changedMetadata, custom: changedCustom } = getChangedImportFields(
      newEntity,
      oldEntity
    );

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
                <div className={styles.detailLabel}>{formatImportFieldLabel(key)}</div>
                <div className={styles.comparisonRow}>
                  <div className={styles.beforeAfter}>
                    <div className={styles.beforeLabel}>Before:</div>
                    <div className={styles.oldValue}>
                      {isEmptyImportValue(oldEntity[key]) ? (
                        <em className={styles.emptyValue}>(empty)</em>
                      ) : (
                        formatImportValue(oldEntity[key])
                      )}
                    </div>
                  </div>
                  <div className={styles.beforeAfter}>
                    <div className={styles.afterLabel}>After:</div>
                    <div className={styles.newValue}>
                      {isEmptyImportValue(newEntity[key]) ? (
                        <em className={styles.emptyValue}>(empty)</em>
                      ) : (
                        formatImportValue(newEntity[key])
                      )}
                    </div>
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
                <div className={styles.detailLabel}>{formatImportFieldLabel(key)}</div>
                <div className={styles.comparisonRow}>
                  <div className={styles.beforeAfter}>
                    <div className={styles.beforeLabel}>Before:</div>
                    <div className={styles.oldValue}>
                      {isEmptyImportValue(oldEntity[key]) ? (
                        <em className={styles.emptyValue}>(empty)</em>
                      ) : (
                        formatImportValue(oldEntity[key])
                      )}
                    </div>
                  </div>
                  <div className={styles.beforeAfter}>
                    <div className={styles.afterLabel}>After:</div>
                    <div className={styles.newValue}>
                      {isEmptyImportValue(newEntity[key]) ? (
                        <em className={styles.emptyValue}>(empty)</em>
                      ) : (
                        formatImportValue(newEntity[key])
                      )}
                    </div>
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
  const { metadata: metadataEntries, custom: customEntries } = getImportDetailEntries(row.entity);

  if (metadataEntries.length === 0 && customEntries.length === 0) return null;

  return (
    <div className={styles.detailContainer}>
      {metadataEntries.length > 0 && (
        <div className={styles.detailSection}>
          <div className={styles.sectionTitle}>Metadata</div>
          <div className={styles.detailGrid}>
            {metadataEntries.map(([key, value]) => (
              <div key={key} className={styles.detailField}>
                <div className={styles.detailLabel}>{formatImportFieldLabel(key)}</div>
                <div className={styles.detailValue}>{formatImportValue(value)}</div>
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
                <div className={styles.detailLabel}>{formatImportFieldLabel(key)}</div>
                <div className={styles.detailValue}>{formatImportValue(value)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const ImportScreen = () => {
  const {
    schemas,
    phase,
    setPhase,
    selectedSchemaId,
    setSelectedSchemaId,
    file,
    setFile,
    rows,
    totalRows,
    committed,
    fileRef,
    schemaName,
    handleDownloadTemplate,
    runParse,
    toggleRow,
    toggleExpand,
    setUserChoice,
    commit,
    reset,
    viewEntities,
    acceptedCount,
    updateCount,
    createCount
  } = useImportController();

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
                const constraintCount = rows.filter(
                  r => (r.constraintViolations?.length ?? 0) > 0
                ).length;
                const decisionCount = rows.filter(
                  r => r.matchType === 'name' && !r.userChoice
                ).length;

                return (
                  <>
                    {errorCount > 0 && (
                      <span className={styles.errorBadge}>
                        <TbAlertCircle size={12} /> {errorCount} error{errorCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {constraintCount > 0 && (
                      <span className={styles.errorBadge}>
                        <TbAlertCircle size={12} /> {constraintCount} constraint violation
                        {constraintCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {decisionCount > 0 && (
                      <span
                        className={styles.errorBadge}
                        style={{ background: 'oklch(0.65 0.15 40 / 0.1)' }}
                      >
                        <TbAlertCircle size={12} /> {decisionCount} decision
                        {decisionCount !== 1 ? 's' : ''} required
                      </span>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          <div className={styles.tableScroll}>
            <Table.Root scroll scrollY stickyHeader wrapClassName={styles.tableWrap}>
              <Table.Head>
                <Table.Row>
                  <Table.HeaderCell className={styles.thExp} />
                  <Table.HeaderCell />
                  <Table.HeaderCell>Row</Table.HeaderCell>
                  <Table.HeaderCell>Name</Table.HeaderCell>
                  <Table.HeaderCell>Action</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {rows.map(r => {
                  const pendingDecision = r.matchType === 'name' && !r.userChoice;
                  return (
                    <React.Fragment key={r.rowNumber}>
                      <Table.Row
                        muted={!r.accepted && !pendingDecision}
                        className={r.expanded ? styles.rowExpanded : undefined}
                      >
                        <Table.Cell className={styles.tdExp}>
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
                        </Table.Cell>
                        <Table.CheckboxCell
                          aria-label={`Include row ${r.rowNumber}`}
                          checked={r.accepted}
                          onChange={() => toggleRow(r.rowNumber)}
                          disabled={r.errors.length > 0}
                        />
                        <Table.Cell>{r.rowNumber}</Table.Cell>
                        <Table.Cell>
                          {r.entity?._name ? String(r.entity._name) : <em>No name</em>}
                        </Table.Cell>
                        <Table.Cell>
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
                                  disabled: r.constraintViolations?.some(
                                    v => v.type === 'wrong_workspace' || v.type === 'wrong_schema'
                                  )
                                },
                                {
                                  label: 'Create new entity',
                                  icon: <TbPlus size={12} />,
                                  onClick: () => setUserChoice(r.rowNumber, 'create'),
                                  disabled: r.constraintViolations?.some(
                                    v => v.type === 'duplicate_slug'
                                  )
                                }
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
                        </Table.Cell>
                        <Table.Cell>
                          {r.errors.length > 0 ||
                          (r.constraintViolations && r.constraintViolations.length > 0) ? (
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
                        </Table.Cell>
                      </Table.Row>
                      {r.expanded && (
                        <Table.DetailRow className={styles.detailRow}>
                          <ExpandedDetail row={r} />
                        </Table.DetailRow>
                      )}
                    </React.Fragment>
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
            <Button variant="primary" onClick={viewEntities}>
              View in Entities
            </Button>
            <Button onClick={reset}>Import more</Button>
          </div>
        </div>
      )}
    </div>
  );
};
