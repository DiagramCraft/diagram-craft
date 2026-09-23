# Arch Register Feature Map

- @id:ar Arch Register provides services to manage architecture entities, projects, documentation, and administrative
  capabilities.

    - @id:ar.access Arch Register provides authenticated, workspace-scoped access to architecture entities, projects,
      documentation, and administrative capabilities.

        - @id:ar.access.login Users can sign in through the configured local authentication flow and maintain an
          authenticated session.

        - @id:ar.access.user-management Platform administrators can create, update, deactivate, reactivate, and
          change passwords for local user accounts when OIDC authentication is not enabled.

        - @id:ar.access.account Users can manage account settings and personal API tokens.

        - @id:ar.access.oidc @status:experimental Deployments can expose OIDC-based authentication flows when
          configured.

        - @id:ar.access.workspaces Users can enter a workspace and work within the workspace’s data, projects,
          permissions, and settings boundary.

        - @id:ar.access.public-catalog Workspace administrators can publish an allow-listed, read-only catalog for
          unauthenticated external readers, including entities, Markdown pages, and API specifications; readers can
          browse the catalog in an accessible light or dark presentation. Identifiers retired by an
          @id:ar.collaboration.entity-merge redirect to the canonical record so external links stay valid.

        - @id:ar.access.dev-switcher @status:experimental Development-mode deployments can optionally expose a
          user-switcher toolbar that instantly assumes the identity of any user in the database, bypassing login, for
          local testing only.

    - @id:ar.workspace Users can orient themselves in a workspace and administrators can configure its shared operating
      model.

        - @id:ar.workspace.applications A workspace is organized into applications, switchable from a switcher in the
          top bar next to the workspace switcher. "Home" is the always-available core register (overview, content,
          projects, entities, search, my work, and AI); Business Glossary, Strategy & Capability Modelling (@id:
          ar.strategy), Vendor Management (@id:ar.vendor-management), Risk & Compliance (@id:ar.risk-compliance), Data
          Stewardship (@id:ar.data-stewardship), and API & Integration Catalog (@id:ar.api-integration-catalog) are
          separate applications; selecting
          an application scopes the left icon rail to only that application's sections and re-skins the shell with
          its accent colour. An application may own several
          rail sections, each with its own icon, tooltip, route, and optionally its own primary sidebar. An
          application appears in the switcher only when enabled, which is governed by its backing workspace
          capability configuration (managed from the "Applications & Capabilities" workspace settings screen, which
          pairs each application's schema binding with its access policy in one tabbed view). Workspace administrators
          can separately control application access for ordinary members with an all-members or
          selected-people-and-teams policy;
          missing policies deny ordinary members by default while global administrators and workspace role managers
          retain access. Breadcrumbs are relative to the active application, which the switcher represents.

        - @id:ar.workspace.home Users can use the workspace home to navigate to entities, projects, content, search,
          diagrams, and other primary work areas. The home screen shows a composable dashboard of widgets (stat metrics,
          saved-view embeds, entity tables, entity cards, entity graphs, entity changelogs, document browsers, entity
          browsers, diagram previews, wiki-page embeds, lifecycle and activity-trend charts, stale-entity reports, an
          activity feed, and configurable Markdown content)
          laid out on a grid; a fresh workspace shows a sensible default layout. The entity table and entity browser
          widgets both show a list of entities but serve different needs: entity table offers quick, flat schema/owner/
          lifecycle/limit filtering with fixed columns, while entity browser exposes the full entity browser experience
          (arbitrary filter conditions, sort, and table/cards/tree/map views) for users who need finer-grained control.
          A workspace can have multiple
          named dashboards, listed in order in a "Dashboards" section of the home sidebar and switchable by selecting
          one; the first dashboard in that order is shown at the workspace home, and a workspace always retains at
          least one dashboard. Administrators can create a dashboard from the sidebar (added at the end of the order),
          and rename or delete a dashboard via its context menu. Administrators can also enter edit mode to add,
          remove, resize, and reposition widgets and save the layout; other users see the active dashboard read-only.
          Schema templates can seed a complete default dashboard layout when a workspace adopts the template. The
          optional Information Governance cross-cutting template contributes reusable built-in vocabularies for data
          flow direction, regulatory tags, processing purposes, and residency regions without adding a new semantic
          enum type. It
          also contributes a Retention Policy entity schema (duration and time unit) and a "Subject to Retention
          Policy" relation schema (an "activated from" date) bound together via the `retention` workspace
          capability, without adding a bespoke retention data model: any governed entity records its retention
          obligation as an ordinary typed-relation assignment to a policy entity, and the assignment's computed
          expiry status (active, approaching expiry, expired, or incomplete when the policy or activation date is
          missing) is available to `resolveEntityRetentionStatus` for later surfacing in queries, views, and
          exports.
          What this actually captures: `activated_from` is a single date on the assignment relation, and the
          governed entity it is usually attached to (a Data Entity) is a *category* of data (e.g. "Customer
          Credentials"), not an individual record — there is no per-record creation-date tracking anywhere in this
          model. So the computed expiry status answers "how long has this policy nominally applied to this
          category, relative to its stated duration", not "which individual records are due for disposal" — the
          records within a governed category don't all share one creation date, so a category showing "expired"
          does not mean every (or any particular) record in it is actually due. Consumers of
          `resolveEntityRetentionStatus` should treat it as a policy-governance/review signal (is this category's
          retention policy stale enough to warrant a compliance check) rather than a disposal action queue; see
          `ar.risk-compliance.retention` below, which was scoped down to a plain assignments register for exactly
          this reason.
          The same template also contributes a Data Entity schema and an "Information Asset Stewardship" shared
          field group carrying steward and custodian principal-reference fields, a review date, and multi-valued
          regulatory tags, processing purposes, and permitted residency regions, alongside the entity's existing
          owner (reused as the data-owner team) and classification field; the group also carries read-only
          derived Review Status (incomplete / overdue / approaching / current, recomputed daily against the
          current date) and Stewardship Status (complete / incomplete) fields, filterable like any field and
          surfaced through the seeded "Review Overdue", "Review Approaching", and "Missing Stewardship" admin
          views. A governed Data Entity can be linked to a
          retention policy through the same "Subject to Retention Policy" relation as any other entity. The bundled
          demo workspace composes this schema and field group from the same templates, with example Data Entities
          showing the full spread of stewardship completeness (fully staffed and partially staffed) and
          review-date states (approaching and overdue). When Information Governance is composed with any full
          architecture template, the
          templates also provide a "Data Flow" relation (a first-class relation between mapped system schemas recording
          direction, protocol, and the Data Entity/Entities it carries) extended with transfer-specific governance
          metadata under a
          "Data Flow Governance" field group: flow-level classification, multi-valued regulatory tags and processing
          purposes, and single-valued source and destination residency regions, all drawn from the same configurable
          vocabularies as the Data Entity stewardship fields. The Protocol vocabulary is owned by Information
          Governance and retains its built-in values. When the concern is added, administrators map its System
          dependency to one or more schemas in the selected workspace model; an unresolved mapping blocks the operation.
          Whether a flow crosses a residency boundary (source
          and destination regions differ) and whether its destination region is permitted by every carried Data
          Entity's permitted-residency-regions are exposed as ordinary read-only derived Data Flow relation fields
          (`cross_boundary`, `residency_invalid`), computed in the same field group as their source inputs so
          redaction stays consistent, and queryable/filterable through the standard query engine like any other
          field.
          The home sidebar's Data model section groups schema links by schema category.
          Every widget shows a title bar (an icon and a title, separated from the widget's content by a divider); the
          stat-metric widget's title is configurable (via its label setting), while other widget types show a fixed
          title naming the widget type. In edit mode, the per-widget edit and remove controls appear within the title
          bar rather than overlapping the content.

        - @id:ar.workspace.home.personal-dashboards Any workspace member can optionally create one or more personal
          dashboards for themselves, separate from the shared workspace dashboard (s). Personal dashboards are listed
          in a "My Dashboards" section of the home sidebar, shown only when the user has at least one, and are
          created via the "New personal dashboard" item in the sidebar's "+" menu. Owners can freely rename or
          delete their own personal dashboards, including deleting the last one, and no workspace capability beyond
          membership is required. A personal dashboard is always fully editable by its owner (add, remove, resize,
          and reposition widgets from the same widget catalog as the shared dashboard) — there is no read-only mode.

        - @id:ar.workspace.templates Administrators can create a workspace from no model, one full architecture
          template, or one full template combined with multiple cross-cutting concerns such as Business Glossary,
          Security / Threat Model, Risk & Compliance, and Strategy. Each selected template contributes its entity
          schemas,
          select-option enums, document types and associated templates, saved views scoped to the template's
          schemas, and any authored schema-scoped entity drawer profiles; conflicting later definition names are
          qualified, and concern dashboards are kept separate from
          the full template's Overview dashboard. Template objects include entity schemas, enums, typed relation
          schemas, shared field groups, and composition extensions for definitions that depend on more than one
          selected template. Cross-cutting dependencies are declared explicitly and resolved by an administrator
          during workspace creation; the same mapping flow is used when importing a concern into an existing workspace.

        - @id:ar.workspace.configuration Administrators can configure workspace lifecycle states, assessment types,
          teams, roles, members,
          supported currencies and the workspace's default currency, document types, templates, AI, analytics, audit,
          and other workspace settings.

            - @id:ar.workspace.configuration.conformance Administrators can manage centrally scheduled conformance
              checks in one workspace-level section, including reusable schema validation expressions, cross-cutting
              entity query policies, and optional AI yes/no conformance prompts when workspace AI is enabled. Each
              check can persist evaluation runs, current and historical violations, auditable time-bound exemptions
              that can also be revoked early, and optional governance acknowledgement or resolution cases; violations
              on checks without governance enabled can be acknowledged or resolved directly. Each violation's full
              observed/acknowledged/resolved/exempted/exemption-revoked transition history is viewable. Violation
              lists, evidence, and summary dashboard widgets respect the entity and field-group permissions of the
              viewing member — evidence naming a field the viewer cannot see is withheld entirely rather than only
              its value; schema validation remains available on entity save as a schema-local blocking or warning
              diagnostic.

            - @id:ar.workspace.configuration.query-console Workspace settings administrators can run ad-hoc entity
              query text DSL queries and inspect the returned records as raw JSON for debugging schemas, saved views,
              derived fields, and other query-driven behavior. Parsing, compilation, entity visibility, and field-group
              redaction use the same query and authorization pipeline as the entity browser.

            - @id:ar.workspace.configuration.entity-drawers Administrators can configure a schema-scoped,
              read-only entity drawer with ordered sections, fields, metadata, relations, direct containment-child
              lists, and registered semantic content slots. Without a stored profile, the drawer falls back to
              schema-ordered attributes,
              attribute groups, and metadata; seeded or templated authored profiles retain their richer content.
              Missing or unsupported references fall back safely to that generic drawer. Registered content slots
              may be capability-bound or generic; the Entity Change cases and Entity Assessments slots are
              associated with the current entity and can therefore be added to any schema's drawer, while remaining
              seeded by default only for Data Entity profiles.

            - @id:ar.workspace.configuration.schemas Administrators can define entity schemas, fields, select options,
              and reusable workspace enums. Enum options have stable values, editable labels and descriptions, an
              optional restricted/sensitive marker, ordering, and a retired state that preserves historical values while
              keeping them out of new record edits. Removing an unused option deletes it; an option still in use is
              automatically retained as retired. Enum names and field references provide context without a hard-coded
              enum category set.
              reusable shared fieldgroups, relationships, and schema-specific behavior, including currency fields and
              ordered multi-valued scalar fields (text, long text, boolean, date, number, currency, and select) with
              minimum/maximum cardinality,
              date fields that can generate schema-field-scoped approaching and overdue governance reminders,
              which can be routed to a user/team field on the record (e.g. its steward), a specific user or team,
              or the owning team, escalated when overdue, and configured to advance the date field by a fixed
              interval each time the reminder is acknowledged so the review recurs; the bundled Data Entity
              review date is enabled this way out of the box,
              the built-in Vendor/Contract model where Contract records contain exactly one Vendor,
              read-only derived fields calculated using a sandboxed expression over sibling fields and a bounded
              one-hop JSON context — on entity schemas the `entity` root (direct references, containment, and
              typed-relation targets); on relation schemas the `relation` root (the relation's own fields, its
              `_in`/`_out` endpoint entities, and `entityRelation` targets) — with a
              declared text, number, currency, select, boolean, or rating result type;
              derived expressions can read `<root>.now` (the current date) and use `daysBetween`, and a
              time-dependent derived field can declare an hourly or daily recalculation cadence so a recurring
              scan job keeps its value current as the calendar advances without any record edit,
              configure workspace-scoped integration capabilities from a dedicated integration catalog, with each
              capability
              binding semantic roles to entity schemas or typed relation schemas (document-type-targeted roles are
              reserved for future use) and declaring its available features and required fields; schema-level Bonsai
              validation rules with blocking errors or non-blocking warnings, field-specific messages,
              activation/deactivation, revision through schema versioning, and preview testing against existing
              entities;
              relation types use the same Bonsai rule model over a depth-1 relation context (`relation`, including its
              typed fields and `in`/`out` endpoint projections),
              and externally managed fields (by AI, an integration, or an internal automation) with a refresh mode of
              on-change or scheduled. Derived values are materialized and synchronously recalculated for affected
              entities and relations when inputs, relations, or definitions change (a relation's derived
              values also re-materialize when a connected or carried entity's fields change), and are excluded
              from required-field completeness. Fields can be organized into named, presentation-only groups (with an
              optional description) that render as labeled sections wherever fields appear as a form or list; this has
              no
              effect on validation, required-ness, or completeness. A group — a schema-local group, or a schema's
              inclusion of a reusable shared fieldgroup — can optionally be assigned one or more teams to scope its
              access: a team's reviewer role (or above) grants view, and editor role (or above) grants edit.
              A schema's "Layout" admin tab lets administrators optionally customize the tab/panel/block composition
              of the entity Details/Edit screen: fields, field groups, fixed metadata (name, slug, description, owner,
              lifecycle, target lifecycle, tags, public ID, namespace), the external links block, and individually
              placeable unbound typed-relation sections can each be arranged into named panels (optionally linked to a
              field group, inheriting its access control) across one or more tabs. A schema without a saved layout
              renders the previous default composition (ungrouped fields, then one section per field group, metadata,
              links, then unbound relations) unchanged; the same layout drives both the Details and Edit screens. Field
              or field-group renames/removals resolved via schema field migrations are applied to the saved layout
              automatically, dropping stale placements without prompting.
              Administrators can similarly define relation types (name, description, "in"/"out" endpoint constraints
              naming the allowed entity schemas at each end, fields, groups, and field-group access control) from a
              dedicated relation-types admin screen alongside entity types, enums, and shared fieldgroups; relation
              types support the same field-group access control, shared-fieldgroup inclusion, field migrations,
              version history, and externally managed fields (by AI, an integration, or an internal automation) with a
              refresh mode of on-change or scheduled, as entity schemas, plus text, long text, boolean, date,
              number, currency, select, entity-relation, and derived field types (no containment fields, and no
              templates or
              approval/deprecation policy).
              The model overview visualizes entity schemas and typed relation schemas as graph nodes, showing generic
              references, relation endpoints, and relation-owned entity links; relation nodes and typed edges link to
              their definitions. Categories are a managed, workspace-scoped list (not free text): administrators add a
              category from the schema settings sidebar's "+" menu, and rename or delete one via a context menu on its
              sidebar header — delete is only available once the category has no entity types, relation types, enums,
              or shared fieldgroups assigned to it. Each of those four kinds is assigned an optional category from a
              dropdown when edited. The schema settings sidebar groups every tab's list (entity types, relation types,
              enums, and shared fieldgroups) by category, with uncategorized items shown in a final Uncategorized group
              that is not itself an editable category.

            - @id:ar.workspace.configuration.document-types Administrators can define document types, templates, fields,
              versions, validation rules, and AI actions for structured content, including marking a field as externally
              managed (by AI, an integration, or an internal automation) with a refresh mode of on-change or scheduled.
              Administrators can edit actions, select their read-only architecture tools, and test an unsaved action
              against an existing document of the same type without persistence.

        - @id:ar.workspace.lifecycle Workspaces can define lifecycle states, designate one as the deprecated state, and
          use them as part of entity and project review workflows.

        - @id:ar.workspace.analytics Administrators can inspect workspace-wide analytics and completeness-oriented
          views.

    - @id:ar.strategy Workspaces can optionally enable Strategy & Capability Modelling (@id:ar.entities.strategy-model)
      as its own workspace application, with a dedicated left rail. The application
      is enabled only once the workspace's `strategy-model` capability configuration is
      valid (all five Business Capability, Objective, Outcome, Initiative, and Measure schema bindings resolved);
      until then, or while a section's own capability lookup is still loading, each section shows a
      capability-not-configured empty state instead of its content.

        - @id:ar.strategy.view-config Alongside the schema bindings, workspace administrators configure how the
          Business Capability attributes are presented across the application. In the "Applications & Capabilities"
          workspace settings screen — a secondary sidebar grouping the applications (Business Glossary, Strategy
          & Capability Modelling, Vendor Management, Risk & Compliance, Data Stewardship, API & Integration Catalog)
          and the remaining capability (Retention policy), each row
          showing a dot for whether that capability is enabled — the Strategy & Capability Modelling entry splits
          into Bindings / Fields / Dashboard / Access tabs. The Fields tab lists
          every capability field in one shared display order (no add or remove — the list follows the schema); each
          field independently opts into the
          Capabilities table (with an optional header override and a rendering — plain value, a red/amber/green bar,
          or a signed delta), the subtree roll-up (average or sum, plus a number format), the detail drawer, and a
          capability-map overlay (direction plus colour-band thresholds; a roll-up field colours by its subtree
          aggregate, otherwise by the capability's own value). The Capabilities table's Name, Level, Owner, and
          Applications columns are fixed and always lead. The Dashboard tab configures the landing-screen tiles,
          the Bindings tab maps the capability roles to schemas as before, and the Access tab carries the
          application's access policy (@id:ar.authorization.application-access). Retiring a field in the schema editor
          drops it from every view (with an advisory diagnostic); the
          configuration round-trips through workspace export/import, and a workspace with no stored configuration
          falls back to a built-in default that mirrors the seed schema fields.

        - @id:ar.strategy.overview The Overview section is the application's landing screen — where the app switcher
          opens. It shows read-only summary tiles chosen by the workspace's view configuration (@id:
          ar.strategy.view-config), derived from the same entity and relation data as the other sections:
          capability count by level, objective count by a select field, application coverage (share of capabilities
          with at least one supporting application), an orphan-capability count (capabilities no objective supports),
          and top-N lists of the largest values of a capability field or roll-up. Each tile links into the section
          behind it (Capabilities filtered by level, Strategy, Capability map, or Traceability's "No strategy link"
          tab).

        - @id:ar.strategy.capability-map The Capability map section renders the Business Capability model as a
          nested L1 → L2 → L3 grid over containment. A toolbar overlay selector colours the leaf tiles by one of the
          workspace's configured overlays (@id:ar.strategy.view-config) — each a capability field or subtree roll-up
          banded into heat colours — with a legend; a search box dims tiles whose capability name does not match
          without removing them, and the
          sidebar's owner facet dims tiles the same way. Clicking a domain header (or a node in the sidebar's
          capability tree) focuses the grid on that subtree, with an "All domains" control to clear it (`focus`
          and `owner` are carried in the URL). Clicking a tile opens the capability's drawer via the workspace-wide
          `drawer` search param.

        - @id:ar.strategy.capabilities The Capabilities section lists every Business Capability with columns chosen
          by the workspace's view configuration (@id:ar.strategy.view-config) — capability fields, subtree roll-up
          metrics, and structural columns such as level, owner, and supported-application count — plus level and
          owner filters, and sortable columns. Rows open the
          capability's drawer via the workspace-wide `drawer` search param (see below) and carry a separate "Open
          in Entities" action to the Home entity browser. The section's own primary sidebar swaps the app's usual
          section nav list for a capability hierarchy tree (clicking a node filters the table to that subtree) plus
          an owner facet with counts.

          The configurable entity drawer shows subtree roll-up stats and a leaf count via the generic drawer
          `rollup`/leaf-count item kinds (seeded from @id:ar.strategy.view-config's roll-up fields by default, but
          configurable per drawer profile like any other item — the same reusable mechanism any schema with a
          containment hierarchy can use), plus capability badges, configured fields, the built-in containment-child
          list, registered Strategy content slots for linked objectives and initiatives, and a "Realized by" item
          using the generic drawer `query` item kind — a path expression in the text query DSL (see
          `specs/QUERY_LANGUAGE.md`) evaluated against the current entity, letting any drawer profile declare
          recursive-containment or typed-relation traversals without app-specific code. Child selections open a
          nested drawer on top of the current one (the shared workspace drawer stack), and the footer action opens
          the underlying record in Entities. "Realized by" unions applications the capability supports directly with
          ones supported anywhere in its recursive containment subtree, so non-leaf capabilities also surface
          coverage carried by their descendants, shown as a flat list (no per-entity provenance of which descendant
          contributed the link).

        - @id:ar.strategy.heatmaps The Heatmaps section is deprioritized and not currently surfaced in the app rail
          or section nav; its route and placeholder screen are retained. The capability-map overlay control already
          provides configurable heat colouring over any capability field or roll-up (@id:ar.strategy.view-config).

        - @id:ar.strategy.strategy The Strategy section is scoped to one objective at a time — chosen from the
          primary sidebar's objective list and shown in a header with its status, target date, owner, capability
          count, and description. Below it are the
          objective's Outcomes, Initiatives, and Measures panels plus a "Capabilities this objective depends on"
          table with maturity, gap, investment, and application roll-ups over each capability's containment subtree.
          Measures render a baseline → current → target progress bar from the Measure schema's measurement fields. A
          "New objective" action opens the entity-create dialog pre-set to the Objective schema. Selecting a
          capability opens the shared capability drawer via the workspace-wide `drawer` search param.

        - @id:ar.strategy.traceability The Traceability section has two tabs. **Trace chain** is a three-column
          hop walker — Objective → Capability → Application — walked one hop at a time over the Objective Supports
          Business Capability and Business Capability Supports Entity typed relations, with a path summary of the
          current selection and an initiatives sub-list for the selected objective. **No strategy link** lists the
          capabilities that no objective supports. Selecting a capability opens the shared capability drawer;
          selecting an application opens its record in Entities.

    - @id:ar.vendor-management Workspaces can optionally enable Vendor Management as its own workspace application,
      with a dedicated left rail scoped to five sections (Overview, Vendors, Contracts, Spend, Risk). The application
      is enabled only once the workspace's `vendor-management` capability configuration is valid (the required Vendor
      entity schema binding resolved; the Contract and Technology Release entity schema bindings are optional —
      Technology Release only gates the Risk section's technology EOL exposure table); until then, or while a
      section's own capability lookup is still loading, each section shows a capability-not-configured empty state
      instead of its content.

        - @id:ar.vendor-management.overview The Overview section is the application's landing screen — where the app
          switcher opens — and summarizes the other four sections rather than adding new data. Four header stats
          (contracted spend, renewals due in 90 days with the $ at stake, vendors above risk tolerance, auto-renewing
          contract count) sit above a 12-month renewal strip — one bar per month, height by that month's contracted
          $ value, colored red when the month holds a contract due within 30 days or overdue, folding an
          already-overdue contract into the current month the same way the Contracts section's own calendar does.
          Below that, a "Next renewals" list (contract, vendor, auto-renew flag, $ value, and a colored day
          countdown) opens the configurable contract drawer on the Contracts section; a "Spend by vendor" list (top 8, magnitude bar + $ value)
          opens the vendor drawer on the Spend section. A "Vendors above tolerance" table (Tier, Criticality, the
          composite risk chip, and applications-supplied count) and a "Technology end-of-life exposure" list (top 5
          by soonest EOL, hidden — not shown empty — when the optional Technology Release binding is unset or
          unusable) both open the vendor drawer on the Risk section. A "Renewal calendar" button jumps to the
          Contracts section's calendar view, and a footnote links back to Entities.

        - @id:ar.vendor-management.vendors The Vendors section is a register of Vendor entities: free-text search by
          name, sort by name / spend / risk / next renewal, and a sidebar of Tier, Category, and Relationship Owner
          facets (each showing a count, driven off the Vendor schema's own field options and the fetched vendors'
          values). Next renewal is the earliest upcoming `Contract.contract_end` across a vendor's own Contracts.
          Selecting a vendor opens the configurable shared vendor drawer, deep-linkable via the workspace-wide
          `drawer` search param: its schema profile preserves a composite risk score
          (`vmRisk`/`vmRiskBand`, weighted across the vendor's security, concentration, financial, and compliance
          risk fields and lifted by criticality), attributes, spend (`vmSpend`, summed across the vendor's own
          Contracts), the vendor's Contracts, the Systems its contracts serve ("Applications supplied"), and a
          best-effort technology lifecycle view derived from those Systems' own lifecycle state. These sections
          can be reordered, relabeled, or have their section and provider titles hidden through the workspace
          entity-drawer configuration; the composite risk summary remains a compact mini-panel. Capabilities funded
          is not yet available — no Contract-to-capability link exists yet.

        - @id:ar.vendor-management.contracts The Contracts section offers a list view and a 12-month renewal
          calendar (its timeline view is still pending). The list is a register of Contract entities: free-text
          search by contract or vendor name, sort by name / vendor / annual cost / renewal date, and a sidebar of
          Renewal window, Type, and Vendor facets (each showing a count). Renewal window is a computed bucket over
          `Contract.contract_end` (overdue, next 30/90/365 days, beyond 12 months, or no end date), not a schema
          field. The calendar shows the current month plus the next 11, one cell per month, with each contract's
          renewal placed by the calendar month of its `contract_end`; an overdue contract is folded into the
          current month's cell instead of dropping off the grid, and a contract renewing beyond 12 months out, or
          with no end date, is excluded from the grid and counted in a caption below it (both remain visible in the
          list). Selecting a contract, in either view, opens the configurable contract entity drawer (contract and
          renewal badges, configured terms and cost fields, a link back to the contract's vendor drawer, and the
          `contract.systems-used` content slot). The Vendor link opens a nested Vendor drawer while preserving the
          Contract drawer; Back, Escape, or close returns to the parent, and a direct `drawer=<id>` link opens the
          linked entity as the stack root. The drawer is deep-linkable through the workspace-wide `drawer` search
          param, mirroring the Vendors section's shared drawer.

        - @id:ar.vendor-management.spend The Spend section is a portfolio-wide spend roll-up: four header stats (total
          annualised spend, fixed-term commitment not auto-renewing, the Strategic tier's share of spend,
          and the number of cost centres charged), a toolbar toggle grouping the roll-up by vendor, by the Vendor
          schema's Cost Centre field, or by capability, a portfolio-wide share-of-spend strip, and a roll-up table
          (share bar, spend, % of total, contract count, largest contract) sorted by spend descending. A sidebar
          of Cost Centre (each row showing that centre's own spend) and Owner facets narrows the roll-up rows (the
          header stats stay portfolio-wide). Selecting a vendor row or share-strip segment (not available
          when grouped by cost centre) opens the shared vendor drawer in place via the workspace-wide `drawer`
          search param. Grouping by capability shows an explanatory empty state instead of
          data — no Contract-to-capability link exists yet.

        - @id:ar.vendor-management.risk The Risk section has four header stats (High risk vendor count, vendors with
          Concentration Risk ≥ 4, technologies nearing end-of-life, and Systems exposed to one), a two-column
          criticality × risk-band matrix and risk register, and a technology end-of-life exposure table — layout and
          composite scoring mirror the Claude Design reference (`vendor-data.jsx`/`vendor-views.jsx`) exactly. `vmRisk`
          is a weighted average of a vendor's security/concentration/financial/compliance risk fields (weights 0.34 /
          0.28 / 0.22 / 0.16) on their native 1-5 scale, linearly lifted by criticality (±6% per point off a
          criticality of 3), clamped to [1, 5], and banded Low (< 2.0) / Moderate (< 2.7) / Elevated (< 3.4) / High.
          The matrix (criticality 5 down to 2 × the four bands) lists each cell's vendors as clickable name tags (not a
          count) that open the shared vendor drawer directly — it isn't itself a filter control. The risk
          register (Vendor, Sec, Conc, Fin, Comp, Score) is sorted by score descending and filterable only by the
          sidebar's Band facet. A technology end-of-life exposure table cross-references the Systems a vendor's
          Contracts serve against those Systems' linked Technology Release records (Technology, Radar ring, Vendor,
          Support ends, Runway in months, Systems affected), one row per vendor-and-technology pair; it depends on
          the `vendor-management` capability's optional Technology Release entity schema binding (configured in
          Applications & Capabilities, and auto-bound for a workspace using the default catalog) and on an entity
          schema — typically Component or Resource — that links a System to that Technology Release schema; the
          panel is hidden entirely, not shown with an explanatory empty state, when either is missing. The sidebar's
          "Technology EOL" facet always shows its own group label (with its own empty-state message when there's no
          exposure data) and lists the same exposed technologies, each opening its vendor.

    - @id:ar.risk-compliance Workspaces can optionally enable Risk & Compliance as its own workspace application,
      with a dedicated left rail scoped to five sections (Overview, Risks, Controls, Retention, Assessments). The
      default seeded workspace has this capability preconfigured, and the application is enabled once the workspace's
      `risk-compliance` capability configuration is valid (the required
      Risk entity schema binding resolved; the Control, Framework, and Compliance Requirement entity schema bindings
      are optional). The Retention section gates separately, on the existing, workspace-wide `retention` capability
      (policy entity schema and assignment relation schema bindings), rather than on `risk-compliance` — a workspace
      can have Retention configured without the rest of Risk & Compliance being enabled, or vice versa.

        - @id:ar.risk-compliance.overview The Overview section (the app switcher's landing section) is a read-only
          dashboard summarizing the other four sections, each panel linking into the section that owns the full
          view — mirroring Vendor Management's own Overview (`ar.vendor-management`). A four-tile stat strip (risks
          outside appetite, control coverage %, retention completeness, and open risk/control assessments due within
          30 days), a two-column row of the same 5×5 risk matrix the Risks section uses (with its own
          inherent/residual toggle) plus the highest-residual live risks, a second two-column row of coverage grouped
          by `control_type` (standing in for "family", same substitution the Controls section makes) plus a table of
          live risks with weak or missing control coverage, and a third row pairing an "upcoming reviews" panel (the
          union of open risk and control assessments, reusing the Assessments section's `AssessmentDuePanel`) with a
          list of retention assignments missing a required field. The design reference's "records past disposal" /
          retention-expiry-summary panel has no analog here: `retention-assignment` links a policy to a Data Entity
          category, not an individual record, so no per-record disposal date exists to summarize (the same
          constraint that shaped `ar.risk-compliance.retention` below) — retention *completeness* (assignments
          missing a field) is reported instead, as the closest thing the data can actually support. Selecting a risk
          from either risk panel opens the shared Risk drawer in place, without navigating away from Overview.

        - @id:ar.risk-compliance.risks The Risks section has a sortable register (search; sidebar facets for
          Category, Status, Owner, and an "outside appetite" toggle for residual scores banding high/critical) and a
          5×5 likelihood × impact matrix, toggled by an inherent/residual axis switch — mutually exclusive views, not
          shown side by side. Selecting a risk opens the shared Risk drawer via the workspace-wide `drawer` search
          parameter; legacy `risk-compliance/risks/$riskId` links redirect there. The drawer shows likelihood/impact,
          the existing `inherent_risk_score` and
          `residual_risk_score` derived fields (the latter banded Low/Medium/High/Critical via the standard 5×5
          heat-map thresholds), attributes, the list of mitigating Controls with each relation's `coverage` % and
          `effectiveness`, and the entities the risk affects (via `risk-affects`). The configurable Risk drawer
          preserves the template-authored default profile for these metrics, attributes, category/status badges,
          and the residual-risk band; workspace administrators can configure supported fields, sections, order,
          labels, and item placement.

        - @id:ar.risk-compliance.controls The Controls section has a sortable library table (search; sort by name,
          risks mitigated, or last verified; columns for Name, Type, Effectiveness — a colour-outlined pill — Risks
          mitigated, Assets protected, and Last verified) and a Coverage roll-up view. The sidebar's facets (Type,
          Effectiveness, Framework — the last derived by joining each Control's satisfied Compliance Requirements to
          their parent Framework, not a schema field) are counts only; it doesn't also list every Control
          individually, unlike the Risks section's sidebar. The library table has no per-Control coverage
          percentage — that would require combining one Control's coverage/effectiveness values across its
          different Risks, which isn't a meaningful number (unlike combining multiple Controls over one Risk, which
          the Risks section's own Coverage column does); `operating_effectiveness` is the field that actually
          measures a Control's effectiveness. The Coverage view has three stat tiles scoped to the library's
          current filters (Effective, Never tested, Uncontrolled risks), a "coverage by risk" bar-list of every live
          (non-closed) Risk sorted weakest-`rcCoverage`-first (each row: residual score, the names of its mitigating
          Controls or "no control", and a coverage bar/percentage), and a "coverage by information asset" table,
          scoped to Data Entities only — asset name, the count of distinct Risks affecting it (`risk-affects`), and
          the count of distinct Controls directly protecting it (`control-affects`, styled as "none" when zero),
          sorted fewest-controls-first. `control-affects` ("Control Protection") is schema-constrained to the
          `information-governance` template's Data Entity schema (a `control-protection` composition extension on
          the `risk-compliance` template, materializing only when `information-governance` is also selected in the
          workspace) — unlike `risk-affects` ("Risk Affects"), which stays unrestricted, since a Risk legitimately
          affects Systems, Vendors, and Technology resources directly, not only information assets. Because
          `risk-affects` can still surface non-Data-Entity assets, the coverage-by-asset table additionally filters
          to the resolved Data Entity schema id (the capability's optional `dataEntity` binding role) rather than
          relying on the relation constraint alone. A third, Traceability view is a dense table: the library's
          currently filtered Controls as (sticky) rows, and — toggled by a "Controls × risks"/"Controls × assets"
          switch in the toolbar — either every live Risk or the same Data-Entity-scoped assets as the Coverage
          view's asset table as (sticky, vertically labelled) columns. A cell is a solid mark for a linked pair
          whose Control is effective, an outlined mark for a link whose Control isn't, or empty for no link (a
          legend in the panel header explains all three). Each row ends with its own total; a closing summary row
          gives each column's total, with a red mark standing in for zero — an uncontrolled Risk or asset — instead
          of the digit. Control row headers are clickable, opening the shared Control drawer; asset-dimension column
          headers open the schema-configured generic entity drawer in place, while Risk-dimension column headers are
          read-only. Selecting a control, a Coverage-view risk row, or a Coverage/Traceability-view asset row all open
          through the same workspace-wide `drawer` search param, stacking rather than competing: the template-authored
          default drawer profile preserves the current attributes and `control_type` badge, while registered Risk &
          Compliance content slots show the Risks it mitigates (with the `coverage`/`effectiveness` it provides each one) and the Data Entities
          it protects (via `control-affects`).

        - @id:ar.risk-compliance.retention The Retention section — the first web UI consumer of the workspace-wide
          `retention` capability — is a single register of Assignments ("Subject to Retention Policy" relations),
          with no view toggle. It originally followed the Claude Design reference's `RCRetention` more closely (an
          expiry dashboard with Overdue/Next-30/31-60/61-90/Beyond-90 buckets, a separate Policies list, and a
          Holds/exceptions view), but the expiry framing was deliberately removed: a "Subject to Retention Policy"
          assignment links a policy to a Data Entity *category*, not to an individual record (see
          `ar.workspace.home`'s note on what the `retention` capability actually captures), so a computed "expiry
          date" per assignment could only ever say "how long this policy has nominally applied to this category" —
          labelling a category "Overdue" implied per-record actionability the data can't support. What remains
          reports what the data actually says as plain, uncoloured facts: each row is a governed entity, its
          policy, the policy's Period (duration + time unit, read via the capability's `policy`/`assignment` semantic
          field-role mappings — a
          workspace may map "duration" to any `number` field on its Policy schema, not only one literally named
          `duration`), and the assignment's Activated-from date. A "Complete" column (and matching sidebar
          "Incomplete" facet) flags assignments missing a policy, duration, time unit, or activation date — a
          data-completeness signal, not a disposal-urgency one, so it was kept even though the expiry bucketing was
          not. The sidebar is the only way to filter: "All" (count of every assignment), "Incomplete", and one row
          per Retention Policy with its assignment count — selecting a policy narrows the register to its
          assignments, shown as a dismissible chip in the toolbar.

        - @id:ar.risk-compliance.assessments The Assessments section is a read view over the existing, generic
          assessment machinery (the same `Assessment` model used by Projects, and by Strategy/Vendor Management's
          own periodic reviews) — no new case kind — scoped down to whichever workspace assessments target the
          Risk and/or Control entity schema (`assessment.scope`). Two "due soon" panels ("Risk reviews due",
          "Control tests due" — the latter only when a Control schema is bound) list open, due-dated assessments in
          each scope, soonest first, each row's due date shown as a coloured day-count ("18d" / "6d late") rather
          than a plain date. Below them, a dense register table (a Risk/Control/All toggle, name search, and the
          same Open-or-Closed/Draft/Archived/All status filter as a project's own Assessments tab) lists matching
          assessments by Name, Scope (the schema names it targets), Progress (a bar plus completed/in-scope count),
          Due (the same day-count styling), and a coloured Status pill. Assessments aren't owned by this app — each
          belongs to a Project — so this section has no create/edit affordance; opening a register row or a
          due-panel row navigates to the assessment's home project, deep-linked to its Assessments tab.

    - @id:ar.data-stewardship Workspaces can optionally enable Data Stewardship as its own workspace application,
      with a dedicated left rail scoped to five sections (My work, Stewardship, Classification, Change cases &
      exceptions, Assessments) — unlike Strategy & Capability Modelling / Vendor Management / Risk & Compliance,
      there is no separate Overview section; My work is both the first rail section and the application's landing
      screen. The application is enabled once the workspace's `data-stewardship` capability configuration is valid (the
      required Data Entity schema binding resolved — the same information-asset entities Risk & Compliance's
      own optional `dataEntity` binding references). The Change cases & exceptions section reuses the existing
      `entity.change-case` governance-case kind directly rather than a bound schema — Change Case is a built-in
      governance-case type, not a workspace-defined entity schema, so the capability has only the one binding role.
      A time-bound exception/waiver register was considered for this section (#3301) but removed after review —
      there is no exception/waiver concept anywhere in this application. All five sections have shipped their real
      content.

        - @id:ar.data-stewardship.my-work The My work section (the app switcher's landing section) is the review
          queue over the workspace's existing governance-case/reminder machinery — not a new queue model — scoped
          down to cases against Data Entities. A four-tile stat strip (Assigned to me, Past due, Cases awaiting a
          decision, Reviews overdue — substituting the design reference's "Exceptions lapsed or expiring" stat,
          since there is no exception/waiver register in this application) sits above a six-week due-date calendar
          (weekly buckets, an already-overdue item folded into the current week rather than dropped off the front,
          mirroring `ar.vendor-management`'s own monthly renewal calendar's overdue handling) and the queue list
          itself (kind, a derived priority pill, the dataset, and a due-date badge). Unlike every other section's
          in-screen toggle, the scope tabs (Assigned to me / All open items / Past due) live in this section's own
          primary sidebar as a facet, alongside a Kind facet and a derived Priority facet (High/Medium/Low, computed
          from a case's due date and escalation state — governance cases carry no priority field of their own).
          There is deliberately no Assignee facet or column: the workspace's "list my own assignments" endpoint only
          resolves an assignment target for the current user's own tasks, so it can't be populated for the "All open
          items"/"Past due" scopes; the "Assigned to me" scope already conveys assignment implicitly. The queue only
          ever surfaces case kinds that actually exist in this codebase (dataset review-date reminders, entity
          change-case approvals, entity deprecation approvals) — the Claude Design reference's mocked "Access
          request" and "Data-subject request" queue kinds have no backing case-kind model anywhere in the workspace
          and are dropped rather than fabricated; bulk entity-change proposals are dropped too (out of scope for a
          first cut, since joining them to a dataset needs an extra bulk-proposal lookup). Every queue row — review
          reminders included — opens a new governance case drawer, not the shared dataset drawer, since the point of
          a queue row is the case that needs acting on: it shows case identity/dates, the linked dataset (with a
          button through to the shared dataset drawer), and, when the current user holds the open, actionable
          assignment on that case, the same Approve/Acknowledge (and, on entity-change-case/document-status kinds,
          Request changes with a reason) decision actions the workspace-wide governance inbox screen offers, reusing
          that screen's own decide mutation so a decision made here is identical in effect. Whether those actions
          show depends on the same "list my own assignments" endpoint the Assignee-facet gap above already
          documents: opened from "Assigned to me" they're reliably present, but opened from "All open items"/"Past
          due" they only appear if the viewer also happens to hold that case's open assignment; otherwise the drawer
          is a read-only view of the case. Withdraw/Send-reminder aren't offered here (both are initiator-only and
          stay on the workspace-wide governance inbox screen, to avoid showing a button that would fail server-side
          for most viewers of this queue). The shared dataset drawer's own "Queue items" section shows this same
          per-dataset queue (opening the same case drawer, not a placeholder).

        - @id:ar.data-stewardship.stewardship The Stewardship section has a four-tile stat strip (fully covered %,
          missing an owner, reviews overdue, missing a steward), a "Gaps to close" panel (every dataset with a
          coverage gap, each gap shown as a chip, opening the shared dataset drawer), and the full dataset table (search
          across name/owner/steward; sort by gap count, next review date, or name; columns for Dataset,
          Business owner, Steward, Classification, Next review, and Gaps). The sidebar swaps its plain section nav
          for this section's own facets: an all-datasets/with-a-gap toggle and a Classification facet (counts only —
          unlike `ar.risk-compliance.risks`'s sidebar, it doesn't also list every dataset individually; the dataset
          table is where datasets are browsed one by one). Coverage reuses `ar.data-stewardship`'s dataset-coverage
          roll-up (named owner, named steward, confirmed classification, current review) directly. The Claude
          Design reference's `DSStewardship` also groups coverage by domain and sorts/reports a "quality" score and
          a "certified" stat tile; none of the three exist as fields on Data Entity (no per-instance domain/category
          field, no quality field, no certified flag), so the coverage-by-domain panel is dropped rather than
          faked, quality/domain aren't offered as sort options, and the stat strip substitutes "Missing a steward"
          for "Certified" — mirroring how `ar.risk-compliance.overview`/`ar.risk-compliance.controls` adapted their
          own design references to the fields the shipped schema actually has. Opening a dataset (from the gaps
          panel or the table) opens the configurable Data Entity drawer via the workspace-wide `drawer` search
          param. Its default profile preserves the
          dataset's attributes and stewardship fields and exposes Queue items, Cases, and the generic Assessments
          slot; unsupported placeholder-only Exceptions, Flows, and Systems sections are omitted.

        - @id:ar.data-stewardship.classification The Classification section has three views, switched via an
          in-screen toggle group in the screen's own header (mirroring the Claude Design reference's `DSClassification`
          segmented control, and this codebase's own Controls-screen view toggle) — the sidebar carries dataset facets
          only, shared with the Stewardship section's own shape (an all-datasets/with-a-gap toggle, a "Holds personal
          data" toggle, and a Classification facet; no per-instance Domain field exists to facet by, same documented
          gap as Stewardship's own dropped domain grouping). Classified data (every dataset, sorted
          classification-first, with a "Datasets by classification" breakdown panel above the table, a derived
          Personal data column, and a Lawful basis proxy column — Data Entity has no dedicated `personal_data` or
          `lawful_basis` field, so Personal data is derived from Classification being sensitive/highly-sensitive, and
          the proxy column shows Regulatory tags + Processing purposes instead) also supports the sidebar's
          coverage-gap and personal-data toggles narrowing its table, same as Stewardship's own table. Each view's own
          stat-tile row (three tiles, full width) sits between the view switcher and the view's own panel/table.
          Restricted flows mirrors the design reference's own panel shape: a single titled table ("Flows carrying
          restricted or confidential data" + a count) with one combined Flow (source → destination) column rather
          than two, Dataset carried (clickable chips opening the shared dataset drawer), Classification, Protocol, and
          Boundary (crosses/internal, off the real `cross_boundary` derived field) — the design reference's
          Style/Adapter/Volume/Health columns come from the Integration Catalog app (#3150, not present in this repo)
          and have no equivalent on the Data Flow relation schema, so they're dropped rather than faked. Cross-boundary
          transfers renders as a card list, not a table, again mirroring the design reference: each card shows the
          flow's route, a classification chip, a "personal data" chip when applicable, and a "no transfer safeguard
          recorded" tag for every personal-data-carrying transfer — there is no exception/waiver register in this
          application (considered for #3301, removed after review) to authorize a transfer against instead; a note
          line (source/destination region and protocol) and a meta row of carried-dataset links plus the flow's
          owner follow. Restricted flows and
          Cross-boundary transfers both depend on a Data Flow relation schema existing in the workspace (resolved by
          name, since relation schemas carry no stable symbolic id at runtime, and there is no dedicated capability
          binding for this — unlike the app's own `dataEntity` binding); when absent, both views show a plain notice
          instead of an empty table/list. No flow-detail drawer exists — each flow's row/card already carries every
          field the Data Flow schema has.

        - @id:ar.data-stewardship.change-cases The Change cases & exceptions section (despite the name — the
          exceptions/waiver register #3301 considered was removed after review, so this is just "Change cases") is a
          read list over the existing `entity.change-case` governance-case machinery — no new case kind, no new
          workflow — scoped to cases whose subject is a Data Entity: columns for Kind, Dataset, Requester (the
          case's initiating user, resolved against the workspace's member list), Steward (the linked dataset's own
          steward field), Risk (the same derived priority bucket `ar.data-stewardship.my-work`'s queue computes —
          governance cases carry no real risk/severity field), Raised, Due, and Status; a Status facet lives in the
          section's own primary sidebar. Every status is shown here (unlike My work's queue, which only surfaces
          open cases), since this is a register, not a personal work queue. Bulk entity-change proposals are out of
          scope for this first cut, same call `ar.data-stewardship.my-work` already made. A row opens the same
          shared, already-shipped case drawer `ar.data-stewardship.my-work`'s queue uses — a viewer who happens to
          hold an open assignment on that case sees the same Approve/Acknowledge/Request-changes actions there as
          from the workspace-wide governance inbox; this section doesn't add a second action surface. The section is
          section's own rail icon is hidden entirely (rather than shown with an in-screen notice) unless the
          configured Data Entity schema actually has its `entity.change-case` approval workflow enabled
          (`schema.entity_approval_policy === 'required'`, the same field the Entities app checks before offering
          "Propose a change") — without that, no `entity.change-case` governance cases are ever created for the
          schema, so the register would always be empty. This gate is evaluated once, centrally, in
          `WorkspaceLayout.tsx`'s rail-item visibility list (alongside the existing AI-feature gate on the
          assistant/extract icons), not per-screen.

        - @id:ar.data-stewardship.assessments The Assessments section is a read view over the existing, generic
          assessment machinery (the same `Assessment`/`AssessmentResponse` model Projects and `ar.risk-compliance`'s
          own Assessments screen already use — no new questionnaire engine), scoped to whichever assessments target
          the workspace's Data Entity schema. One row per assessment — not per dataset, even though a real
          `Assessment` can scope many dataset entities: an earlier version joined every in-scope assessment against
          every dataset entity it targets (matching the Claude Design reference's `DSAssessments` mock, where each
          mock assessment record is already bound to exactly one dataset), but that repeated a "progress" bar per row
          for what is really one assessment-level number once an assessment spans several datasets, so it was
          replaced with one row per assessment and an aggregate progress bar (in-scope datasets with a complete
          response, over the total in scope, off `Assessment.completed_entity_count`) — mirroring
          `ar.risk-compliance.assessments`'s own one-row-per-assessment register. A four-tile stat strip (Overdue, In
          progress, Not started, Complete) sits above a searchable table (Assessment — name plus its `description` as
          a subtitle, Kind, Project, a progress bar, Questions, Due, Status); the design reference's "Dataset",
          "Owner", and "Findings" columns have no analog once a row is a whole assessment rather than one dataset (the
          same "Kind/Owner/Findings/Opened" gap `ar.risk-compliance`'s own Assessments screen already
          documents), so they're dropped — replaced with a Project column resolving `assessment.project_id` — rather
          than invented, with "Not started" promoted to its own stat-strip tile in "Findings"'s place so the strip
          stays a genuine 4-way partition. Kind is the assessment's workspace-managed assessment-type name (falling
          back to "Uncategorized"); Questions is the assessment's field count. Status is Overdue once the assessment
          is open and past its due date with an incomplete rollup, otherwise Complete/In progress/Not started off the
          same rollup. Like `ar.risk-compliance.assessments`, a row click navigates to the assessment's owning
          Project, deep-linked to its Assessments tab (assessments are authored/filled there, not in this app). The
          status facet lives in this section's own primary sidebar (all/Overdue/In progress/Not started/Complete,
          mirroring the stat strip's own buckets) rather than an in-page toggle, the same facet-sidebar shape
          `ar.data-stewardship.stewardship`/`ar.data-stewardship.classification` use; only free-text search (name,
          kind, project) stays in the screen's own toolbar. The per- (assessment, entity) join from the earlier
          version still exists internally and backs the shared entity drawer's own Assessments section (that
          entity's status on that assessment, listed alongside its attributes/stewardship/coverage/cases). A header
          action links out to the My work section for sign-offs due, mirroring the design
          reference.

    - @id:ar.api-integration-catalog Workspaces can optionally enable API & Integration Catalog as its own workspace
      application, with a dedicated left rail scoped to four sections (Overview, APIs, Integrations, Impact).
      Unlike Data Stewardship, Overview is a separate landing section rather than doubling with the first facet
      section. The application is enabled once the workspace's existing `api-specification` capability configuration
      (@id:ar.integrations.api-specification-sync) is valid (the required API entity schema binding resolved) — this
      promotes `api-specification` from a capability-only binding (configurable in workspace settings but with no
      rail of its own) to a full application; it remains the same capability the Entities app's API artifact detail
      views already read. Overview, Sync, and Impact remain scaffolded placeholders pending their own sub-issues of
      the API & Integration Catalog epic; APIs and Integrations have their real content (below). Integration sync
      operations are available under Workspace Settings rather than in this catalog browsing application.

        - @id:ar.api-integration-catalog.overview The Overview section (the app switcher's landing section) is
          scaffolded as a placeholder pending its own APIs/integrations/health catalog-landing content.

        - @id:ar.api-integration-catalog.apis The APIs section lists every entity of the workspace's `api` schema (@id:
          ar.integrations.api-specification-sync) — name, protocol (s), declared API version, lifecycle, owner, and
          the entities that provide and consume it (via the `Provides API`/`Consumes API` typed relations) —
          searchable by name and sortable by name, provider count, consumer count, or normalized operations/messages
          count (read from the entity's primary `api-specification` artifact's current revision, the same
          normalized-catalog projection the Entities app's API artifact detail view reads; there is no telemetry
          column, matching the epic's explicit non-goal of not being an API gateway or runtime observability tool).
          The section's own primary sidebar replaces the app's plain section nav with Protocol, Lifecycle, and
          Owning team facets over these entities (each option showing its count, state kept in the URL); the facets
          narrow which APIs are in scope across both of the section's views below, not just the catalog table.
          A toolbar toggle ("Catalog" / "Operations" / "Deprecated operations") additionally switches the table
          between the catalog above and two flat, sortable cross-API tables built from the same feed: every
          operation/message across the APIs in scope, or just the ones flagged deprecated (method, path, API,
          deprecated flag) — there is no sunset-date countdown, since no such field exists on the normalized
          operation model. A row click (in any view) opens a deep-linkable spec drawer (via the workspace-wide
          `drawer` search param) shared with any other section that links into a spec: attributes, providers/consumers, and the full specification
          viewer — source/version picker, revision status notices, normalized operations/messages list,
          and a raw-source preview dialog — rendered through the configurable entity drawer with the specification
          viewer supplied by a registered API provider slot, reusing the same viewer as the Entities app's API
          artifact detail tab rather than a separate implementation. Clicking a row in either operations view opens that operation's
          parent API at the same drawer, not a per-operation deep link — the drawer has no per-operation addressing
          to link into. The Deprecated operations view (#3347) was briefly deferred from #3345 after a fan-out
          across every API's revisions surfaced a pre-existing server defect: `listApiSpecificationRevisions`
          used to 409 its entire response whenever any revision of an artifact lacked a normalized projection row —
          now fixed to omit that revision instead, rather than failing the whole list.

        - @id:ar.api-integration-catalog.integrations The Integrations section lists every `Data Flow` typed relation
          in the workspace (the same relation modeled for Data Stewardship's classification views) — source and
          destination system, protocol, data classification, count of carried Data Entities, whether the flow
          crosses a residency boundary, owner, and (when resolvable) the registered API either endpoint provides or
          consumes — rather than a separate integration-relation model. Above the table, four stat tiles summarize
          relation count and protocols in use, boundary-crossing count, restricted/highly-sensitive classification
          count, and how many relations resolve to a registered API; the section's own primary sidebar replaces the
          app's plain section nav with Protocol and Classification facets plus a "crosses a boundary" toggle (each
          option showing its count, state kept in the URL), and the table itself is additionally searchable by flow,
          protocol, or classification and sortable by flow, protocol, classification, or boundary. A row click opens
          a detail drawer with the flow's endpoints (linking to their entity records), direction, protocol,
          classification, carried Data Entities, owner, and the shared Data Flow governance fields (regulatory tags,
          processing purposes, source/destination residency); when either endpoint provides or consumes a registered
          API (via the `Provides API`/`Consumes API` typed relations), the drawer's footer links into the same
          shared spec drawer the APIs section uses (@id:ar.api-integration-catalog.apis). There are no
          adapter/health/latency/volume columns and no "relations per adapter" breakdown, matching the epic's
          explicit non-goal of not being an API gateway or runtime observability tool; there is also no quick-create
          action for new relations, since no generic schema-pre-filled quick-create flow exists in this codebase to
          wire it to (the APIs section's own "Register API" action was dropped for the same reason). A fifth stat
          tile counts `Provides`/`Consumes API` pairs with no matching Data Flow relation between their two
          endpoints — Component-typed endpoints are excluded from this count as structurally ineligible, since Data
          Flow relations are System-only. A toolbar toggle ("Data Flows" / "API Usage") switches the table between
          this Data Flow relation list and a lighter provider/consumer pairs table (Consumer, API, Provider, and a
          flag for whether a matching Data Flow relation exists), independent of whether a Data Flow relation exists
          for a pair and without the governance fields (classification, carried data, boundary) that only exist on
          Data Flow relations.

        - @id:ar.workspace-settings.integration-sync Workspace administrators can open Integration sync from the
          Workspace Settings Administration group. It is an operational control center for manually configured and
          workspace-approved integration sources and their idempotent runs. Administrators can configure source
          identity, ownership, type, and status; integrations cannot self-register sources. Paused (and any
          future unapproved) sources are rejected before catalog writes. It shows source ownership/type/status, last
          successful completion,
          complete versus partial coverage, changed and failed counts, safe warnings/failures, and externally managed
          entities, relations, and API artifacts. Complete scans can identify missing records; partial scans never do
          so. Stale, orphaned, and repeatedly failing records remain visible for permissioned retry. Orphaned
          entities and relations can be explicitly relinked through type-specific pickers, or an administrator can
          confirm stopping management, which removes integration tracking without deleting the catalog record; all
          reconciliation actions are audited and there is no automatic deletion.

        - @id:ar.api-integration-catalog.impact The Impact section is scaffolded as a placeholder pending its own
          dependency/blast-radius map content (blocked on catalog impact analysis).

    - @id:ar.entities Users can maintain a structured catalog of architectural entities and their relationships.

        - @id:ar.entities.create-edit Users can create, view, edit, move, organize, and delete entities subject to their
          permissions. From the entities view, creating a new entity preselects the schema of the first filtered entity
          when one is available.

        - @id:ar.entities.hierarchy Users can organize entities into hierarchical scopes and navigate from parents to
          descendants and related records.

        - @id:ar.entities.fields Users can view and edit standard and schema-defined fields, including owners,
          lifecycle, links, references, typed relations, currency values, ordered multi-valued scalar values, custom
          values, and principal fields that reference a user or a team (for example, a steward or custodian
          assignment). A schema field marked as externally
          managed (by AI, an integration, or an internal automation) is read-only to users; its current value stays
          visible alongside the latest update's source, timestamp, status, and any explanation or findings. A user
          edit to any other field on the entity marks that entity's external field results outdated. Fields belonging
          to a schema group render under a labeled section in the entity's Properties panel, with ungrouped fields
          shown first, unless the schema defines a custom layout (@id:ar.workspace.configuration.schemas), in which
          case the Details/Edit screen renders that schema's configured tabs and panels instead.
          Entity saves return validation warnings and reject blocking validation rules atomically, including rules that
          evaluate direct dependent entities through the same bounded JSON context.

        - @id:ar.entities.json-view Users can open "View JSON" from an entity's details menu to inspect the
          depth-1 JSON projection used by entity derived fields, including metadata, direct references, and typed
          relation targets.

        - @id:ar.entities.artifacts Workspace administrators can bind typed, functionality-driving artifacts such as API
          specifications or compliance evidence to workspace model objects. Authorized users can upload document-based
          API specifications from
          entity details, register link-only or HTTPS URL sources, manually refresh URL sources, retain immutable
          revisions, inspect asynchronous processing status and safe diagnostics, and retrieve raw content through a
          separate permission. Capability metadata, supported features, and required fields are owned by the integration
          catalog. The catalog
          does not treat arbitrary binary documents as a generic attachment store. OpenAPI 3.0/3.1 and AsyncAPI 2.x/3.0
          documents can be validated and synchronously projected into queryable operations or messages with stable
          identifiers, source pointers, summaries, filters, pagination, and visible partial/unsupported diagnostics;
          external references are preserved without network fetching. Entities whose schema matches the valid workspace
          API binding include a dedicated
          API catalog section for browsing normalized operations or messages, inspecting separately grouped API
          sources and immutable versions, explicitly selecting a source/revision, identifying each source's current
          successful version, inspecting source/revision/status and diagnostics, filtering and paginating results, and
          opening permitted raw or canonical external sources; stale and failed ingestion is explicitly distinguished
          from the last successful revision. Capability configuration is managed only from workspace settings and is
          included in workspace export/import and replication; this supports multi-schema and future relation/document
          bindings without making the contract entity-schema-owned. External
          catalog integrations can atomically attach an API specification
          to an entity using a provider-scoped source key, submit bounded documents, register HTTPS or link-only
          sources, repeat idempotently without duplicate revisions, and preserve the last successful revision when a
          refresh or completed source scan fails.

        - @id:ar.entities.business-glossary Workspaces can enable a permission-aware business glossary backed by
          ordinary entity schemas, surfaced as its own application (@id:ar.workspace.applications) with a
          glossary-scoped left rail. Users can browse and deep-link to terms, search canonical names, synonyms, and
          abbreviations, organize terms across flat many-to-many categories, inspect explicit usage across entities,
          typed relations, Markdown, projects, and diagrams, and review unused, conflicting, deprecated, and ownerless
          quality reports. Term drawers use the workspace's configurable schema-scoped entity drawer for declarative
          term fields, metadata, ordering, and the glossary usage slot, while quality badges and permission-filtered
          usage remain glossary-owned application content. Term definitions, aliases, category changes, ownership,
          lifecycle, and status continue to use the existing entity permissions, history, and approval mechanisms;
          generic entity behavior is unchanged.

        - @id:ar.entities.strategy-model Workspaces can optionally enable a strategy model — nested Business
          Capability, Objective, Outcome, Initiative, and Measure entity schemas — bound to the workspace via a
          `strategy-model` capability, surfaced as its own application (@id:ar.strategy) so other features (traceability
          views, roll-ups) can discover it. The Objective Supports Business Capability relation
          connects objectives to the nested capability hierarchy, while Business Capability Supports Entity connects
          capabilities to systems and other architecture entities; Objective Affects Entity remains a wildcard
          relation for architecture impact links. Relation endpoint constraints are authoritative and typed-relation
          fields provide projections on capability and objective schemas, so the hierarchy and strategic links can
          be browsed, edited, and queried. Business Capabilities also carry explicit maturity, maturity target,
          annual investment, and 1–5 risk ratings, plus a derived maturity gap (target minus maturity). They
          additionally carry enterprise-architecture attributes for capability-based planning — capability type (core /
          supporting / generic), value stream, stakeholders, business criticality (1–5), health (RAG),
          strategic importance, investment priority (TIME), target state, last-assessed date, and an external
          reference-model mapping (APQC PCF / BIAN / TM Forum eTOM) with a reference code — organised into
          presentation field groups (Maturity & Performance, Strategic Assessment, Investment & Risk, Lifecycle
          & Review, Reference Models) on the detail screen. Measures carry baseline, current, target, and
          direction values for strategy roll-ups. Which of these attributes each Strategy & Capability Modelling
          surface shows, and how they are aggregated and coloured, is set per workspace (@id:ar.strategy.view-config);
          the roll-up metrics it lists are computed over each capability's full recursive containment subtree using
          the generic metric roll-up engine (@id:ar.entity-views.map).

        - @id:ar.entities.relations Users can create and inspect relationships between entities and navigate related,
          dependent, and referenced records. Alongside generic reference/containment relations, workspace admins can
          define typed relation schemas with mandatory "in"/"out" endpoints (each constrained to a set of allowed
          entity schemas, or allowing any entity schema, and their own configurable fields, field groups, access
          control, validation rules, and an optional unique ordered endpoint-pair constraint. Typed-relation
          projections can also declare minimum and maximum counts from either endpoint perspective (with `-1`
          retaining unlimited cardinality); these constraints are enforced transactionally for every relation
          write path. Enabling pair uniqueness is blocked when existing duplicate pairs are found and returns a
          structural diagnostic preview, while constraint settings are retained in schema version history and
          workspace export/import;
          relation instances are first-class, independently addressable, audited records rather than entity-data
          values. Saving an entity also validates affected typed relation instances, and relation create/update/delete
          mutations participate in the same atomic blocking-validation behavior. A typed relation
          schema is surfaced on an entity by adding a "typed relation" field to that entity's schema, bound to a
          relation schema and a direction ("in" or "out"); like any other field, it can be placed in a named field
          group and is subject to that group's access control on top of the target relation schema's own field-group
          access control (a user needs edit access under both to change it). The field renders inline among the
          entity's other Properties, listing the relation instances the entity participates in with each row showing
          the connected entity and key field values (subject to field-group redaction) and linking to that entity.
          The built-in Default and Backstage templates provide first-class "Provides API" and "Consumes API"
          relation schemas, allowing Components and Systems to point to APIs while API entities expose inverse
          provider and consumer views; these relations are available to the same graph, topology, search, and
          permission surfaces as other typed relations. Endpoint labels are contextual to the entity at each side,
          so inverse relation views remain understandable without relying on the relation schema name.
          The built-in Risk & Compliance template provides a `Risk Affects` relation from each Risk to any entity
          schema, including Business Capabilities, with an inline `Affects` field on Risk, and a matching
          `Control Protection` relation from each
          Control to any entity schema, with an inline `Protects` field on Control; the bundled demo composes that
          template and seeds example relations. Together these let an information asset (Data Entity) be traced to
          the Risks that affect it and the Controls that protect it — and back — reusing the same typed-relation
          machinery, without a parallel asset model; project and documentation associations are the entity's
          existing generic ones. Target schemas do not need inverse projection fields
          because the relation endpoint definition is sufficient. On the entity Overview page, valid
          unprojected endpoints appear in contextual-label accordions and support the same add, edit, and remove
          lifecycle as projected typed-relation fields.
          While editing the entity, users can add, edit, and remove relation instances directly inline — adding
          picks another entity from schemas the relation type allows and fills in the relation's own fields (subject
          to field-group access control); these changes are saved together with the rest of the entity's edits in one
          atomic update. Each existing instance can also be expanded inline to edit its fields, or opened in a detail
          dialog showing its audit trail of create/update/delete events. Relation instances now retain version
          history on create/update/delete and can be restored to an earlier version via the API, mirroring entity
          version history's redaction and restore semantics; this is not yet surfaced in the relation instance UI
          the way entity history is (@id:ar.entities.history). Relation instances can also go through
          change-approval: a relation can require approval before edits apply (same policy-override precedence as
          entities), a single-relation proposal can be submitted/resubmitted/withdrawn/bypassed via the API mirroring
          the entity change-approval workflow, and a project's planned-change case can include relation instances
          alongside entities as members (endpoints are immutable and a proposal that changes one is rejected).
          Approved and applied relation changes are wired into the same governance engine, timeline markers, and
          workspace landscape-diff as entities; this relation change-approval/planned-change surface is not yet
          exposed in the web UI (API-only so far). The
          entity detail screen's Relations tab and Topology view also surface typed relation instances (grouped by
          relation schema in Topology, using the schema's own color), each expandable in place to view field values
          and open the same audit-trail history dialog. Relation instances can additionally be browsed as
          first-class records in their own right: a standalone Relations browser (a relation schema picker plus a
          table of matching relation instances) lists relation instances via the same structured query engine
          entities use, supporting scalar-field filters on the relation itself, filters on its "in"/"out" endpoint
          entities, and asOf/historical reconstruction. Users can switch the filtered result set between a table
          and a flat Graph view whose nodes are the matching relation endpoints and whose edges are the matching
          relation instances; the Graph view does not perform further traversal. This remains separate from the
          entity-embedded Relations tab above, which is unaffected. Graph edges can be labelled and coloured from
          relation field values, with deterministic palette colours; saved views can persist the relation-rooted
          query, selected display mode, and graph field settings the same way entity views do. A saved view's graph
          configuration can opt into an alternate node style, mirroring how the workspace model-overview graph
          renders relation *schemas* as their own boxes with "in"/"out" fan edges: each matching relation *instance*
          becomes its own node, fan-connected to its endpoint entities and to whatever entities its entityRelation
          fields reference (e.g. a Data Flow relation's carried Data Entities), instead of one direct
          endpoint-to-endpoint edge per relation. An entity the viewer cannot see is omitted from the graph rather
          than rendered blank, in either node style. The Relations browser's filter controls mirror the entity
          browser's: the same progressive builder popover (flat relation-field and In/Out endpoint conditions growing
          in place into Any/All groups and negation) plus a Simple/Advanced toggle whose Advanced side is a text
          field bound to the same relation-rooted query, full-fidelity in both directions. The builder can also
          traverse a relation's own entityRelation fields (relationForward, e.g. a Data Flow's carried Data
          Entities) and the fixed In/Out endpoints past a single hop, chained with further entity-side traversal
          and, going the other way, an entity-rooted relationBackward hop onto a relation - and a Columns section
          adds those traversed values (a relationForward-sourced field included) as table columns, the same way
          the entity browser's does. A query with a scoped "where" filter on one of these relation-context hops,
          or a column reading a value off the relation itself rather than the entity a hop lands on, still opens
          in Advanced mode until those narrower cases get a visual editor.
          A set of built-in, workspace-pinned canonical views cover information-governance analysis:
          restricted-data-flow exposure (flagging either the flow's own classification or a carried Data Entity's
          classification, shown as separate columns so a result can explain which one triggered it), missing or
          incomplete data stewardship, overdue stewardship review, cross-boundary transfers, residency-invalid
          transfers, an information-asset governance map (Data Entities graphed with the Risks that affect them and
          the Controls that protect them), and information assets with no inbound Risk or Control link — all composed
          from the standard relation/entity query engine, saved-view mechanism, and the table/graph views described
          above, with no bespoke computation beyond the Data Flow relation's `cross_boundary` and `residency_invalid`
          derived fields. The Risk & Compliance template additionally ships a `Control Coverage` traceability view
          following each Control out to its mitigated Risks and protected entities.

        - @id:ar.entities.content Users can attach and manage structured or Markdown-based content associated with an
          entity.

        - @id:ar.entities.history Users can inspect immutable entity versions, compare actual historical state, and
          restore earlier versions where permitted. Field values from access-restricted field groups are scrubbed
          from a version's recorded state for viewers without view access to that group, mirroring the redaction
          applied when viewing the entity directly.

        - @id:ar.entities.baselines Users can create named, durable architecture baselines from an accessible
          workspace, project, saved view, or explicit entity selection. A baseline preserves the reconstructed entity
          and relation state at its effective date, remains available after live records change or are deleted, and
          can be browsed, compared with another baseline or the current scope, and exported as permission-aware JSON.
          Workspace baselines are listed in a Baselines tab alongside the entity browser, project baselines are
          listed in a Baselines tab in the project's secondary sidebar, and selecting one opens its named detail
          view in the relevant entities or project context, with captured records, JSON export, and comparisons
          available there. Creation can capture the current entity filters or saved view through a dialog.
          Baselines expose Active, Stale, and Superseded lifecycle states; superseding is explicit and deletion is
          soft-only. Approval decisions remain represented by linked governance cases rather than by baseline status.

        - @id:ar.entities.bulk-edit Users can select multiple entities and edit supported fields in bulk, including
          replacing, appending, removing, reordering, or clearing ordered multi-valued scalar lists. Entities that
          require an approved change proposal are bundled into a single multi-entity proposal case routed through
          governance instead of being skipped.

        - @id:ar.entities.templates Users can create entities from configured templates and use templates to standardize
          recurring entity structures, including ordered defaults for multi-valued scalar fields.

    - @id:ar.entity-views Users can browse, filter, search, and analyze entity collections through configurable views,
      including free-text search across entity names, slugs, and descriptions. The entity sidebar provides familiar
      facet navigation for selecting multiple schemas, lifecycle states, and owners at once; schema type facets are
      grouped by category, and values within a facet
      are combined as alternatives while different facets narrow the result together; checked rows can be adjusted
      directly, and the All entities row resets the facet selections.

        - @id:ar.entity-views.table Users can inspect entities in a tabular browser with configurable fields, sorting,
          filtering, selection, and bulk actions. Project-only fields such as project role and project status are shown
          when the browser is in project context. Scalar-array filters use any-element matching for positive operators,
          while emptiness checks the list and sorting/chart metrics use its first value.

          Entity lists also expose an aggregate Conformance status field that can be displayed and filtered in
          browser queries and saved views. The status distinguishes conformant, violating, acknowledged, exempt, and
          not-evaluated entities; unresolved filtering matches active or acknowledged violations, and stale evaluation
          coverage is shown separately from the substantive status.

        - @id:ar.entity-views.cards Users can inspect entities as cards for quick scanning of record summaries.

        - @id:ar.entity-views.tree Users can inspect hierarchical entity structure in a tree-oriented view.

- @id:ar.entity-views.graph Users can explore the entities matching the current browser filter as highlighted
  roots, together with linked entities traversed up to a configurable number of relationship levels; the
  graph includes typed relationship instances alongside generic reference/containment relations, each
  rendered with its relation schema's color, and clicking a typed relation edge opens a popup with its
  field values, links to both endpoint entities, and access to its audit history.

        - @id:ar.entity-views.topology Users can inspect entity relationships and dependencies in a topology view,
          including a dedicated section grouping typed relation instances by relation schema alongside the
          containment/reference sections; clicking a typed relation opens the same detail popup used in the graph
          view.

        - @id:ar.entity-views.radar Users can compare entities in a radar-oriented view when the required data is
          available.

        - @id:ar.entity-views.timeline Users can inspect date-driven entity history and planned change context in a
          condensed Entity + Project timeline, grouping rows by owner, type, or containment parent, with configurable
          project lanes, milestone guides, autosave snapshot visibility, and continuous Historical, Now, Next, and
          Later horizon bands. The Capability + Entity + Project strategic roadmap mode aggregates accessible
          project-linked workspace entities, keeps owners visible, and places undated entities in a separate section.
          When grouped by Project + Entity, a project with both a start and target date set shows a gantt bar spanning
          that range in its group header.

        - @id:ar.entity-views.entity-detail Entity detail screens present metadata, project membership, and diagram
          membership in an accordion, with metadata open initially and project/diagram counts visible while their
          sections are collapsed. Valid typed relation schemas without projected fields have their own accordion
          sections, and planned changes are available in a dedicated Future plans tab beside Change history. A
          Conformance tab shows the entity's own violations (active, acknowledged, exempt) with severity and
          last-seen timestamps, or a conformant/not-yet-evaluated state when none apply, with its tab title counting
          active violations; it is gated by the same permission as the workspace Conformance section and links out
          to it for further investigation.

        - @id:ar.entity-views.diff Users can pick a future date and view a workspace-wide diff of what changes by
          then — entities added, removed, or changed, with all applicable planned changes across projects applied,
          scoped to the browser's current search/filter/project-scope selection, with a field-level diff on
          drill-down for changed entities. Planned changes with a target date already in the past but never applied
          are excluded by default (an "include overdue changes" toggle brings them back in). Field values from
          access-restricted field groups are scrubbed from added/removed entities and from changed-entity field
          diffs for viewers without view access to that group; an entity whose only changes are restricted shows an
          undifferentiated "Restricted changes" indicator rather than being silently omitted.

        - @id:ar.entity-views.matrix Users can inspect relationship density and coverage in a matrix view, filterable
          by a specific relation field where typed relation instances are included alongside generic
          reference/containment relations and marked with their relation schema's colour/icon in the field picker.

        - @id:ar.entity-views.traceability Users can save a generic, path-configured traceability view that follows
          one or more bounded relationship paths from the current entity query, reports architecture and current
          delivery coverage separately, inherits milestone, planned-change, and assessment evidence from aligned
          projects, and identifies accessible entities and projects outside the configured traceability graph. Path
          editors offer arrow-first (`->`/`<-`) controls with each hop's dropdown populated by every schema-compatible
          option for that direction — plain reference/containment fields, typed-relation fields bound to a specific
          projection field, and unbound relation-schema traversals alike — filtered by field-group access, while
          preserving invalid saved paths for repair. Multi-hop paths render one line per matched root-to-leaf path
          (not a flattened, uncorrelated bag of every entity touched at each hop), capped at 3 visible paths per
          cell with a "+N more" expander. Each row also reports a completion roll-up — the share of aligned projects
          with `complete` status — so a root entity (e.g. a strategy Objective reached via its Initiatives) shows
          delivery progress alongside its coverage/gap status, without exposing project detail the viewer can't
          already see.

        - @id:ar.entity-views.path-walker Users can walk a single relationship chain interactively, one column per hop,
          with no path configured up front. Column 0 lists the entities matching the current browser filter; selecting
          an entity reveals a dropdown on the connecting arrow listing every relation traversable from that entity —
          incoming and outgoing typed relations, generic references, and containment, grouped and filtered by
          field-group access. Choosing one populates the next column with the entities it links to; every intermediate
          column preselects its first entity so a chain (e.g. a saved view's remembered hop sequence) reads end-to-end,
          while the final column is left for the user to choose, and an explicit click always overrides. Selecting an
          entity reveals the next arrow, and so on up to six hops. Once a column's outgoing relation is chosen, each of
          its rows shows how many entities it leads to in the next column (a single batched lookup). A breadcrumb
          summarises the current chain, a hop that resolves to nothing shows an explicit "chain breaks here" state, and
          an "Open" action in each entity's hover card navigates to that entity. The walked chain (selected entity per column) is kept in the URL so it is shareable, and saving
          the view remembers the chosen hop sequence so it reopens on the same chain. Coverage, orphan, and delivery
          analysis stay in the traceability view.

        - @id:ar.entity-views.bubble Users can plot entities across configurable dimensions such as X, Y, size, and
          colour in a bubble view, with optional equally split axes and named quadrant labels persisted in saved views
          and wiki embeds.

        - @id:ar.entity-views.heatmap Users can inspect entities in a generic NxN heat-map grid, mapping likelihood
          and impact to any numeric or select field on the selected schema (not tied to a specific template's field
          ids); numeric axes split into a configurable number of equal-width bands while select axes use their
          declared options as bands. Each cell shows the count of matching entities, coloured by grid-position
          severity by default or by an optional averaged numeric field, and clicking a populated cell opens a list of
          its entities to navigate to.

        - @id:ar.entity-views.map Users can inspect containment hierarchies, including the built-in Vendor-to-Contract
          path, as a nested capability map, colouring boxes by a configurable metric rolled up from descendant entities
          (numeric or currency fields, lifecycle state, or assessment fields), using count, leaf-count, sum, average,
          minimum, maximum, dominant-option, worst, or percentage aggregation. Leaf-count counts only descendants
          with no containment children of their own — used, for example, by the Strategy & Capability Modelling
          application's capability roll-up (@id:ar.entities.strategy-model). Percentage aggregation shows the share
          of descendants matching a configurable numerator condition against the same field set as the entity
          browser's filters. Currency rollups convert
          amounts to the selected currency or workspace default using the latest
          daily exchange-rate snapshot, and show the conversion currency and rate date. For
          enum-sourced metrics, "worst" ranks options by the admin-configured top-to-bottom order of the enum's
          options. A metric source in an access-restricted field group evaluates as unavailable (no value, distribution,
          or dominant option) for viewers without view access to that group, rather than exposing the underlying data;
          the field picker also excludes such fields when configuring the metric. Each level after the first is
          connected to its parent by an explicit, user-picked hop (the same direction-toggle-plus-grouped-dropdown
          hop editor used by traceability paths), so a level can traverse any reference/containment field, any
          typed-relation field, or any unbound relation schema - not just containment - grouped in the dropdown as
          Containment, Reference, Typed relation, and Relation. Level 1 has no schema of its own and always
          represents every entity currently matching the view's filters, spanning whatever schemas they belong to;
          subsequent levels narrow from there via their configured hop. Typed relation instances such as System
          Contract can still be selected as their own map level (shown as a box for the relation instance itself)
          via the legacy schema-picker mechanism; field-less typed relation schemas are available as explicit
          relation levels this way too, so the selected relation schema (rather than an inferred or merged
          relationship) determines the hop, and self-loop relations may traverse both endpoints - once a relation
          level appears anywhere in a map's configured levels, every level from Level 1 onward reverts to the
          legacy single-schema picker for that map. Users can add an arbitrary number of ordered levels and hide
          any level after the first while retaining its descendants. The metric picker
          automatically uses the final selected level (so Contract exposes Annual Cost and System Contract exposes its
          relation fields). Users can optionally hide boxes with missing metric data; a box with a direct source value
          but no aggregate is colored and annotated from that source value. Clicking any rendered entity box opens
          its entity detail card rather than re-rooting the map.
          Traversal applies the current visibility, permission, project, and filter scope. Map filters select relevant
          branches while ancestors and configured descendants are included as structural context; recursive maps use
          only top-most entities as roots. Repeated terminal sources are deduplicated and collapsed duplicates are
          marked in the map with a count and hover detail.

        - @id:ar.entity-views.explore Users can inspect entity data in a configurable side-by-side exploration view,
          using a scoped relation filter popup grouped by source entity schema and labelled with source schema,
          predicate, and target schema; each non-center column can be filtered to a schema, with the selection
          constraining subsequent traversal and persisting with the view configuration. Selected schema relationships
          apply across matching entities, while typed relation instances remain included alongside generic reference
          and containment relations by default. Entity cards provide context-menu actions to exclude an entity from
          the exploration or focus the entity filter on that entity.

        - @id:ar.entity-views.saved-configuration Users can configure and reuse entity view fields, filters, sorting,
          display modes, and joined data such as assessment fields. Saved views may also use relationship-aware
          structured queries with projected fields. Schema templates (full or cross-cutting) can seed initial saved
          views into a workspace at creation time, so users see a populated view list for template-provided schemas
          without configuring one themselves.

        - @id:ar.entity-views.technology-lifecycle Users can use saved table, radar, and timeline views to review
          technology release lifecycles, radar governance status, and end-of-life planning dates.

    - @id:ar.search Users can discover entities, projects, documents, and other workspace content without navigating
      each hierarchy manually.

        - @id:ar.search.workspace Users can search across the current workspace and navigate to matching records and
          content.

        - @id:ar.search.filters Users can combine search terms and structured filters to narrow results. Entity
          browser views provide a progressive filter builder popover (available alongside the multi-select sidebar
          facets in both modes) plus a Simple/Advanced toggle that switches the adjacent input between a plain
          free-text search box and a single text query parsed against the entity query language. The filter builder
          opens as a flat list of conditions and grows in place into Any/All groups, negation, and relation traversal (a
          per-condition hop chain that ends either on a field of the related record or on a bare "the related record
          exists" check, with an optional per-hop same-instance "where" filter for the record that hop lands on), and
          a Columns section for traversed projection values (a hop chain plus a terminal field or a whole-path
          capture, with an optional column name; each becomes selectable as a table column under Manage fields),
          reading and writing the same structured query as the Advanced text field with no lossy conversion between
          them. The Advanced text field expresses projected columns as a `columns` sub-clause inside a traversal
          segment's `[...]` scope — `technology_releases[eol_date < date("2026-06-30") columns eol_date as "TR EOL"]`,
          or a capture-only bracket for an unfiltered traversal — covering entity- and relation-rooted queries,
          `relationForward` hops, and whole-path (`path`, `includePath` in the IR) captures; each column binds to
          that scope's match witness. an empty group is treated as no filter rather than matching nothing, and a blank
          free-text row as no
          filter rather than an error. A free-text clause is normally the dedicated search box, but a "Free text"
          entry in any condition row's field dropdown places one inside the boolean tree for the "text OR a field
          predicate" case the search box (always root-level AND) cannot express. A query that uses relation-rooted
          traversal, a relation-instance projection, or a same-instance scoped filter inside a projection opens with
          the Advanced text field shown until the corresponding visual editors are available. A field in a schema group
          the user cannot view is offered nowhere as a
          filter/sort option and is treated as unrecognized if referenced directly in an Advanced-mode query,
          matching how the field is hidden elsewhere. The builder shows an always-visible, copyable pretty-printed
          query preview, and the Advanced editor supports multiline text, formatting without applying the draft, and
          Ctrl/Cmd+Enter to apply it. Advanced queries can traverse typed relations and filter or
          project their scalar relation fields; entity-valued relation fields are deferred to follow-up issue #2670.
          Query-level columns can preserve correlated path provenance, walk a named containment subtree, and reduce
          matched entity/relation terminals with `count` or `countDistinct`; recursive and aggregate expressions remain
          read-only in Advanced mode.
          A before/after/on date filter (on a scalar entity or relation date field) can be set relative to today
          instead of a fixed date, with an optional day offset, so a saved view re-evaluates against the current
          date each time it runs (e.g. "review date before today" for an overdue view); the filter popover offers a
          toggle between a fixed date and this relative mode.

        - @id:ar.search.navigation Search results provide context and links into the relevant entity, project, document,
          or workspace surface.

        - @id:ar.search.glossary The dedicated glossary surface provides alias-aware term search and quality filters
          without changing the semantics of generic workspace search.

    - @id:ar.projects Users can organize architecture work into projects containing files, content, diagrams,
      milestones, and assessments.

        - @id:ar.projects.lifecycle Users can create, edit, view, and delete projects and manage their project-level
          metadata, including optional start and target dates shown on the project home screen. Entities can be linked
          to one or more projects, making the project's milestones, assessments, and planned changes available as
          project context for that entity.

        - @id:ar.projects.dashboard The project home screen shows a composable dashboard of widgets scoped to that
          project, built from the same widget catalog as the workspace dashboard (stat metrics, saved-view embeds,
          entity tables, entity cards, entity graphs, entity changelogs, document browsers, entity browsers, diagram
          previews, project wiki-page embeds, configurable Markdown content, assessments, and upcoming milestones — plus
          a
          project-relevant subset of the general catalog; workspace-wide analytics widgets such as lifecycle and
          activity-trend charts, stale-entity reports, and the activity feed are not available at project scope). The
          assessments widget lists up to four assessments filtered by mode and optional assessment type; the
          upcoming-milestones widget
          shows the most recently completed milestone plus up to three upcoming ones. A project has a single
          dashboard (no personal or multiple project dashboards); a fresh project shows a sensible default layout.
          Project editors can enter edit mode to add, remove, resize, and reposition widgets and save the layout;
          other project members see the dashboard read-only. File and diagram browsing for the project remains
          available via the sidebar rather than as a dashboard widget.

        - @id:ar.projects.files Users can organize project files and folders, create content nodes, rename or relocate
          them, and manage supported file content.

        - @id:ar.projects.markdown Users can create and edit Markdown documents with links, backlinks, attachments,
          metadata, and revision history. Project editors can manage project-specific Markdown templates from the
          project home actions menu.

        - @id:ar.projects.revisions Users can inspect, create, restore, and validate revisions for supported project and
          workspace documents.

        - @id:ar.projects.milestones Users can manage project milestones with target dates and status, and associate
          planned entity changes with milestones.

        - @id:ar.projects.planned-changes Users can record named, coordinated change cases for one or more entities
          within or outside a project without changing the current live entity state, including planning the
          introduction of new project-scoped entities. A member's recorded base and proposed state scrub field
          values from access-restricted field groups for viewers without view access to that group, with an
          undifferentiated "Restricted changes" indicator shown where redaction would otherwise leave a member's
          diff looking empty. When the workspace has a strategy model, the planned-change editor also shows the
          affected objectives derived from the selected existing entities' current `Objective Affects Entity`
          relationships, with a deduplicated case-level summary and per-entity attribution; new draft entities have
          no current objective links, and inaccessible relationships remain omitted.

            - @id:ar.projects.planned-changes.schedule Users can target a planned entity change to a future date or
              associate it with a project milestone.

            - @id:ar.projects.planned-changes.timeline Users can inspect planned entity changes in project and
              entity-oriented timeline views alongside historical change information.

            - @id:ar.projects.planned-changes.apply Users can apply a planned entity change case atomically, promoting
              all approved member states into the live entities.

            - @id:ar.projects.planned-changes.whats-changed Users can view a summary of what changes across a
              project's connected entities once all of its planned changes are applied, compared to the current
              live state — entities added, removed, or changed, with a field-level diff on drill-down for changed
              entities. The comparison date is fixed to the latest effective date among the project's planned
              changes, falling back to the project's target date when no planned change has a date. From this view,
              users can compare the project's reconstructed future state with another project's future state, showing
              entities present in only one scenario and field-level differences between both proposals. As with the
              workspace-wide diff, restricted field-group values are scrubbed per viewer, with a "Restricted changes"
              indicator standing in when redaction would otherwise leave a changed entity's diff empty.

        - @id:ar.projects.permissions Project content can be protected through the applicable workspace, project,
          entity, team, and role permissions.

    - @id:ar.assessments Users can collect structured review data for entities within a project.

        - @id:ar.assessments.definitions Users can create and edit assessment definitions with status, scope, filters,
          and required or optional fields, start from built-in assessment templates, or configure a confirm-only mode
          with no fields. Scope filters honor field-group view access: unauthorized restricted fields cannot be used
          when defining a condition, and existing inaccessible conditions are hidden and fail closed for that caller.
          Enum fields can reference reusable workspace enums or define assessment-local option values.
          Rating fields use a 1-5 scale by default but a template or definition can widen it up to 1-10. Read-only
          derived fields can calculate typed values from sibling responses through the `assessment` JSON root and are
          excluded from response
          completeness and status. Fields can be organized into named, presentation-only groups (with an optional
          description) that render as labeled sections in the assessment editor and the per-entity assessment
          accordion; this is purely visual and does not affect the assessment grid/results view, where fields remain
          flat table columns. The built-in "Business fit vs. technical fit" template scores both dimensions on a
          1-10 scale and includes a derived TIME quadrant (Tolerate / Invest / Migrate / Eliminate) field computed
          from the two ratings.

        - @id:ar.assessments.responses Reviewers can fill in assessment responses for in-scope entities from an
          assessment grid or entity detail view, or, for confirm-only assessments, record a single "confirmed
          accurate" action per entity.

        - @id:ar.assessments.progress Users can inspect assessment completion, status, summary, and aggregate results,
          including a per-team acknowledgement breakdown when the assessment has assigned teams. Scope-derived
          results are evaluated with the caller's field-group access and do not disclose inaccessible conditions.

        - @id:ar.assessments.entity-views Users can join assessment data to entity views and use the assessment fields
          for filtering, sorting, and analysis.

        - @id:ar.assessments.export Users can export assessment results to CSV. Exports do not include rows or
          statuses derived from scope conditions the caller cannot view.

        - @id:ar.assessments.team-assignment Users can assign one or more teams to an assessment, with an optional
          due date, before opening it. Opening the assessment surfaces an acknowledgement task per assigned team in
          the governance inbox; closing the assessment resolves those tasks. Assigned teams and the due date are
          fixed while the assessment is open and can only be changed by returning it to draft.

        - @id:ar.assessments.recurrence Users can configure an assessment to recur weekly or monthly (with a
          configurable interval, so quarterly or annual cadences are just a monthly interval of 3 or 12) and set a
          response window in days. Once open, a recurring assessment automatically reopens for a new response cycle
          when its response window elapses: prior responses are preserved but no longer count toward completion, so
          teams re-attest each cycle rather than seeing stale "complete" state, and the assigned teams' governance
          inbox acknowledgement task is recreated for the new cycle. The assessment card shows the current cycle
          number and when it next reopens.

    - @id:ar.content Users can maintain Markdown, diagram, and document content at workspace, project, and entity
      scopes.

        - @id:ar.content.workspace-documents Users can create, edit, organize, link, and revise shared workspace
          documents.

        - @id:ar.content.entity-content Users can maintain content attached to individual entities and navigate between
          entities and their content.

        - @id:ar.content.versioning Users can inspect content history, compare revisions, and restore earlier versions
          of supported content.

        - @id:ar.content.diagrams Users can associate Diagram Craft diagrams with architectural entities and projects.

        - @id:ar.content.glossary-links Glossary term usage and backlinks include only explicit, permission-visible
          links from Markdown metadata, project associations, and diagram entity references.

            - @id:ar.content.diagrams.entity-graphs Users can generate or inspect diagrams derived from entity
              relationships and graph data.

            - @id:ar.content.diagrams.editing Users can open associated diagrams in the Diagram Craft editing experience
              where the integration is configured. Entity data and field values exposed to Diagram Craft through this
              integration are scrubbed of access-restricted field groups per viewer, mirroring the redaction applied
              when viewing the entity directly; typed relation fields expose the connected endpoint entity IDs while
              relation-instance attributes remain private to Arch Register.

            - @id:ar.content.diagrams.preview Users can view generated or stored diagram previews and associated diagram
              metadata.

        - @id:ar.content.attachments Users can add and manage supported attachments associated with Markdown and
          document content.

        - @id:ar.content.inline-comments Users can discuss supported wiki or document content through inline comments
          and discussion threads.

        - @id:ar.content.external-sources @status:experimental Deployments can mount or synchronize external content
          sources, including Git-backed content, when configured.

    - @id:ar.collaboration Users can collaborate around architectural records, projects, documents, and review activity.

        - @id:ar.collaboration.discussions Users can create and participate in discussion threads associated with
          supported records and content.

        - @id:ar.collaboration.watches Users can watch entities and receive notifications when relevant changes occur.

        - @id:ar.collaboration.notifications Users can inspect a single consolidated in-app notification feed covering
          entity-watch changes, comment activity, and governance action items, see an unread count badge, navigate to
          the related resource, and clear or mark notifications read. A governance action-item notification is cleared
          automatically once its underlying task is resolved, superseded, or cancelled, without requiring the user to
          open the notification.

            - @id:ar.collaboration.notifications.comment-activity Users receive in-app notifications when someone
              comments on an entity or content they own, or replies to their comment, subject to current access and
              excluding the person who posted the comment.

            - @id:ar.collaboration.notifications.delivery-preferences Users can choose, per notification type and per
              delivery channel, whether they receive that notification. In-app delivery is on by default for normal
              notification types and off by default for reminder types; email is available when configured by the
              deployment, while Slack and SMS are not yet deliverable. Preferences are scoped per user per workspace and
              only affect future notifications, not existing Inbox items.

        - @id:ar.collaboration.governance-inbox Users can find open governance tasks, review completed task history,
          filter work by task and due-date attributes, and navigate to governed cases.

            - @id:ar.collaboration.governance-inbox.my-submissions Users can review governance work they have submitted,
              see what or who is currently blocking it, and withdraw an open submission where permitted. For an open
              case with outstanding assignments, the initiator can also send an out-of-band reminder to the remaining
              assignees on demand, rate-limited to prevent spamming them.

            - @id:ar.collaboration.governance-inbox.scheduled-reminders For governance case kinds with a due date
              (entity change proposals, entity deprecations, relation change proposals, document status approvals,
              assessment responses), still-open assignees automatically
              receive reminders as the deadline approaches and again once it has passed, on a per-case-kind cadence.
              Reminders respect each user's notification delivery preferences and are not re-sent once a given
              reminder has already fired for a case. The inbox highlights an overdue deadline.

                - @id:ar.collaboration.governance-inbox.scheduled-reminders.workspace-config Workspace administrators
                  can configure all supported governance workflows from the central Workflows settings screen. Each
                  saved configuration can enable or disable reminders and define the approaching/overdue cadence for a
                  workspace-wide or supported case-subkind scope. Each configuration has an administrator-defined short
                  name and optional description, which are shown in the configuration list.

            - @id:ar.collaboration.governance-inbox.escalation For governance case kinds that support escalation (entity
              changes, entity deprecations, and document status approvals), a case left open past a
              configured number of days overdue is automatically escalated once. Each case kind resolves its own
              configured strategy first, then notifies all valid fallback users and teams; workspace administrators are
              the final fallback. Escalation is recorded in the case's activity history with the resolved targets, and
              the inbox marks an escalated case with a distinct badge. Workspace administrators can turn escalation on
              or off and configure its strategy, overdue threshold, and fallback targets alongside reminder
              configuration in
              @id:ar.collaboration.governance-inbox.scheduled-reminders.workspace-config.

            - @id:ar.collaboration.governance-inbox.initiation-fields Workspace administrators can configure ordered,
              typed initiation fields for supported non-assessment workflows. Initiators provide required values when
              a workflow starts, and the captured field definitions and values remain visible in the governance APIs,
              webhooks, inbox, notifications, and escalation messages.

        - @id:ar.collaboration.entity-change-approval Workspace administrators can require approval for entity change
          cases, while authorized users can submit immutable coordinated revisions with an optional due date, review
          before/after diffs across all affected entities, resubmit after requested changes, and record an audited
          approval bypass. This covers both a single entity's propose-a-change flow and a bulk-edit-originated
          proposal bundling several entities into one case, the latter routed through governance without a resubmit
          path. Approvals use the entity-owner-admin strategy, configurable quorum, fallback users/teams, and the
          workspace-admin final fallback. Field values from access-restricted field groups are scrubbed from a
          proposal's base/proposed state
          and diffs for viewers without view access to that group, mirroring the redaction applied when viewing the
          entity directly.

        - @id:ar.collaboration.entity-deprecation Workspace administrators can require deprecation proposals for
          entities on schemas that opt in, while authorized users can propose a deprecation with a target date, reason,
          successor entity, and related project, route it through approval, notify affected owner teams for
          acknowledgement, postpone or finalize on schedule, and cancel an in-flight deprecation; finalizing moves the
          entity to the workspace's designated deprecated lifecycle state.

        - @id:ar.collaboration.entity-merge Workspace administrators with merge permission can merge a duplicate
          entity into a canonical one from a "Merge into…" action on the entity detail page or the entity browser
          (single or multi-select), via a four-step wizard: pick a same-schema target entity, review every field,
          relation, and side-table conflict plus repointed dependents and any blockers, type the source entity's name
          to confirm, then view the merged result. Field-group-restricted conflicts are shown read-only with an
          explanation rather than left for the user to resolve, and acknowledgeable blockers require an explicit
          checkbox before the merge can proceed; merging several selected entities into the same target runs the
          wizard once per source in sequence. Source and target must share project scope: a cross-project pair is a
          hard blocker, an open governance case on the source is a hard blocker, and a merge that would drop a source's
          project confinement or move the canonical record into a project proceeds only on an acknowledged warning.
          Under the hood the wizard drives the preview/execute API: the preview is
          read-only and reports conflicting field values, reverse references, typed relations, side-table collisions,
          affected row counts, and hard blockers; the caller explicitly resolves every conflict, then one atomic
          operation rewrites supported references and side tables, transfers record history, creates the
          retired-identifier alias, removes the source record, and records a correlated audit trail for the retired
          source, canonical target, and rewritten dependents. The alias keeps the retired entity's id and public id
          resolving to the canonical record with a redirect marker, for both authenticated lookups and the
          @id:ar.access.public-catalog. Preview versions and an opaque participant fingerprint
          prevent stale applies, while restricted field values are flagged rather than disclosed and unsupported
          external identities remain blocked.

        - @id:ar.collaboration.audit Authorized users can inspect audit activity for workspace and domain changes.
          Field values from access-restricted field groups are scrubbed from an entry's recorded changes for viewers
          without view access to that group, mirroring the same redaction applied when viewing the entity directly.

    - @id:ar.authorization Administrators can control who can access, modify, review, and administer workspace content.

        - @id:ar.authorization.global-roles Platform administrators can manage global roles, platform-level access,
          and user assignments.

        - @id:ar.authorization.workspace-roles Administrators can assign workspace roles such as owner, administrator,
          editor, reviewer, and viewer.

        - @id:ar.authorization.entity-grants Administrators can grant targeted entity-level edit, contribution, or
          administration access (not view — that comes from workspace content access, team ownership, or these
          grants' own edit-capable roles) with scopes such as the entity itself or its subtree.

        - @id:ar.authorization.teams Administrators can create teams, manage memberships, and use team assignments in
          authorization decisions.

        - @id:ar.authorization.application-access Workspace administrators can control access to each installed
          optional application independently from workspace roles, from the Access tab of that application's entry in
          the "Applications & Capabilities" settings screen, granting all workspace members or selected people
          and teams. Ordinary members must still have workspace view access; global administrators and workspace role
          managers retain access, and removing a policy returns the application to administrator-only access.

        - @id:ar.authorization.project-scope Entities can be scoped to a single project, which excludes them from
          global listings and search while keeping them visible within that project's context.

    - @id:ar.import-export Users and administrators can move supported workspace, entity, project, and content data into
      and out of Arch Register.

        - @id:ar.import-export.workspace-export Authorized users can export selected or complete workspace data,
          including supported content, workspace capability configuration, typed relation schemas, and typed relation
          instances. Exported
          entity and relation data is scrubbed of access-restricted field groups per exporting user, mirroring the
          redaction applied when viewing those records directly. Filtered exports omit relations whose endpoint
          entities are not included, report safe diagnostics when field values are omitted, and record those
          omissions in archive diagnostics.

        - @id:ar.import-export.workspace-import Authorized users can validate, preview, and execute supported workspace
          imports. Entity and relation schema groups, field-group access controls, reusable shared fieldgroups,
          workspace
          capability bindings, their links, and schema-scoped entity drawer profiles are preserved with remapped
          references; relation endpoints follow remapped entity IDs; imports
          preserve destination custom drawer profiles, report stale drawer references as non-fatal diagnostics, reject
          restricted values the importing caller cannot edit, redact restricted values from conflict previews, and
          report missing
          relation dependencies.

        - @id:ar.import-export.workspace-replication Workspace copies preserve schema field groups, shared fieldgroup
          links, field-group access-control semantics, workspace capability bindings, and schema-scoped entity drawer
          profiles while remapping
          workspace-local identifiers.

        - @id:ar.import-export.definition-import Workspace administrators can preview and atomically import selected
          schemas, reusable enums, active document types, and typed relation schemas from built-in templates or another
          administered workspace, including recursively resolved dependencies and remapped references. Cross-cutting
          dependencies can be mapped to one or more existing destination definitions; dependent schema patches are
          applied with the import atomically and versioned/audited. Built-in templates also apply their declared
          dashboard layout and authored entity drawer profiles when the administrator opts in.

        - @id:ar.import-export.entity-csv Users can import and export entity collections through CSV workflows.
          Columns for fields in access-restricted field groups are omitted from exported CSVs and import templates
          for viewers without view access to that group, mirroring the redaction applied elsewhere. Field values
          from access-restricted field groups are scrubbed from import previews, and CSV updates cannot write or
          clear fields in field groups the importer lacks edit access to. Multi-valued scalar fields are exported and
          imported as ordered JSON arrays.

        - @id:ar.import-export.relation-csv Users can import and export typed relation instances through CSV
          workflows. Exports include relation-schema and endpoint entity IDs plus fields when all rows share one
          relation type; mixed-type exports contain only the identifiers. Imports validate endpoint constraints and
          relation fields, then upsert by relation type and endpoint pair while respecting relation and field-group
          access controls.

    - @id:ar.integrations Arch Register exposes integration surfaces for external clients, content sources, event
      delivery, and scheduled work.

        - @id:ar.integrations.api External clients can use the documented API contract and API tokens to access
          supported Arch Register operations. The stable integration surface exposes entity schemas, typed relation
          schema metadata, paginated typed relation reads, entity-scoped typed relation traversal, and typed relation
          instance create/update/delete operations with capability checks, field-group redaction (including typed
          relation owner-field ACLs in audit entries), audit logging, and approval-policy enforcement. Administrators
          can create workspace-scoped API tokens backed by a system user,
          restricted to a chosen subset of role capabilities, with an optional expiry date, in addition to the
          personal API tokens available from account settings.

        - @id:ar.integrations.entity-sync External integrations holding the external-update capability can
          idempotently create or update an entity by a durable (source, external key) identity, distinct from the
          entity's internal id, so repeated submissions from a catalog importer converge on the same entity instead
          of creating duplicates.

        - @id:ar.integrations.api-specification-sync External integrations can atomically sync an API entity and
          its specification source through the versioned integration API. Sources are identified by a stable
          provider-scoped source key rather than an internal database ID and support bounded submitted documents,
          secure HTTPS refreshes, and link-only provenance. Repeated content is checksum-deduplicated into immutable
          revisions; manual and scheduled URL refreshes share the artifact refresh job path, while source failures
          preserve the last-known-good revision and expose stale/failed diagnostics. The Backstage example resolves
          inline and supported `$text`, `$json`, and `$yaml` definitions with its GitHub credentials, records source
          provenance, reports unsupported definitions as warnings, and only marks disappeared sources stale after a
          complete organization scan.

        - @id:ar.integrations.relation-sync External integrations holding the external-update capability can
          idempotently create or update a typed relation instance by a durable (source, external key) identity, the
          same pattern as entity sync, so repeated submissions from an integration converge on the same relation
          instead of creating duplicates. The "in"/"out" endpoints and schema are fixed at creation and cannot be
          changed by a later sync call. The Backstage catalog sync example discovers the API participation relation
          schemas and synchronizes Component/System provider and consumer references as stable typed-relation
          identities.

        - @id:ar.integrations.mcp External AI or automation clients can use the MCP server’s supported entity and
          typed-relation discovery, bounded traversal, and mutation tools. Typed relation mutations require the MCP
          mutation switch and `ent.edit`, while relation fields remain subject to field-group redaction and writes are
          audited.

        - @id:ar.integrations.webhooks Administrators can configure webhooks and inspect supported delivery behavior for
          workspace events, including typed-relation create, update, and delete events filtered by relation schema,
          plus governance workflow start, approval, rejection, change-request, escalation, and finalization events.

        - @id:ar.integrations.external-governance @status:experimental External workflow engines can use a dedicated
          integration API to create governance cases and inbox items, and to approve, reject, or request changes on
          external workflows. Workspace administrators can mark supported workflows as external so Arch Register
          retains the case and emits events while assignment routing, reminders, escalation, and internal approval
          requests are controlled by the external engine.

        - @id:ar.integrations.jobs Administrators can create and configure supported recurring jobs, inspect scheduled
          jobs, job servers, run history, and supported cancellation operations.

            - @id:ar.integrations.jobs.standard_jobs Administrators can configure a Technology End of Life job to
              hydrate mapped schema fields from endoflife.date while recording those fields as scheduled integration
              data.

            - @id:ar.integrations.jobs.currency-rates The system refreshes a shared daily currency-rate snapshot for
              currency rollups and retains the last successful snapshot when the provider is unavailable.

        - @id:ar.integrations.automation-rules Workspace administrators can define, edit, and delete workspace-scoped
          automation rules that match entity or typed-relation triggers (creation, deletion, or a field change; entity
          rules also support lifecycle transitions) and an optional set of field conditions, then run one or more
          configured actions — recording an audit note, sending an in-app notification, or setting a field value on the
          triggering subject. Conditions support equality, emptiness, and (for number, currency, and
          rating/derived-number
          fields) numeric comparison operators (greater than, greater than or equal, less than, less than or equal).
          Field
          conditions and
          field-targeting actions respect the rule author's current field-group access, and field references must remain
          available in the applicable entity or relation schema. Rules are matched synchronously on every entity
          mutation
          and rechecked before asynchronous actions execute, so access revocation, field reassignment, or removed fields
          cannot leave an existing rule with restricted or stale access. Rule definitions redact stored literals
          associated
          with restricted or unavailable field references for callers without field-group view access, while retaining
          field
          identifiers.
          Administrators can inspect recent rule runs, including failures, from workspace settings.

        - @id:ar.integrations.external-content @status:experimental Configured external content providers can be mounted
          and synchronized into supported workspace content workflows.

    - @id:ar.ai @status:experimental Users can use configured AI workflows to explore workspace information and extract
      structured records.

        - @id:ar.ai.assistant @status:experimental Users can hold workspace-scoped AI conversations and inspect
          persisted conversation history when AI is configured. Field values from access-restricted field groups
          are scrubbed from the assistant's entity search, preview, and detail results, and writes to a restricted
          field through the assistant are blocked, consistent with the equivalent REST/oRPC entity operations.

        - @id:ar.ai.entity-extraction @status:experimental Users can submit supported content to an AI extraction
          workflow, review parsed entities, and accept selected results.

        - @id:ar.ai.document-actions @status:experimental Users who can view a document can launch document type-defined
          interactive AI actions from the document sidebar, running a predefined prompt read-only against the document's
          body, metadata, type, and location, and can continue the temporary result in an AI conversation.

        - @id:ar.ai.metadata-generation @status:experimental Document type-defined AI metadata generators run
          automatically, read-only, a short time after an effective body or metadata change, producing one validated
          value per generator's target field; a generator's target field must be marked externally managed with kind AI.
          The previous value and generation details (explanation, findings, status, timestamp, source revision,
          generator version) stay visible but are marked outdated as soon as the document changes, and a further edit
          while generation is running discards its result and reschedules against the latest revision. A failed
          generation is retried once before its failure notice is retained. Successful values are written to document
          history under a dedicated AI system actor rather than the editing user, so they do not themselves trigger
          another generation run. Changing a generator's prompt or configuration marks existing results outdated without
          regenerating until the next document edit. Every such update, successful or failed, is recorded in the
          workspace audit log alongside the previous and new values.

        - @id:ar.ai.configuration Administrators can configure the AI provider and workspace-level AI settings.
