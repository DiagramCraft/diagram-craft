import type { AppConfig } from './appConfig';
import { deserializeDiagramDocument } from '@diagram-craft/model/serialization/deserialize';
import { Random } from '@diagram-craft/utils/random';
import { MultiWindowAutosave } from './react-app/autosave/MultiWindowAutosave';
import { ElectronAutosave } from './react-app/autosave/ElectronAutosave';
import { FileSystem } from '@diagram-craft/canvas-app/loaders';
import { stencilLoaderBasic } from '@diagram-craft/model/elementDefinitionRegistry';

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
      {
        id: 'bpmn2',
        name: 'BPMN 2.0',
        type: 'basic',
        opts: {
          loader: () =>
            import('@diagram-craft/stencil-bpmn/stencil-bpmn-loader').then(
              m => m.registerBPMNStencils
            )
        }
      },
      {
        id: 'data-modelling',
        name: 'Data Modelling',
        type: 'basic',
        opts: {
          loader: () =>
            import('@diagram-craft/stencil-data-modelling/stencil-data-modelling-loader').then(
              m => m.registerDataModellingStencils
            )
        }
      },
      {
        id: 'uml',
        name: 'UML',
        type: 'basic',
        opts: {
          loader: () =>
            import('@diagram-craft/canvas-drawio/shapes/uml/canvas-drawio-stencil-uml-loader').then(
              m => m.registerUMLStencils
            )
        }
      },
      {
        id: 'GCP',
        name: 'GCP',
        type: 'drawioXml',
        opts: {
          name: 'GCP',
          url: `$STENCIL_ROOT/stencils/gcp2.xml`,
          foreground: '#3b8df1',
          background: '#3b8df1'
        }
      },
      {
        id: 'AWS',
        name: 'AWS',
        type: 'drawioXml',
        opts: {
          name: 'AWS',
          url: `$STENCIL_ROOT/stencils/aws3.xml`,
          foreground: '#ff9900',
          background: '#ff9900'
        }
      },
      {
        id: 'Azure',
        name: 'Azure',
        type: 'drawioXml',
        opts: {
          name: 'Azure',
          url: `$STENCIL_ROOT/stencils/azure.xml`,
          foreground: '#00abf0',
          background: '#00abf0'
        }
      },
      {
        id: 'Fluid Power',
        name: 'Fluid Power',
        type: 'drawioXml',
        opts: {
          name: 'Fluid Power',
          url: `$STENCIL_ROOT/stencils/fluid_power.xml`,
          foreground: 'var(--canvas-fg)',
          background: 'var(--canvas-fg)'
        }
      },
      {
        id: 'IBM',
        name: 'IBM',
        type: 'drawioXml',
        opts: {
          name: 'IBM',
          url: `$STENCIL_ROOT/stencils/ibm.xml`,
          foreground: 'var(--canvas-fg)',
          background: 'transparent'
        }
      },
      {
        id: 'Web Logos',
        name: 'Web Logos',
        type: 'drawioXml',
        opts: {
          name: 'Web Logos',
          url: `$STENCIL_ROOT/stencils/weblogos.xml`,
          foreground: 'blue',
          background: '#ffffff'
        }
      },
      {
        id: 'Web Icons',
        name: 'Web Icons',
        type: 'drawioXml',
        opts: {
          name: 'Web Icons',
          url: `$STENCIL_ROOT/stencils/webicons.xml`,
          foreground: 'blue',
          background: '#000000'
        }
      },
      {
        id: 'EIP',
        name: 'EIP',
        type: 'drawioXml',
        opts: {
          name: 'EIP',
          url: `$STENCIL_ROOT/stencils/eip.xml`,
          foreground: 'black',
          background: '#c0f5a9'
        }
      },
      {
        id: 'Arrows',
        name: 'Arrows',
        type: 'drawioXml',
        opts: {
          name: 'Arrows',
          url: `$STENCIL_ROOT/stencils/arrows.xml`,
          foreground: 'var(--canvas-fg)',
          background: 'var(--canvas-bg2)'
        }
      },
      {
        id: 'Basic',
        name: 'Basic',
        type: 'drawioXml',
        opts: {
          name: 'Basic',
          url: `$STENCIL_ROOT/stencils/basic.xml`,
          foreground: 'var(--canvas-fg)',
          background: 'var(--canvas-bg2)'
        }
      },
      {
        id: 'BPMN',
        name: 'BPMN',
        type: 'drawioXml',
        opts: {
          name: 'BPMN',
          url: `$STENCIL_ROOT/stencils/bpmn.xml`,
          foreground: 'var(--canvas-fg)',
          background: 'var(--canvas-bg2)'
        }
      }
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
