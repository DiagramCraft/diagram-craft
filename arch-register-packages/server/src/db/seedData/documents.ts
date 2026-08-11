import type { ContentNodeDbResult } from '../../domain/project/db/projectDatabase';
import { seededProjects } from '../seedFixtures';
import { AUTH_API_ENTITY_ID, CONTENT_IDS, TEAM_IDS, WORKSPACE_ID, now } from './constants';

const encodeEntityBrowserEmbedConfig = (config: {
  q: string;
  conditions: Array<{ fieldId: string; op: string; value: string }>;
  sort: string;
  view: string;
  viewConfigs: Record<string, unknown>;
}): string => {
  const payload = {
    q: config.q,
    conditions: config.conditions,
    sort: config.sort,
    view: config.view,
    viewConfigs:
      Object.keys(config.viewConfigs).length === 0 ? undefined : JSON.stringify(config.viewConfigs)
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
};

export const seedWikiPageBodies: Record<string, string> = {
  [CONTENT_IDS.wsWikiHome]: `# Example Corp Wiki

Welcome to the **Example Corp** architecture wiki. This page collects the standards, guides and
reference material that the platform, design, security and data teams maintain together.

Use this space to document *why* a decision was made, not just *what* was decided — the catalog
already tracks the "what".

## What's here

- [Markdown Cheatsheet](../standards/markdown-cheatsheet) — every markup element the editor supports
- [Entity Widgets Showcase](../standards/entity-widgets) — live catalog data embedded in a page
- [Diagrams & Views](../standards/diagrams-and-views) — embedding diagrams and saved views

## Getting started checklist

- [x] Read the [API Design Guide](../standards/api-design-guide)
- [x] Review the [Deployment Topology](../standards/deployment-topology) diagram
- [ ] Add your team's on-call runbook
- [ ] Link your service's entity page from this wiki

> Documentation that lives next to the catalog stays accurate longer than documentation that lives
> somewhere else entirely.

## Quick links

| Area | Owner | Status |
| --- | --- | --- |
| Platform | Platform Engineering | Production |
| Auth | Security & Compliance | Production |
| Design system | Design Systems | Experimental |

For raw markup examples (tables, code blocks, task lists, etc.) see the
[Markdown Cheatsheet](../standards/markdown-cheatsheet).
`,
  [CONTENT_IDS.wsWikiMarkdownCheatsheet]: `# Markdown Cheatsheet

A quick reference for the markup supported by the wiki editor.

## Headings

### Third level heading
#### Fourth level heading

## Emphasis

Plain text, **bold text**, *italic text*, ***bold italic text***, and ~~strikethrough text~~.

## Lists

Unordered, with nesting:

- Platform
  - API Gateway
  - Event Bus
- Security
  - Auth API
  - Threat modeling

Ordered:

1. Propose the change
2. Get review from the owning team
3. Ship it

Task list:

- [x] Draft the page
- [ ] Get it reviewed

## Blockquote

> A quote can span
> multiple lines.

## Code

Inline \`code\` looks like this. A fenced block:

\`\`\`ts
export const greet = (name: string) => \`Hello, \${name}!\`;
\`\`\`

## Links and autolinks

A regular [markdown link](https://example.com), and a bare autolink: https://example.com

## Horizontal rule

---

## Tables

| Column A | Column B | Column C |
| --- | --- | --- |
| one | two | three |
| four | five | six |
`,
  [CONTENT_IDS.wsWikiEntityWidgets]: `# Entity Widgets Showcase

This page demonstrates the custom MDX components that pull live data from the catalog.

## Entity card

<EntityCard id="${AUTH_API_ENTITY_ID}" fields="owner,lifecycle,tags" />

## Entity table

<EntityTable schema="00000000-0000-0000-0000-000000000004" owner="${TEAM_IDS.security}" limit="10" />

## Entity changelog

<EntityChangelog id="${AUTH_API_ENTITY_ID}" limit="5" />

## Entity chart

<EntityChart schema="00000000-0000-0000-0000-000000000003" groupBy="lifecycle" type="pie" />

## Entity metric

<Metric schema="00000000-0000-0000-0000-000000000004" label="Total APIs" />

## Entity browser embed

<EntityBrowserEmbed config="${encodeEntityBrowserEmbedConfig({
    q: '',
    conditions: [
      { fieldId: 'schemaId', op: 'equals', value: '00000000-0000-0000-0000-000000000002' }
    ],
    sort: 'name',
    view: 'table',
    viewConfigs: {}
  })}" />

## Inline components

The Auth API entity can be mentioned inline like this: <EntityMention id="${AUTH_API_ENTITY_ID}" />.

It can also be linked directly: <EntityLink id="00000000-0000-0000-0003-000000000001" /> (renders the entity's own name).

A single field can be pulled inline — the Auth API type is <EntityField id="${AUTH_API_ENTITY_ID}" field="api_type" />.
`,
  [CONTENT_IDS.wsWikiDiagramsAndViews]: `# Diagrams & Views

Diagrams and saved catalog views can be embedded directly in a wiki page.

## Diagram embed

<DiagramEmbed id="${CONTENT_IDS.wsArchitectureOverview}" caption="Architecture overview" />

## Saved view embed

<EntityViewEmbed viewId="00000000-0000-0000-0020-000000000001" />
`,
  [CONTENT_IDS.wsAdrApiVersioning]: `# Use URL versioning for public APIs

## Context

Several clients consume the platform API independently and need a predictable way to adopt
breaking changes.

## Decision

Public APIs will use a major version in the URL when a breaking change is introduced. Additive
changes remain compatible within the current version.

## Consequences

Clients can migrate deliberately, and old versions can be retired with a clear communication plan.
`,
  [CONTENT_IDS.wsAdrAsyncMessaging]: `# Use asynchronous messaging for long-running workflows

## Context

Some workflows take longer than a normal request and should not keep an HTTP connection open.

## Decision

Long-running workflows will be submitted through the API and completed through asynchronous
messages and status updates.

## Consequences

The user interface must show progress and failure states, but workers can retry without blocking
request handlers.
`,
  [CONTENT_IDS.wsAdrAuthentication]: `# Keep credentials outside application data

## Context

Authentication tokens and other secrets require stronger controls than ordinary catalog data.

## Decision

Secrets will be stored through the configured secret-management integration. Application records
may keep references and metadata, but not the secret values themselves.

## Consequences

Secret rotation is centralized, while local development needs a documented fallback configuration.
`,
  [CONTENT_IDS.wsAdrObservability]: `# Standardize on structured logs and traces

## Context

Production incidents are difficult to investigate when logs use inconsistent fields and formats.

## Decision

Services will emit structured logs with correlation identifiers and produce distributed traces for
requests that cross service boundaries.

## Consequences

Operational dashboards become easier to share, and new services need to adopt the common fields
before they are considered production-ready.
`,
  [CONTENT_IDS.wsAdrDataOwnership]: `# Keep data ownership with the domain that changes it

## Context

Shared tables make it easy for unrelated features to modify the same data without clear ownership.

## Decision

Each domain owns its persistence model and exposes changes through a documented service boundary.
Other domains consume that boundary instead of writing directly to the tables.

## Consequences

Ownership is clearer and schema changes are safer, although some cross-domain operations require
explicit coordination.
`,
  [CONTENT_IDS.checkoutRevampProjectBrief]: `# Checkout Revamp — Project Brief

## Goal

Modernize checkout orchestration and integrate a new payment gateway provider to reduce
transaction latency and support additional payment methods.

## Scope

- <EntityLink id="00000000-0000-0000-0002-000000000003" /> — new dedicated system for payment
  authorization, capture, refunds and ledger reconciliation
- <EntityLink id="00000000-0000-0000-0003-000000000004" /> — orchestrates authorization and
  capture against the new gateway provider
- <EntityLink id="00000000-0000-0000-0003-000000000005" /> — double-entry ledger for all payment
  and refund transactions
- <EntityLink id="00000000-0000-0000-0003-000000000006" /> — real-time fraud scoring ahead of
  capture

## Non-goals

- Migrating existing subscription billing (tracked separately)
- Multi-currency support (candidate for a follow-up project)

## Stakeholders

<EntityCard id="00000000-0000-0000-0003-000000000004" fields="owner,lifecycle,tags" />

See the [Rollout Plan](../planning/rollout-plan) for milestones and sequencing.
`,
  [CONTENT_IDS.checkoutRevampRolloutPlan]: `# Rollout Plan

## Milestones

| Milestone | Target date | Status |
| --- | --- | --- |
| Payment gateway integration | 2026-05-15 | Planned |
| Fraud detection rollout | 2026-07-01 | Planned |

## Sequencing

1. Stand up <EntityMention id="00000000-0000-0000-0002-000000000003" /> and the supporting
   ledger and Postgres resources.
2. Integrate <EntityMention id="00000000-0000-0000-0003-000000000004" /> with the new gateway
   provider behind a feature flag.
3. Enable <EntityMention id="00000000-0000-0000-0003-000000000006" /> in shadow mode, then
   promote to blocking once precision/recall targets are met.
4. Cut over checkout traffic and decommission the legacy payment path.

## Risks

- Gateway provider sandbox availability may slip the integration milestone.
- Fraud model precision needs validation against production traffic before it can block
  transactions.
`
};

export const seedAdrDocuments = [
  { id: CONTENT_IDS.wsAdrApiVersioning, status: 'Accepted', decision_date: '2025-09-15' },
  { id: CONTENT_IDS.wsAdrAsyncMessaging, status: 'Accepted', decision_date: '2025-10-03' },
  { id: CONTENT_IDS.wsAdrAuthentication, status: 'Accepted', decision_date: '2025-11-12' },
  { id: CONTENT_IDS.wsAdrObservability, status: 'Proposed', decision_date: '2025-12-01' },
  { id: CONTENT_IDS.wsAdrDataOwnership, status: 'Accepted', decision_date: '2026-01-05' }
] as const;

export const seedProjectFiles: ContentNodeDbResult[] = [
  {
    id: CONTENT_IDS.authApiOverviewFolder,
    workspace: WORKSPACE_ID,
    project_id: null,
    entity_id: AUTH_API_ENTITY_ID,
    parent_id: null,
    path: 'overview',
    name: 'Overview',
    type: 'folder',
    size_bytes: 0,
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  {
    id: CONTENT_IDS.authApiOverviewDiagram,
    workspace: WORKSPACE_ID,
    project_id: null,
    entity_id: AUTH_API_ENTITY_ID,
    parent_id: CONTENT_IDS.authApiOverviewFolder,
    path: 'overview/architecture',
    name: 'Architecture',
    type: 'diagram',
    size_bytes: 0,
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  {
    id: CONTENT_IDS.authApiSequenceDiagram,
    workspace: WORKSPACE_ID,
    project_id: null,
    entity_id: AUTH_API_ENTITY_ID,
    parent_id: null,
    path: 'token-flow',
    name: 'Token Flow',
    type: 'diagram',
    size_bytes: 0,
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  {
    id: CONTENT_IDS.authApiSecurityFolder,
    workspace: WORKSPACE_ID,
    project_id: null,
    entity_id: AUTH_API_ENTITY_ID,
    parent_id: null,
    path: 'security',
    name: 'Security',
    type: 'folder',
    size_bytes: 0,
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  {
    id: CONTENT_IDS.authApiThreatModel,
    workspace: WORKSPACE_ID,
    project_id: null,
    entity_id: AUTH_API_ENTITY_ID,
    parent_id: CONTENT_IDS.authApiSecurityFolder,
    path: 'security/threat-model',
    name: 'Threat Model',
    type: 'diagram',
    size_bytes: 0,
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  // Workspace-level content nodes (both project_id and entity_id are null)
  {
    id: CONTENT_IDS.wsArchitectureOverview,
    workspace: WORKSPACE_ID,
    project_id: null,
    entity_id: null,
    parent_id: null,
    path: 'architecture-overview',
    name: 'Architecture Overview',
    type: 'diagram',
    size_bytes: 0,
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  {
    id: CONTENT_IDS.wsStandardsFolder,
    workspace: WORKSPACE_ID,
    project_id: null,
    entity_id: null,
    parent_id: null,
    path: 'standards',
    name: 'Standards',
    type: 'folder',
    size_bytes: 0,
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  {
    id: CONTENT_IDS.wsApiDesignGuide,
    workspace: WORKSPACE_ID,
    project_id: null,
    entity_id: null,
    parent_id: CONTENT_IDS.wsStandardsFolder,
    path: 'standards/api-design-guide',
    name: 'API Design Guide',
    type: 'diagram',
    size_bytes: 0,
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  {
    id: CONTENT_IDS.wsDeploymentTopology,
    workspace: WORKSPACE_ID,
    project_id: null,
    entity_id: null,
    parent_id: CONTENT_IDS.wsStandardsFolder,
    path: 'standards/deployment-topology',
    name: 'Deployment Topology',
    type: 'diagram',
    size_bytes: 0,
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  {
    id: CONTENT_IDS.wsWikiFolder,
    workspace: WORKSPACE_ID,
    project_id: null,
    entity_id: null,
    parent_id: null,
    path: 'wiki',
    name: 'Wiki',
    type: 'folder',
    size_bytes: 0,
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  {
    id: CONTENT_IDS.wsWikiHome,
    workspace: WORKSPACE_ID,
    project_id: null,
    entity_id: null,
    parent_id: CONTENT_IDS.wsWikiFolder,
    path: 'wiki/home',
    name: 'Home',
    type: 'markdown',
    size_bytes: Buffer.byteLength(
      JSON.stringify({ body: seedWikiPageBodies[CONTENT_IDS.wsWikiHome] }),
      'utf8'
    ),
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  {
    id: CONTENT_IDS.wsWikiMarkdownCheatsheet,
    workspace: WORKSPACE_ID,
    project_id: null,
    entity_id: null,
    parent_id: CONTENT_IDS.wsWikiFolder,
    path: 'wiki/markdown-cheatsheet',
    name: 'Markdown Cheatsheet',
    type: 'markdown',
    size_bytes: Buffer.byteLength(
      JSON.stringify({ body: seedWikiPageBodies[CONTENT_IDS.wsWikiMarkdownCheatsheet] }),
      'utf8'
    ),
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  {
    id: CONTENT_IDS.wsWikiEntityWidgets,
    workspace: WORKSPACE_ID,
    project_id: null,
    entity_id: null,
    parent_id: CONTENT_IDS.wsWikiFolder,
    path: 'wiki/entity-widgets',
    name: 'Entity Widgets Showcase',
    type: 'markdown',
    size_bytes: Buffer.byteLength(
      JSON.stringify({ body: seedWikiPageBodies[CONTENT_IDS.wsWikiEntityWidgets] }),
      'utf8'
    ),
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  {
    id: CONTENT_IDS.wsWikiDiagramsAndViews,
    workspace: WORKSPACE_ID,
    project_id: null,
    entity_id: null,
    parent_id: CONTENT_IDS.wsWikiFolder,
    path: 'wiki/diagrams-and-views',
    name: 'Diagrams & Views',
    type: 'markdown',
    size_bytes: Buffer.byteLength(
      JSON.stringify({ body: seedWikiPageBodies[CONTENT_IDS.wsWikiDiagramsAndViews] }),
      'utf8'
    ),
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  {
    id: CONTENT_IDS.wsAdrFolder,
    workspace: WORKSPACE_ID,
    project_id: null,
    entity_id: null,
    parent_id: CONTENT_IDS.wsWikiFolder,
    path: 'wiki/adr',
    name: 'Architecture Decision Records',
    type: 'folder',
    size_bytes: 0,
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  ...(
    [
      [CONTENT_IDS.wsAdrApiVersioning, 'wiki/adr/api-versioning', 'API versioning'],
      [CONTENT_IDS.wsAdrAsyncMessaging, 'wiki/adr/async-messaging', 'Asynchronous messaging'],
      [
        CONTENT_IDS.wsAdrAuthentication,
        'wiki/adr/credential-storage-policy',
        'Credential storage policy'
      ],
      [
        CONTENT_IDS.wsAdrObservability,
        'wiki/adr/structured-observability',
        'Structured observability'
      ],
      [CONTENT_IDS.wsAdrDataOwnership, 'wiki/adr/domain-data-ownership', 'Domain data ownership']
    ] as const
  ).map(([id, path, name]) => ({
    id,
    workspace: WORKSPACE_ID,
    project_id: null,
    entity_id: null,
    parent_id: CONTENT_IDS.wsAdrFolder,
    path,
    name,
    type: 'markdown' as const,
    size_bytes: Buffer.byteLength(JSON.stringify({ body: seedWikiPageBodies[id] }), 'utf8'),
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  })),
  // Checkout Revamp project-scoped wiki
  {
    id: CONTENT_IDS.checkoutRevampPlanningFolder,
    workspace: WORKSPACE_ID,
    project_id: seededProjects.checkoutRevamp.id,
    entity_id: null,
    parent_id: null,
    path: 'planning',
    name: 'Planning',
    type: 'folder',
    size_bytes: 0,
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  {
    id: CONTENT_IDS.checkoutRevampProjectBrief,
    workspace: WORKSPACE_ID,
    project_id: seededProjects.checkoutRevamp.id,
    entity_id: null,
    parent_id: CONTENT_IDS.checkoutRevampPlanningFolder,
    path: 'planning/project-brief',
    name: 'Project Brief',
    type: 'markdown',
    size_bytes: Buffer.byteLength(
      JSON.stringify({ body: seedWikiPageBodies[CONTENT_IDS.checkoutRevampProjectBrief] }),
      'utf8'
    ),
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  {
    id: CONTENT_IDS.checkoutRevampRolloutPlan,
    workspace: WORKSPACE_ID,
    project_id: seededProjects.checkoutRevamp.id,
    entity_id: null,
    parent_id: CONTENT_IDS.checkoutRevampPlanningFolder,
    path: 'planning/rollout-plan',
    name: 'Rollout Plan',
    type: 'markdown',
    size_bytes: Buffer.byteLength(
      JSON.stringify({ body: seedWikiPageBodies[CONTENT_IDS.checkoutRevampRolloutPlan] }),
      'utf8'
    ),
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  }
];
