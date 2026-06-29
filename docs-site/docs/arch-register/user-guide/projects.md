# Projects and diagrams

Projects group diagrams, files, and wiki pages inside a workspace.
They are separate from entities and schemas, but they can reference both when a diagram needs architectural context.

## What a project contains

- Folders for organizing related content.
- Diagrams for architecture views and workflows.
- Files such as attachments and supporting documents.
- Templates that can be reused when creating new diagrams.
- Real-time collaboration for shared editing.

## Project browser

Use the project browser to review project metadata, navigate into folders, and open content.

![Project browser overview](/img/arch-register/projects/list.png)

![Project detail view](/img/arch-register/projects/auth-migration-detail.png)

## Creating diagrams

1. Open a project.
2. Select `New` and then `New diagram`.
3. Leave `Blank canvas` selected to start from an empty diagram.
4. Enter a diagram name.
5. Select `Create diagram`.
6. Open the new diagram card to launch the editor.

Use the same dialog to create diagrams from templates when a project template or workspace template is available.

![New diagram dialog](/img/arch-register/projects/add-diagram-dialog.png)

## Diagram editor

The editor is where you add shapes, connectors, notes, and layout.
Arch Register handles project context, saving, and collaboration around the editor.
For canvas behavior, shortcuts, and advanced editor features, see the [Diagram Craft docs](/docs/diagram-craft/intro).

![Blank diagram editor](/img/arch-register/projects/diagram-editor.png)

## Templates

Templates help standardize recurring diagram types.
Project templates are available inside the current project.
Workspace templates are available wherever the template rules allow them.

You can promote a diagram to a template from its card menu, then create future diagrams from that starting point.

![Template selection in new diagram dialog](/img/arch-register/projects/template-dialog.png)

## Collaboration

When multiple users open the same diagram, Arch Register connects them to the same collaborative session.
The presence toolbar shows who is currently in the file, and edits sync in real time.

## Common workflows

- Create a blank diagram for a new initiative, then refine it in the editor.
- Turn a finished diagram into a project template so future work starts from the same baseline.
- Keep related diagrams in folders to make large projects easier to scan.
- Open the same diagram with a teammate to review changes together.

If you want to document the project itself, use [wiki pages](wiki) inside the project instead of keeping notes in a
separate tool.

## Related pages

- [Core concepts](../getting-started/core-concepts)
- [Diagram Craft docs](/docs/diagram-craft/intro)
- [Wiki pages](wiki)
