import type { ProjectFile } from '@arch-register/api-types/projectContract';
import type {
  SerializedDiagram,
  SerializedDiagramDocument,
  SerializedLayer,
  SerializedStyles
} from '@diagram-craft/model/serialization/serializedTypes';

const randomId = () => Math.random().toString(36).substring(2, 9);

const makeEmptyDiagramTab = (name: string): SerializedDiagram => {
  const diagramId = randomId();
  const layerId = randomId();
  const layers: SerializedLayer[] = [
    {
      id: layerId,
      name: 'Default',
      type: 'layer',
      layerType: 'regular',
      elements: [],
      isLocked: false
    }
  ];
  return {
    id: diagramId,
    name,
    layers,
    activeLayerId: layerId,
    visibleLayers: [layerId],
    diagrams: [],
    comments: [],
    zoom: { x: 0, y: 0, zoom: 1 },
    canvas: { x: -20, y: -20, w: 1076, h: 904 }
  };
};

const makeEmptyDiagramStyles = (): SerializedStyles => ({
  edgeStyles: [
    {
      id: 'default-edge',
      name: 'Default',
      props: { stroke: { color: 'var(--canvas-fg)' }, type: 'straight' },
      type: 'edge'
    }
  ],
  nodeStyles: [
    {
      id: 'default',
      name: 'Default',
      props: {
        fill: { color: 'var(--canvas-bg2)' },
        stroke: { color: 'var(--canvas-fg)' },
        text: { color: 'var(--canvas-fg)' }
      },
      type: 'node'
    },
    {
      id: 'default-text',
      name: 'Text',
      props: {
        fill: { enabled: false },
        stroke: { enabled: false },
        text: { color: 'var(--canvas-fg)' }
      },
      type: 'node'
    }
  ],
  textStyles: [
    {
      id: 'default-text-default',
      name: 'Default',
      props: {
        text: { fontSize: 10, font: 'sans-serif', top: 0, left: 0, right: 0, bottom: 0 }
      },
      type: 'text'
    },
    {
      id: 'h1',
      name: 'H1',
      props: {
        text: {
          fontSize: 20,
          bold: true,
          font: 'sans-serif',
          align: 'left',
          top: 6,
          left: 6,
          right: 6,
          bottom: 6
        }
      },
      type: 'text'
    }
  ]
});

export const emptyDiagram = (name: string) => {
  const diagram = makeEmptyDiagramTab(name);
  return {
    name,
    diagrams: [diagram],
    attachments: {},
    customPalette: Array(14).fill('#000000'),
    styles: makeEmptyDiagramStyles(),
    schemas: [
      {
        id: 'default',
        name: 'Default',
        providerId: 'default',
        fields: [
          { id: 'name', name: 'Name', type: 'text' },
          { id: 'notes', name: 'Notes', type: 'longtext' }
        ]
      }
    ],
    schemaMetadata: {
      default: { availableForElementLocalData: false, useDocumentOverrides: false }
    },
    props: {
      query: { history: [], saved: [] },
      stencils: ['default@@rect'],
      activeStencilPackages: [],
      recentEdgeStylesheets: []
    },
    data: {
      providers: [
        {
          id: 'default',
          providerId: 'defaultDataProvider',
          data: '{"schemas":[{"id":"default","name":"Default","providerId":"default","fields":[{"id":"name","name":"Name","type":"text"},{"id":"notes","name":"Notes","type":"longtext"}]}],"data":[]}'
        }
      ],
      templates: [],
      overrides: {}
    },
    activeDiagramId: diagram.id,
    hash: randomId() + randomId()
  };
};

export const prepareTemplateDiagramDocument = <
  T extends SerializedDiagramDocument & { name?: string }
>(
  templateContent: T,
  name: string
): T & { name: string } => {
  const diagrams = templateContent.diagrams.slice(1);
  const fallbackDiagram = makeEmptyDiagramTab('Sheet 1');
  const nextDiagrams = diagrams.length > 0 ? diagrams : [fallbackDiagram];
  return {
    ...templateContent,
    name,
    diagrams: nextDiagrams,
    activeDiagramId: nextDiagrams[0]!.id
  } as T & { name: string };
};

export const createDiagramFromTemplate = async (
  workspace: string,
  projectId: string,
  name: string,
  templateFile: ProjectFile,
  folder?: string | null
) => {
  const { orpcClient } = await import('./orpcClient');
  const templateContent = await orpcClient.projects.getFileContent({
    params: { workspace, id: templateFile.project_id! },
    query: { path: templateFile.path }
  });
  const newContent = prepareTemplateDiagramDocument(
    templateContent as unknown as SerializedDiagramDocument & { name?: string },
    name
  );
  const fileName = `${name}.json`;
  const filePath = folder ? `${folder}/${fileName}` : fileName;
  return orpcClient.projects.saveFile({
    params: { workspace, id: projectId },
    query: { path: filePath },
    body: newContent as unknown as Record<string, unknown>
  });
};

export const createEntityDiagramFromTemplate = async (
  workspace: string,
  entityId: string,
  name: string,
  templateFile: ProjectFile,
  folder?: string | null
) => {
  const { orpcClient } = await import('./orpcClient');
  const templateContent = await orpcClient.projects.getFileContent({
    params: { workspace, id: templateFile.project_id! },
    query: { path: templateFile.path }
  });
  const newContent = prepareTemplateDiagramDocument(
    templateContent as unknown as SerializedDiagramDocument & { name?: string },
    name
  );
  const fileName = `${name}.json`;
  const filePath = folder ? `${folder}/${fileName}` : fileName;
  return orpcClient.projects.createEntityFile({
    params: { workspace, entityId },
    query: { path: filePath },
    body: newContent as unknown as Record<string, unknown>
  });
};
