# Arch Register domain model

This document describes the persistent model for live entities, entity history, planned changes,
and approval workflow. It is the design reference for the catalog domain and its database adapters.

## Core concepts

### `entity`

`entity` is the current live representation of an architecture entity. Reads from the normal catalog
use this table. Direct edits update the live row and append an `entity_version`.

The live row is not replaced by the change-case model. It remains the authoritative current state.

### `entity_version`

`entity_version` records an actual historical state of one entity. It is append-only in the domain
model and is identified by `(workspace, entity_id, version_number)`.

Supported version kinds are:

- `autosave` — ordinary edit history;
- `saved_version` — an explicitly named/preserved version;
- `deleted` — a deletion marker;
- `restored` — a restoration result;
- `direct_edit` — an explicitly classified direct edit;
- `case_applied` — a state produced by applying a change-case revision;
- `bypass` — a governed change applied through an administrative bypass.

`applied_case_revision_id` links a `case_applied` version to the revision that produced it.
Ordinary direct edits leave this relationship null.

### `entity_change_case`

An entity change case is the durable container for a proposed change to one or more entities. It can
be created for project planning or directly for approval.

`purpose` is constrained to:

- `planned_change` — a change being planned for a future/effective date;
- `requested_change` — a change created as an approval request.

`purpose` describes intent. `status` describes lifecycle. A planned case may later enter approval
without changing its purpose.

Case statuses are:

`planned`, `in_approval`, `applied`, `rejected`, `withdrawn`, `cancelled`, and `superseded`.

The case owns shared information such as project, name, description, effective date or milestone,
initiator, and timestamps.

### `entity_change_case_revision`

A revision is an immutable proposal for the complete case at a particular point in time. A case may
have multiple revisions after changes are requested, a revision becomes stale, or a proposal is
resubmitted.

The revision stores:

- the parent case and revision number;
- the complete approval-relevant policy snapshot;
- proposal message and author;
- revision lifecycle status;
- creation and resolution timestamps.

`policy_version` identifies the policy inputs used to resolve the approval policy. `resolved_policy`
stores the effective policy snapshot so later policy changes do not alter the meaning of a submitted
revision.

Revision statuses are:

`draft`, `submitted`, `changes_requested`, `stale`, `applied`, `rejected`, `withdrawn`, and
`superseded`.

### `entity_change_case_entity_version`

This table contains one entry for every entity affected by a revision. The name is intentional: the
row connects a case revision to the entity version it is based on and, after application, to the
resulting entity version.

Each entry stores:

- entity identifier;
- base version and complete base state;
- complete proposed state;
- field-level diff;
- nullable `applied_version_id`, populated with the resulting `entity_version` after application.

There can be only one entry for a given `(revision_id, entity_id)` pair.

## Relationships

```text
entity                         current live state
  │
  └── entity_version            actual historical states
          ▲
          │ applied_case_revision_id
entity_change_case
  └── entity_change_case_revision  immutable proposal snapshot
          └── entity_change_case_entity_version  one row per affected entity
                  │
                  └── applied_version_id → entity_version
```

The generic governance case remains the workflow mechanism for assignments, decisions,
notifications, and decision history. It references the relevant entity change-case revision; it does
not duplicate proposed entity state.

## Time-travel behavior

- Historical browsing reconstructs state from `entity_version` rows.
- Future browsing starts with the relevant actual version and applies active planned revisions in
  effective-date order.
- All entries belonging to one revision are treated as one coordinated future event.
- Applied cases are represented by their resulting `case_applied` versions and are not applied again
  as future intent.
- Rejected, withdrawn, cancelled, superseded, and stale revisions remain available for audit/history
  but do not affect the active future projection.

## Invariants

- `entity_version` version numbers are unique per workspace and entity.
- Applied-version and applied-revision relationships are foreign-key constrained.
- A case revision and its entries retain the same workspace. Workspace columns are intentionally
  denormalized for tenant-scoped queries; their consistency must be enforced by foreign keys or
  application checks.
- A case uses either an effective date or a milestone, never both.
- A revision has at most one entry per entity.
- Approval validates every entry against its base version before changing any live entity.
- Multi-entity application updates all live entities and creates all resulting versions in one
  transaction.

## Compatibility and migration

The target model is created by migration `063_entity_change_case_model`. Migration
`064_drop_legacy_entity_change_storage` removes the old `entity_snapshot`,
`entity_change_proposal`, and `entity_change_proposal_revision` tables. Existing migration files are
kept unchanged as migration history.

The current server still exposes snapshot/proposal-shaped repository and API compatibility methods
for the existing single-entity UI. Those methods write to and read from the target tables. The
multi-entity case API and atomic application flow are tracked in
[issue #2364](https://github.com/DiagramCraft/diagram-craft/issues/2364) (planning) and
[issue #2365](https://github.com/DiagramCraft/diagram-craft/issues/2365) (approval proposals);
removal of the compatibility API surface is tracked in
[issue #2341](https://github.com/DiagramCraft/diagram-craft/issues/2341).

Bootstrap assumes a clean database. Seeded entities receive an initial `entity_version`; no legacy
data backfill is performed.

## Related follow-up

- [#2364 — Plan a change across multiple entities](https://github.com/DiagramCraft/diagram-craft/issues/2364)
- [#2365 — Propose a change across multiple entities](https://github.com/DiagramCraft/diagram-craft/issues/2365)
- [#2340 — Evaluate redundant workspace columns](https://github.com/DiagramCraft/diagram-craft/issues/2340)
- [#2341 — Replace snapshot and proposal compatibility APIs](https://github.com/DiagramCraft/diagram-craft/issues/2341)
