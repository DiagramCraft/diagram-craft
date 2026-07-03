import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  SerializedDiagram,
  SerializedDiagramDocument,
  SerializedLayer,
} from '@diagram-craft/model/serialization/serializedTypes';
import { commitCsvImport, parseCsvImport, prepareTemplateDiagramDocument } from './api';

const importParseMock = vi.fn();
const importCommitMock = vi.fn();

vi.mock('./orpcClient', () => ({
  orpcClient: {
    entities: {
      importParse: importParseMock,
      importCommit: importCommitMock,
    },
  },
}));

const makeRegularLayer = (id: string): SerializedLayer => ({
  id,
  name: 'Default',
  type: 'layer',
  layerType: 'regular',
  elements: [],
  isLocked: false,
});

const makeDiagram = (
  id: string,
  name: string,
  nested: SerializedDiagram[] = []
): SerializedDiagram => ({
  id,
  name,
  layers: [makeRegularLayer(`${id}-layer`)],
  activeLayerId: `${id}-layer`,
  visibleLayers: [`${id}-layer`],
  diagrams: nested,
  comments: [],
  zoom: { x: 0, y: 0, zoom: 1 },
  canvas: { x: 0, y: 0, w: 100, h: 100 },
});

const makeDocument = (diagrams: SerializedDiagram[]): SerializedDiagramDocument & { name: string } => ({
  name: 'Template',
  diagrams,
  attachments: { 'asset-1': 'data:image/png;base64,aaa' },
  customPalette: ['#000000'],
  styles: {
    edgeStyles: [],
    nodeStyles: [],
    textStyles: [],
  },
  schemas: [],
  props: {
    stencils: ['default@@rect'],
    activeStencilPackages: ['archimate'],
    recentEdgeStylesheets: ['default-edge'],
    query: { history: [], saved: [] },
  },
  data: {
    providers: [],
    templates: [],
    overrides: {},
  },
  activeDiagramId: diagrams[0]?.id,
});

beforeEach(() => {
  importParseMock.mockReset();
  importCommitMock.mockReset();
});

describe('prepareTemplateDiagramDocument', () => {
  it('removes the first top-level tab and keeps the remaining order', () => {
    const input = makeDocument([
      makeDiagram('first', 'First'),
      makeDiagram('second', 'Second'),
      makeDiagram('third', 'Third'),
    ]);

    const result = prepareTemplateDiagramDocument(input, 'Copied Diagram');

    expect(result.name).toBe('Copied Diagram');
    expect(result.diagrams.map(diagram => diagram.id)).toEqual(['second', 'third']);
    expect(result.activeDiagramId).toBe('second');
    expect(result.attachments).toBe(input.attachments);
    expect(result.styles).toBe(input.styles);
    expect(result.data).toBe(input.data);
  });

  it('drops the removed tab subtree by omitting the first top-level tab', () => {
    const child = makeDiagram('child', 'Child');
    const input = makeDocument([
      makeDiagram('first', 'First', [child]),
      makeDiagram('second', 'Second'),
    ]);

    const result = prepareTemplateDiagramDocument(input, 'Copied Diagram');

    expect(result.diagrams).toHaveLength(1);
    expect(result.diagrams[0]?.id).toBe('second');
    expect(result.diagrams.some(diagram => diagram.id === 'child')).toBe(false);
  });

  it('creates a new empty Sheet 1 tab when removing the first tab leaves none', () => {
    const input = makeDocument([makeDiagram('only', 'Only')]);

    const result = prepareTemplateDiagramDocument(input, 'Copied Diagram');

    expect(result.diagrams).toHaveLength(1);
    expect(result.diagrams[0]?.name).toBe('Sheet 1');
    expect(result.diagrams[0]?.diagrams).toEqual([]);
    expect(result.activeDiagramId).toBe(result.diagrams[0]?.id);
    expect(result.diagrams[0]?.layers).toHaveLength(1);
    expect(result.diagrams[0]?.layers[0]).toMatchObject({
      name: 'Default',
      type: 'layer',
      layerType: 'regular',
      elements: [],
      isLocked: false,
    });
    expect(result.diagrams[0]?.activeLayerId).toBe(result.diagrams[0]?.layers[0]?.id);
    expect(result.diagrams[0]?.visibleLayers).toEqual([result.diagrams[0]?.layers[0]?.id]);
  });
});

describe('CSV import helpers', () => {
  it('routes parseCsvImport through the ORPC client', async () => {
    const result = {
      schemaId: 'schema-1',
      schemaName: 'Application',
      totalRows: 2,
      validRows: 1,
      entities: [
        {
          rowNumber: 1,
          errors: [],
          entity: { _name: 'Payments API' },
          isUpdate: false,
        },
      ],
    };
    importParseMock.mockResolvedValue(result);

    await expect(parseCsvImport('demo', 'schema-1', 'name\nPayments API\n')).resolves.toEqual(result);
    expect(importParseMock).toHaveBeenCalledWith({
      params: { workspace: 'demo' },
      body: { schemaId: 'schema-1', csvContent: 'name\nPayments API\n' },
    });
  });

  it('routes commitCsvImport through the ORPC client', async () => {
    const entities = [{ _name: 'Payments API', _schemaId: 'schema-1' }];
    const result = { created: 1, updated: 0, ids: ['entity-1'] };
    importCommitMock.mockResolvedValue(result);

    await expect(commitCsvImport('demo', 'schema-1', entities)).resolves.toEqual(result);
    expect(importCommitMock).toHaveBeenCalledWith({
      params: { workspace: 'demo' },
      body: { schemaId: 'schema-1', entities },
    });
  });
});
