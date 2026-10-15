# Domain-specific dashboard widgets: assessment (#3636)

Per-widget inventory of what each domain widget renders, which generic code it already uses, what is truly domain-specific, and the proposed disposition. No code has moved yet.

## Inventory (what each widget relies on)

Legend: **Generic already** = shared code that exists under `widgets/`. **Truly domain** = cannot be expressed
by config on a generic widget today.

### API & Integration Catalog (7)

| Widget (`type`) | Renders | Generic already | Truly domain-specific | Proposed disposition |
|---|---|---|---|---|
| `…-needs-attention` | List of open change/deprecation cases on APIs | `useNeedsAttentionQueue`, `NeedsAttentionList` (`widgets/data-views/needs-attention`) | Nothing. Only: case-kind constant `IC_QUEUE_CASE_KINDS`, API schema resolved via `useResolvedApiIntegrationCatalogConfig`, click → `openApi` navigates to APIs dashboard drawer | **Replace** with `NeedsAttentionQueue` (`schema: 'API'`, `caseKinds`, `limit`). Drawer navigation difference is acceptable (generic opens entity drawer) |
| `…-needs-attention-count` | Single stat: number of those cases | `useNeedsAttentionQueue` | Nothing | **Generalize**: new generic `CaseCount` metric widget (see Data Stewardship `case-count`); one widget replaces both |
| `…-pair-gaps` | Single stat: provider/consumer pairs lacking a Data Flow | `computeRelationPairs`/`computeRelationPairCoverage` (`relation-pairs-coverage`) | Nothing in logic; schema/field names (`API`, Provides/Consumes API, `Data Flow`) come from workspace config hooks | **Generalize** `RelationPairsCoverage` with a compact `display: 'stat'` (gap count) mode; config supplies names |
| `…-stats` | 4 tiles: needs attention, crossing boundary, restricted data, gap pairs | all four sub-computations above | `classifyDataFlowRelations`: `cross_boundary === 'cross-boundary'`, `data_classification ∈ RESTRICTED_CLASSIFICATIONS`, `'highly-sensitive'` — field/value conventions, not behaviour | **Delete** — not used by any seeded dashboard (not in `appDashboards.ts`); compose from `AggregateStat` + `CaseCount` if wanted |
| `…-at-risk` | List of Data Flow relations that cross a boundary or are restricted | `useRelations`, relation row rendering in `RelationTable` | OR-filter "crosses boundary OR restricted" over Data Flow relations (`selectAtRiskIntegrations`) | **Replace** with `RelationTable` (`widgets/data-views/relation-table`) if its filter supports OR; otherwise small gap: add OR/`in` filter support. Header "All integrations" link → generic link action |
| `…-most-consumed` | Top-N APIs by consumer count + operations count | `groupByApiId`/`rankMostConsumedApis` helpers (domain files), `TopEntities` ranks by a **field** only | Rank by count of typed-relation targets (`CONSUMERS_FIELD`); "operations" count from `useSpecificationItemCounts` (spec revisions) | **Generalize** `TopEntities` with rank-by `relationFieldCount`; operations column is spec-specific → **dropped** (decided) |
| `…-impact` | Blast radius with Providers / Direct consumers / Second order groups | `BlastRadiusPanel`, generic `blast-radius` widget (config: only `entityId`) | Only the path definition (Provides API / Consumes API typed relations), group labels, depth 2, no-paths message | **Generalize** `blast-radius` widget: config for relation fields + group labels (`apiBlastRadiusConfig.ts` becomes a seeded config). Nothing truly domain remains |

### Data Stewardship (4)

| Widget (`type`) | Renders | Generic already | Truly domain-specific | Proposed disposition |
|---|---|---|---|---|
| `…-case-count` | Stat tile: open governance cases, scope + kinds, tone, `{count}/{due}` subtext | `useNeedsAttentionQueue` | Nothing: schema `'Data Entity'` by name, default kinds `DS_QUEUE_CASE_KINDS` (incl. `field-date-reminder`) are config | **Generalize** → shared `CaseCount` (above); `schemaName`, `caseKinds`, `scope`, `tone`, `subtextTemplate`, `dueWithinDays` as config |
| `…-case-queue` | Case cards: kind, derived priority, due label, dataset; click opens case drawer | `useNeedsAttentionQueue`, `deriveDueDatePriority`, `NeedsAttentionList` | Click target = case drawer via `caseId` search param (host `AppDashboardRouteScreen`); card visual | **Replace** with `NeedsAttentionQueue`; add `onOpen: 'entity' \| 'case'` option if case drawer must be kept. Scope `mine/workspace/late` already supported |
| `…-case-calendar` | Six-week grid of cases by due week | `bucketByPeriod`, `CalendarGrid`, `DateCalendar` (week period × `periodCount`) | `DateCalendar` sources *records by date field*; this sources *cases by `dueAt`* — record-source mismatch | **Generalize** `DateCalendar` (or share its bucketing) with a case source (`NeedsAttention` queue config). Only real gap in this group |
| `…-reviews-overdue` | Stat: Data Entities with `review_status === 'overdue'` | `AggregateStat` query mode | `review_status` is a schema derived field (#3079), not widget logic | **Replace** with `AggregateStat` query `review_status = overdue` on `Data Entity`; custom subtext via `subtextTemplate` |

## Summary

- Truly domain-specific functionality: **only** the "operations count" column of Most consumed (spec
  revisions), which is dropped — everything else is config (schema/field/case-kind names), or small gaps in generic widgets.
- 3 widgets replaced by existing generics, 1 deleted (unused), 3 need a new generic `CaseCount` / generic
  extension of `RelationPairsCoverage`/`TopEntities`/`blast-radius`, 1 generalizes `DateCalendar`.
- Gaps to build in generics: `CaseCount`; `RelationPairsCoverage` stat mode; `TopEntities` rank-by-relation
  count; `blast-radius` path/group config; `DateCalendar` case source; `NeedsAttention` `onOpen: case`;
  `RelationTable` OR filter (verify).

## Migration notes (from #3636 to-do 3)

- Seeded types in `server/src/db/seedData/appDashboards.ts` (lines ~256–341 API catalog, ~1027–1094 Data
  Stewardship); also referenced by `server/.../appDashboards.test.ts`, `e2e/src/api/dashboard.app.test.ts`,
  `web/src/sections/dashboard/dashboardWidgets.test.ts`, and `app/data-stewardship/*.stories.tsx`.
- No backwards compatibility needed (decided): old widget types are removed outright; seed and template
  dashboard data must be updated to the new types/configs.
- Per `docs/internal/widget-structure.md`, any widget kept domain-specific moves to `widgets/<category>/<name>/`.
- Per CLAUDE.md, update `feature-maps/` for removed/changed widgets.

## Verification

- Doc table cross-checked against each `*.widget.tsx` (type, category, config schema) — done during research.
- On follow-up implementation: `vitest run` for `widgets/**`, `dashboardWidgets.test.ts`,
  `appDashboards.test.ts`; `pnpm lint:tsc`; e2e `pnpm --filter @arch-register/e2e test:api`; open seeded
  API Catalog and Data Stewardship dashboards to confirm parity.
