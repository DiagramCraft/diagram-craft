import { AppConfig, stencilEntry } from './appConfig';
import { deserializeDiagramDocument } from '@diagram-craft/model/serialization/deserialize';
import { Random } from '@diagram-craft/utils/random';
import { MultiWindowAutosave } from './react-app/autosave/MultiWindowAutosave';
import { ElectronAutosave } from './react-app/autosave/ElectronAutosave';
import { FileSystem } from '@diagram-craft/canvas-app/loaders';
import { fileLoaderDiagramCraftSvg } from '@diagram-craft/canvas-app/diagramCraftSvgFormat';
import { stencilLoaderBasic } from '@diagram-craft/model/stencilRegistry';

const random = new Random(Date.now());

if (!window.electronAPI) {
  FileSystem.loadFromUrl = async (url: string) => {
    let resolvedUrl: string;
    if (url.includes('$STENCIL_ROOT')) {
      resolvedUrl = url.replace('$STENCIL_ROOT', import.meta.env.VITE_STENCIL_ROOT ?? '');
    } else {
      const fsConfig = AppConfig.get().filesystem;
      if (fsConfig.provider === 'remote') {
        resolvedUrl = `${AppConfig.get().filesystem.endpoint}/api/fs/${url}`;
      } else {
        resolvedUrl = url;
      }
    }
    const response = await fetch(resolvedUrl);
    if (!response.ok) {
      throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
    }
    return response.text();
  };
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
        shapes: /^(dataModelling[A-Z][a-zA-Z0-9]+)$/,
        nodeDefinitionLoader: () =>
          import('@diagram-craft/stencil-data-modelling/stencil-data-modelling-loader').then(
            m => m.registerDataModellingNodes
          ),
        edgeDefinitionLoader: () =>
          import('@diagram-craft/stencil-data-modelling/stencil-data-modelling-loader').then(
            m => m.registerDataModellingEdges
          )
      },
      {
        shapes: /^(c4[A-Z][a-zA-Z0-9]+)$/,
        nodeDefinitionLoader: () =>
          import('@diagram-craft/stencil-c4/stencil-c4-loader').then(m => m.registerC4Nodes)
      },
      {
        shapes: /^(uml[A-Z][a-zA-Z0-9]+)$/,
        nodeDefinitionLoader: () =>
          import('@diagram-craft/stencil-uml/stencil-uml-loader').then(m => m.registerUMLNodes)
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
        id: 'default',
        name: 'Basic shapes',
        includedByDefault: true,
        loader: 'basic',
        opts: {
          stencils: () =>
            Promise.resolve(async registry => {
              return registry.stencils.get('default');
            })
        }
      }),
      stencilEntry({
        id: 'arrow',
        name: 'Arrow',
        includedByDefault: true,
        loader: 'basic',
        opts: {
          stencils: () =>
            Promise.resolve(async registry => {
              return registry.stencils.get('arrow');
            })
        }
      }),
      stencilEntry({
        id: 'bpmn2',
        name: 'BPMN 2.0',
        includedByDefault: true,
        loader: 'basic',
        opts: {
          stencils: () =>
            import('@diagram-craft/stencil-bpmn/stencil-bpmn-loader').then(m => m.loadBPMNStencils)
        }
      }),
      stencilEntry({
        id: 'uml',
        name: 'UML',
        includedByDefault: true,
        loader: 'basic',
        opts: {
          stencils: () =>
            import('@diagram-craft/stencil-uml/stencil-uml-loader').then(m => m.loadUMLStencils)
        }
      }),
      stencilEntry({
        id: 'data-modelling',
        name: 'Data Modelling',
        includedByDefault: true,
        loader: 'basic',
        opts: {
          stencils: () =>
            import('@diagram-craft/stencil-data-modelling/stencil-data-modelling-loader').then(
              m => m.loadDataModellingStencils
            )
        }
      }),
      stencilEntry({
        id: 'c4',
        name: 'C4',
        includedByDefault: true,
        loader: 'basic',
        opts: {
          stencils: () =>
            import('@diagram-craft/stencil-c4/stencil-c4-loader').then(m => m.loadC4Stencils)
        }
      }),
      stencilEntry({
        id: 'archimate',
        name: 'ArchiMate',
        includedByDefault: true,
        loader: 'basic',
        opts: {
          stencils: () =>
            import('@diagram-craft/stencil-archimate/stencil-archimate-loader').then(
              m => m.loadArchimateStencils
            )
        }
      }),
      stencilEntry({
        id: 'drawioUml',
        name: 'UML (DrawIO)',
        includedByDefault: false,
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
        includedByDefault: false,
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
        includedByDefault: false,
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
        includedByDefault: false,
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
        includedByDefault: false,
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
        includedByDefault: false,
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
        includedByDefault: false,
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
        includedByDefault: false,
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
        includedByDefault: false,
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
        includedByDefault: false,
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
        includedByDefault: false,
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
        includedByDefault: false,
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
        deserializeDiagramDocument(JSON.parse(content), doc, diagramFactory, {
          includedPackages: defaultAppConfig.stencils.registry
            .filter(entry => entry.includedByDefault)
            .map(entry => entry.id)
        }),

      '.dcd': async () => (content, doc, diagramFactory) =>
        deserializeDiagramDocument(JSON.parse(content), doc, diagramFactory, {
          includedPackages: defaultAppConfig.stencils.registry
            .filter(entry => entry.includedByDefault)
            .map(entry => entry.id)
        }),

      '.diagramCraft.svg': fileLoaderDiagramCraftSvg
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
    endpoint: import.meta.env.VITE_FS_ENDPOINT ?? ''
  },
  ai: {
    provider: import.meta.env.VITE_AI_PROVIDER ?? 'none',
    endpoint: import.meta.env.VITE_AI_ENDPOINT ?? ''
  }
};
