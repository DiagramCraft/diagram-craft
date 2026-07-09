import { deserializeDiagramDocument } from '@diagram-craft/model/serialization/deserialize';
import { stencilLoaderBasic } from '@diagram-craft/model/stencilRegistry';
import type { TextHandlers } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import { markdownToHTML, htmlStringToMarkdown } from '@diagram-craft/markdown';
import { fileLoaderDiagramCraftSvg } from '@diagram-craft/canvas-app/diagramCraftSvgFormat';
import { stencilEntry } from '../appConfig';
import type { ElementDefinitionRegistryConfig, StencilRegistryConfig } from '../appConfig';
import type { Autosave } from '../react-app/autosave/Autosave';
import type { fileLoaderRegistry } from '@diagram-craft/canvas-app/loaders';

/**
 * Env-free shared fragments used to build both the standalone default config
 * (appConfig.default.ts) and the embedding facade (embed/bootstrapDiagramCraft.ts).
 * Must not touch import.meta.env or window.electronAPI.
 */

export const noopAutosave: Autosave = {
  load: async () => undefined,
  save: async () => {},
  asyncSave: () => {},
  exists: async () => false,
  clear: () => {},
  init: () => {}
};

export const markdownTextHandlers: TextHandlers = {
  format: 'Markdown',
  dialog: {
    editToStored: (s: string) => markdownToHTML(s, 'extended'),
    storedToEdit: (s: string) => htmlStringToMarkdown(s),
    storedToHTML: (s: string) => s
  }
};

export const embedElementDefinitions: ElementDefinitionRegistryConfig = [
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
];

const basicStencilConfig: StencilRegistryConfig = [
  stencilEntry({
    id: 'default',
    name: 'Basic shapes',
    description: 'Rectangles, ellipses, lines and connectors',
    icon: 'TbShape',
    group: 'General',
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
    description: 'Directional arrows and flow markers',
    icon: 'TbArrowRight',
    group: 'General',
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
    description: 'Business process model & notation',
    icon: 'TbBinaryTree',
    group: 'Modelling',
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
    description: 'Class, sequence, activity and state diagrams',
    icon: 'TbBox',
    group: 'Modelling',
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
    description: 'Entities, relationships and tables',
    icon: 'TbDatabase',
    group: 'Modelling',
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
    description: 'Context, container and component views',
    icon: 'TbStack2',
    group: 'Modelling',
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
    description: 'Enterprise architecture notation',
    icon: 'TbNetwork',
    group: 'Modelling',
    includedByDefault: true,
    loader: 'basic',
    opts: {
      stencils: () =>
        import('@diagram-craft/stencil-archimate/stencil-archimate-loader').then(
          m => m.loadArchimateStencils
        )
    }
  })
];

/**
 * The `basic`-loader stencils shared by every host, plus (when `stencilRoot` is passed)
 * the Draw.io XML-based stencil packs, whose asset URLs are resolved against it. Hosts
 * that don't pass `stencilRoot` at all get none of the Draw.io packs — there's nowhere
 * to fetch their assets from.
 */
export const embedStencilConfig = (opts?: { stencilRoot?: string }): StencilRegistryConfig => {
  const entries: StencilRegistryConfig = [
    ...basicStencilConfig,
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
    })
  ];

  if (opts?.stencilRoot === undefined) return entries;

  const root = opts.stencilRoot;
  entries.push(
    stencilEntry({
      id: 'GCP',
      name: 'GCP',
      description: 'Google Cloud Platform service icons',
      icon: 'TbCloud',
      group: 'Cloud & infra',
      includedByDefault: false,
      loader: 'drawioXml',
      opts: { url: `${root}/stencils/gcp2.xml`, foreground: '#3b8df1', background: '#3b8df1' }
    }),
    stencilEntry({
      id: 'AWS',
      name: 'AWS',
      description: 'Amazon Web Services icon library',
      icon: 'TbCloud',
      group: 'Cloud & infra',
      includedByDefault: false,
      loader: 'drawioXml',
      opts: { url: `${root}/stencils/aws3.xml`, foreground: '#ff9900', background: '#ff9900' }
    }),
    stencilEntry({
      id: 'Azure',
      name: 'Azure',
      description: 'Microsoft Azure service icons',
      icon: 'TbCloud',
      group: 'Cloud & infra',
      includedByDefault: false,
      loader: 'drawioXml',
      opts: { url: `${root}/stencils/azure.xml`, foreground: '#00abf0', background: '#00abf0' }
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
        url: `${root}/stencils/fluid_power.xml`,
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
        url: `${root}/stencils/ibm.xml`,
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
      opts: { url: `${root}/stencils/weblogos.xml`, foreground: 'blue', background: '#ffffff' }
    }),
    stencilEntry({
      id: 'Web Icons',
      name: 'Web Icons',
      description: 'General web and UI icons',
      icon: 'TbGlobe',
      group: 'Web',
      includedByDefault: false,
      loader: 'drawioXml',
      opts: { url: `${root}/stencils/webicons.xml`, foreground: 'blue', background: '#000000' }
    }),
    stencilEntry({
      id: 'EIP',
      name: 'EIP',
      description: 'Enterprise integration patterns',
      icon: 'TbRoute',
      group: 'Modelling',
      includedByDefault: false,
      loader: 'drawioXml',
      opts: { url: `${root}/stencils/eip.xml`, foreground: 'black', background: '#c0f5a9' }
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
        url: `${root}/stencils/arrows.xml`,
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
        url: `${root}/stencils/basic.xml`,
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
        url: `${root}/stencils/bpmn.xml`,
        foreground: 'var(--canvas-fg)',
        background: 'var(--canvas-bg2)'
      }
    })
  );

  return entries;
};

export const embedStencilLoaders = {
  basic: () => Promise.resolve(stencilLoaderBasic),
  drawioXml: () =>
    import('@diagram-craft/canvas-drawio/drawioLoaders').then(m => m.stencilLoaderDrawioXml)
};

/**
 * `.json`/`.dcd`/`.drawio`/`.diagramCraft.svg` file loaders, parameterized by a
 * lazily-evaluated list of the currently-included stencil packages (so callers can pass
 * their own stencil config).
 */
export const makeEmbedFileLoaders = (
  getIncludedPackages: () => string[]
): Pick<typeof fileLoaderRegistry, '.json' | '.dcd' | '.drawio' | '.diagramCraft.svg'> => ({
  '.json': async () => (content, doc, diagramFactory) =>
    deserializeDiagramDocument(JSON.parse(content), doc, diagramFactory, {
      includedPackages: getIncludedPackages()
    }),
  '.dcd': async () => (content, doc, diagramFactory) =>
    deserializeDiagramDocument(JSON.parse(content), doc, diagramFactory, {
      includedPackages: getIncludedPackages()
    }),
  '.drawio': () => import('@diagram-craft/canvas-drawio/drawioLoaders').then(m => m.fileLoaderDrawio),
  '.diagramCraft.svg': fileLoaderDiagramCraftSvg
});
