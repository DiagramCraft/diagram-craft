import { useCallback, useMemo, useRef, useState } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { commitCsvImport, downloadCsvTemplate, parseCsvImport } from '../../lib/entityCsv';
import { downloadBlob } from '../../lib/browserDownload';
import { entityKeys, schemaKeys } from '../../hooks/queryKeys';
import {
  buildImportCommitEntities,
  toImportReviewRow,
  type ImportReviewRow
} from './importReviewState';

export type ImportPhase = 'upload' | 'parsing' | 'review' | 'done';
export type CommittedImportEntity = { id: string; name: string };
const routeApi = getRouteApi('/authenticated/$workspaceSlug/entities/import');

export const useImportController = () => {
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const navigate = routeApi.useNavigate();
  const queryClient = useQueryClient();
  const search = routeApi.useSearch();
  const [phase, setPhase] = useState<ImportPhase>('upload');
  const [selectedSchemaId, setSelectedSchemaId] = useState(search.type ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ImportReviewRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [committed, setCommitted] = useState<CommittedImportEntity[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const schemaName = schemas.find(schema => schema.id === selectedSchemaId)?.name ?? '';

  const handleDownloadTemplate = useCallback(async () => {
    if (!selectedSchemaId) return;
    try {
      const blob = await downloadCsvTemplate(workspaceSlug, selectedSchemaId);
      downloadBlob(blob, `${schemaName.toLowerCase().replace(/\s+/g, '-')}-import-template.csv`);
    } catch (error) {
      console.error('Failed to download template:', error);
      alert('Failed to download template. Please try again.');
    }
  }, [schemaName, selectedSchemaId, workspaceSlug]);
  const runParse = useCallback(async () => {
    if (!file || !selectedSchemaId) return;
    setPhase('parsing');
    try {
      const result = await parseCsvImport(workspaceSlug, selectedSchemaId, await file.text());
      setRows(result.entities.map(toImportReviewRow));
      setTotalRows(result.totalRows);
      setPhase('review');
    } catch (error) {
      console.error('Failed to parse CSV:', error);
      alert('Failed to parse CSV. Please check the file format and try again.');
      setPhase('upload');
    }
  }, [file, selectedSchemaId, workspaceSlug]);
  const updateRow = useCallback(
    (rowNumber: number, update: (row: ImportReviewRow) => ImportReviewRow) => {
      setRows(current => current.map(row => (row.rowNumber === rowNumber ? update(row) : row)));
    },
    []
  );
  const toggleRow = useCallback(
    (rowNumber: number) => updateRow(rowNumber, row => ({ ...row, accepted: !row.accepted })),
    [updateRow]
  );
  const toggleExpand = useCallback(
    (rowNumber: number) => updateRow(rowNumber, row => ({ ...row, expanded: !row.expanded })),
    [updateRow]
  );
  const setUserChoice = useCallback(
    (rowNumber: number, choice: 'update' | 'create') =>
      updateRow(rowNumber, row => ({
        ...row,
        userChoice: choice,
        accepted: true,
        isUpdate: choice === 'update'
      })),
    [updateRow]
  );
  const commit = useCallback(async () => {
    try {
      const accepted = rows.filter(row => row.accepted && row.entity);
      const result = await commitCsvImport(
        workspaceSlug,
        selectedSchemaId,
        buildImportCommitEntities(rows, selectedSchemaId)
      );
      setCommitted(
        accepted.map((row, index) => ({
          id: result.ids[index] ?? `imported-${index}`,
          name: (row.entity!._name as string) ?? `Row ${row.rowNumber}`
        }))
      );
      await queryClient.invalidateQueries({ queryKey: entityKeys.all });
      await queryClient.invalidateQueries({ queryKey: schemaKeys.list(workspaceSlug) });
      setPhase('done');
    } catch (error) {
      console.error('Failed to import entities:', error);
      alert('Failed to import entities. Please try again.');
    }
  }, [queryClient, rows, selectedSchemaId, workspaceSlug]);
  const reset = useCallback(() => {
    setFile(null);
    setRows([]);
    setCommitted([]);
    setSelectedSchemaId('');
    setPhase('upload');
  }, []);
  const viewEntities = useCallback(
    () =>
      navigate({
        to: '/$workspaceSlug/entities',
        params: { workspaceSlug }
      }),
    [navigate, workspaceSlug]
  );
  const counts = useMemo(() => {
    const acceptedCount = rows.filter(row => row.accepted).length;
    const updateCount = rows.filter(row => row.accepted && row.isUpdate).length;
    return { acceptedCount, updateCount, createCount: acceptedCount - updateCount };
  }, [rows]);

  return {
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
    ...counts
  };
};
