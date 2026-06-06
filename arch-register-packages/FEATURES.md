# Arch-Register Features

## Entity Catalog

**Entity management.** The catalog is the core of arch-register. Entities represent any architectural concept — services, applications, platforms, teams, databases, and so on. Each entity has a name, description, lifecycle state, and owner, plus any custom fields defined by its schema. Entities can be created, edited, cloned, and deleted, with all changes captured in the audit log.

**Custom entity schemas.** Administrators define entity types through schemas, each with a name, icon, color, and a set of typed fields. Supported field types are Text, Long Text, Boolean, Date, Select (with configurable options), Reference (link to another entity), and Containment (parent–child hierarchy). Each field can have cardinality constraints and a default owner.

**Lifecycle states.** Each workspace defines its own lifecycle states (e.g. Proposed, Experimental, Production, Deprecated) with labels and colors. Any entity can be assigned a lifecycle state, enabling filtering and governance workflows around where each system sits in its maturity curve.

**Ownership.** Entities can be assigned to a team as their owner. Ownership drives access control, governs who is responsible for keeping catalog data accurate, and is used as a filter dimension in the browser.

**Relations.** Entities are connected through Reference and Containment fields. Reference fields capture directional relationships (e.g. "depends on", "integrates with"), while Containment fields model hierarchies (e.g. a domain containing services). Both incoming and outgoing relations are visible on the entity detail page.

---

## Browsing and Discovery

**Entity browser.** The main catalog view supports three rendering modes: a Table view for dense data comparison, a Cards view for visual scanning, and a Tree view that traverses containment hierarchies. All three modes share the same filter state.

**Filtering and facets.** Entities can be filtered by schema type, lifecycle state, and owner team. Facet counts (the number of entities per value) are shown alongside each filter option, updating as filters are applied.

**Global search.** A workspace-wide search covers entities, projects, diagram files, and schemas simultaneously. Results are returned with match highlighting and categorised by type, allowing quick navigation to any artifact in the workspace.

**CSV export.** The current filtered entity set can be exported as a CSV file, with columns for name, schema type, lifecycle, owner, and all custom field values.

---

## Diagrams

**Embedded diagram editor.** Each workspace contains projects that hold diagram files. Diagrams are edited in a full diagram-craft canvas embedded directly in arch-register, supporting shapes, connectors, text, and styling. Multiple stencil libraries are available including C4, ArchiMate, BPMN, and UML.

**Projects and folders.** Diagrams are organised into projects, which can contain nested folders of files. Projects have a name, description, owner, color, and a status of pinned, active, or archived.

**Templates.** New diagrams can be created from workspace-level or project-level templates, providing a starting structure for common diagram types.

**Real-time collaboration.** Multiple users can edit the same diagram simultaneously. Changes are synchronised in real time using Yjs and WebSockets, with automatic persistence.

---

## AI Assistant

**AI chat.** Each workspace has an AI assistant that answers questions about the architecture using the live catalog as context. The assistant is aware of entity schemas, lifecycle states, and team structure, and can look up specific entities or summarise the workspace. Conversations are stored and can be resumed.

**Entity extraction.** A dedicated extraction screen accepts free-form text (e.g. a design document, meeting notes, or a README) and uses AI to identify architectural entities within it. The user reviews the proposed entities before any are added to the catalog.

**AI-driven mutations.** The assistant can propose catalog changes (create or update entities) via tool calls, which are presented to the user for approval before being applied. This keeps the AI in an advisory role rather than making unreviewed edits.

**Provider configuration.** Workspace administrators can configure the AI provider (OpenRouter or OpenAI), model, system prompt, and temperature. This allows teams to use their own API keys and tune the assistant's behaviour.

---

## Access Control

**Role-based permissions.** Access is controlled at three levels: global roles (platform-wide admin), workspace roles (owner, admin, editor, reviewer, viewer), and entity-level grants. Workspace roles are fully customisable — administrators can define new roles with specific capability combinations.

**Capabilities.** Permissions are modelled as discrete capabilities (e.g. `ent.edit`, `schema.publish`, `people.invite`) that are bundled into roles. This makes it possible to create roles such as a "Schema Editor" who can publish schema changes but cannot manage members.

**Teams.** Users are organised into teams. Teams can be assigned as entity owners, and team membership determines which entities a user can access under restricted visibility settings. Each team has its own roles (admin, editor, reviewer).

**Entity-level grants.** Sensitive entities can have explicit grants that extend or restrict access beyond the workspace role, either for the entity alone or for its entire containment subtree.

---

## Governance and Audit

**Audit log.** Every create, update, and delete operation on entities, schemas, projects, and workspace settings is recorded with the user, timestamp, and a before/after diff of the changed fields. The audit log is queryable and visible to workspace administrators.

**Workspace configuration.** Administrators manage lifecycle states, custom roles, team structure, member access, and AI settings through a dedicated settings area. Global administrators have an additional settings screen for platform-wide configuration.

---

## Authentication

**Local authentication.** Users can sign in with a username and password. Passwords are hashed with Argon2. Account management is available through a personal account settings page.

**OIDC integration.** Arch-register supports OpenID Connect for single sign-on with an external identity provider. User accounts are provisioned automatically on first login via OIDC.
