// Seed data for Arch Register — typed constants.

export type EntityTypeField = {
  id: string;
  label: string;
  type: 'string' | 'text' | 'number' | 'enum' | 'tags' | 'url' | 'ref';
  required?: boolean;
  options?: string[];
  refType?: string;
};

export type EntityType = {
  id: string;
  name: string;
  plural: string;
  short: string;
  icon: string;
  color: string;
  description: string;
  fields: EntityTypeField[];
  count: number;
};

export type Entity = {
  id: string;
  type: string;
  name: string;
  description?: string;
  owner?: string;
  tier?: string;
  tech?: string[];
  repo?: string;
  status: string;
  protocol?: string;
  baseUrl?: string;
  version?: string;
  provider?: string;
  sla?: string;
  [key: string]: unknown;
};

export type Relation = {
  from: string;
  to: string;
  kind: string;
};

export type DiagramItem = {
  id: string;
  kind: string;
  name: string;
  updated: string;
  pinned?: boolean;
  folder?: string;
};

export type Folder = {
  id: string;
  name: string;
  items: DiagramItem[];
};

export type Project = {
  id: string;
  name: string;
  description: string;
  owner: string;
  status: string;
  progress: number;
  updated: string;
  starred: boolean;
  diagrams: number;
  folders: Folder[];
  rootItems: DiagramItem[];
};

export type Workspace = {
  id: string;
  name: string;
  short: string;
  active: boolean;
  description: string;
  entities: number;
  projects: number;
};

export type ActivityEntry = {
  who: string;
  what: string;
  target: string;
  project: string;
  time: string;
};

export const ENTITY_TYPES: EntityType[] = [
  {
    id: 'component',
    name: 'Application / Component',
    plural: 'Applications',
    short: 'App',
    icon: 'Component',
    color: 'var(--tag-component)',
    description:
      'Deployable software components — web apps, batch jobs, frontends, microservices.',
    fields: [
      { id: 'name', label: 'Name', type: 'string', required: true },
      { id: 'description', label: 'Description', type: 'text' },
      { id: 'owner', label: 'Owner', type: 'ref', refType: 'team' },
      {
        id: 'tier',
        label: 'Tier',
        type: 'enum',
        options: ['Tier 0', 'Tier 1', 'Tier 2', 'Tier 3'],
      },
      { id: 'tech', label: 'Tech stack', type: 'tags' },
      { id: 'repo', label: 'Repository', type: 'url' },
      {
        id: 'status',
        label: 'Lifecycle',
        type: 'enum',
        options: ['Proposed', 'Active', 'Deprecated', 'Retired'],
      },
    ],
    count: 18,
  },
  {
    id: 'api',
    name: 'API',
    plural: 'APIs',
    short: 'API',
    icon: 'Api',
    color: 'var(--tag-api)',
    description:
      'Published interfaces — REST, GraphQL, gRPC. Has a provider and consumers.',
    fields: [
      { id: 'name', label: 'Name', type: 'string', required: true },
      { id: 'description', label: 'Description', type: 'text' },
      {
        id: 'protocol',
        label: 'Protocol',
        type: 'enum',
        options: ['REST', 'GraphQL', 'gRPC', 'SOAP', 'AsyncAPI'],
      },
      { id: 'baseUrl', label: 'Base URL', type: 'url' },
      { id: 'version', label: 'Version', type: 'string' },
      { id: 'provider', label: 'Provided by', type: 'ref', refType: 'component' },
      {
        id: 'status',
        label: 'Lifecycle',
        type: 'enum',
        options: ['Proposed', 'Active', 'Deprecated', 'Retired'],
      },
    ],
    count: 11,
  },
  {
    id: 'service',
    name: 'Service',
    plural: 'Services',
    short: 'Svc',
    icon: 'Service',
    color: 'var(--tag-service)',
    description:
      'Logical capabilities provided by the IT landscape. Higher-level than components.',
    fields: [
      { id: 'name', label: 'Name', type: 'string', required: true },
      { id: 'description', label: 'Description', type: 'text' },
      { id: 'owner', label: 'Owner', type: 'ref', refType: 'team' },
      {
        id: 'sla',
        label: 'SLA',
        type: 'enum',
        options: ['99.0%', '99.5%', '99.9%', '99.95%'],
      },
      {
        id: 'status',
        label: 'Lifecycle',
        type: 'enum',
        options: ['Proposed', 'Active', 'Deprecated', 'Retired'],
      },
    ],
    count: 7,
  },
];

