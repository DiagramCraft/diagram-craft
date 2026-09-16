// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataStewardshipSidebar } from './DataStewardshipSidebar';
import {
  DS_CLASSIFICATION_ID,
  DS_MY_WORK_ID,
  DS_STEWARDSHIP_ID,
  type DataStewardshipRailItemId
} from '../dataStewardshipSections';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  entityList: vi.fn(),
  schemasList: vi.fn(),
  relationSchemasList: vi.fn(),
  capabilityConfigurationsList: vi.fn(),
  search: {} as Record<string, unknown>
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  useSearch: () => mocks.search
}));

vi.mock('../../../lib/orpcClient', () => ({
  orpcClient: {
    entities: { list: mocks.entityList },
    schemas: { list: mocks.schemasList },
    relationSchemas: { list: mocks.relationSchemasList },
    config: { capabilityConfigurations: { list: mocks.capabilityConfigurationsList } }
  }
}));

const CONFIG = {
  type: 'data-stewardship',
  valid: true,
  bindings: { dataEntity: { target: { kind: 'entity_schema', id: 'data-entity' } } }
};

describe('DataStewardshipSidebar', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  const flush = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));
  const renderSidebar = async (activeSection: DataStewardshipRailItemId = DS_STEWARDSHIP_ID) => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DataStewardshipSidebar workspaceSlug="ws-1" activeSection={activeSection} />
        </QueryClientProvider>
      );
    });
    for (let i = 0; i < 8; i++) await flush();
  };

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mocks.search = {};
    mocks.capabilityConfigurationsList.mockResolvedValue([CONFIG]);
    mocks.relationSchemasList.mockResolvedValue([]);
    mocks.schemasList.mockResolvedValue([
      {
        id: 'data-entity',
        name: 'Data Entity',
        fields: [
          {
            id: 'classification',
            name: 'Classification',
            type: 'select',
            options: [{ value: 'confidential', label: 'Confidential' }]
          }
        ]
      }
    ]);
    mocks.entityList.mockResolvedValue({
      items: [
        {
          _uid: 'ds-1',
          _publicId: 'DS-001',
          _name: 'Customer Records',
          classification: 'confidential'
        }
      ],
      total: 1
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    vi.clearAllMocks();
  });

  it('renders Stewardship facets — gap toggle and classification counts, but no dataset list', async () => {
    await renderSidebar(DS_STEWARDSHIP_ID);
    expect(container.textContent).toContain('All datasets');
    expect(container.textContent).toContain('With a coverage gap');
    expect(container.textContent).toContain('Confidential');
    expect(container.textContent).not.toContain('Customer Records');
  });

  it('narrows to a classification when its facet is clicked', async () => {
    await renderSidebar(DS_STEWARDSHIP_ID);
    const entry = container.querySelector(
      '[data-testid="data-stewardship-facet-classification-confidential"]'
    );
    expect(entry).toBeDefined();
    await act(async () => {
      entry!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/data-stewardship/stewardship',
        params: { workspaceSlug: 'ws-1' }
      })
    );
  });

  it('falls back to the plain section nav list for other sections', async () => {
    await renderSidebar(DS_MY_WORK_ID);
    expect(container.textContent).toContain('Sections');
    expect(container.textContent).toContain('My work');
    expect(container.textContent).not.toContain('With a coverage gap');
  });

  it('shows a not-enabled empty state when the capability is unconfigured', async () => {
    mocks.capabilityConfigurationsList.mockResolvedValue([]);
    await renderSidebar(DS_STEWARDSHIP_ID);
    expect(container.textContent).toContain('Data stewardship is not enabled.');
  });

  it('renders Classification facets — same shape as Stewardship, plus a personal-data toggle', async () => {
    await renderSidebar(DS_CLASSIFICATION_ID);
    expect(container.textContent).toContain('All datasets');
    expect(container.textContent).toContain('With a coverage gap');
    expect(container.textContent).toContain('Holds personal data');
    expect(container.textContent).toContain('Confidential');
    expect(container.textContent).not.toContain('Customer Records');
  });

  it('narrows to a classification when its Classification facet is clicked', async () => {
    await renderSidebar(DS_CLASSIFICATION_ID);
    const entry = container.querySelector(
      '[data-testid="data-stewardship-classification-facet-confidential"]'
    );
    expect(entry).toBeDefined();
    await act(async () => {
      entry!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/data-stewardship/classification',
        params: { workspaceSlug: 'ws-1' }
      })
    );
  });

  it('toggles the personal-data facet', async () => {
    await renderSidebar(DS_CLASSIFICATION_ID);
    const entry = container.querySelector(
      '[data-testid="data-stewardship-classification-facet-personal"]'
    );
    expect(entry).toBeDefined();
    await act(async () => {
      entry!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$workspaceSlug/data-stewardship/classification',
        params: { workspaceSlug: 'ws-1' }
      })
    );
  });
});
