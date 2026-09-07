// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { DocumentTemplate, DocumentType } from '@arch-register/api-types/documentContract';
import type { MarkdownContent } from '@arch-register/api-types/projectMarkdownContract';
import {
  useMarkdownEditorDocumentState,
  type MarkdownEditorDocumentStateOptions
} from './useMarkdownEditorDocumentState';

const makeContent = (body: string, documentTypeId: string | null = 'type-1') =>
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

const makeTemplate = (): DocumentTemplate =>
  ({
    id: 'template-1',
    name: 'Template',
    body: '# {{title}}\n\nTemplate body',
    document_type_id: 'type-1',
    metadata_defaults: { owner: 'Architecture' }
  }) as unknown as DocumentTemplate;

const makeOptions = (
  overrides: Partial<MarkdownEditorDocumentStateOptions> = {}
): MarkdownEditorDocumentStateOptions => ({
  nodeId: 'node-1',
  isDraft: false,
  data: makeContent('Saved body'),
  documentTitle: 'Document',
  draft: {
    name: 'Draft document',
    type: null,
    template: null,
    templates: [],
    templatesLoading: false
  },
  documentTypes: [makeDocumentType()],
  documentTypesLoading: false,
  governanceWorkflowConfig: undefined,
  workspaceEnums: [],
  ...overrides
});

let latest!: ReturnType<typeof useMarkdownEditorDocumentState>;
let root: Root | undefined;
let container: HTMLDivElement | undefined;

const Harness = ({ options }: { options: MarkdownEditorDocumentStateOptions }) => {
  latest = useMarkdownEditorDocumentState(options);
  return null;
};

const renderState = (options: MarkdownEditorDocumentStateOptions) => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(<Harness options={options} />);
  });
};

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

describe('useMarkdownEditorDocumentState', () => {
  it('hydrates existing content and protects edits from later query refreshes', () => {
    const options = makeOptions();
    renderState(options);

    expect(latest.body).toBe('Saved body');
    expect(latest.dirty).toBe(false);

    act(() => latest.onChange('Unsaved body'));
    expect(latest.dirty).toBe(true);

    act(() => {
      root!.render(<Harness options={{ ...options, data: makeContent('Refreshed body') }} />);
    });

    expect(latest.body).toBe('Unsaved body');
  });

  it('initializes a draft from the selected template after inputs finish loading', () => {
    const options = makeOptions({
      nodeId: '',
      isDraft: true,
      data: undefined,
      documentTitle: 'Draft document',
      draft: {
        name: 'Architecture overview',
        type: null,
        template: 'template-1',
        templates: [makeTemplate()],
        templatesLoading: true
      }
    });
    renderState(options);

    expect(latest.body).toBe('');

    act(() => {
      root!.render(
        <Harness
          options={{
            ...options,
            draft: { ...options.draft, templatesLoading: false }
          }}
        />
      );
    });

    expect(latest.body).toBe('# Architecture overview\n\nTemplate body');
    expect(latest.documentTypeId).toBe('type-1');
    expect(latest.metadata).toEqual({ owner: 'Architecture' });
    expect(latest.dirty).toBe(true);
  });

  it('resets document state when the node changes', () => {
    const options = makeOptions();
    renderState(options);

    act(() => latest.onChange('Unsaved body'));
    act(() => {
      root!.render(
        <Harness options={{ ...options, nodeId: 'node-2', data: makeContent('Next body') }} />
      );
    });

    expect(latest.body).toBe('Next body');
    expect(latest.dirty).toBe(false);
  });
});
