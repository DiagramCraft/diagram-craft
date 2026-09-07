import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type {
  DocumentGeneratedMetadata,
  DocumentMetadata,
  DocumentTemplate,
  DocumentType
} from '@arch-register/api-types/documentContract';
import type { GovernanceInitiationField } from '@arch-register/api-types/governanceInitiationFields';
import type { GovernanceWorkflowConfigRow } from '@arch-register/api-types/governanceWorkflowConfigContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import type { MarkdownContent } from '@arch-register/api-types/projectMarkdownContract';
import { extractFirstHeadingTitle } from './preview/markdownTitle';
import { hasWorkflowFields } from './markdownChangeImpact';

type MetadataValue = string | number | boolean | string[] | null | undefined;

type MarkdownEditorDocumentState = {
  body: string;
  documentTypeId: string | null;
  metadata: DocumentMetadata;
  generatedMetadata: DocumentGeneratedMetadata;
  dirty: boolean;
};

type MarkdownEditorDocumentAction =
  | { type: 'reset' }
  | {
      type: 'hydrate';
      body: string;
      documentTypeId: string | null;
      metadata: DocumentMetadata;
      generatedMetadata: DocumentGeneratedMetadata;
      dirty: boolean;
    }
  | { type: 'set-body'; body: string }
  | { type: 'set-document-type'; documentTypeId: string | null }
  | { type: 'set-metadata'; fieldId: string; value: MetadataValue }
  | { type: 'mark-clean' };

const emptyDocumentState = (): MarkdownEditorDocumentState => ({
  body: '',
  documentTypeId: null,
  metadata: {},
  generatedMetadata: {},
  dirty: false
});

const createInitialDocumentState = (
  isDraft: boolean,
  draftType: string | null
): MarkdownEditorDocumentState => ({
  ...emptyDocumentState(),
  documentTypeId: isDraft ? draftType : null,
  dirty: isDraft
});

const reduceDocumentState = (
  state: MarkdownEditorDocumentState,
  action: MarkdownEditorDocumentAction
): MarkdownEditorDocumentState => {
  switch (action.type) {
    case 'reset':
      return emptyDocumentState();
    case 'hydrate':
      return {
        body: action.body,
        documentTypeId: action.documentTypeId,
        metadata: action.metadata,
        generatedMetadata: action.generatedMetadata,
        dirty: action.dirty
      };
    case 'set-body':
      return { ...state, body: action.body, dirty: true };
    case 'set-document-type':
      return { ...state, documentTypeId: action.documentTypeId, dirty: true };
    case 'set-metadata': {
      if (action.value === undefined) {
        const metadata = { ...state.metadata };
        delete metadata[action.fieldId];
        return { ...state, metadata, dirty: true };
      }

      return {
        ...state,
        metadata: { ...state.metadata, [action.fieldId]: action.value },
        dirty: true
      };
    }
    case 'mark-clean':
      return { ...state, dirty: false };
  }
};

export type MarkdownEditorDocumentStateOptions = {
  nodeId: string;
  isDraft: boolean;
  data: MarkdownContent | undefined;
  documentTitle: string;
  draft: {
    name: string;
    type: string | null;
    template: string | null;
    templates: DocumentTemplate[];
    templatesLoading: boolean;
  };
  documentTypes: DocumentType[];
  documentTypesLoading: boolean;
  governanceWorkflowConfig: { configs: GovernanceWorkflowConfigRow[] } | undefined;
  workspaceEnums: WorkspaceEnum[];
};

