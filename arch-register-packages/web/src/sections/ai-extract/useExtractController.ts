import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { orpcClient } from '../../lib/orpcClient';
import { createExtractedEntities } from '../../lib/extractOperations';
import { invalidateEntityQueries } from '../../queries/entities';
import { schemaKeys } from '../../queries/schemas';
import {
  buildExtractCommitInput,
  normalizeExtractedEntities,
  toCommittedExtractEntities,
  updateExtractRow,
  type CommittedExtractEntity,
  type ExtractedEntity,
  type ExtractInputTab,
  type ExtractPhase
} from './extractReviewState';

export const useExtractController = () => {
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<ExtractInputTab>('paste');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<ExtractPhase>('input');
  const [rows, setRows] = useState<ExtractedEntity[]>([]);
  const [committed, setCommitted] = useState<CommittedExtractEntity[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const readFile = useCallback(async (nextFile: File) => {
    setFile(nextFile);
    setText(await nextFile.text());
  }, []);
  const runExtract = useCallback(async () => {
    setPhase('scanning');
    try {
      const result = await orpcClient.ai.extract({
        params: { workspace: workspaceSlug },
        body: { text }
      });
      setRows(normalizeExtractedEntities(result.entities ?? []));
      setPhase('review');
    } catch {
      setPhase('input');
    }
  }, [text, workspaceSlug]);
  const toggleRow = useCallback(
    (id: string) =>
      setRows(current =>
        updateExtractRow(current, id, row => ({ ...row, accepted: !row.accepted }))
      ),
    []
  );
  const toggleExpand = useCallback(
    (id: string) =>
      setRows(current =>
        updateExtractRow(current, id, row => ({ ...row, expanded: !row.expanded }))
      ),
    []
  );
  const updateRowName = useCallback(
    (id: string, name: string) =>
      setRows(current => updateExtractRow(current, id, row => ({ ...row, name }))),
    []
  );
  const acceptAll = useCallback(
    () => setRows(current => current.map(row => ({ ...row, accepted: true }))),
    []
  );
  const commit = useCallback(async () => {
    try {
      const created = await createExtractedEntities(workspaceSlug, buildExtractCommitInput(rows));
      setCommitted(toCommittedExtractEntities(created));
      await invalidateEntityQueries(queryClient, workspaceSlug);
      await queryClient.invalidateQueries({ queryKey: schemaKeys.list(workspaceSlug) });
      setPhase('done');
    } catch (error) {
      console.error('Failed to create entities:', error);
      alert('Failed to create entities. Please try again.');
    }
  }, [queryClient, rows, workspaceSlug]);
  const reset = useCallback(() => {
    setText('');
    setFile(null);
    setRows([]);
    setCommitted([]);
    setPhase('input');
    setTab('paste');
  }, []);
  const viewEntities = useCallback(
    () =>
      navigate({
        to: '/$workspaceSlug/entities',
        params: { workspaceSlug }
      }),
    [navigate, workspaceSlug]
  );
  const schemaMap = useMemo(() => new Map(schemas.map(schema => [schema.id, schema])), [schemas]);

  return {
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
    acceptedCount: rows.filter(row => row.accepted).length,
    schemaMap
  };
};