export const TEAMS = [
  'Checkout',
  'Catalog',
  'Search',
  'Inventory',
  'Payments',
  'Identity',
  'Platform',
  'Data',
  'Storefront',
  'Ops',
];

const E = (id: string, type: string, name: string, fields: Partial<Entity> = {}): Entity => ({
  id,
  type,
  name,
  status: 'Active',
  ...fields,
});

export const ENTITIES: Entity[] = [
  // Components
  E('c-checkout-web', 'component', 'Checkout Web', {
    owner: 'Checkout', tier: 'Tier 0', tech: ['TypeScript', 'Next.js'], status: 'Active',
    description: 'Customer-facing checkout flow.', repo: 'github.com/acme/checkout-web',
  }),
  E('c-checkout-svc', 'component', 'Checkout Service', {
    owner: 'Checkout', tier: 'Tier 0', tech: ['Go', 'Postgres'], status: 'Active',
    description: 'Orchestrates cart-to-order conversion.', repo: 'github.com/acme/checkout-svc',
  }),
  E('c-cart-svc', 'component', 'Cart Service', {
    owner: 'Checkout', tier: 'Tier 0', tech: ['Go', 'Redis'], status: 'Active',
    description: 'Holds carts for guests and signed-in users.', repo: 'github.com/acme/cart-svc',
  }),
  E('c-order-svc', 'component', 'Order Service', {
    owner: 'Checkout', tier: 'Tier 0', tech: ['Java', 'Postgres'], status: 'Active',
    description: 'Order lifecycle and post-purchase events.', repo: 'github.com/acme/order-svc',
  }),
  E('c-payments-svc', 'component', 'Payments Service', {
    owner: 'Payments', tier: 'Tier 0', tech: ['Go', 'Postgres', 'Kafka'], status: 'Active',
    description: 'Tokenization, auth, capture, refunds.', repo: 'github.com/acme/payments',
  }),
  E('c-catalog-svc', 'component', 'Catalog Service', {
    owner: 'Catalog', tier: 'Tier 1', tech: ['Node.js', 'MongoDB'], status: 'Active',
    description: 'Master product catalog.', repo: 'github.com/acme/catalog',
  }),
  E('c-pricing-svc', 'component', 'Pricing Service', {
    owner: 'Catalog', tier: 'Tier 1', tech: ['Go', 'Postgres'], status: 'Active',
    description: 'List and promo pricing.', repo: 'github.com/acme/pricing',
  }),
  E('c-inventory-svc', 'component', 'Inventory Service', {
    owner: 'Inventory', tier: 'Tier 1', tech: ['Java', 'Postgres'], status: 'Active',
    description: 'Stock levels per SKU per location.', repo: 'github.com/acme/inventory',
  }),
  E('c-search-svc', 'component', 'Search Service', {
    owner: 'Search', tier: 'Tier 1', tech: ['Go', 'Elasticsearch'], status: 'Active',
    description: 'Faceted product search & autocomplete.', repo: 'github.com/acme/search',
  }),
  E('c-search-indexer', 'component', 'Search Indexer', {
    owner: 'Search', tier: 'Tier 2', tech: ['Go', 'Kafka'], status: 'Active',
    description: 'Materializes product docs into the search index.', repo: 'github.com/acme/search-indexer',
  }),
  E('c-recos-svc', 'component', 'Recommendations', {
    owner: 'Search', tier: 'Tier 2', tech: ['Python', 'Postgres'], status: 'Active',
    description: 'Related-product and homepage carousels.', repo: 'github.com/acme/recos',
  }),
  E('c-identity-svc', 'component', 'Identity Service', {
    owner: 'Identity', tier: 'Tier 0', tech: ['Go', 'Postgres'], status: 'Active',
    description: 'Customer accounts and session tokens.', repo: 'github.com/acme/identity',
  }),
  E('c-storefront-web', 'component', 'Storefront Web', {
    owner: 'Storefront', tier: 'Tier 0', tech: ['TypeScript', 'Next.js'], status: 'Active',
    description: 'Public-facing browse + PDP experience.', repo: 'github.com/acme/storefront',
  }),
  E('c-admin-console', 'component', 'Admin Console', {
    owner: 'Ops', tier: 'Tier 2', tech: ['TypeScript', 'React'], status: 'Active',
    description: 'Internal tool for catalog & order ops.', repo: 'github.com/acme/admin',
  }),
  E('c-cms-sanity', 'component', 'CMS (Sanity)', {
    owner: 'Storefront', tier: 'Tier 2', tech: ['Sanity'], status: 'Active',
    description: 'Editorial content for storefront.',
  }),
  E('c-ecc-bridge', 'component', 'ECC Bridge', {
    owner: 'Platform', tier: 'Tier 2', tech: ['Java', 'SAP'], status: 'Deprecated',
    description: 'Legacy SAP ECC integration. Retiring in Q4.', repo: 'github.com/acme/ecc-bridge',
  }),
  E('c-loyalty-svc', 'component', 'Loyalty Service', {
    owner: 'Identity', tier: 'Tier 2', tech: ['Node.js', 'Postgres'], status: 'Proposed',
    description: 'Points and tier benefits. Not yet built.',
  }),
  E('c-notification', 'component', 'Notification Service', {
    owner: 'Platform', tier: 'Tier 1', tech: ['Go', 'Kafka', 'SES'], status: 'Active',
    description: 'Email, SMS, and push fan-out.', repo: 'github.com/acme/notify',
  }),

  // APIs
  E('a-checkout-api', 'api', 'Checkout API', {
    protocol: 'REST', version: 'v3', provider: 'Checkout Service', status: 'Active',
    description: 'Submit & inspect orders.', baseUrl: 'api.acme.com/checkout',
  }),
  E('a-cart-api', 'api', 'Cart API', {
    protocol: 'REST', version: 'v2', provider: 'Cart Service', status: 'Active',
    description: 'CRUD on shopping carts.', baseUrl: 'api.acme.com/cart',
  }),
  E('a-catalog-api', 'api', 'Catalog API', {
    protocol: 'GraphQL', version: '2024-08', provider: 'Catalog Service', status: 'Active',
    description: 'Product master read API.', baseUrl: 'api.acme.com/graphql',
  }),
  E('a-pricing-api', 'api', 'Pricing API', {
    protocol: 'gRPC', version: 'v1', provider: 'Pricing Service', status: 'Active',
    description: 'Resolve effective price for a cart.', baseUrl: 'pricing.acme.internal',
  }),
  E('a-inventory-api', 'api', 'Inventory API', {
    protocol: 'REST', version: 'v2', provider: 'Inventory Service', status: 'Active',
    description: 'Stock lookup and reservation.', baseUrl: 'api.acme.com/inventory',
  }),
  E('a-search-api', 'api', 'Search API', {
    protocol: 'REST', version: 'v4', provider: 'Search Service', status: 'Active',
    description: 'Product search and autocomplete.', baseUrl: 'api.acme.com/search',
  }),
  E('a-payments-api', 'api', 'Payments API', {
    protocol: 'REST', version: 'v2', provider: 'Payments Service', status: 'Active',
    description: 'Tokenize, authorize, capture, refund.', baseUrl: 'api.acme.com/payments',
  }),
  E('a-identity-api', 'api', 'Identity API', {
    protocol: 'REST', version: 'v3', provider: 'Identity Service', status: 'Active',
    description: 'Account & session management.', baseUrl: 'api.acme.com/identity',
  }),
  E('a-order-events', 'api', 'Order Events', {
    protocol: 'AsyncAPI', version: 'v1', provider: 'Order Service', status: 'Active',
    description: 'order.placed / order.shipped / order.refunded.', baseUrl: 'kafka://orders.*',
  }),
  E('a-recos-api', 'api', 'Recommendations API', {
    protocol: 'REST', version: 'v1', provider: 'Recommendations', status: 'Active',
    description: 'Related items, homepage rails.', baseUrl: 'api.acme.com/recos',
  }),
  E('a-legacy-soap', 'api', 'ECC SOAP', {
    protocol: 'SOAP', version: '1.2', provider: 'ECC Bridge', status: 'Deprecated',
    description: 'Last remaining SAP SOAP endpoint.', baseUrl: 'ecc.internal/wsdl',
  }),

  // Services
  E('s-checkout', 'service', 'Checkout', {
    owner: 'Checkout', sla: '99.95%', status: 'Active',
    description: 'End-to-end cart -> order capability.',
  }),
  E('s-catalog', 'service', 'Product Catalog', {
    owner: 'Catalog', sla: '99.9%', status: 'Active',
    description: 'Master product data and pricing.',
  }),
  E('s-inventory', 'service', 'Inventory', {
    owner: 'Inventory', sla: '99.9%', status: 'Active',
    description: 'Stock visibility across locations.',
  }),
  E('s-search', 'service', 'Search & Discovery', {
    owner: 'Search', sla: '99.5%', status: 'Active',
    description: 'Browse, search, recommend.',
  }),
  E('s-identity', 'service', 'Identity', {
    owner: 'Identity', sla: '99.95%', status: 'Active',
    description: 'Customer authentication and profile.',
  }),
  E('s-payments', 'service', 'Payments', {
    owner: 'Payments', sla: '99.95%', status: 'Active',
    description: 'Auth, capture, refund across providers.',
  }),
  E('s-loyalty', 'service', 'Loyalty', {
    owner: 'Identity', sla: '99.5%', status: 'Proposed',
    description: 'Points-based loyalty program.',
  }),
];

