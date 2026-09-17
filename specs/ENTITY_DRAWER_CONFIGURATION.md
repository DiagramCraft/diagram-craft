# Configurable entity drawers: requirements assessment

This assessment supports [#3310](https://github.com/DiagramCraft/diagram-craft/issues/3310), part of
[#3309](https://github.com/DiagramCraft/diagram-craft/issues/3309).

## Decision summary

Arch Register should use one workspace-scoped drawer configuration document with one profile per entity
schema. The profile is selected by the resolved schema id, which is the stable discriminator already used by
the entity and application configuration APIs.

Named drawers and context-specific variants are deferred. The current differences are primarily explained by
entity type and application capability, while adding selectors for application, relation context, or link source
would make precedence and administration substantially harder before the common renderer exists. The model must
leave room for those selectors later.

The v1 configuration controls presentation and optional registered content. It does not become a general-purpose
programming, query, permission, or action-authoring surface.

## Current implementation inventory

### Shared drawer behavior

All current drawers use `../arch-register-packages/web/src/components/Drawer.tsx`:

- a full-height right-side overlay with a backdrop and Escape-to-close behavior;
- an optional eyebrow, title, badges, scrollable body, and optional footer;
- a default width of `min(420px, 100vw)`;
- no configurable width, column count, tabs, responsive breakpoints, or content schema;
- loading and unavailable states implemented independently by each drawer.

The current app drawers are single scrolling surfaces. Tabs exist on the full entity detail screen, not on the
specialized drawers.

The full entity detail screen is the generic baseline. Its `detail_layout` already supports ordered tabs, panels,
fields, field groups, metadata, links, unbound typed relations, projects, and diagrams. It is an edit-capable
full-page experience and should remain separate from the read-only drawer configuration.

### Specialized drawers

| Drawer | Entity or context | Header and actions | Sections and content | Entry/deep-link behavior |
| --- | --- | --- | --- | --- |
| `GlossaryTermDrawer` | Business Glossary Term | Public id eyebrow; status, lifecycle, and quality badges; **Open in Entities** footer action | Definition, aliases, conflict warning, categories, owner, and usage/backlinks grouped by entities, relations, documents, projects, and diagrams | `/glossary/$termId`; opened from the glossary register; usage comes from glossary-specific queries |
| `DatasetDrawer` | Data Stewardship Data Entity/dataset | Public id eyebrow; classification badge; **Open record in Entities** footer action | Attributes; Stewardship; coverage score/gaps; queue items; change cases; exceptions placeholder; assessments; Flows and Systems placeholders | Uses `datasetId` search state on several Data Stewardship sections; queue items can open `DataStewardshipCaseDrawer` |
| `DataStewardshipCaseDrawer` | Governance case, not an entity drawer | Case status eyebrow; priority badge; permission-dependent Approve/Acknowledge and Request changes actions; open subject dataset/record action | Case status, timestamps, due/escalation/outcome, current-user assignment, and dataset in scope | Uses `caseId` search state; remains a specialized case drawer outside the entity profile model |
| `RiskDrawer` | Risk | Public id eyebrow; category/status badges; **Open record in Entities** footer action | Risk profile and residual band; attributes; aggregate coverage; mitigating controls with coverage/effectiveness; affected entities | `/risk-compliance/risks/$riskId`, plus in-situ opening from controls and overview surfaces |
| `ControlDrawer` | Control | Public id eyebrow; control-type badge; **Open record in Entities** footer action | Attributes; mitigated risks with coverage/effectiveness; protected entities | `/risk-compliance/controls/$controlId`, plus in-situ opening from risk coverage and traceability surfaces |
| Local `AssetDrawer` | Arbitrary entity affecting a risk | Public id eyebrow; schema badge; **Open record in Entities** footer action | Identity only and an explanation that the full record contains attributes and links | In-situ only from Risk & Compliance coverage/traceability; no dedicated route |
| `CapabilityDrawer` | Strategy Business Capability | Public id eyebrow; capability-level/lifecycle badges; **Open record in Entities** footer action | Configured roll-up metrics and leaf count; type, level, owner, child count; configured extra fields; children; realized-by applications with provenance; linked objectives and initiatives | `/strategy/capabilities/$capabilityId`, `/strategy/map/$capabilityId`, and `/strategy/strategy/$capabilityId`; child capability clicks replace the drawer target |
| `VendorDrawer` | Vendor | Public id eyebrow; tier/status badges; **Open record in Entities** footer action | Risk profile and derived risk band; attributes; spend and contract count; contracts; applications supplied; technology lifecycle; capabilities-funded placeholder | Vendor Management vendor, spend, overview, and risk surfaces use vendor-specific deep links or in-situ navigation |
| `ContractDrawer` | Contract | Public id eyebrow; contract type and renewal-window badges; **Open record in Entities** footer action | Vendor link; terms; cost; systems used | `/vendor-management/contracts/$contractId`; vendor link opens the Vendor drawer rather than the generic entity page |

### Common versus entity-specific behavior

Common behavior is limited to drawer chrome, entity identity, loading/error handling, and the full-record escape
hatch. The following are currently hard-coded per drawer:

- field visibility, ordering, and labels;
- section names, grouping, collapsibility, and empty-state copy;
- badges and derived metrics;
- relation traversal and related-entity presentation;
- route state and nested drawer navigation;
- application-specific placeholders and actions.

Entity-specific content falls into three categories:

1. **Declarative entity values** — scalar fields, metadata, references, and typed relations.
2. **Registered application content** — glossary usage, risk coverage, capability roll-ups, vendor spend,
   stewardship queues, and similar derived sections.
3. **Contextual operations** — governance decisions, nested drawer transitions, and application-specific links.

Only the first two categories belong in the initial configuration boundary. Contextual operations remain owned by
the application/provider layer and must continue to enforce their own permissions.

## Proposed v1 configuration

The persisted resource is one workspace-level JSON document:

```json
{
  "version": 1,
  "profiles": {
    "schema-id": {
      "header": {
        "badges": [
          { "kind": "field", "fieldId": "status", "label": "Status" },
          { "kind": "metadata", "slot": "lifecycle" }
        ]
      },
      "sections": [
        {
          "id": "attributes",
          "title": "Attributes",
          "collapsible": false,
          "items": [
            { "kind": "field", "fieldId": "category" },
            { "kind": "metadata", "slot": "owner", "label": "Relationship owner" },
            { "kind": "metadata", "slot": "description" }
          ]
        },
        {
          "id": "related",
          "title": "Related entities",
          "items": [
            { "kind": "relation", "fieldId": "affected_entities", "label": "Affected entities" }
          ]
        },
        {
          "id": "coverage",
          "title": "Coverage",
          "items": [{ "kind": "slot", "slotId": "risk.coverage" }]
        }
      ]
    }
  }
}
```

The exact API naming can follow the existing contract conventions, but the semantics are fixed:

- Presence and array order control visibility and ordering.
- Sections control grouping, titles, and collapsibility.
- Field items reference schema field ids and may override the display label.
- Metadata items reference a fixed allowlist of identity/metadata slots, such as public id, description, owner,
  lifecycle, target lifecycle, namespace, and tags.
- Relation items reference an entity relation field or a registered relation source. They do not contain arbitrary
  query expressions.
- Slot items reference a semantic provider slot registered by an application. The slot registry supplies the
  friendly admin label, supported schemas, renderer, data loading, and permission behavior; the configuration does
  not expose component names or implementation paths.
- The entity name remains the drawer title and the public id remains available as the identity eyebrow.
- The full-record action remains a mandatory, fixed escape hatch. Optional mutating actions are not authored by the
  workspace configuration.

### v1 admin UI capabilities

The follow-up configuration UI should provide:

- a schema/entity-type selector within the workspace settings area;
- a list of available fields, metadata slots, relations, and registered content slots;
- add/remove and drag-and-drop ordering for sections and items;
- section title and collapsibility editing;
- field and slot label overrides where supported;
- a preview using a representative entity, including loading, empty, and unavailable content states;
- reset-to-default behavior;
- warnings for archived/missing fields, inaccessible field groups, unsupported slots, and stale relation references;
- a clear indication that permissions and contextual actions are not granted by drawer configuration.

The UI should not expose arbitrary SQL/query builders, JSX/component identifiers, custom formulas, custom action
handlers, viewer-specific layouts, drawer width, responsive breakpoints, or tab construction in v1.

### Selection, fallback, and permissions

Selection is schema-only in v1:

1. Load the profile for the entity's resolved schema id.
2. Resolve configured fields and metadata against the current schema.
3. Render registered slots only when the current application/provider supports them.
4. Omit stale or unsupported items and surface diagnostics to administrators.
5. If no profile exists, use a generic read-only default based on schema field/group order, followed by non-empty
   metadata and relation/content blocks supported by the generic renderer.

The same schema profile applies wherever that entity is opened. Application and relation context do not override it
in v1.

Configuration must never grant access. The renderer must reapply field-group visibility before rendering fields,
including shared field-group links. Related-entity queries and registered slots must use the existing permission-aware
API/data paths. Hidden groups and empty sections should disappear rather than reveal a restricted-field placeholder.
Admin editing remains gated by the existing workspace/schema administration permissions.

### Tabs and responsive behavior

Specialized drawers currently have no tabs. V1 uses one ordered scrollable surface with collapsible sections. The
existing full-page detail tabs remain the escape hatch for broad entity inspection and editing.

Drawer sizing and responsive behavior remain renderer-owned: the drawer is up to 420px wide, becomes full-width on
narrow viewports, and scrolls vertically. Configuration controls content order, not columns or breakpoints.

## Multiple configurations and extension path

One schema-keyed workspace document is sufficient for v1 because:

- every current specialized drawer has a clear entity/schema owner;
- the current app configuration already resolves capability roles to concrete workspace schema ids;
- the most important consistency goal is shared field/section presentation for the same entity type;
- application-derived content can be represented by registered slots without giving each app an independent layout;
- named/context-specific configurations would introduce precedence, inheritance, and preview complexity before there
  is a common renderer to exercise them.

If later use cases require variants, extend profile selection without changing the v1 profile payload. Candidate
selectors, in descending specificity, are:

1. an explicitly named profile selected by the caller;
2. relation context or link source;
3. application id/capability;
4. entity schema id;
5. the generic workspace default.

The selector and precedence should be introduced only with a concrete use case and migration tests. Existing
schema-only profiles must remain valid and continue to be the fallback.

## Migration and compatibility requirements

### Follow-up drawer migration (#3312)

The migration issue must cover these entity drawers and their provider adapters:

- Business Glossary Term;
- Data Stewardship Data Entity/dataset;
- Strategy Business Capability;
- Risk & Compliance Risk and Control;
- Vendor Management Vendor and Contract;
- the generic arbitrary-entity path currently represented by the local AssetDrawer.

The generic renderer should become the fallback for ordinary entity types that do not have an application-specific
drawer. Existing application-derived sections should first be registered as semantic slots, then moved into the
configured profile without changing their underlying queries or calculations.

`DataStewardshipCaseDrawer` is a governance-case drawer, not an entity drawer, and should remain specialized. The
conformance violation drawer is likewise outside this model.

### Backwards compatibility

- A missing configuration document means existing/default behavior, not an empty drawer.
- Existing full entity detail routes and their `detail_layout` configuration remain unchanged.
- Existing app deep links remain valid while each drawer is migrated.
- Field rename/removal handling should follow the existing schema migration/remapping behavior; stale drawer items
  are dropped with diagnostics and never block entity data migration.
- Unknown configuration versions must fail closed to the generic default and preserve the stored payload for an
  administrator to repair or migrate.
- The mandatory full-record action remains available even when a specialized slot is unavailable.
- #3313 should migrate entity links only after the drawer renderer and migrated providers can preserve the current
  route/search context and provide a reliable full-page escape hatch.

## Implementation handoff

### #3311 — configuration UI and storage

Define the API contract and persisted workspace resource, add versioned validation, expose the schema/slot catalog,
and build the admin editor and preview. Reuse the existing schema/detail-layout editor conventions where useful, but
keep drawer configuration separate from the edit-capable `detail_layout` payload.

### #3312 — drawer migration

Build the generic drawer renderer and slot registry, add schema-profile defaults, then migrate the listed application
drawers one at a time. Preserve existing loading/error/empty states, derived calculations, permission checks, and
deep-link behavior with focused component tests.

### #3313 — drawer-first links

Update entity navigation links and route/search state handling after #3312. Keep an explicit action for opening the
full entity detail route and verify links from generic entity views, Markdown, projects, relations, and app surfaces.

## Acceptance checklist

- [x] Current drawer implementations and differences are inventoried.
- [x] A v1 configuration shape and admin capability list are documented.
- [x] The single workspace document versus multiple named/context configurations decision is explicit.
- [x] Entity types and drawers for #3312 are identified, including explicit exclusions.
- [x] Permissions, responsive behavior, routes, and backwards compatibility are actionable for implementation.
- [x] Link this assessment from parent issue #3309.
