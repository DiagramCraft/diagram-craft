---
sidebar_position: 4
---

# Wiki pages

Arch Register wiki pages are the lightweight documentation layer for workspaces, projects, and entities.
Use them for notes that should live next to the thing they describe: runbooks, standards, ownership notes, rollout
checklists, or short design decisions.

## Where wiki pages live

Wiki pages appear in three places:

- **Workspace content** for shared documentation across the whole workspace.
- **Project content** for documentation that belongs to one project and its files.
- **Entity content** for notes attached to a specific entity.

All three use the same markdown editor and the same page layout. The difference is the parent scope and the
permissions that apply to that scope.

![Workspace wiki overview](/img/arch-register/wiki/workspace-overview.png)

![Project wiki page](/img/arch-register/wiki/project-page.png)

![Entity wiki page](/img/arch-register/wiki/entity-page.png)

## Creating and linking pages

Create a wiki page from the `New` menu in the workspace, project, or entity content view:

1. Open the relevant scope.
2. Select `New wiki page`.
3. Give the page a name.
4. Save the page and start editing the body.

Wiki pages are linked by route, so you can copy the page URL and share it directly with other users who have access
to the same scope.

Use folders when you want to group related pages:

- Workspace wiki pages can live under workspace content folders.
- Project wiki pages can live under project folders.
- Entity wiki pages can live under entity folders.

## Scope differences

| Scope | Best for | Access model |
| --- | --- | --- |
| Workspace | Shared operating notes, standards, and team-wide docs | Available in the workspace content area |
| Project | Project plans, runbooks, and meeting notes | Inherits project access and project file permissions |
| Entity | Notes that belong to one entity record | Available in the entity content area |

Project-scoped pages are the most controlled of the three because they follow the project permission model.
Workspace and entity pages are useful when the content should stay close to the workspace or entity without adding an
extra project boundary.

## Markdown support

Wiki pages use the markdown editor that Arch Register uses for other documents. You can write:

- headings, lists, links, quotes, code blocks, and tables
- inline formatting such as emphasis and strong text
- markdown images and standard links
- attachments uploaded to the page
- embedded entity cards and other MDX blocks for live references

Example entity card:

```md
<EntityCard id="entity-id" fields="owner,lifecycle,description" />
```

Attachments show up below the preview, and entity cards render live catalog data that opens the linked record when clicked.

![Markdown preview with embedded entity card](/img/arch-register/wiki/workspace-overview.png)

## Editing and history

Use `Edit` to switch into edit mode. In edit mode, you can choose between:

- **Edit** for the rich editor
- **Raw** for direct markdown
- **Preview** for a rendered preview before saving

The `Versions` menu shows the page history. From there you can inspect previous revisions, compare them, and restore
an older version if needed.

![Markdown history panel](/img/arch-register/wiki/history.png)

## Permissions and visibility

Wiki pages inherit the visibility of their parent scope:

- Workspace pages are visible to users who can access that workspace.
- Project pages require access to the project and follow the project file permission model.
- Entity pages are visible from the entity content area in the workspace.

In practice, that means project wiki pages are the best choice for team-specific material that should not live in the
workspace-wide content area.

## Practical patterns

- Put workspace standards, glossary pages, and operating procedures in workspace wiki pages.
- Keep project plans, decisions, and release notes in project wiki pages.
- Add entity-specific notes, ownership clarifications, and integration details to entity wiki pages.
- Use entity cards when a written explanation needs a live catalog reference.
- Use attachments when the page needs supporting files but not another diagram or full document.

## Related pages

- [Workspaces](workspaces)
- [Entities](entities)
- [Projects and diagrams](projects)