export const RELATIONS: Relation[] = [
  { from: 'c-checkout-svc', to: 'a-cart-api', kind: 'consumes' },
  { from: 'c-checkout-svc', to: 'a-pricing-api', kind: 'consumes' },
  { from: 'c-checkout-svc', to: 'a-inventory-api', kind: 'consumes' },
  { from: 'c-checkout-svc', to: 'a-payments-api', kind: 'consumes' },
  { from: 'c-checkout-svc', to: 'a-identity-api', kind: 'consumes' },
  { from: 'c-checkout-svc', to: 'a-checkout-api', kind: 'provides' },
  { from: 'c-checkout-svc', to: 'a-order-events', kind: 'publishes' },
  { from: 'c-checkout-svc', to: 's-checkout', kind: 'supports' },
  { from: 'c-checkout-web', to: 'a-checkout-api', kind: 'consumes' },
  { from: 'c-checkout-web', to: 'a-cart-api', kind: 'consumes' },
  { from: 'c-search-indexer', to: 'a-catalog-api', kind: 'consumes' },
  { from: 'c-search-indexer', to: 'a-order-events', kind: 'consumes' },
  { from: 'c-storefront-web', to: 'a-catalog-api', kind: 'consumes' },
  { from: 'c-storefront-web', to: 'a-search-api', kind: 'consumes' },
  { from: 'c-storefront-web', to: 'a-recos-api', kind: 'consumes' },
  { from: 'c-storefront-web', to: 'a-identity-api', kind: 'consumes' },
];

