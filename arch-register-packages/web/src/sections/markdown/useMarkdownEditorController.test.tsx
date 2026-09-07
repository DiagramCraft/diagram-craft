// @vitest-environment jsdom
import { act, type ChangeEvent } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentAiAction, DocumentType } from '@arch-register/api-types/documentContract';
import type { MarkdownContent } from '@arch-register/api-types/projectMarkdownContract';
import type { ProjectFile } from '@arch-register/api-types/projectContentContract';
import type { RunAiActionResponse } from '@arch-register/api-types/projectDocumentAiContract';
import {
  useMarkdownEditorController,
  type MarkdownEditorController,
  type MarkdownEditorControllerOptions
} from './useMarkdownEditorController';

const mocks = vi.hoisted(() => ({
  save: { mutateAsync: vi.fn(), isPending: false },
  migrate: { mutateAsync: vi.fn(), isPending: false },
  saveNew: { mutateAsync: vi.fn(), isPending: false },
  restore: { mutateAsync: vi.fn(), isPending: false },
  uploadAttachment: { mutateAsync: vi.fn(), isPending: false },
  deleteAttachment: { mutateAsync: vi.fn(), isPending: false },
  createConversation: { mutateAsync: vi.fn(), isPending: false },
  runAiAction: vi.fn(),
  writeAiActionSeed: vi.fn(),
  closeFlow: {
    closeDialogOpen: false,
    closeSummary: null,
    clearCloseSummary: vi.fn(),
    handleClose: vi.fn(),
    handleCancelClose: vi.fn(),
    handleKeepDiagramChanges: vi.fn(),
    handleRevertEligibleDiagramChanges: vi.fn()
  }
}));

vi.mock('../../hooks/useMarkdownContent', () => ({
  useSaveMarkdownContent: () => mocks.save,
  useMigrateMarkdownContent: () => mocks.migrate,
  useSaveNewMarkdownContent: () => mocks.saveNew,
  useRestoreMarkdownRevision: () => mocks.restore
}));

vi.mock('../../hooks/useAttachments', () => ({
  useUploadMarkdownAttachment: () => mocks.uploadAttachment,
  useDeleteMarkdownAttachment: () => mocks.deleteAttachment
}));

vi.mock('../../hooks/useAiConversations', () => ({
  useCreateConversation: () => mocks.createConversation
}));

vi.mock('../../hooks/useAiConfig', () => ({
  useAiStatus: () => ({ data: { configured: true } })
}));

vi.mock('../../hooks/useDocumentAiActions', () => ({
  runDocumentAiAction: (...args: unknown[]) => mocks.runAiAction(...args)
}));

vi.mock('../../lib/aiActionSeed', () => ({
  writeAiActionSeed: (...args: unknown[]) => mocks.writeAiActionSeed(...args)
}));

vi.mock('./useMarkdownCloseFlow', () => ({
  useMarkdownCloseFlow: () => mocks.closeFlow
}));

vi.mock('./MarkdownPropertiesPanel', () => ({
  validateDocMetadata: () => ({ errors: {} })
}));

const makeFile = (type: ProjectFile['type'] = 'markdown') =>
  ({
    id: 'file-1',
    name: 'Document',
    path: 'Document.md',
    type,
    read_only: false
  }) as ProjectFile;

const makeContent = (body = 'Saved body', documentTypeId: string | null = 'type-1') =>
  ({
    body,
    attachments: [],
    document_type: null,
    document_type_id: documentTypeId,
    metadata: {},
    generated_metadata: {},
    available_fields: [],
    retired_fields: [],
    workflow: []
  }) as MarkdownContent;

const makeDocumentType = (fields: unknown[] = []) =>
  ({ id: 'type-1', name: 'Document type', fields, aiActions: [] }) as unknown as DocumentType;

const makeDiagram = (): MarkdownEditorControllerOptions['diagram'] => ({
  sessionId: 'session-1',
  createdDiagramsRef: { current: [] },
  hasPendingDiagramChanges: false,
  clearDiagramSessionState: vi.fn(),
  rotateDiagramSession: vi.fn(),
  resetForNewDocument: vi.fn(),
  loadDiagramContentByPath: vi.fn(async () => ({})),
  saveDiagramContentByPath: vi.fn(async () => undefined),
  refreshDiagramPreviewCaches: vi.fn(async () => undefined)
});

type MarkdownEditorControllerTestOverrides = {
  context?: Partial<MarkdownEditorControllerOptions['context']>;
  draft?: Partial<MarkdownEditorControllerOptions['draft']>;
  config?: Partial<MarkdownEditorControllerOptions['config']>;
  navigation?: Partial<MarkdownEditorControllerOptions['navigation']>;
  attachments?: Partial<MarkdownEditorControllerOptions['attachments']>;
  file?: Partial<MarkdownEditorControllerOptions['file']>;
  diagram?: Partial<MarkdownEditorControllerOptions['diagram']>;
};

