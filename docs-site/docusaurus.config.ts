import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const typedocEnv = process.env.DOCS_SITE_TYPEDOC;
const isDevServerCommand = process.argv.includes('start') || process.argv.includes('serve');
const shouldGenerateTypedoc =
  typedocEnv === '1' || (typedocEnv == null && !isDevServerCommand);

const typedocPlugins = shouldGenerateTypedoc
  ? [
      [
        'docusaurus-plugin-typedoc',
        {
          id: 'api-docs',
          entryPoints: [
            '../packages/geometry',
            '../packages/utils'
            /*          '../packages/model',
          '../packages/canvas',
          '../packages/canvas-app',
          '../packages/canvas-react',
          '../packages/collaboration',*/
          ],
          entryPointStrategy: 'packages',
          tsconfig: '../tsconfig.json',
          out: 'docs/diagram-craft/api',
          sidebar: {
            autoConfiguration: true,
            pretty: true
          },
          // Exclude test files
          exclude: ['**/*.test.ts', '**/*.bench.ts', '**/*.fixtures.ts', '**/test-support/**', '**/node_modules/**'],
          // Documentation options
          excludePrivate: true,
          excludeInternal: true,
          excludeProtected: false,
          sanitizeComments: true,
          useHTMLEncodedBrackets: true,
          readme: 'none',
          // Styling options for consistency
          hideGenerator: true,
          hideBreadcrumbs: false,
          hidePageHeader: false,
          hidePageTitle: false
        }
      ]
    ]
  : [];

const config: Config = {
  title: 'Docs',
  tagline: 'Arch Register & Diagram Craft documentation',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: 'https://diagramcraft.github.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  baseUrl: '/diagram-craft/',

  // GitHub pages deployment config
  organizationName: 'DiagramCraft',
  projectName: 'diagram-craft',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en']
  },

  presets: [
    [
      'classic',
      {
        docs: false, // Disable default docs plugin, we'll use multiple instances
        blog: false, // Disable blog for now
        theme: {
          customCss: './src/css/custom.css'
        }
      } satisfies Preset.Options
    ]
  ],

  plugins: [
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'diagram-craft',
        path: 'docs/diagram-craft',
        routeBasePath: 'diagram-craft',
        sidebarPath: './sidebars-diagram-craft.ts',
        editUrl: 'https://github.com/DiagramCraft/diagram-craft/tree/main/docs-site/',
        showLastUpdateTime: true,
        showLastUpdateAuthor: true
      }
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'arch-register',
        path: 'docs/arch-register',
        routeBasePath: 'arch-register',
        sidebarPath: './sidebars-arch-register.ts',
        editUrl: 'https://github.com/DiagramCraft/diagram-craft/tree/main/docs-site/',
        showLastUpdateTime: true,
        showLastUpdateAuthor: true
      }
    ],
    ...typedocPlugins,
    ['./plugins/typedoc-mdx-sanitizer.cjs', {}],
    ['./plugins/postcss-config-disable.cjs', {}],
  ],

  themeConfig: {
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true
    },
    image: 'img/social-card.jpg',
    navbar: {
      title: 'Docs',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Diagram Craft',
          docsPluginId: 'diagram-craft'
        },
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Arch Register',
          docsPluginId: 'arch-register'
        },
        {
          href: 'https://github.com/DiagramCraft/diagram-craft',
          label: 'GitHub',
          position: 'right'
        }
      ]
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Diagram Craft',
              to: '/diagram-craft/diagram-craft/intro'
            },
            {
              label: 'Arch Register',
              to: '/diagram-craft/arch-register/intro'
            }
          ]
        },
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/DiagramCraft/diagram-craft'
            },
            {
              label: 'Issues',
              href: 'https://github.com/DiagramCraft/diagram-craft/issues'
            }
          ]
        }
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Diagram Craft. Built with Docusaurus.`
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula
    }
  } satisfies Preset.ThemeConfig
};

export default config;
