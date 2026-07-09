import { AppConfig, stencilEntry } from './appConfig';
import { Random } from '@diagram-craft/utils/random';
import { MultiWindowAutosave } from './react-app/autosave/MultiWindowAutosave';
import { ElectronAutosave } from './react-app/autosave/ElectronAutosave';
import { FileSystem } from '@diagram-craft/canvas-app/loaders';
import { fileLoaderDiagramCraftSvg } from '@diagram-craft/canvas-app/diagramCraftSvgFormat';
import {
  embedElementDefinitions,
  embedStencilConfig,
  embedStencilLoaders,
  makeJsonFileLoaders
} from './embed/defaults';

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
    registry: embedElementDefinitions
  },
  stencils: {
    loaders: {
      ...embedStencilLoaders,

      drawioXml: () =>
        import('@diagram-craft/canvas-drawio/drawioLoaders').then(m => m.stencilLoaderDrawioXml)
    },
    registry: [
      ...embedStencilConfig,
      stencilEntry({
        id: 'drawioUml',
        name: 'UML (DrawIO)',
        description: 'DrawIO-compatible UML stencil set',
        icon: 'TbBox',
        group: 'Modelling',
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
        description: 'Google Cloud Platform service icons',
        icon: 'TbCloud',
        group: 'Cloud & infra',
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
        description: 'Amazon Web Services icon library',
        icon: 'TbCloud',
        group: 'Cloud & infra',
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
        description: 'Microsoft Azure service icons',
        icon: 'TbCloud',
        group: 'Cloud & infra',
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
        description: 'Hydraulic and pneumatic circuit symbols',
        icon: 'TbCircuitResistor',
        group: 'Engineering',
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
        description: 'IBM service icons',
        icon: 'TbCloud',
        group: 'Cloud & infra',
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
        description: 'Brand and product logos',
        icon: 'TbBrandChrome',
        group: 'Web',
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
        description: 'General web and UI icons',
        icon: 'TbGlobe',
        group: 'Web',
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
        description: 'Enterprise integration patterns',
        icon: 'TbRoute',
        group: 'Modelling',
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
        description: 'Extended arrow and connector shapes',
        icon: 'TbArrowsRandom',
        group: 'General',
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
        description: 'Basic DrawIO shape set',
        icon: 'TbSquare',
        group: 'General',
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
        description: 'DrawIO-compatible BPMN stencil set',
        icon: 'TbGitFork',
        group: 'Modelling',
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

      ...makeJsonFileLoaders(() =>
        defaultAppConfig.stencils.registry
          .filter(entry => entry.includedByDefault)
          .map(entry => entry.id)
      ),

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
