import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const typedocSidebarPath = './docs/diagram-craft/api/typedoc-sidebar.cjs';

const typedocSidebar = (() => {
  try {
    return require(typedocSidebarPath) as any;
  } catch {
    return [];
  }
})();

const stripDocsRootPrefix = (item: any): any => {
  if (Array.isArray(item)) {
    return item.map(stripDocsRootPrefix);
  }

  if (item && typeof item === 'object') {
    const next = {...item};

    if (typeof next.id === 'string') {
      next.id = next.id.replace(/^diagram-craft\//, '');
    }

    if (next.link && typeof next.link === 'object' && typeof next.link.id === 'string') {
      next.link = {
        ...next.link,
        id: next.link.id.replace(/^diagram-craft\//, '')
      };
    }

    if (Array.isArray(next.items)) {
      next.items = next.items.map(stripDocsRootPrefix);
    }

    return next;
  }

  return item;
};

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Overview',
      items: [
        'overview/core-concepts',
        'overview/key-features'
      ]
    },
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'getting-started/introduction',
        'getting-started/installation',
        'getting-started/first-diagram',
        'getting-started/basic-shapes-connectors',
        'getting-started/styling-basics',
        'getting-started/saving-exporting',
        'getting-started/next-steps'
      ]
    },
    {
      type: 'category',
      label: 'Using Diagram Craft',
      items: [
        {
          type: 'category',
          label: 'Core Diagramming',
          items: [
            'use/core-diagramming/canvas-navigation',
            'use/core-diagramming/shapes-elements',
            'use/core-diagramming/connectors-edges',
            'use/core-diagramming/text-labels',
            'use/core-diagramming/selection-manipulation'
          ]
        },
        {
          type: 'category',
          label: 'Styling and Appearance',
          items: [
            'use/styling/styling-system',
            'use/styling/colors-gradients',
            'use/styling/effects',
            'use/styling/custom-shapes'
          ]
        },
        {
          type: 'category',
          label: 'Organization',
          items: [
            'use/organization/layers',
            'use/organization/tabs-documents',
            'use/organization/groups',
            'use/organization/document-structure'
          ]
        },
        {
          type: 'category',
          label: 'Advanced Editing',
          items: [
            'use/advanced-editing/alignment-distribution',
            'use/advanced-editing/snapping-guides',
            'use/advanced-editing/boolean-operations',
            'use/advanced-editing/geometry-operations'
          ]
        },
        {
          type: 'category',
          label: 'Layout and Automation',
          items: [
            'use/layout/automatic-layouts',
            'use/layout/layout-configuration',
            'use/layout/manual-refinement'
          ]
        },
        {
          type: 'category',
          label: 'Data and Integration',
          items: [
            'use/data-integration/data-sources',
            'use/data-integration/data-binding',
            'use/data-integration/query-language',
            'use/data-integration/dynamic-updates'
          ]
        },
        {
          type: 'category',
          label: 'Collaboration',
          items: [
            'use/collaboration/real-time-editing',
            'use/collaboration/comments-review',
            'use/collaboration/presence-awareness',
            'use/collaboration/version-history'
          ]
        },
        {
          type: 'category',
          label: 'AI Features',
          items: [
            'use/ai-features/text-to-diagram',
            'use/ai-features/diagram-to-text',
            'use/ai-features/ai-assistant'
          ]
        },
        {
          type: 'category',
          label: 'Import and Export',
          items: [
            'use/import-export/drawio-import',
            'use/import-export/image-export',
            'use/import-export/svg-export',
            'use/import-export/file-formats'
          ]
        }
      ]
    },
    {
      type: 'category',
      label: 'Stencils and Templates',
      items: [
        'stencils-templates/built-in-stencils',
        'stencils-templates/diagram-templates'
      ]
    },
    {
      type: 'category',
      label: 'User Interface',
      items: [
        'user-interface/tool-windows',
        'user-interface/command-palette',
        'user-interface/toolbars',
        'user-interface/keyboard-shortcuts',
        'user-interface/dark-mode',
        'user-interface/preview-mode'
      ]
    },
    {
      type: 'category',
      label: 'Reference',
      items: [
        'reference/keyboard-shortcuts-reference',
        'reference/tool-windows-reference',
        'reference/djql-reference',
        'reference/file-format-reference',
        'reference/stencil-reference'
      ]
    },
    {
      type: 'category',
      label: 'Developing with Diagram Craft',
      items: [
        'developing/custom-development',
        'developing/self-hosting',
        'developing/troubleshooting',
        'developing/contributing'
      ]
    },
    {
      type: 'category',
      label: 'API',
      link: {
        type: 'generated-index',
        title: 'API',
        description: 'TypeDoc reference for Diagram Craft packages'
      },
      items: typedocSidebar.map(stripDocsRootPrefix)
    }
  ],
};

export default sidebars;