const makeOptions = (
  overrides: MarkdownEditorControllerTestOverrides = {}
): MarkdownEditorControllerOptions => ({
  context: {
    workspaceSlug: 'workspace',
    nodeId: 'node-1',
    isDraft: false,
    isReadOnly: false,
    data: makeContent(),
    file: makeFile(),
    documentTitle: 'Document',
    contentScope: { kind: 'workspace', workspaceId: 'workspace' },
    ...overrides.context
  },
  draft: {
    name: 'Draft document',
    type: null,
    template: null,
    templates: [],
    templatesLoading: false,
    ...overrides.draft
  },
  config: {
    documentTypes: [makeDocumentType()],
    documentTypesLoading: false,
    governanceWorkflowConfig: undefined,
    workspaceEnums: [],
    ...overrides.config
  },
  navigation: {
    requestedMode: 'edit',
    requestedPanel: 'preview',
    diagramSessionId: 'session-1',
    historyMode: 'preview',
    compareMode: 'to-current',
    selectedRevisionId: undefined,
    revisions: [],
    revisionsLoading: false,
    updatedLabel: null,
    updateSearch: vi.fn(),
    onNavigateBack: vi.fn(),
    onNavigateToSavedDraft: vi.fn(),
    onExit: vi.fn(),
    onNavigateToConversation: vi.fn(),
    ...overrides.navigation
  },
  attachments: {
    onOpenAttachment: vi.fn(),
    onDownloadAttachment: vi.fn(),
    ...overrides.attachments
  },
  file: {
    renameFile: vi.fn(async () => undefined),
    deleteFile: vi.fn(async () => undefined),
    ...overrides.file
  },
  diagram: { ...makeDiagram(), ...overrides.diagram }
});

let latest!: MarkdownEditorController;
let root: Root | undefined;
let container: HTMLDivElement | undefined;

const ControllerHarness = ({ options }: { options: MarkdownEditorControllerOptions }) => {
  latest = useMarkdownEditorController(options);
  return null;
};

const renderController = (options: MarkdownEditorControllerOptions) => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(<ControllerHarness options={options} />);
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.saveNew.mutateAsync.mockResolvedValue(makeFile());
  mocks.save.mutateAsync.mockResolvedValue({});
  mocks.migrate.mutateAsync.mockResolvedValue({});
  mocks.restore.mutateAsync.mockResolvedValue({});
  mocks.uploadAttachment.mutateAsync.mockResolvedValue({});
  mocks.deleteAttachment.mutateAsync.mockResolvedValue({});
  mocks.createConversation.mutateAsync.mockResolvedValue({ id: 'conversation-1' });
  mocks.runAiAction.mockResolvedValue({
    actionId: 'summarize',
    actionName: 'Summarize',
    prompt: 'Summarize this document',
    answer: 'Summary',
    documentTitle: 'Document',
    nodeId: 'node-1'
  } satisfies RunAiActionResponse);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

