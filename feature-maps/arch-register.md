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
          user-switcher toolbar that instantly assumes the identity of any user in the database, bypassing login,
          for local testing only.

    - @id:ar.workspace Users can orient themselves in a workspace and administrators can configure its shared operating
      model.

        - @id:ar.workspace.home Users can use the workspace home to navigate to entities, projects, content, search,
          diagrams, and other primary work areas.

        - @id:ar.workspace.configuration Administrators can configure workspace lifecycle states, teams, roles, members,
          document types, templates, AI, analytics, audit, and other workspace settings.

            - @id:ar.workspace.configuration.schemas Administrators can define entity schemas, fields, select options,
              relationships, and schema-specific behavior.

            - @id:ar.workspace.configuration.document-types Administrators can define document types, templates,
            fields, versions, validation rules, and AI actions for structured content. Administrators can edit actions,
            select their read-only architecture tools, and test an unsaved action against an existing document of the
            same type without persistence.

        - @id:ar.workspace.lifecycle Workspaces can define lifecycle states, designate one as the deprecated state,
          and use them as part of entity and project review workflows.

        - @id:ar.workspace.analytics Administrators can inspect workspace-wide analytics and completeness-oriented
          views.

    - @id:ar.entities Users can maintain a structured catalog of architectural entities and their relationships.

        - @id:ar.entities.create-edit Users can create, view, edit, move, organize, and delete entities subject to their
          permissions.

        - @id:ar.entities.hierarchy Users can organize entities into hierarchical scopes and navigate from parents to
          descendants and related records.

        - @id:ar.entities.fields Users can view and edit standard and schema-defined fields, including owners,
          lifecycle, links, references, and custom values.

        - @id:ar.entities.relations Users can create and inspect relationships between entities and navigate related,
          dependent, and referenced records.

        - @id:ar.entities.content Users can attach and manage structured or Markdown-based content associated with an
          entity.

        - @id:ar.entities.history Users can inspect entity change history and work with snapshots or restoration flows
          where permitted.

        - @id:ar.entities.bulk-edit Users can select multiple entities and edit supported fields in bulk.

        - @id:ar.entities.templates Users can create entities from configured templates and use templates to standardize
          recurring entity structures.

    - @id:ar.entity-views Users can browse, filter, search, and analyze entity collections through configurable views.

        - @id:ar.entity-views.table Users can inspect entities in a tabular browser with configurable fields, sorting,
          filtering, selection, and bulk actions.

        - @id:ar.entity-views.cards Users can inspect entities as cards for quick scanning of record summaries.

        - @id:ar.entity-views.tree Users can inspect hierarchical entity structure in a tree-oriented view.

        - @id:ar.entity-views.graph Users can explore entity relationships and dependencies through a graph view.

        - @id:ar.entity-views.topology Users can inspect entity relationships and dependencies in a topology view.

        - @id:ar.entity-views.radar Users can compare entities in a radar-oriented view when the required data is
          available.

        - @id:ar.entity-views.timeline Users can inspect date-driven entity history and planned change context in a
          timeline view.

        - @id:ar.entity-views.matrix Users can inspect relationship density and coverage in a matrix view.

        - @id:ar.entity-views.bubble Users can plot entities across configurable dimensions such as X, Y, size, and
          colour in a bubble view.

        - @id:ar.entity-views.map Users can inspect containment hierarchies as a nested capability map, colouring
          boxes by a configurable metric rolled up from descendant entities (numeric fields, lifecycle state, or
          assessment fields), using dominant-option or worst aggregation. For enum-sourced metrics, "worst" ranks
          options by the admin-configured top-to-bottom order of the enum's options.

        - @id:ar.entity-views.explore Users can inspect entity data in a configurable side-by-side exploration view.

        - @id:ar.entity-views.saved-configuration Users can configure and reuse entity view fields, filters, sorting,
          display modes, and joined data such as assessment fields.

    - @id:ar.search Users can discover entities, projects, documents, and other workspace content without navigating
      each hierarchy manually.

        - @id:ar.search.workspace Users can search across the current workspace and navigate to matching records and
          content.

        - @id:ar.search.filters Users can combine search terms and structured filters to narrow results.

        - @id:ar.search.navigation Search results provide context and links into the relevant entity, project, document,
          or workspace surface.

    - @id:ar.projects Users can organize architecture work into projects containing files, content, diagrams,
      milestones, and assessments.

        - @id:ar.projects.lifecycle Users can create, edit, view, and delete projects and manage their project-level
          metadata.

        - @id:ar.projects.files Users can organize project files and folders, create content nodes, rename or relocate
          them, and manage supported file content.

        - @id:ar.projects.markdown Users can create and edit Markdown documents with links, backlinks, attachments,
          metadata, and revision history.

        - @id:ar.projects.revisions Users can inspect, create, restore, and validate revisions for supported project and
          workspace documents.

        - @id:ar.projects.milestones Users can manage project milestones with target dates and status, and associate
          planned entity changes with milestones.

        - @id:ar.projects.planned-changes Users can record proposed future changes to entities within the scope of a
          project without changing the current live entity state.

            - @id:ar.projects.planned-changes.schedule Users can target a planned entity change to a future date or
              associate it with a project milestone.

            - @id:ar.projects.planned-changes.timeline Users can inspect planned entity changes in project and
              entity-oriented timeline views alongside historical change information.

            - @id:ar.projects.planned-changes.apply Users can apply a planned entity change when it is ready, promoting
              the proposed state into the live entity.

        - @id:ar.projects.permissions Project content can be protected through the applicable workspace, project,
          entity, team, and role permissions.

    - @id:ar.assessments Users can collect structured review data for entities within a project.

        - @id:ar.assessments.definitions Users can create and edit assessment definitions with status, scope, filters,
          and required or optional fields.

        - @id:ar.assessments.responses Reviewers can fill in assessment responses for in-scope entities from an
          assessment grid or entity detail view.

        - @id:ar.assessments.progress Users can inspect assessment completion, status, summary, and aggregate results.

        - @id:ar.assessments.entity-views Users can join assessment data to entity views and use the assessment fields
          for filtering, sorting, and analysis.

        - @id:ar.assessments.export Users can export assessment results to CSV.

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
              where the integration is configured.

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

        - @id:ar.collaboration.notifications Users can inspect a single consolidated in-app notification feed
          covering entity-watch changes, comment activity, and governance action items, see an unread count badge,
          navigate to the related resource, and clear or mark notifications read. A governance action-item
          notification is cleared automatically once its underlying task is resolved, superseded, or cancelled,
          without requiring the user to open the notification.

            - @id:ar.collaboration.notifications.comment-activity Users receive in-app notifications when someone
              comments on an entity or content they own, or replies to their comment, subject to current access and
              excluding the person who posted the comment.

            - @id:ar.collaboration.notifications.delivery-preferences Users can choose, per notification type and
              per delivery channel, whether they receive that notification. In-app delivery is on by default for
              normal notification types and off by default for reminder types; email is available when configured by
              the deployment, while Slack and SMS are not yet deliverable. Preferences are scoped per user per
              workspace and only affect
              future notifications, not existing Inbox items.

        - @id:ar.collaboration.governance-inbox Users can find open governance tasks, review completed task history,
          filter work by task and due-date attributes, and navigate to governed cases.

            - @id:ar.collaboration.governance-inbox.my-submissions Users can review governance work they have
              submitted, see what or who is currently blocking it, and withdraw an open submission where permitted.

        - @id:ar.collaboration.entity-change-approval Workspace administrators can require approval for entity
          changes, while authorized users can submit immutable revisions, review before/after diffs, resubmit after
          requested changes, self-approve when they are the sole eligible approver, and record an audited approval
          bypass.

        - @id:ar.collaboration.entity-deprecation Workspace administrators can require deprecation proposals for
          entities on schemas that opt in, while authorized users can propose a deprecation with a target date,
          reason, successor entity, and related project, route it through approval, notify affected owner teams for
          acknowledgement, postpone or finalize on schedule, and cancel an in-flight deprecation; finalizing moves the
          entity to the workspace's designated deprecated lifecycle state.

        - @id:ar.collaboration.audit Authorized users can inspect audit activity for workspace and domain changes.

    - @id:ar.authorization Administrators can control who can access, modify, review, and administer workspace content.

        - @id:ar.authorization.global-roles Platform administrators can manage global roles and platform-level access.

        - @id:ar.authorization.workspace-roles Administrators can assign workspace roles such as owner, administrator,
          editor, reviewer, and viewer.

        - @id:ar.authorization.entity-grants Administrators can grant entity-level access with scopes such as the entity
          itself or its subtree.

        - @id:ar.authorization.teams Administrators can create teams, manage memberships, and use team assignments in
          authorization decisions.

        - @id:ar.authorization.visibility Workspaces and entities can use public or restricted visibility modes subject to
          the permission model.

    - @id:ar.import-export Users and administrators can move supported workspace, entity, project, and content data into
      and out of Arch Register.

        - @id:ar.import-export.workspace-export Authorized users can export selected or complete workspace data,
          including supported content and configuration.

        - @id:ar.import-export.workspace-import Authorized users can validate, preview, and execute supported workspace
          imports.

        - @id:ar.import-export.entity-csv Users can import and export entity collections through CSV workflows.

    - @id:ar.integrations Arch Register exposes integration surfaces for external clients, content sources, event
      delivery, and scheduled work.

        - @id:ar.integrations.api External clients can use the documented API contract and API tokens to access
          supported Arch Register operations.

        - @id:ar.integrations.mcp External AI or automation clients can use the MCP server’s supported discovery and
          mutation tools.

        - @id:ar.integrations.webhooks Administrators can configure webhooks and inspect supported delivery behavior for
          workspace events.

        - @id:ar.integrations.jobs Administrators can inspect scheduled jobs, job servers, run history, and supported
          cancellation operations.

        - @id:ar.integrations.external-content @status:experimental Configured external content providers can be mounted
          and synchronized into supported workspace content workflows.

    - @id:ar.ai @status:experimental Users can use configured AI workflows to explore workspace information and extract
      structured records.

        - @id:ar.ai.assistant @status:experimental Users can hold workspace-scoped AI conversations and inspect
          persisted conversation history when AI is configured.

        - @id:ar.ai.entity-extraction @status:experimental Users can submit supported content to an AI extraction
          workflow, review parsed entities, and accept selected results.

        - @id:ar.ai.document-actions @status:experimental Users who can view a document can launch document
          type-defined interactive AI actions from the document sidebar, running a predefined prompt read-only
          against the document's body, metadata, type, and location, and can continue the temporary result in an
          AI conversation.

        - @id:ar.ai.metadata-generation @status:experimental Document type-defined AI metadata generators run
          automatically, read-only, a short time after an effective body or metadata change, producing one
          validated value per generator's target field. The previous value and generation details (explanation,
          findings, status, timestamp, source revision, generator version) stay visible but are marked outdated
          as soon as the document changes, and a further edit while generation is running discards its result and
          reschedules against the latest revision. A failed generation is retried once before its failure notice
          is retained. Successful values are written to document history under a dedicated AI system actor rather
          than the editing user, so they do not themselves trigger another generation run. Changing a generator's
          prompt or configuration marks existing results outdated without regenerating until the next document
          edit.

        - @id:ar.ai.configuration Administrators can configure the AI provider and workspace-level AI settings.
