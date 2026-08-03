# Arch Register Feature Map

- @id:ar Arch Register provides services to manage architecture entities, projects, documentation, and administrative
  capabilities.

    - @id:ar.access Arch Register provides authenticated, workspace-scoped access to architecture entities, projects,
      documentation, and administrative capabilities.

        - @id:ar.access.login Users can sign in through the configured local authentication flow and maintain an
          authenticated session.

        - @id:ar.access.account Users can manage account settings and personal API tokens.

        - @id:ar.access.oidc @status:experimental Deployments can expose OIDC-based authentication flows when
          configured.

        - @id:ar.access.workspaces Users can enter a workspace and work within the workspace’s data, projects,
          permissions, and settings boundary.

        - @id:ar.access.dev-switcher @status:experimental Development-mode deployments can optionally expose a
          user-switcher toolbar that instantly assumes the identity of any user in the database, bypassing login, for
          local testing only.

    - @id:ar.workspace Users can orient themselves in a workspace and administrators can configure its shared operating
      model.

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
          Every widget shows a title bar (an icon and a title, separated from the widget's content by a divider); the
          stat-metric widget's title is configurable (via its label setting), while other widget types show a fixed
          title naming the widget type. In edit mode, the per-widget edit and remove controls appear within the title
          bar rather than overlapping the content.

        - @id:ar.workspace.home.personal-dashboards Any workspace member can optionally create one or more personal
          dashboards for themselves, separate from the shared workspace dashboard(s). Personal dashboards are listed
          in a "My Dashboards" section of the home sidebar, shown only when the user has at least one, and are
          created via the "New personal dashboard" item in the sidebar's "+" menu. Owners can freely rename or
          delete their own personal dashboards, including deleting the last one, and no workspace capability beyond
          membership is required. A personal dashboard is always fully editable by its owner (add, remove, resize,
          and reposition widgets from the same widget catalog as the shared dashboard) — there is no read-only mode.

        - @id:ar.workspace.templates Administrators can create a workspace from a built-in architecture template,
          including its entity schemas, select-option enums, and document types and associated templates.

        - @id:ar.workspace.configuration Administrators can configure workspace lifecycle states, teams, roles, members,
          document types, templates, AI, analytics, audit, and other workspace settings.

            - @id:ar.workspace.configuration.schemas Administrators can define entity schemas, fields, select options,
            reusable shared fieldgroups, relationships, and schema-specific behavior, including read-only derived fields
            calculated from sibling
            fields using a sandboxed expression and a declared text, number, select, boolean, or rating result type,
            and externally managed fields (by AI, an integration, or an internal automation) with a refresh mode of
            on-change or scheduled. Derived values are materialized when inputs or definitions change, and are excluded
            from required-field completeness. Fields can be organized into named, presentation-only groups (with an
            optional description) that render as labeled sections wherever fields appear as a form or list; this has no
            effect on validation, required-ness, or completeness. A group — a schema-local group, or a schema's
            inclusion of a reusable shared fieldgroup — can optionally be assigned one or more teams to scope its
            access: a team's reviewer role (or above) grants view, and editor role (or above) grants edit.
            Administrators can similarly define relation types (name, description, "in"/"out" endpoint constraints
            naming the allowed entity schemas at each end, fields, groups, and field-group access control) from a
            dedicated relation-types admin screen alongside entity types, enums, and shared fieldgroups; relation
            types support the same field-group access control, shared-fieldgroup inclusion, field migrations, and
            version history as entity schemas, but only text, long text, boolean, date, number, and select field
            types (no reference, containment, or derived fields, and no templates or approval/deprecation policy).

            - @id:ar.workspace.configuration.document-types Administrators can define document types, templates, fields,
              versions, validation rules, and AI actions for structured content, including marking a field as externally
              managed (by AI, an integration, or an internal automation) with a refresh mode of on-change or scheduled.
              Administrators can edit actions, select their read-only architecture tools, and test an unsaved action
              against an existing document of the same type without persistence.

        - @id:ar.workspace.lifecycle Workspaces can define lifecycle states, designate one as the deprecated state, and
          use them as part of entity and project review workflows.

        - @id:ar.workspace.analytics Administrators can inspect workspace-wide analytics and completeness-oriented
          views.

    - @id:ar.entities Users can maintain a structured catalog of architectural entities and their relationships.

        - @id:ar.entities.create-edit Users can create, view, edit, move, organize, and delete entities subject to their
          permissions.

        - @id:ar.entities.hierarchy Users can organize entities into hierarchical scopes and navigate from parents to
          descendants and related records.

        - @id:ar.entities.fields Users can view and edit standard and schema-defined fields, including owners,
          lifecycle, links, references, typed relations, and custom values. A schema field marked as externally
          managed (by AI, an integration, or an internal automation) is read-only to users; its current value stays
          visible alongside the latest update's source, timestamp, status, and any explanation or findings. A user
          edit to any other field on the entity marks that entity's external field results outdated. Fields belonging
          to a schema group render under a labeled section in the entity's Properties panel, with ungrouped fields
          shown first.

        - @id:ar.entities.relations Users can create and inspect relationships between entities and navigate related,
          dependent, and referenced records. Alongside generic reference/containment relations, workspace admins can
          define typed relation schemas with mandatory "in"/"out" endpoints (each constrained to a set of allowed
          entity schemas) and their own configurable fields, field groups, and access control; relation instances are
          first-class, independently addressable, audited records rather than entity-data values. A typed relation
          schema is surfaced on an entity by adding a "typed relation" field to that entity's schema, bound to a
          relation schema and a direction ("in" or "out"); like any other field, it can be placed in a named field
          group and is subject to that group's access control on top of the target relation schema's own field-group
          access control (a user needs edit access under both to change it). The field renders inline among the
          entity's other Properties, listing the relation instances the entity participates in with each row showing
          the connected entity and key field values (subject to field-group redaction) and linking to that entity.
          While editing the entity, users can add, edit, and remove relation instances directly inline — adding
          picks another entity from schemas the relation type allows and fills in the relation's own fields (subject
          to field-group access control); these changes are saved together with the rest of the entity's edits in one
          atomic update. Each existing instance can also be expanded inline to edit its fields, or opened in a detail
          dialog showing its audit trail of create/update/delete events. Versioning and change-approval specifically
          for relation instances are not yet supported; when an entity's changes go through change-approval,
          in-progress relation edits are not yet guaranteed to carry through the proposal/approval workflow. The
          entity detail screen's Relations tab and Topology view also surface typed relation instances (grouped by
          relation schema in Topology, using the schema's own color), each expandable in place to view field values
          and open the same audit-trail history dialog.

        - @id:ar.entities.content Users can attach and manage structured or Markdown-based content associated with an
          entity.

        - @id:ar.entities.history Users can inspect immutable entity versions, compare actual historical state, and
          restore earlier versions where permitted. Field values from access-restricted field groups are scrubbed
          from a version's recorded state for viewers without view access to that group, mirroring the redaction
          applied when viewing the entity directly.

        - @id:ar.entities.bulk-edit Users can select multiple entities and edit supported fields in bulk. Entities that
          require an approved change proposal are bundled into a single multi-entity proposal case routed through
          governance instead of being skipped.

        - @id:ar.entities.templates Users can create entities from configured templates and use templates to standardize
          recurring entity structures.

    - @id:ar.entity-views Users can browse, filter, search, and analyze entity collections through configurable views,
      including free-text search across entity names, slugs, and descriptions.

        - @id:ar.entity-views.table Users can inspect entities in a tabular browser with configurable fields, sorting,
          filtering, selection, and bulk actions.

        - @id:ar.entity-views.cards Users can inspect entities as cards for quick scanning of record summaries.

        - @id:ar.entity-views.tree Users can inspect hierarchical entity structure in a tree-oriented view.

        - @id:ar.entity-views.graph Users can explore entity relationships and dependencies through a graph view,
          including typed relationship instances alongside generic reference/containment relations, each rendered
          with its relation schema's color; clicking a typed relation edge opens a popup with its field values,
          links to both endpoint entities, and access to its audit history.

        - @id:ar.entity-views.topology Users can inspect entity relationships and dependencies in a topology view,
          including a dedicated section grouping typed relation instances by relation schema alongside the
          containment/reference sections; clicking a typed relation opens the same detail popup used in the graph
          view.

        - @id:ar.entity-views.radar Users can compare entities in a radar-oriented view when the required data is
          available.

        - @id:ar.entity-views.timeline Users can inspect date-driven entity history and planned change context in a
          condensed Entity + Project timeline, grouping rows by owner, type, or containment parent, with configurable
          project lanes, milestone guides, and autosave snapshot visibility. When grouped by Project + Entity, a
          project with both a start and target date set shows a gantt bar spanning that range in its group header.

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

        - @id:ar.entity-views.bubble Users can plot entities across configurable dimensions such as X, Y, size, and
          colour in a bubble view, with optional equally split axes and named quadrant labels persisted in saved views
          and wiki embeds.

        - @id:ar.entity-views.map Users can inspect containment hierarchies as a nested capability map, colouring boxes
          by a configurable metric rolled up from descendant entities (numeric fields, lifecycle state, or assessment
          fields), using dominant-option or worst aggregation. For enum-sourced metrics, "worst" ranks options by the
          admin-configured top-to-bottom order of the enum's options. A metric source in an access-restricted field
          group evaluates as unavailable (no value, distribution, or dominant option) for viewers without view access
          to that group, rather than exposing the underlying data; the field picker also excludes such fields when
          configuring the metric.

        - @id:ar.entity-views.explore Users can inspect entity data in a configurable side-by-side exploration view,
          toggling which relation fields draw connections; typed relation instances are included by default
          alongside generic reference relations and their toggle is marked with the relation schema's colour/icon.

        - @id:ar.entity-views.saved-configuration Users can configure and reuse entity view fields, filters, sorting,
          display modes, and joined data such as assessment fields. Saved views may also use relationship-aware
          structured queries with projected fields.

        - @id:ar.entity-views.technology-lifecycle Users can use saved table, radar, and timeline views to review
          technology release lifecycles, radar governance status, and end-of-life planning dates.

    - @id:ar.search Users can discover entities, projects, documents, and other workspace content without navigating
      each hierarchy manually.

        - @id:ar.search.workspace Users can search across the current workspace and navigate to matching records and
          content.

        - @id:ar.search.filters Users can combine search terms and structured filters to narrow results. Entity
          browser views offer Basic (free-text search plus a visual filter popover) and Advanced (a single text
          query parsed against the entity query language) modes, switchable without losing the underlying query;
          switching from Advanced to Basic warns first if the query uses grouping, negation, or relation traversal
          that Basic mode can't represent. A field in a schema group the user cannot view is offered nowhere as a
          filter/sort option and is treated as unrecognized if referenced directly in an Advanced-mode query,
          matching how the field is hidden elsewhere.

        - @id:ar.search.navigation Search results provide context and links into the relevant entity, project, document,
          or workspace surface.

    - @id:ar.projects Users can organize architecture work into projects containing files, content, diagrams,
      milestones, and assessments.

        - @id:ar.projects.lifecycle Users can create, edit, view, and delete projects and manage their project-level
          metadata, including optional start and target dates shown on the project home screen.

        - @id:ar.projects.dashboard The project home screen shows a composable dashboard of widgets scoped to that
          project, built from the same widget catalog as the workspace dashboard (stat metrics, saved-view embeds,
          entity tables, entity cards, entity graphs, entity changelogs, document browsers, entity browsers, diagram
          previews, project wiki-page embeds, configurable Markdown content, and two project-only widgets — active assessments and upcoming milestones — plus a
          project-relevant subset of the general catalog; workspace-wide analytics widgets such as lifecycle and
          activity-trend charts, stale-entity reports, and the activity feed are not available at project scope). The
          active-assessments widget lists up to four open assessments for the project; the upcoming-milestones widget
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
          diff looking empty.

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
          derived fields can calculate typed values from sibling responses and are excluded from response
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

            - @id:ar.content.diagrams.entity-graphs Users can generate or inspect diagrams derived from entity
              relationships and graph data.

            - @id:ar.content.diagrams.editing Users can open associated diagrams in the Diagram Craft editing experience
              where the integration is configured. Entity data and field values exposed to Diagram Craft through this
              integration are scrubbed of access-restricted field groups per viewer, mirroring the redaction applied
              when viewing the entity directly.

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
              (entity change proposals, entity deprecations, assessment responses), still-open assignees automatically
              receive reminders as the deadline approaches and again once it has passed, on a per-case-kind cadence.
              Reminders respect each user's notification delivery preferences and are not re-sent once a given
              reminder has already fired for a case. The inbox highlights an overdue deadline.

              - @id:ar.collaboration.governance-inbox.scheduled-reminders.workspace-config Workspace administrators
                can configure, per governance case kind, whether scheduled reminders are enabled and how many days
                before/after the deadline each reminder fires, overriding the case kind's built-in default.

            - @id:ar.collaboration.governance-inbox.escalation For the same governance case kinds as scheduled
              reminders, a case left open past a case-kind-defined number of days overdue is automatically escalated
              once: notifying, in addition to the original assignees, the admins of the project team that owns the
              case's subject (or, for a workspace-scoped case, workspace admins) so someone beyond the original
              assignees can intervene. Escalation fires at most once per case and is recorded in the case's activity
              history with the resolved escalation target. The inbox marks an escalated case with a distinct badge.
              Workspace administrators can turn escalation on or off per case kind alongside the reminder
              configuration in @id:ar.collaboration.governance-inbox.scheduled-reminders.workspace-config, but cannot
              change the escalation target or threshold in this version.

        - @id:ar.collaboration.entity-change-approval Workspace administrators can require approval for entity change
          cases, while authorized users can submit immutable coordinated revisions with an optional due date, review
          before/after diffs across all affected entities, resubmit after requested changes, and record an audited
          approval bypass. This covers both a single entity's propose-a-change flow and a bulk-edit-originated
          proposal bundling several entities into one case, the latter routed through governance without a resubmit
          path. Field values from access-restricted field groups are scrubbed from a proposal's base/proposed state
          and diffs for viewers without view access to that group, mirroring the redaction applied when viewing the
          entity directly.

        - @id:ar.collaboration.entity-deprecation Workspace administrators can require deprecation proposals for
          entities on schemas that opt in, while authorized users can propose a deprecation with a target date, reason,
          successor entity, and related project, route it through approval, notify affected owner teams for
          acknowledgement, postpone or finalize on schedule, and cancel an in-flight deprecation; finalizing moves the
          entity to the workspace's designated deprecated lifecycle state.

        - @id:ar.collaboration.audit Authorized users can inspect audit activity for workspace and domain changes.
          Field values from access-restricted field groups are scrubbed from an entry's recorded changes for viewers
          without view access to that group, mirroring the same redaction applied when viewing the entity directly.

    - @id:ar.authorization Administrators can control who can access, modify, review, and administer workspace content.

        - @id:ar.authorization.global-roles Platform administrators can manage global roles and platform-level access.

        - @id:ar.authorization.workspace-roles Administrators can assign workspace roles such as owner, administrator,
          editor, reviewer, and viewer.

        - @id:ar.authorization.entity-grants Administrators can grant targeted entity-level edit, contribution, or
          administration access (not view — that comes from workspace content access, team ownership, or these
          grants' own edit-capable roles) with scopes such as the entity itself or its subtree.

        - @id:ar.authorization.teams Administrators can create teams, manage memberships, and use team assignments in
          authorization decisions.

        - @id:ar.authorization.project-scope Entities can be scoped to a single project, which excludes them from
          global listings and search while keeping them visible within that project's context.

    - @id:ar.import-export Users and administrators can move supported workspace, entity, project, and content data into
      and out of Arch Register.

        - @id:ar.import-export.workspace-export Authorized users can export selected or complete workspace data,
          including supported content and configuration. Exported entity data is scrubbed of access-restricted
          field groups per exporting user, mirroring the redaction applied when viewing entities directly.

        - @id:ar.import-export.workspace-import Authorized users can validate, preview, and execute supported workspace
          imports. Schema groups, field-group access controls, reusable shared fieldgroups, and their links are
          preserved with remapped references; imports reject restricted values the importing caller cannot edit.

        - @id:ar.import-export.workspace-replication Workspace copies preserve schema field groups, shared fieldgroup
          links, and field-group access-control semantics while remapping workspace-local identifiers.

        - @id:ar.import-export.definition-import Workspace administrators can preview and atomically import selected
          schemas, reusable enums, and active document types from built-in templates or another administered workspace,
          including recursively resolved dependencies and remapped references.

        - @id:ar.import-export.entity-csv Users can import and export entity collections through CSV workflows.
          Columns for fields in access-restricted field groups are omitted from exported CSVs and import templates
          for viewers without view access to that group, mirroring the redaction applied elsewhere. Field values
          from access-restricted field groups are scrubbed from import previews, and CSV updates cannot write or
          clear fields in field groups the importer lacks edit access to.

    - @id:ar.integrations Arch Register exposes integration surfaces for external clients, content sources, event
      delivery, and scheduled work.

        - @id:ar.integrations.api External clients can use the documented API contract and API tokens to access
          supported Arch Register operations. Administrators can create workspace-scoped API tokens backed by a
          system user, restricted to a chosen subset of role capabilities, with an optional expiry date, in addition
          to the personal API tokens available from account settings.

        - @id:ar.integrations.entity-sync External integrations holding the external-update capability can
          idempotently create or update an entity by a durable (source, external key) identity, distinct from the
          entity's internal id, so repeated submissions from a catalog importer converge on the same entity instead
          of creating duplicates.

        - @id:ar.integrations.mcp External AI or automation clients can use the MCP server’s supported discovery and
          mutation tools.

        - @id:ar.integrations.webhooks Administrators can configure webhooks and inspect supported delivery behavior for
          workspace events.

        - @id:ar.integrations.jobs Administrators can create and configure supported recurring jobs, inspect scheduled
          jobs, job servers, run history, and supported cancellation operations.

            - @id:ar.integrations.jobs.standard_jobs Administrators can configure a Technology End of Life job to
              hydrate mapped schema fields from endoflife.date while recording those fields as scheduled integration
              data.

        - @id:ar.integrations.automation-rules Workspace administrators can define, edit, and delete workspace-scoped
          automation rules that match an entity trigger (creation, deletion, a field change, or a lifecycle transition)
          and an optional set of field conditions, then run one or more configured actions — recording an audit note,
          sending an in-app notification, or setting a field value on the triggering entity. Field conditions and
          field-targeting actions respect the rule author's current field-group access. Rules are matched synchronously on
          every entity mutation and rechecked before asynchronous actions execute, so access revocation or field reassignment
          cannot leave an existing rule with restricted access. Administrators can inspect recent rule runs, including failures,
          from workspace settings.

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
