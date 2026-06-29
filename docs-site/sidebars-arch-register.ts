import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Getting started',
      items: [
        'getting-started/intro',
        'getting-started/installation',
        'getting-started/first-workspace',
        'getting-started/core-concepts',
        'getting-started/first-entity'
      ]
    },
    {
      type: 'category',
      label: 'User guide',
      items: [
        'user-guide/workspaces',
        'user-guide/entities',
        'user-guide/projects',
        'user-guide/wiki',
        { type: 'doc', id: 'admin-guide', label: 'Administration' }
      ]
    },
  ],
};

export default sidebars;
