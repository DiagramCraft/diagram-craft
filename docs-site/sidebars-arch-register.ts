import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Overview',
      items: ['overview/core-concepts']
    },
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'getting-started/intro',
        'getting-started/installation',
        'getting-started/first-workspace',
        'getting-started/first-entity',
        'getting-started/first-project-diagram',
        'getting-started/next-steps'
      ]
    },
    {
      type: 'category',
      label: 'Use Arch Register',
      items: [
        'use/workspace-home-navigation',
        'use/search',
        'use/data-modeling-schemas',
        'use/entities',
        'use/entity-views',
        'use/projects',
        'use/assessments',
        'use/content',
        'use/ai-assistant-extract',
        'use/account-settings'
      ]
    },
    {
      type: 'category',
      label: 'Workspace Administration',
      items: [
        'admin/overview',
        'admin/workspace-settings',
        'admin/schemas-model-overview',
        'admin/document-types-templates',
        'admin/teams-members',
        'admin/roles-permissions',
        'admin/ai-configuration',
        'admin/export-import'
      ]
    },
    {
      type: 'category',
      label: 'Reference',
      items: [
        'reference/scope-matrix',
        'reference/permission-model',
        'reference/entity-screen-reference',
        'reference/project-content-screen-reference',
        'reference/mcp-server',
        'reference/api-integrations'
      ]
    },
    {
      type: 'link',
      label: 'API Reference',
      href: 'pathname:///arch-register/api.html'
    }
  ],
};

export default sidebars;