export const PROJECTS: Project[] = [
  {
    id: 'p-checkout-modern',
    name: 'Checkout Modernization',
    description: 'Replace the legacy checkout monolith with a service-oriented flow. Q3-Q4.',
    owner: 'Checkout', status: 'Active', progress: 62, updated: '2 hours ago', starred: true, diagrams: 14,
    folders: [
      { id: 'f-current', name: 'Current state', items: [
        { id: 'd-cm-1', kind: 'diagram', name: 'Checkout — current architecture', updated: 'yesterday' },
        { id: 'd-cm-2', kind: 'diagram', name: 'Order data flow', updated: '3 days ago' },
        { id: 'd-cm-3', kind: 'diagram', name: 'Payment integration map', updated: '1 week ago' },
      ]},
      { id: 'f-target', name: 'Target state', items: [
        { id: 'd-cm-4', kind: 'diagram', name: 'Target — service decomposition', updated: '2 hours ago' },
        { id: 'd-cm-5', kind: 'diagram', name: 'Cart Service — sequence', updated: 'today' },
        { id: 'd-cm-6', kind: 'diagram', name: 'Idempotency strategy', updated: 'today' },
        { id: 'd-cm-7', kind: 'diagram', name: 'Event topics — order.*', updated: '2 days ago' },
      ]},
      { id: 'f-migration', name: 'Migration', items: [
        { id: 'd-cm-8', kind: 'diagram', name: 'Cut-over plan', updated: '4 days ago' },
        { id: 'd-cm-9', kind: 'diagram', name: 'Dual-write window', updated: '4 days ago' },
        { id: 'd-cm-10', kind: 'diagram', name: 'Rollback playbook', updated: '1 week ago' },
      ]},
    ],
    rootItems: [
      { id: 'd-cm-root', kind: 'diagram', name: 'Overview', updated: 'today', pinned: true },
    ],
  },
  {
    id: 'p-inventory',
    name: 'Inventory Replatform',
    description: 'Move inventory off Oracle to a new event-sourced store.',
    owner: 'Inventory', status: 'Active', progress: 28, updated: 'yesterday', starred: false, diagrams: 9,
    folders: [
      { id: 'f-i-1', name: 'Discovery', items: [
        { id: 'd-i-1', kind: 'diagram', name: 'Current — Oracle topology', updated: '1 week ago' },
        { id: 'd-i-2', kind: 'diagram', name: 'Read patterns', updated: '1 week ago' },
      ]},
      { id: 'f-i-2', name: 'Proposal', items: [
        { id: 'd-i-3', kind: 'diagram', name: 'Target — event-sourced store', updated: 'yesterday' },
        { id: 'd-i-4', kind: 'diagram', name: 'CQRS read models', updated: '2 days ago' },
      ]},
    ],
    rootItems: [],
  },
  {
    id: 'p-search',
    name: 'Search Overhaul',
    description: 'Migrate to vector-augmented retrieval.',
    owner: 'Search', status: 'Active', progress: 75, updated: '3 hours ago', starred: true, diagrams: 6,
    folders: [
      { id: 'f-s-1', name: 'Architecture', items: [
        { id: 'd-s-1', kind: 'diagram', name: 'Hybrid retrieval pipeline', updated: '3 hours ago' },
        { id: 'd-s-2', kind: 'diagram', name: 'Reranking stack', updated: 'yesterday' },
      ]},
    ],
    rootItems: [
      { id: 'd-s-pinned', kind: 'diagram', name: 'Search — north star', updated: '1 week ago', pinned: true },
    ],
  },
  {
    id: 'p-identity',
    name: 'Passwordless Identity',
    description: 'Roll out WebAuthn and remove password-based auth.',
    owner: 'Identity', status: 'Planning', progress: 10, updated: '5 days ago', starred: false, diagrams: 3,
    folders: [],
    rootItems: [
      { id: 'd-id-1', kind: 'diagram', name: 'WebAuthn registration flow', updated: '5 days ago' },
      { id: 'd-id-2', kind: 'diagram', name: 'Account recovery', updated: '5 days ago' },
    ],
  },
  {
    id: 'p-loyalty',
    name: 'Loyalty Launch',
    description: 'Stand up the new loyalty program for Q1.',
    owner: 'Identity', status: 'Planning', progress: 4, updated: '2 weeks ago', starred: false, diagrams: 2,
    folders: [],
    rootItems: [
      { id: 'd-l-1', kind: 'diagram', name: 'Loyalty — service boundaries', updated: '2 weeks ago' },
    ],
  },
  {
    id: 'p-ecc-sunset',
    name: 'ECC Sunset',
    description: 'Final retirement of SAP ECC integrations.',
    owner: 'Platform', status: 'On hold', progress: 45, updated: '1 month ago', starred: false, diagrams: 5,
    folders: [],
    rootItems: [
      { id: 'd-e-1', kind: 'diagram', name: 'Remaining ECC touch-points', updated: '1 month ago' },
    ],
  },
];

