// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MarkdownContent } from '@arch-register/api-types/projectMarkdownContract';
import {
  useMarkdownEditorSaveWorkflow,
  type MarkdownEditorSaveWorkflowOptions
} from './useMarkdownEditorSaveWorkflow';
import type { useMarkdownEditorDocumentState } from './useMarkdownEditorDocumentState';

const mocks = vi.hoisted(() => ({
  save: { mutateAsync: vi.fn(), isPending: false },
  migrate: { mutateAsync: vi.fn(), isPending: false },
  saveNew: { mutateAsync: vi.fn(), isPending: false },
  validateDocMetadata: vi.fn()
}));

vi.mock('../../hooks/useMarkdownContent', () => ({
  useSaveMarkdownContent: () => mocks.save,
  useMigrateMarkdownContent: () => mocks.migrate,
  useSaveNewMarkdownContent: () => mocks.saveNew
}));

vi.mock('./MarkdownPropertiesPanel', () => ({
  validateDocMetadata: (...args: unknown[]) => mocks.validateDocMetadata(...args)
}));

const data = {
  body: 'Saved body',
  document_type_id: 'type-1'
} as MarkdownContent;

const makeDocument = (workflowEnabled = false) =>
  ({
    body: '# Updated',
    headingTitle: 'Updated',
    documentTypeId: 'type-1',
    metadata: {},
    documentFields: workflowEnabled ? [{ isStatus: true, retired: false }] : [],
    documentInitiationFields: [],
    workflowEnabled,
    resolvedTitle: 'Updated',
    dirty: true,
    markClean: vi.fn()
  }) as unknown as ReturnType<typeof useMarkdownEditorDocumentState>;

const makeOptions = (
  document: ReturnType<typeof useMarkdownEditorDocumentState>
): MarkdownEditorSaveWorkflowOptions => ({
  context: {
    workspaceSlug: 'workspace',
    nodeId: 'node-1',
    isDraft: false,
    isReadOnly: false,
    contentScope: { kind: 'workspace', workspaceId: 'workspace' }
  },
  data,
  document,
  diagram: {
    hasPendingDiagramChanges: false,
    rotateDiagramSession: vi.fn()
  },
  close: { clearCloseSummary: vi.fn() },
  transitions: {
    finalizeExit: vi.fn(() => true),
    finalizeBack: vi.fn(() => true),
    finalizeSavedDraft: vi.fn(() => true)
  }
});

let latest!: ReturnType<typeof useMarkdownEditorSaveWorkflow>;
let root: Root | undefined;
let container: HTMLDivElement | undefined;

const Harness = ({ options }: { options: MarkdownEditorSaveWorkflowOptions }) => {
  latest = useMarkdownEditorSaveWorkflow(options);
  return null;
};

const renderSave = (options: MarkdownEditorSaveWorkflowOptions) => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(<Harness options={options} />);
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.save.mutateAsync.mockResolvedValue({});
  mocks.migrate.mutateAsync.mockResolvedValue({});
  mocks.saveNew.mutateAsync.mockResolvedValue({});
  mocks.validateDocMetadata.mockReturnValue({ errors: {} });
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

describe('useMarkdownEditorSaveWorkflow', () => {
  it('uses the existing-document save mutation for a valid minor change', async () => {
    const options = makeOptions(makeDocument());
    renderSave(options);

    await act(async () => {
      await latest.onSave();
    });

    expect(mocks.save.mutateAsync).toHaveBeenCalledWith({
      body: '# Updated',
      name: 'Updated',
      document_type_id: 'type-1',
      metadata: {},
      change_kind: 'minor',
      initiation_fields: {}
    });
    expect(options.document.markClean).toHaveBeenCalledOnce();
  });

  it('keeps save-and-close intent until workflow impact is confirmed', async () => {
    const options = makeOptions(makeDocument(true));
    await act(async () => {
      renderSave(options);
    });

    await act(async () => {
      await latest.onSaveAndClose();
    });

    expect(latest.workflow.pendingSaveIntent).toBe('save-and-close');
    expect(mocks.save.mutateAsync).not.toHaveBeenCalled();

    act(() => latest.workflow.setChangeKind('major'));
    await act(async () => {
      await latest.workflow.confirm();
    });

    expect(mocks.save.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ change_kind: 'major' })
    );
    expect(options.transitions.finalizeExit).toHaveBeenCalledOnce();
  });
});
