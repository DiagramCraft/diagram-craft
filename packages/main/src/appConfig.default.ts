import { AppConfig, stencilEntry } from './appConfig';
import { deserializeDiagramDocument } from '@diagram-craft/model/serialization/deserialize';
import { Random } from '@diagram-craft/utils/random';
import { MultiWindowAutosave } from './react-app/autosave/MultiWindowAutosave';
import { ElectronAutosave } from './react-app/autosave/ElectronAutosave';
import { FileSystem } from '@diagram-craft/canvas-app/loaders';
import { stencilLoaderBasic } from '@diagram-craft/model/stencilRegistry';

const random = new Random(Date.now());

if (!window.electronAPI) {
  FileSystem.loadFromUrl = async (url: string) =>
    fetch(url.replace('$STENCIL_ROOT', import.meta.env.VITE_STENCIL_ROOT ?? '')).then(r =>
      r.text()
    );
}

export const defaultAppConfig: AppConfig = {
  elementDefinitions: {
    registry: [
      {
        shapes: /^(bpmn[A-Z][a-zA-Z]+)$/,
        nodeDefinitionLoader: () =>
          import('@diagram-craft/stencil-bpmn/stencil-bpmn-loader').then(m => m.registerBPMNNodes),
        edgeDefinitionLoader: () =>
          import('@diagram-craft/stencil-bpmn/stencil-bpmn-loader').then(m => m.registerBPMNEdges)
      },
      {
        shapes: /^(module|folder|providedRequiredInterface|requiredInterface|uml[A-Z][a-z]+)$/,
        nodeDefinitionLoader: () =>
          import('@diagram-craft/canvas-drawio/shapes/uml/canvas-drawio-stencil-uml-loader').then(
            m => m.registerUMLShapes
          )
      },
      {
        shapes: /^(dataModelling[A-Z][a-zA-Z0-9]+)$/,
        nodeDefinitionLoader: () =>
          import('@diagram-craft/stencil-data-modelling/stencil-data-modelling-loader').then(
            m => m.registerDataModellingNodes
          ),
        edgeDefinitionLoader: () =>
          import('@diagram-craft/stencil-data-modelling/stencil-data-modelling-loader').then(
            m => m.registerDataModellingEdges
          )
      }
    ]
  },
  stencils: {
    loaders: {
      basic: () => Promise.resolve(stencilLoaderBasic),

      drawioXml: () =>
        import('@diagram-craft/canvas-drawio/drawioLoaders').then(m => m.stencilLoaderDrawioXml)
    },
    registry: [
      stencilEntry({
        id: 'bpmn2',
        name: 'BPMN 2.0',
        loader: 'basic',
        opts: {
          stencils: () =>
            import('@diagram-craft/stencil-bpmn/stencil-bpmn-loader').then(m => m.loadBPMNStencils)
        }
      }),
      stencilEntry({
        id: 'data-modelling',
        name: 'Data Modelling',
        loader: 'basic',
        opts: {
          stencils: () =>
            import('@diagram-craft/stencil-data-modelling/stencil-data-modelling-loader').then(
              m => m.loadDataModellingStencils
            )
        }
      }),
      stencilEntry({
        id: 'uml',
        name: 'UML',
        loader: 'basic',
        opts: {
          stencils: () =>
            import('@diagram-craft/canvas-drawio/shapes/uml/canvas-drawio-stencil-uml-loader').then(
              m => m.loadUMLStencils
            )
        }
      }),
      stencilEntry({
        id: 'GCP',
        name: 'GCP',
        loader: 'drawioXml',
        opts: {
          url: `$STENCIL_ROOT/stencils/gcp2.xml`,
          foreground: '#3b8df1',
          background: '#3b8df1'
        }
      }),
      stencilEntry({
        id: 'AWS',
        name: 'AWS',
        loader: 'drawioXml',
        opts: {
          url: `$STENCIL_ROOT/stencils/aws3.xml`,
          foreground: '#ff9900',
          background: '#ff9900'
        }
      }),
      stencilEntry({
        id: 'Azure',
        name: 'Azure',
        loader: 'drawioXml',
        opts: {
          url: `$STENCIL_ROOT/stencils/azure.xml`,
          foreground: '#00abf0',
          background: '#00abf0'
        }
      }),
      stencilEntry({
        id: 'Fluid Power',
        name: 'Fluid Power',
        loader: 'drawioXml',
        opts: {
          url: `$STENCIL_ROOT/stencils/fluid_power.xml`,
          foreground: 'var(--canvas-fg)',
          background: 'var(--canvas-fg)'
        }
      }),
      stencilEntry({
        id: 'IBM',
        name: 'IBM',
        loader: 'drawioXml',
        opts: {
          url: `$STENCIL_ROOT/stencils/ibm.xml`,
          foreground: 'var(--canvas-fg)',
          background: 'transparent'
        }
      }),
      stencilEntry({
        id: 'Web Logos',
        name: 'Web Logos',
        loader: 'drawioXml',
        opts: {
          url: `$STENCIL_ROOT/stencils/weblogos.xml`,
          foreground: 'blue',
          background: '#ffffff'
        }
      }),
      stencilEntry({
        id: 'Web Icons',
        name: 'Web Icons',
        loader: 'drawioXml',
        opts: {
          url: `$STENCIL_ROOT/stencils/webicons.xml`,
          foreground: 'blue',
          background: '#000000'
        }
      }),
      stencilEntry({
        id: 'EIP',
        name: 'EIP',
        loader: 'drawioXml',
        opts: {
          url: `$STENCIL_ROOT/stencils/eip.xml`,
          foreground: 'black',
          background: '#c0f5a9'
        }
      }),
      stencilEntry({
        id: 'Arrows',
        name: 'Arrows',
        loader: 'drawioXml',
        opts: {
          url: `$STENCIL_ROOT/stencils/arrows.xml`,
          foreground: 'var(--canvas-fg)',
          background: 'var(--canvas-bg2)'
        }
      }),
      stencilEntry({
        id: 'Basic',
        name: 'Basic',
        loader: 'drawioXml',
        opts: {
          url: `$STENCIL_ROOT/stencils/basic.xml`,
          foreground: 'var(--canvas-fg)',
          background: 'var(--canvas-bg2)'
        }
      }),
      stencilEntry({
        id: 'BPMN',
        name: 'BPMN',
        loader: 'drawioXml',
        opts: {
          url: `$STENCIL_ROOT/stencils/bpmn.xml`,
          foreground: 'var(--canvas-fg)',
          background: 'var(--canvas-bg2)'
        }
      })
    ]
  },
  file: {
    loaders: {
      '.drawio': () =>
        import('@diagram-craft/canvas-drawio/drawioLoaders').then(m => m.fileLoaderDrawio),

      '.json': async () => (content, doc, diagramFactory) =>
        deserializeDiagramDocument(JSON.parse(content), doc, diagramFactory),

      '.dcd': async () => (content, doc, diagramFactory) =>
        deserializeDiagramDocument(JSON.parse(content), doc, diagramFactory)
    }
  },
  state: {
    store: true,
    key: () => 'diagram-craft.user-state'
  },
  awareness: {
    name: () =>
      (navigator.userAgent.includes('Edg') ? 'Edge' : 'Chrome') +
      ' ' +
      Math.floor(random.nextRange(0, 1000)),
    color: () => random.pick(['red', 'green', 'blue', 'orange']),
    avatar: () => undefined
  },
  collaboration: {
    forceClearServerState: () => false,
    forceLoadFromServer: () => false,
    backend: import.meta.env.VITE_CRDT_BACKEND === 'yjs-websocket' ? 'yjs' : 'noop',
    config: {
      url: import.meta.env.VITE_CRDT_BACKEND_YJS_URL
    }
  },
  autosave: window.electronAPI ? ElectronAutosave : MultiWindowAutosave,
  filesystem: {
    provider: import.meta.env.VITE_FS_PROVIDER ?? 'remote',
    endpoint: import.meta.env.VITE_FS_ENDPOINT ?? 'http://localhost:3000'
  },
  ai: {
    provider: import.meta.env.VITE_AI_PROVIDER ?? 'none',
    endpoint: import.meta.env.VITE_AI_ENDPOINT ?? 'http://localhost:3000'
  }
};
