import type { AppConfig } from './appConfig';
import { deserializeDiagramDocument } from '@diagram-craft/model/serialization/deserialize';
import { Random } from '@diagram-craft/utils/random';

const random = new Random(new Date().getTime());

export const defaultAppConfig: AppConfig = {
  stencils: {
    loaders: {
      drawioManual: () =>
        import('@diagram-craft/canvas-drawio/drawioLoaders').then(m => m.stencilLoaderDrawioManual),

      drawioXml: () =>
        import('@diagram-craft/canvas-drawio/drawioLoaders').then(m => m.stencilLoaderDrawioXml)
    },
    registry: [
      {
        type: 'drawioManual',
        shapes: /^(module|folder|providedRequiredInterface|requiredInterface|uml[A-Z][a-z]+)$/,
        opts: {
          callback: () =>
            import('@diagram-craft/canvas-drawio/shapes/uml/uml').then(m => m.registerUMLShapes)
        }
      },
      {
        type: 'drawioXml',
        opts: {
          name: 'GCP',
          url: '/stencils/gcp2.xml',
          foreground: '#3b8df1',
          background: '#3b8df1'
        }
      },
      {
        type: 'drawioXml',
        opts: {
          name: 'AWS',
          url: '/stencils/aws3.xml',
          foreground: '#ff9900',
          background: '#ff9900'
        }
      },
      {
        type: 'drawioXml',
        opts: {
          name: 'Azure',
          url: '/stencils/azure.xml',
          foreground: '#00abf0',
          background: '#00abf0'
        }
      },
      {
        type: 'drawioXml',
        opts: {
          name: 'Fluid Power',
          url: '/stencils/fluid_power.xml',
          foreground: 'var(--canvas-fg)',
          background: 'var(--canvas-fg)'
        }
      },
      {
        type: 'drawioXml',
        opts: {
          name: 'IBM',
          url: '/stencils/ibm.xml',
          foreground: 'var(--canvas-fg)',
          background: 'transparent'
        }
      },
      {
        type: 'drawioXml',
        opts: {
          name: 'Web Logos',
          url: '/stencils/weblogos.xml',
          foreground: 'blue',
          background: '#ffffff'
        }
      },
      {
        type: 'drawioXml',
        opts: {
          name: 'Web Icons',
          url: '/stencils/webicons.xml',
          foreground: 'blue',
          background: '#000000'
        }
      },
      {
        type: 'drawioXml',
        opts: {
          name: 'EIP',
          url: '/stencils/eip.xml',
          foreground: 'black',
          background: '#c0f5a9'
        }
      },
      {
        type: 'drawioXml',
        opts: {
          name: 'Arrows',
          url: '/stencils/arrows.xml',
          foreground: 'var(--canvas-fg)',
          background: 'var(--canvas-bg2)'
        }
      },
      {
        type: 'drawioXml',
        opts: {
          name: 'Basic',
          url: '/stencils/basic.xml',
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
    color: () => random.pick(['red', 'green', 'blue', 'orange'])
  },
  collaboration: {
    forceClearServerState: () => location.search.includes('crdtClear=true'),
    forceLoadFromServer: () => location.search.includes('crdtLoadFromServer=true'),
    backend: import.meta.env.VITE_CRDT_BACKEND === 'yjs-websocket' ? 'yjs' : 'noop',
    config: {
      url: import.meta.env.VITE_CRDT_BACKEND_YJS_URL
    }
  }
};