export const WORKSPACES: Workspace[] = [
  { id: 'ws-commerce', name: 'Acme Commerce', short: 'AC', active: true, description: 'Customer-facing commerce platform.', entities: 36, projects: 6 },
  { id: 'ws-internal', name: 'Acme Internal Tools', short: 'AI', active: false, description: 'Back-office and ops systems.', entities: 22, projects: 3 },
  { id: 'ws-data', name: 'Acme Data Platform', short: 'AD', active: false, description: 'Warehouse, lake, and pipelines.', entities: 18, projects: 4 },
];

export const RECENT_ACTIVITY: ActivityEntry[] = [
  { who: 'Maya R.', what: 'edited diagram', target: 'Target — service decomposition', project: 'Checkout Modernization', time: '2h ago' },
  { who: 'Liam K.', what: 'added entity', target: 'Loyalty Service', project: 'Loyalty Launch', time: '5h ago' },
  { who: 'Priya S.', what: 'renamed', target: 'Search Indexer', project: 'Search Overhaul', time: 'yesterday' },
  { who: 'Tomas J.', what: 'deprecated', target: 'ECC Bridge', project: 'ECC Sunset', time: 'yesterday' },
  { who: 'Anika P.', what: 'added field', target: 'Application.tier', project: 'Data Model', time: '2 days ago' },
  { who: 'Wen Z.', what: 'created project', target: 'Passwordless Identity', project: '—', time: '5 days ago' },
];

export const STATUS_TONE: Record<string, { dot: string; label: string }> = {
  Active: { dot: 'var(--ok)', label: 'Active' },
  Proposed: { dot: 'var(--accent)', label: 'Proposed' },
  Deprecated: { dot: 'var(--warn)', label: 'Deprecated' },
  Retired: { dot: 'var(--fg-3)', label: 'Retired' },
  Planning: { dot: 'var(--accent)', label: 'Planning' },
  'On hold': { dot: 'var(--fg-3)', label: 'On hold' },
};
