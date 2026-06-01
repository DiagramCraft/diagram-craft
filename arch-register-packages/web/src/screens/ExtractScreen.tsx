import { useState, useRef, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  TbWand, TbTextCaption, TbFileUpload, TbCheck,
  TbUpload, TbPlus,
} from 'react-icons/tb';
import styles from './ExtractScreen.module.css';
import { useWorkspaceContext } from '../layouts/WorkspaceContext';
import { apiFetch } from '../api';

type Phase = 'input' | 'scanning' | 'review' | 'done';
type InputTab = 'paste' | 'upload';

type ExtractedEntity = {
  id: string;
  name: string;
  schema_id: string;
  fields: Record<string, string>;
  confidence: number;
  source: string;
  accepted: boolean;
};

const STEPS = [
  { key: 'input', label: 'Provide' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Add' },
] as const;

const Stepper = ({ phase }: { phase: Phase }) => {
  const phaseIdx = phase === 'scanning' ? 0 : STEPS.findIndex(s => s.key === phase);
  return (
    <div className={styles.stepper}>
      {STEPS.map((s, i) => {
        const done = i < phaseIdx;
        const active = i === phaseIdx;
        return (
          <div key={s.key}>
            {i > 0 && <span className={styles.stepLine} />}
            <span className={`${styles.step} ${active ? styles.stepActive : ''} ${done ? styles.stepDone : ''}`}>
              <span className={styles.stepNum}>{done ? <TbCheck size={10} /> : i + 1}</span>
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const ExtractScreen = () => {
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const navigate = useNavigate();

  const [tab, setTab] = useState<InputTab>('paste');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('input');
  const [rows, setRows] = useState<ExtractedEntity[]>([]);
  const [committedCount, setCommittedCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const readFile = useCallback((f: File) => {
    setFile(f);
    if (/\.(txt|md|markdown)$/i.test(f.name)) {
      const reader = new FileReader();
      reader.onload = () => setText(String(reader.result ?? ''));
      reader.readAsText(f);
    }
  }, []);

  const runExtract = useCallback(async () => {
    setPhase('scanning');
    try {
      const result = await apiFetch<{ entities: Array<{
        name: string;
        schema_id: string;
        fields: Record<string, string>;
        confidence: number;
        source: string;
      }> }>(`/api/${workspaceSlug}/ai/extract`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      });

      const extracted: ExtractedEntity[] = (result.entities ?? []).map((e, i) => ({
        id: `extract-${i}`,
        ...e,
        accepted: true,
      }));
      setRows(extracted);
      setPhase('review');
    } catch {
      setPhase('input');
    }
  }, [workspaceSlug, text]);

  const toggleRow = useCallback((id: string) => {
    setRows(rs => rs.map(r => r.id === id ? { ...r, accepted: !r.accepted } : r));
  }, []);

  const updateRowName = useCallback((id: string, name: string) => {
    setRows(rs => rs.map(r => r.id === id ? { ...r, name } : r));
  }, []);

  const commit = useCallback(() => {
    const accepted = rows.filter(r => r.accepted);
    setCommittedCount(accepted.length);
    setPhase('done');
    // TODO: Actually create entities via API
  }, [rows]);

  const reset = useCallback(() => {
    setText('');
    setFile(null);
    setRows([]);
    setPhase('input');
    setTab('paste');
  }, []);

  const acceptedCount = rows.filter(r => r.accepted).length;
  const schemaMap = new Map(schemas.map(s => [s.id, s]));

  return (
    <div className={styles.extract}>
      <div className={styles.header}>
        <div className={styles.eyebrow}><TbWand size={11} /> Extract</div>
        <div className={styles.title}>Find entities in content</div>
        <div className={styles.desc}>
          Paste a doc or drop a file. The assistant detects components, APIs and services,
          maps them to your schema, and lets you review before anything is saved.
        </div>
      </div>

      <Stepper phase={phase} />

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
              placeholder={'Paste an architecture doc, RFC, meeting notes, an email thread...\n\ne.g. "The new Returns Service will let customers create RMAs. It calls the Shipping API for labels..."'}
              value={text}
              onChange={e => setText(e.target.value)}
            />
          ) : (
            <div
              className={`${styles.dropzone} ${file ? styles.dropzoneHasFile : ''}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]); }}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.md,.markdown,.pdf"
                style={{ display: 'none' }}
                onChange={e => e.target.files?.[0] && readFile(e.target.files[0])}
              />
              <div className={styles.dropIcon}>
                <TbUpload size={20} />
              </div>
              {file ? (
                <>
                  <div>{file.name}</div>
                  <div className={styles.dropSub}>{(file.size / 1024).toFixed(1)} KB</div>
                </>
              ) : (
                <>
                  <div>Drop a file or click to browse</div>
                  <div className={styles.dropSub}>.txt, .md or .pdf</div>
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
              className={styles.extractBtn}
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
          <div className={styles.scanPulse}><TbWand size={22} /></div>
          <div className={styles.scanTitle}>Scanning content...</div>
          <div className={styles.scanSub}>Detecting entities and mapping to your schema</div>
        </div>
      )}

      {phase === 'review' && (
        <div className={styles.reviewPhase}>
          <div className={styles.reviewBar}>
            <div className={styles.reviewBarL}>
              <b>{rows.length}</b> detected &middot; <b>{acceptedCount}</b> selected
            </div>
            <button type="button" className={styles.ghostBtn} onClick={() => setRows(rs => rs.map(r => ({ ...r, accepted: true })))}>
              Select all
            </button>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: 30 }} />
                  <th>Name</th>
                  <th>Type</th>
                  <th>Confidence</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className={r.accepted ? '' : styles.rowRejected}>
                    <td>
                      <input type="checkbox" checked={r.accepted} onChange={() => toggleRow(r.id)} />
                    </td>
                    <td>
                      <input
                        className={styles.cellInput}
                        value={r.name}
                        onChange={e => updateRowName(r.id, e.target.value)}
                      />
                    </td>
                    <td>
                      <span className={`${styles.actionPill} ${styles.actionAdd}`}>
                        {schemaMap.get(r.schema_id)?.name ?? r.schema_id}
                      </span>
                    </td>
                    <td>
                      <div className={styles.confidenceBar}>
                        <div className={styles.confidenceFill} style={{ width: `${(r.confidence * 100)}%` }} />
                      </div>
                    </td>
                    <td>
                      <span className={styles.sourceText} title={r.source}>{r.source}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.reviewFoot}>
            <button type="button" className={styles.ghostBtn} onClick={() => setPhase('input')}>
              Back
            </button>
            <button
              type="button"
              className={styles.commitBtn}
              disabled={acceptedCount === 0}
              onClick={commit}
            >
              <TbPlus size={12} /> Add {acceptedCount} {acceptedCount === 1 ? 'entity' : 'entities'}
            </button>
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className={styles.donePhase}>
          <TbCheck size={32} className={styles.doneIcon} />
          <div className={styles.doneTitle}>Done!</div>
          <div className={styles.doneSummary}>
            {committedCount} {committedCount === 1 ? 'entity' : 'entities'} added to the model.
          </div>
          <div className={styles.doneActions}>
            <button type="button" className={styles.ghostBtn} onClick={reset}>
              Extract more
            </button>
            <button
              type="button"
              className={styles.extractBtn}
              onClick={() => navigate({
                to: '/$workspaceSlug/entities',
                params: { workspaceSlug },
              })}
            >
              View in Entities
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
