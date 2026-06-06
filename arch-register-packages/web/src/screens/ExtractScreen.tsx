import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  TbWand, TbTextCaption, TbFileUpload, TbCheck,
  TbUpload, TbPlus, TbChevronRight, TbX,
} from 'react-icons/tb';
import styles from './ExtractScreen.module.css';
import { useWorkspaceContext } from '../layouts/WorkspaceContext';
import { apiFetch, createEntity } from '../api';
import { entityKeys, schemaKeys } from '../hooks/queryKeys';

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
  expanded: boolean;
};

type CommittedEntity = {
  id: string;
  name: string;
  schema_id: string;
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
          <span key={s.key} className={styles.stepperItem}>
            {i > 0 && <span className={`${styles.stepLine} ${done ? styles.stepLineDone : ''}`} />}
            <span className={`${styles.step} ${active ? styles.stepActive : ''} ${done ? styles.stepDone : ''}`}>
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
  const entries = Object.entries(row.fields).filter(([, v]) => v !== undefined && v !== '' && v !== null);
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
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<InputTab>('paste');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('input');
  const [rows, setRows] = useState<ExtractedEntity[]>([]);
  const [committed, setCommitted] = useState<CommittedEntity[]>([]);
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
        expanded: false,
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

  const toggleExpand = useCallback((id: string) => {
    setRows(rs => rs.map(r => r.id === id ? { ...r, expanded: !r.expanded } : r));
  }, []);

  const updateRowName = useCallback((id: string, name: string) => {
    setRows(rs => rs.map(r => r.id === id ? { ...r, name } : r));
  }, []);

  const commit = useCallback(async () => {
    const accepted = rows.filter(r => r.accepted);
    
    try {
      // Build a map of entity names for reference resolution
      const nameToRow = new Map(accepted.map(row => [row.name.toLowerCase(), row]));
      const createdEntities: typeof accepted = [];
      const nameToId = new Map<string, string>();
      
      // Helper to check if an entity has unresolved references
      const hasUnresolvedRefs = (row: typeof accepted[0]) => {
        const schema = schemas.find(s => s.id === row.schema_id);
        if (!schema) return false;
        
        const refFields = schema.fields.filter(f => f.type === 'reference' || f.type === 'containment');
        return refFields.some(field => {
          const value = row.fields[field.id];
          if (!value || typeof value !== 'string') return false;
          
          // Check if any referenced entity names haven't been created yet
          const refNames = value.split(',').map(n => n.trim().toLowerCase()).filter(Boolean);
          return refNames.some(name => nameToRow.has(name) && !nameToId.has(name));
        });
      };
      
      // Create entities in order, resolving references as we go
      const remaining = [...accepted];
      let lastCount = remaining.length;
      
      while (remaining.length > 0) {
        // Find entities that can be created (no unresolved references)
        const canCreate = remaining.filter(row => !hasUnresolvedRefs(row));
        
        if (canCreate.length === 0) {
          // No progress possible - create remaining entities without resolving refs
          console.warn('Circular or unresolvable references detected, creating remaining entities');
          for (const row of remaining) {
            const entity = await createEntity(workspaceSlug, {
              _schemaId: row.schema_id,
              _name: row.name,
              _description: '',
              ...row.fields,
            });
            nameToId.set(row.name.toLowerCase(), entity._uid);
            createdEntities.push(row);
          }
          break;
        }
        
        // Create entities that are ready
        for (const row of canCreate) {
          const schema = schemas.find(s => s.id === row.schema_id);
          const fields = { ...row.fields };
          
          // Resolve reference/containment fields to IDs
          if (schema) {
            const refFields = schema.fields.filter(f => f.type === 'reference' || f.type === 'containment');
            
            for (const field of refFields) {
              // Check both field.id and field.name as keys (AI might use either)
              let value = fields[field.id];
              if (!value) {
                // Try field name as fallback
                value = fields[field.name];
                if (value) {
                  // Move from name key to id key
                  delete fields[field.name];
                  fields[field.id] = value;
                }
              }
              
              if (value && typeof value === 'string') {
                const refNames = value.split(',').map(n => n.trim()).filter(Boolean);
                const refIds = refNames
                  .map(name => nameToId.get(name.toLowerCase()))
                  .filter((id): id is string => id !== undefined);
                
                if (refIds.length > 0) {
                  fields[field.id] = refIds.join(',');
                } else {
                  delete fields[field.id];
                }
              }
            }
          }
          
          const entity = await createEntity(workspaceSlug, {
            _schemaId: row.schema_id,
            _name: row.name,
            _description: '',
            ...fields,
          });
          nameToId.set(row.name.toLowerCase(), entity._uid);
          createdEntities.push(row);
          remaining.splice(remaining.indexOf(row), 1);
        }
        
        // Safety check for infinite loops
        if (remaining.length === lastCount) {
          throw new Error('Unable to resolve entity references');
        }
        lastCount = remaining.length;
      }
      
      setCommitted(createdEntities.map(row => ({ 
        id: nameToId.get(row.name.toLowerCase()) ?? row.id, 
        name: row.name, 
        schema_id: row.schema_id 
      })));
      
      // Invalidate entity and schema queries to update counts and lists
      await queryClient.invalidateQueries({ queryKey: entityKeys.all });
      await queryClient.invalidateQueries({ queryKey: schemaKeys.list(workspaceSlug) });
      
      setPhase('done');
    } catch (error) {
      console.error('Failed to create entities:', error);
      alert('Failed to create entities. Please try again.');
    }
  }, [rows, workspaceSlug, schemas, queryClient]);

  const reset = useCallback(() => {
    setText('');
    setFile(null);
    setRows([]);
    setCommitted([]);
    setPhase('input');
    setTab('paste');
  }, []);

  const acceptedCount = rows.filter(r => r.accepted).length;
  const schemaMap = new Map(schemas.map(s => [s.id, s]));

  return (
    <div className={styles.extract}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.eyebrow}><TbWand size={11} /> Extract</div>
          <div className={styles.title}>Find entities in content</div>
          <div className={styles.desc}>
            Paste a doc or drop a file. The assistant detects components, APIs and services,
            maps them to your schema, and lets you review before anything is saved.
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
                  <div className={styles.dropFileName}>{file.name}</div>
                  <div className={styles.dropSub}>{(file.size / 1024).toFixed(1)} KB · click to replace</div>
                </>
              ) : (
                <>
                  <div className={styles.dropFileName}>Drop a file or click to browse</div>
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
          <div className={styles.scanPulse}><TbWand size={22} /></div>
          <div className={styles.scanTitle}>Scanning content…</div>
          <div className={styles.scanSub}>Detecting entities and mapping to your schema</div>
        </div>
      )}

      {phase === 'review' && (
        <div className={styles.reviewPhase}>
          <div className={styles.reviewBar}>
            <div className={styles.reviewBarL}>
              <b>{rows.length}</b> detected &middot;{' '}
              <span className={styles.sumAdd}><b>{acceptedCount}</b> to add</span>
            </div>
            <button type="button" className={styles.ghostBtn} onClick={() => setRows(rs => rs.map(r => ({ ...r, accepted: true })))}>
              Reset selection
            </button>
          </div>

          <div className={styles.tableScroll}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.thExp} />
                  <th className={styles.thCheck} />
                  <th>Name</th>
                  <th>Change</th>
                  <th>Type</th>
                  <th>Confidence</th>
                  <th>Source</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <React.Fragment key={r.id}>
                    <tr
                      className={`${r.accepted ? '' : styles.rowRejected} ${r.expanded ? styles.rowExpanded : ''}`}
                    >
                      <td className={styles.tdExp}>
                        <button
                          type="button"
                          className={`${styles.expBtn} ${r.expanded ? styles.expBtnOpen : ''}`}
                          title={r.expanded ? 'Collapse' : 'Expand fields'}
                          onClick={() => toggleExpand(r.id)}
                        >
                          <TbChevronRight size={12} />
                        </button>
                      </td>
                      <td className={styles.tdCheck}>
                        <input type="checkbox" checked={r.accepted} onChange={() => toggleRow(r.id)} />
                      </td>
                      <td>
                        <input
                          className={`${styles.cellInput} ${styles.cellInputName}`}
                          value={r.name}
                          onChange={e => updateRowName(r.id, e.target.value)}
                        />
                      </td>
                      <td>
                        <span className={`${styles.actionPill} ${styles.actionAdd}`}>
                          <TbPlus size={10} /> Add
                        </span>
                      </td>
                      <td>
                        <span className={styles.typeTag}>
                          {schemaMap.get(r.schema_id)?.name ?? r.schema_id}
                        </span>
                      </td>
                      <td>
                        <div className={styles.conf}>
                          <div className={`${styles.confBar} ${r.confidence > 0.85 ? styles.confHi : r.confidence > 0.7 ? styles.confMid : styles.confLo}`}
                            style={{ width: `${Math.round(r.confidence * 100)}%` }} />
                          <span className={styles.confNum}>{Math.round(r.confidence * 100)}%</span>
                        </div>
                      </td>
                      <td className={styles.tdSource} title={r.source}>{r.source}</td>
                      <td>
                        <button
                          type="button"
                          className={styles.rejectBtn}
                          title={r.accepted ? 'Reject' : 'Accept'}
                          onClick={() => toggleRow(r.id)}
                        >
                          {r.accepted ? <TbX size={12} /> : <TbPlus size={12} />}
                        </button>
                      </td>
                    </tr>
                    {r.expanded && (
                      <tr className={styles.detailRow}>
                        <td colSpan={8}>
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
            <button type="button" className={styles.ghostBtn} onClick={() => setPhase('input')}>
              Back
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={acceptedCount === 0}
              onClick={commit}
            >
              <TbCheck size={12} /> Add {acceptedCount} {acceptedCount === 1 ? 'entity' : 'entities'}
            </button>
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className={styles.donePhase}>
          <div className={styles.doneCheck}><TbCheck size={24} /></div>
          <div className={styles.doneTitle}>
            Added {committed.length} {committed.length === 1 ? 'entity' : 'entities'}
          </div>
          <div className={styles.doneSub}>
            New entities are saved as <b>Proposed</b> and can be reviewed before publishing.
          </div>
          <div className={styles.doneList}>
            {committed.map(e => (
              <button
                key={e.id}
                type="button"
                className={styles.doneItem}
                onClick={() => navigate({
                  to: '/$workspaceSlug/entities',
                  params: { workspaceSlug },
                })}
              >
                <span className={`${styles.actionPill} ${styles.actionAdd}`}>
                  <TbPlus size={10} /> Add
                </span>
                <span className={styles.doneItemSchema}>{schemaMap.get(e.schema_id)?.name ?? e.schema_id}</span>
                <span className={styles.doneItemName}>{e.name}</span>
                <TbChevronRight size={11} className={styles.doneItemChevron} />
              </button>
            ))}
          </div>
          <div className={styles.doneActions}>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => navigate({
                to: '/$workspaceSlug/entities',
                params: { workspaceSlug },
              })}
            >
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
