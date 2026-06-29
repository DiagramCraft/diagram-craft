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
