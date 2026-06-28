# Arch Register Administration Guide

Arch Register administration is workspace-scoped. The settings screens let you manage the parts of a workspace that affect structure, access, and operational hygiene:

- lifecycle states
- schemas and enums
- owner teams and workspace members
- workspace roles and permissions
- AI provider configuration
- audit visibility

If a section is missing from the sidebar, your current role does not expose that capability in the workspace.

## Workspace configuration

The main entry point is the workspace settings screen.

![Workspace settings overview](/img/arch-register/settings/general.png)

Use the settings sidebar to move between the workspace areas you can manage:

- `General` for workspace identity
- `Lifecycle` for lifecycle states
- `Schemas` for entity types and enums
- `Teams` for owner teams and team-role assignments
- `Members` for workspace membership roles
- `Roles & permissions` for workspace roles
- `AI` for model and provider settings
- `Audit log` for change history

The workspace settings screen does not mix governance with content editing. Lifecycle, teams, roles, and AI are configuration concerns; entity and project content stays in the catalog screens.

## Lifecycle states

Lifecycle states define the allowed maturity labels for entities in a workspace.

Use them to keep the catalog consistent:

- keep the list short and business-specific
- prefer stable labels over process jargon
- update them when the workspace's review process changes

Lifecycle configuration is separate from access control. It shapes how records are classified and filtered, but it does not grant permissions by itself.

## Schemas

Schemas define the entity types, fields, and relationships in the workspace.

![Schema management](/img/arch-register/settings/schema-management.png)

Use `Settings > Schemas` to:

- add or rename entity types
- define text, long text, boolean, date, select, reference, and containment fields
- connect entity types with references and containment
- manage enums used by select fields

Containment fields are the ones that drive parent-child hierarchy. Reference fields model cross-cutting relationships.

## Teams and users

Teams are the ownership boundary for entities and projects.

![Teams management](/img/arch-register/settings/teams.png)

Use `Settings > Teams` to:

- create and rename owner teams
- assign team members
- set the role each user has in that team
- keep ownership aligned with the people who actually maintain the content

Team roles are not the same as workspace membership roles:

- team roles control access to content owned by that team
- workspace roles control what a user can do across the workspace

Use `Settings > Members` for the workspace-wide role assignment and `Settings > Teams` for ownership and team-role assignment.

## Access control

Workspace access is split across workspace roles, team roles, and global permissions.

![Roles and permissions](/img/arch-register/settings/roles-permissions.png)

Use `Settings > Roles & permissions` to review the built-in workspace roles and create custom roles when the defaults are too broad or too narrow.

Current built-in roles are:

- `Owner`
- `Admin`
- `Editor`
- `Reviewer`
- `Viewer`

The permission matrix groups capabilities into:

- Workspace
- People
- Content
- Schema

The most important workspace capabilities for administration are:

- `ws.settings` for workspace settings
- `ws.audit` for the audit log
- `people.role` for changing member roles
- `people.teams` for creating and editing teams
- `schema.edit` for model management

Keep these concerns separate:

- workspace roles govern the workspace shell and admin surfaces
- team roles govern owned entities and projects
- lifecycle states classify records
- schema fields define record shape

## AI provider setup

The AI screen controls the workspace assistant configuration.

![AI settings](/img/arch-register/settings/ai-settings.png)

Use `Settings > AI` to configure:

- whether AI features are enabled for the workspace
- the provider
- the API key
- the model
- temperature
- the optional system prompt

The current UI exposes both OpenRouter and OpenAI-compatible provider settings. If you switch provider, make sure the selected model and base URL match the provider you actually want to use.

The system prompt is appended to every AI conversation, while schema context is injected automatically.

## Audit log

Use `Settings > Audit log` when you need to verify what changed, who changed it, and when.

Audit visibility is permission-gated. In the current permission model, `ws.audit` controls access to the audit log.

This is the right place to check:

- workspace setting changes
- schema updates
- team changes
- content mutations that need review or incident follow-up

Audit data is most useful when you treat it as a control surface, not a reporting dashboard. It helps you confirm operational changes after the fact.

## Security best practices

- Give workspace admin access to the smallest number of people possible.
- Use workspace roles for broad access and team roles for ownership-specific access.
- Review team assignments whenever ownership changes.
- Keep lifecycle states descriptive, but do not use them as a substitute for permissions.
- Rotate AI API keys through workspace settings instead of sharing them informally.
- Check the audit log after sensitive configuration changes.
- Prefer restricted access patterns for content that should not be broadly visible.

## Related pages

- [Workspaces](user-guide/workspaces)
- [Entities](user-guide/entities)
- [Projects](user-guide/projects)