describe('useMarkdownEditorController', () => {
  it('saves a draft using the resolved heading title and navigates to the saved file', async () => {
    const options = makeOptions({
      context: {
        isDraft: true,
        nodeId: '',
        data: undefined,
        file: undefined,
        documentTitle: 'Draft document'
      }
    });
    renderController(options);

    act(() => {
      latest.document.onChange('# Draft title\n\nBody');
    });
    await act(async () => {
      await latest.save.onSave();
    });

    expect(mocks.saveNew.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Draft title',
        body: '# Draft title\n\nBody',
        document_type_id: null,
        metadata: {}
      })
    );
    expect(options.navigation.onNavigateToSavedDraft).toHaveBeenCalledWith(makeFile());
  });

  it('uses the normal save for an existing document and migration when its type changes', async () => {
    renderController(makeOptions());

    act(() => {
      latest.document.onChange('# Updated');
    });
    await act(async () => {
      await latest.save.onSave();
    });

    expect(mocks.save.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        body: '# Updated',
        document_type_id: 'type-1',
        change_kind: 'minor'
      })
    );

    act(() => {
      latest.document.onDocumentTypeChange('type-2');
    });
    await act(async () => {
      await latest.save.onSave();
    });

    expect(mocks.migrate.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ document_type_id: 'type-2', change_kind: 'minor' })
    );
  });

  it('keeps the originating save intent and selected impact for workflow documents', async () => {
    const options = makeOptions({
      config: { documentTypes: [makeDocumentType([{ isStatus: true, retired: false }])] }
    });
    renderController(options);

    act(() => {
      latest.document.onChange('# Workflow change');
    });
    await act(async () => {
      await latest.save.onSaveAndClose();
    });

    expect(latest.save.workflow.pendingSaveIntent).toBe('save-and-close');
    expect(mocks.save.mutateAsync).not.toHaveBeenCalled();

    act(() => latest.save.workflow.setChangeKind('major'));
    await act(async () => {
      await latest.save.workflow.confirm();
    });

    expect(mocks.save.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ change_kind: 'major' })
    );
    expect(options.navigation.onExit).toHaveBeenCalledOnce();
  });

  it('delegates rename, delete, and attachment deletion confirmations', async () => {
    const options = makeOptions();
    renderController(options);

    act(() => latest.file.onRequestRename());
    expect(latest.file.renameOpen).toBe(true);
    await act(async () => {
      await latest.file.onRenameConfirm('Renamed document');
    });
    expect(options.file.renameFile).toHaveBeenCalledWith('Renamed document');
    expect(latest.file.renameOpen).toBe(false);

    act(() => latest.file.onRequestDelete());
    await act(async () => {
      await latest.file.onDeleteConfirm();
    });
    expect(options.file.deleteFile).toHaveBeenCalledOnce();
    expect(options.navigation.onNavigateBack).toHaveBeenCalledOnce();

    const attachment = makeFile('file');
    act(() => latest.attachments.onRequestDelete(attachment));
    await act(async () => {
      await latest.attachments.onDeleteConfirm();
    });
    expect(mocks.deleteAttachment.mutateAsync).toHaveBeenCalledWith(attachment.path);
  });

  it('routes attachment opens and runs AI actions through the controller', async () => {
    const options = makeOptions();
    renderController(options);

    const fileAttachment = makeFile('file');
    const markdownAttachment = makeFile('markdown');
    act(() => {
      latest.attachments.onOpen(fileAttachment);
      latest.attachments.onOpen(markdownAttachment);
    });
    expect(options.attachments.onDownloadAttachment).toHaveBeenCalledWith(fileAttachment);
    expect(options.attachments.onOpenAttachment).toHaveBeenCalledWith(markdownAttachment);

    const input = {
      target: {
        files: [new File(['attachment'], 'attachment.txt')],
        value: 'selected'
      }
    } as unknown as ChangeEvent<HTMLInputElement>;
    await act(async () => {
      await latest.attachments.onInputChange(input);
    });
    expect(mocks.uploadAttachment.mutateAsync).toHaveBeenCalledWith(input.target.files?.[0]);
    expect(input.target.value).toBe('');

    const action = { id: 'summarize', label: 'Summarize' } as unknown as DocumentAiAction;
    await act(async () => {
      await latest.ai.onRunAiAction(action);
    });
    expect(mocks.runAiAction).toHaveBeenCalledWith(
      'workspace',
      'node-1',
      'summarize',
      expect.any(Function)
    );
    expect(latest.ai.aiActionResult?.answer).toBe('Summary');

    await act(async () => {
      await latest.ai.onContinueInConversation(latest.ai.aiActionResult!);
    });
    expect(options.navigation.onNavigateToConversation).toHaveBeenCalledWith('conversation-1');
  });

  it('updates history search state and restores a revision', async () => {
    const options = makeOptions({
      navigation: {
        selectedRevisionId: 'revision-1',
        historyMode: 'compare',
        compareMode: 'to-current'
      }
    });
    renderController(options);

    act(() => latest.history.onSelectRevision('revision-2'));
    expect(options.navigation.updateSearch).toHaveBeenCalledWith({
      mode: 'preview',
      panel: 'history',
      revisionId: 'revision-2',
      historyMode: 'compare',
      compareMode: 'to-current',
      diagramSessionId: undefined
    });

    act(() => latest.history.onEnterCompare('changes-in-version'));
    expect(options.navigation.updateSearch).toHaveBeenLastCalledWith({
      mode: 'preview',
      panel: 'history',
      historyMode: 'compare',
      compareMode: 'changes-in-version',
      revisionId: 'revision-1',
      diagramSessionId: undefined
    });

    act(() => latest.history.onViewVersion());
    expect(options.navigation.updateSearch).toHaveBeenLastCalledWith({
      mode: 'preview',
      panel: 'history',
      revisionId: 'revision-1',
      historyMode: undefined,
      compareMode: undefined,
      diagramSessionId: undefined
    });

    await act(async () => {
      await latest.history.onRestore('revision-2');
    });
    expect(mocks.restore.mutateAsync).toHaveBeenCalledWith({
      revisionId: 'revision-2',
      change_kind: 'major'
    });
    expect(options.navigation.onExit).toHaveBeenCalledOnce();
  });
});
