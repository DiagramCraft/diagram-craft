import React from 'react';
import {
  TbWand,
  TbTextCaption,
  TbFileUpload,
  TbCheck,
  TbUpload,
  TbPlus,
  TbChevronRight,
  TbX
} from 'react-icons/tb';
import styles from './ExtractScreen.module.css';
import { Table } from '../../components/table/Table';
import { useExtractController } from './useExtractController';
import type { ExtractedEntity, ExtractPhase } from './extractReviewState';

const STEPS = [
  { key: 'input', label: 'Provide' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Add' }
] as const;

const Stepper = ({ phase }: { phase: ExtractPhase }) => {
  const phaseIdx = phase === 'scanning' ? 0 : STEPS.findIndex(s => s.key === phase);
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

const ExpandedDetail = ({ row }: { row: ExtractedEntity }) => {
  const entries = Object.entries(row.fields).filter(
    ([, v]) => v !== undefined && v !== '' && v !== null
  );
  if (entries.length === 0) return null;
  return (
    <div className={styles.detailGrid}>
      {entries.map(([key, value]) => (
        <div key={key} className={styles.detailField}>
          <div className={styles.detailLabel}>{key}</div>
          <div className={styles.detailValue}>{String(value)}</div>
        </div>
      ))}
    </div>
  );
};

export const ExtractScreen = () => {
  const {
    tab,
    setTab,
    text,
    setText,
    file,
    phase,
    setPhase,
    rows,
    committed,
    fileRef,
    readFile,
    runExtract,
    toggleRow,
    toggleExpand,
    updateRowName,
    acceptAll,
    commit,
    reset,
    viewEntities,
    acceptedCount,
    schemaMap
  } = useExtractController();

  return (
    <div className={styles.extract}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.eyebrow}>
            <TbWand size={11} /> Extract
          </div>
          <div className={styles.title}>Find entities in content</div>
          <div className={styles.desc}>
            Paste a doc or drop a file. The assistant detects components, APIs and services, maps
            them to your schema, and lets you review before anything is saved.
          </div>
        </div>
        <Stepper phase={phase} />
      </div>

      {phase === 'input' && (
        <div className={styles.inputPhase}>
          <div className={styles.segmented}>
            <button
              type="button"
              className={`${styles.segBtn} ${tab === 'paste' ? styles.segBtnActive : ''}`}
              onClick={() => setTab('paste')}
            >
              <TbTextCaption size={12} /> Paste text
            </button>
            <button
              type="button"
              className={`${styles.segBtn} ${tab === 'upload' ? styles.segBtnActive : ''}`}
              onClick={() => setTab('upload')}
            >
              <TbFileUpload size={12} /> Upload file
            </button>
          </div>

          {tab === 'paste' ? (
            <textarea
              className={styles.textarea}
              placeholder={
                'Paste an architecture doc, RFC, meeting notes, an email thread...\n\ne.g. "The new Returns Service will let customers create RMAs. It calls the Shipping API for labels..."'
              }
              value={text}
              onChange={e => setText(e.target.value)}
            />
          ) : (
            <div
              className={`${styles.dropzone} ${file ? styles.dropzoneHasFile : ''}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]);
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.md,.markdown"
                style={{ display: 'none' }}
                onChange={e => e.target.files?.[0] && readFile(e.target.files[0])}
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
                  <div className={styles.dropFileName}>Drop a file or click to browse</div>
                  <div className={styles.dropSub}>.txt, .md or .markdown</div>
                </>
              )}
            </div>
          )}

          <div className={styles.inputFoot}>
            <span className={styles.charCount}>
              {tab === 'paste' ? `${text.length} chars` : file ? '1 file ready' : 'no file'}
            </span>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={runExtract}
              disabled={tab === 'paste' ? text.trim().length < 1 : !file}
            >
              <TbWand size={12} /> Extract entities
            </button>
          </div>
        </div>
      )}

      {phase === 'scanning' && (
        <div className={styles.scanning}>
          <div className={styles.scanPulse}>
            <TbWand size={22} />
          </div>
          <div className={styles.scanTitle}>Scanning content…</div>
          <div className={styles.scanSub}>Detecting entities and mapping to your schema</div>
        </div>
      )}

      {phase === 'review' && (
        <div className={styles.reviewPhase}>
          <div className={styles.reviewBar}>
            <div className={styles.reviewBarL}>
              <b>{rows.length}</b> detected &middot;{' '}
              <span className={styles.sumAdd}>
                <b>{acceptedCount}</b> to add
              </span>
            </div>
            <button type="button" className={styles.ghostBtn} onClick={acceptAll}>
              Reset selection
            </button>
          </div>

          <div className={styles.tableScroll}>
            <Table.Root scroll scrollY stickyHeader wrapClassName={styles.tableWrap}>
              <Table.Head>
                <Table.Row>
                  <Table.HeaderCell className={styles.thExp} />
                  <Table.HeaderCell />
                  <Table.HeaderCell>Name</Table.HeaderCell>
                  <Table.HeaderCell>Change</Table.HeaderCell>
                  <Table.HeaderCell>Type</Table.HeaderCell>
                  <Table.HeaderCell>Confidence</Table.HeaderCell>
                  <Table.HeaderCell>Source</Table.HeaderCell>
                  <Table.HeaderCell />
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {rows.map(r => (
                  <React.Fragment key={r.id}>
                    <Table.Row
                      muted={!r.accepted}
                      className={r.expanded ? styles.rowExpanded : undefined}
                    >
                      <Table.Cell className={styles.tdExp}>
                        <button
                          type="button"
                          className={`${styles.expBtn} ${r.expanded ? styles.expBtnOpen : ''}`}
                          title={r.expanded ? 'Collapse' : 'Expand fields'}
                          onClick={() => toggleExpand(r.id)}
                        >
                          <TbChevronRight size={12} />
                        </button>
                      </Table.Cell>
                      <Table.CheckboxCell
                        aria-label={`Include ${r.name ?? 'entity'}`}
                        checked={r.accepted}
                        onChange={() => toggleRow(r.id)}
                      />
                      <Table.Cell>
                        <input
                          className={`${styles.cellInput} ${styles.cellInputName}`}
                          value={r.name}
                          onChange={e => updateRowName(r.id, e.target.value)}
                        />
                      </Table.Cell>
                      <Table.Cell>
                        <span className={`${styles.actionPill} ${styles.actionAdd}`}>
                          <TbPlus size={10} /> Add
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className={styles.typeTag}>
                          {schemaMap.get(r.schema_id)?.name ?? r.schema_id}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <div className={styles.conf}>
                          <div
                            className={`${styles.confBar} ${r.confidence > 0.85 ? styles.confHi : r.confidence > 0.7 ? styles.confMid : styles.confLo}`}
                            style={{ width: `${Math.round(r.confidence * 100)}%` }}
                          />
                          <span className={styles.confNum}>{Math.round(r.confidence * 100)}%</span>
                        </div>
                      </Table.Cell>
                      <Table.Cell className={styles.tdSource} title={r.source}>
                        {r.source}
                      </Table.Cell>
                      <Table.Cell>
                        <button
                          type="button"
                          className={styles.rejectBtn}
                          title={r.accepted ? 'Reject' : 'Accept'}
                          onClick={() => toggleRow(r.id)}
                        >
                          {r.accepted ? <TbX size={12} /> : <TbPlus size={12} />}
                        </button>
                      </Table.Cell>
                    </Table.Row>
                    {r.expanded && (
                      <Table.DetailRow className={styles.detailRow}>
                        <ExpandedDetail row={r} />
                      </Table.DetailRow>
                    )}
                  </React.Fragment>
                ))}
              </Table.Body>
            </Table.Root>
          </div>

          <div className={styles.reviewFoot}>
            <button type="button" className={styles.ghostBtn} onClick={() => setPhase('input')}>
              Back
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={acceptedCount === 0}
              onClick={commit}
            >
              <TbCheck size={12} /> Add {acceptedCount}{' '}
              {acceptedCount === 1 ? 'entity' : 'entities'}
            </button>
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className={styles.donePhase}>
          <div className={styles.doneCheck}>
            <TbCheck size={24} />
          </div>
          <div className={styles.doneTitle}>
            Added {committed.length} {committed.length === 1 ? 'entity' : 'entities'}
          </div>
          <div className={styles.doneSub}>
            New entities are saved as <b>Proposed</b> and can be reviewed before publishing.
          </div>
          <div className={styles.doneList}>
            {committed.map(e => (
              <button key={e.id} type="button" className={styles.doneItem} onClick={viewEntities}>
                <span className={`${styles.actionPill} ${styles.actionAdd}`}>
                  <TbPlus size={10} /> Add
                </span>
                <span className={styles.doneItemSchema}>
                  {schemaMap.get(e.schema_id)?.name ?? e.schema_id}
                </span>
                <span className={styles.doneItemName}>{e.name}</span>
                <TbChevronRight size={11} className={styles.doneItemChevron} />
              </button>
            ))}
          </div>
          <div className={styles.doneActions}>
            <button type="button" className={styles.primaryBtn} onClick={viewEntities}>
              View in Entities
            </button>
            <button type="button" className={styles.ghostBtn} onClick={reset}>
              Extract more
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
