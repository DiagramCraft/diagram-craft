# Entities

Entities are records created from schemas.
They carry the schema fields plus workspace metadata like name, owner, lifecycle, tags, links, and target lifecycle.

## Create an entity

Use **Entities** when you want to add a new record to the catalog.

1. Open **Entities**.
2. Select **New entity**.
3. Pick the schema.
4. Enter a name.
5. Fill in the required fields.
6. Save the entity.

The new record opens in its detail view after creation.

![Create entity dialog](/img/arch-register/entities/create-dialog.png)

## Edit an entity

Open an entity from the browser, then select **Edit**.
The detail screen switches into inline edit mode for the built-in metadata and schema fields.

When you save, you can add an optional note and mark the change as a significant version.

![Entity detail overview](/img/arch-register/entities/detail-overview.png)

![Entity edit state](/img/arch-register/entities/detail-edit.png)

## Schema-driven fields

Schemas define which fields an entity has.
Arch Register supports:

- Text
- Long text
- Boolean
- Date
- Select
- Reference
- Containment

Reference fields point to other entities.
Containment fields define a parent-child hierarchy and are what the tree view follows.
Schemas can also set minimum and maximum counts, so a field can be required or limited to a single related entity.

## Browser views

The entity browser keeps the same filters across all views.
Use the view switcher when you want a different way to scan the same data.

![Entity browser table view](/img/arch-register/entities/browser-overview.png)

Table view is the default.
It is the best choice when you need to compare owner, lifecycle, and field values side by side.

![Entity browser cards view](/img/arch-register/entities/browser-cards.png)

Cards view is better for quick visual scanning.
It keeps the same filter state but gives each entity a more compact summary.

![Entity browser tree view](/img/arch-register/entities/browser-tree.png)

Tree view follows containment relationships.
Use it when you want to check domain or system structure.

The browser also supports search, filter facets, saved views, CSV export, and import from the actions menu.

## Ownership and lifecycle

Every entity can have an owner team and a lifecycle state.

- Owner identifies the team responsible for the record.
- Lifecycle shows where the entity is in its maturity path.
- Target lifecycle and target date help track planned transitions.

Set owner and lifecycle early.
That keeps the browser filterable and makes the catalog easier to govern.

## Relations

Reference fields model directional relationships such as depends on, provides, or consumes.
Containment fields model hierarchy such as a system containing components.

On the detail page:

- The Overview tab shows the entity metadata and schema fields.
- The Topology tab groups incoming and outgoing reference and containment links.
- The Relations tab lists each linked entity explicitly.
- The Graph tab expands the neighborhood around the current entity.

Use reference fields when the relationship is cross-cutting.
Use containment fields when one entity is the parent of another.

## Workflow examples

Create a new API:

1. Open **Entities** and create an entity from the **API** schema.
2. Assign the owner team and lifecycle.
3. Set the API type field.
4. Link it to the correct system through the containment field.

Model a service dependency:

1. Open the service entity.
2. Add a reference field such as **Depends On**.
3. Select the downstream component or API.
4. Check the **Relations** tab to confirm the incoming and outgoing links look right.

Organize a domain hierarchy:

1. Create or edit the parent entity first.
2. Add the child entity through the containment field.
3. Switch to **Tree** view to verify the hierarchy reads the way you expect.

## Best practices

- Define the schema before you start entering records.
- Keep names stable and singular.
- Use owner and lifecycle on every important entity.
- Prefer containment only when the child really has one parent.
- Use table view for audits, cards for scanning, and tree view for hierarchy checks.
- Save filtered views you use often instead of rebuilding the same slice each time.

## Related pages

- [Create your first entity](../getting-started/first-entity)
- [Core concepts](../getting-started/core-concepts)
- [Workspaces](workspaces)