export const useMarkdownEditorDocumentState = ({
  nodeId,
  isDraft,
  data,
  documentTitle,
  draft,
  documentTypes,
  documentTypesLoading,
  governanceWorkflowConfig,
  workspaceEnums
}: MarkdownEditorDocumentStateOptions) => {
  const [state, dispatch] = useReducer(
    reduceDocumentState,
    createInitialDocumentState(isDraft, draft.type)
  );
  const initializedRef = useRef(false);
  const previousNodeIdRef = useRef(nodeId);

  useEffect(() => {
    if (previousNodeIdRef.current === nodeId) return;
    previousNodeIdRef.current = nodeId;
    initializedRef.current = false;
    dispatch({ type: 'reset' });
  }, [nodeId]);

  useEffect(() => {
    if (isDraft || !data) return;
    if (!initializedRef.current) {
      dispatch({
        type: 'hydrate',
        body: data.body,
        documentTypeId: data.document_type_id,
        metadata: data.metadata,
        generatedMetadata: data.generated_metadata ?? {},
        dirty: false
      });
      initializedRef.current = true;
      return;
    }

    if (!state.dirty) {
      dispatch({
        type: 'hydrate',
        body: data.body,
        documentTypeId: data.document_type_id,
        metadata: data.metadata,
        generatedMetadata: data.generated_metadata ?? {},
        dirty: false
      });
    }
  }, [data, isDraft, state.dirty]);

  useEffect(() => {
    if (!isDraft || initializedRef.current || documentTypesLoading || draft.templatesLoading) {
      return;
    }

    const template = draft.templates.find(item => item.id === draft.template);
    dispatch({
      type: 'hydrate',
      body: template ? template.body.split('{{title}}').join(draft.name) : '',
      documentTypeId: template?.document_type_id ?? draft.type,
      metadata: template?.metadata_defaults ?? {},
      generatedMetadata: {},
      dirty: true
    });
    initializedRef.current = true;
  }, [documentTypesLoading, draft, isDraft]);

  const headingTitle = useMemo(() => extractFirstHeadingTitle(state.body), [state.body]);
  const resolvedTitle = headingTitle ?? documentTitle;
  const toc = useMemo(
    () => state.body.match(/^## .+$/gm)?.map(line => line.slice(3).trim()) ?? [],
    [state.body]
  );
  const readTime = useMemo(
    () => Math.max(1, Math.round(state.body.split(/\s+/).filter(Boolean).length / 200)),
    [state.body]
  );
  const availableDocumentTypes = useMemo(() => {
    if (!data?.document_type || documentTypes.some(type => type.id === data.document_type?.id)) {
      return documentTypes;
    }
    return [...documentTypes, data.document_type];
  }, [data?.document_type, documentTypes]);
  const selectedDocumentType = state.documentTypeId
    ? (availableDocumentTypes.find(type => type.id === state.documentTypeId) ?? null)
    : null;
  const documentFields =
    state.documentTypeId == null
      ? []
      : (selectedDocumentType?.fields ?? data?.available_fields ?? []);
  const workflowEnabled = hasWorkflowFields(documentFields);
  const documentInitiationFields = useMemo<GovernanceInitiationField[]>(() => {
    if (!state.documentTypeId) return [];
    const seen = new Set<string>();
    return (governanceWorkflowConfig?.configs ?? [])
      .filter(
        row =>
          row.case_kind === 'document.status' &&
          row.case_subkind?.startsWith(`${state.documentTypeId}:`)
      )
      .flatMap(row => row.config.initiationFields ?? [])
      .map(field =>
        field.type === 'enum' && !field.options && field.enumId
          ? {
              ...field,
              options: workspaceEnums.find(item => item.id === field.enumId)?.options ?? []
            }
          : field
      )
      .filter(field => {
        if (seen.has(field.id)) return false;
        seen.add(field.id);
        return true;
      });
  }, [governanceWorkflowConfig?.configs, state.documentTypeId, workspaceEnums]);

  const onChange = useCallback((body: string) => {
    dispatch({ type: 'set-body', body });
  }, []);

  const onDocumentTypeChange = useCallback((documentTypeId: string | null) => {
    dispatch({ type: 'set-document-type', documentTypeId });
  }, []);

  const onMetadataChange = useCallback((fieldId: string, value: MetadataValue) => {
    dispatch({ type: 'set-metadata', fieldId, value });
  }, []);

  const markClean = useCallback(() => {
    dispatch({ type: 'mark-clean' });
  }, []);

  const resetToSaved = useCallback(() => {
    if (!data) {
      dispatch({ type: 'reset' });
      return;
    }

    dispatch({
      type: 'hydrate',
      body: data.body,
      documentTypeId: data.document_type_id,
      metadata: data.metadata,
      generatedMetadata: data.generated_metadata ?? {},
      dirty: false
    });
  }, [data]);

  return {
    body: state.body,
    documentTypeId: state.documentTypeId,
    metadata: state.metadata,
    generatedMetadata: state.generatedMetadata,
    dirty: state.dirty,
    resolvedTitle,
    toc,
    readTime,
    headingTitle,
    availableDocumentTypes,
    selectedDocumentType,
    documentFields,
    workflowEnabled,
    documentInitiationFields,
    workflow: data?.workflow,
    onChange,
    onDocumentTypeChange,
    onMetadataChange,
    markClean,
    resetToSaved
  };
};
