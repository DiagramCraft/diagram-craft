# Diagram Craft Feature Map

- @id:dc.editor
  Diagram Craft is an interactive editor for creating, arranging, styling, and sharing technical and visual diagrams.

  - @id:dc.editor.canvas
    Users can pan and zoom across a large canvas, frame the document, and work at different levels of detail.

  - @id:dc.editor.elements
    Users can create, select, move, resize, rotate, duplicate, delete, and restack diagram elements.

    - @id:dc.editor.elements.shapes
      Users can insert general-purpose shapes and specialized stencil elements into a diagram.

    - @id:dc.editor.elements.connectors
      Users can draw connectors between elements, configure their line and arrow styles, and edit their waypoints.

    - @id:dc.editor.elements.text
      Users can add and edit text, labels, and text attached to diagram elements or connectors.

    - @id:dc.editor.elements.images
      Users can insert images into diagrams and position them alongside other elements.

    - @id:dc.editor.elements.tables
      Users can insert and edit tables, rows, and cells as diagram elements.

    - @id:dc.editor.elements.actions
      Users can attach labeled actions to shapes, including actions that open a URL, navigate to another diagram, or
      toggle a layer.

  - @id:dc.editor.selection
    Users can select single or multiple elements, grow or shrink a selection, and manipulate the selection as a unit.

    - @id:dc.editor.selection.rotate
      Users can rotate a selection around its center, with angle snapping available during rotation.

    - @id:dc.editor.selection.constrained-resize
      Users can constrain resizing to preserve the selection’s aspect ratio.

    - @id:dc.editor.selection.constrained-move
      Users can constrain movement to a horizontal or vertical axis while dragging a selection.

  - @id:dc.editor.diagram-as-code
    Users can edit the active diagram layer through the text-to-diagram format, inspect parse errors, apply changes,
    and restore the previous content.

  - @id:dc.editor.clipboard
    Users can cut, copy, paste, duplicate, and transfer diagram elements while preserving relevant relationships.

  - @id:dc.editor.history
    Users can undo and redo editing actions and inspect the recent working history of a diagram.

- @id:dc.documents
  Users can work with multi-diagram documents, preserve editable source files, and reopen work later.

  - @id:dc.documents.tabs
    A document can contain multiple diagram tabs, allowing related diagrams to live in one editable document.

    - @id:dc.documents.tabs.nested
      Users can organize diagram tabs hierarchically with nested tabs.

  - @id:dc.documents.stories
    Users can create guided stories within a document to sequence diagram views for explanation or presentation.

    - @id:dc.documents.stories.authoring
      Users can create stories and steps, record the current diagram, layer visibility, and pan/zoom state, and
      re-record or remove steps.

    - @id:dc.documents.stories.player
      Users can play a story step by step, move forward or backward, stop playback, and restore the prior editor state.

    - @id:dc.documents.stories.presentation
      Users can launch a story in presentation mode for guided viewing.

  - @id:dc.documents.native-files
    Users can create, open, save, and save-as native Diagram Craft documents while retaining their editable structure.

  - @id:dc.documents.file-formats
    Native JSON, `.dcd`, and embedded Diagram Craft SVG formats preserve diagram structure, metadata, layers, and
    styles for continued editing.

  - @id:dc.documents.metadata
    Users can inspect and edit document, element, tag, and custom metadata associated with diagram content.

  - @id:dc.documents.links
    Users can create links between nodes or use linked elements to navigate related diagram content.

- @id:dc.organization
  Users can organize complex diagrams into structures that are easier to navigate, edit, and maintain.

  - @id:dc.organization.layers
    Users can create, rename, reorder, hide, lock, and manage regular layers within a diagram.

  - @id:dc.organization.special-layers
    Users can work with specialized layer types for reuse, data-driven behavior, and controlled overrides.

    - @id:dc.organization.special-layers.reference
      Users can reuse the contents of a layer from another diagram without copying its elements into the current
      diagram.

    - @id:dc.organization.special-layers.rule
      Users can define rules that adjust element visibility or styling based on diagram data and query results.

    - @id:dc.organization.special-layers.modification
      Users can create controlled overlays that add, remove, or change delegated elements without altering the source
      layer directly.

  - @id:dc.organization.groups
    Users can group elements, edit grouped content, and manipulate a group as a unit.

  - @id:dc.organization.containers
    Users can use container elements and configure their borders and contained content.

  - @id:dc.organization.structure-view
    Users can browse and manage document structure, layers, tags, and related objects through dedicated tool windows.

- @id:dc.styling
  Users can control the visual language of diagrams from simple presentation changes to detailed element styling.

  - @id:dc.styling.basic
    Users can configure fills, strokes, line widths, arrowheads, typography, alignment, spacing, and opacity.

  - @id:dc.styling.fills
    Users can apply solid colors, linear and radial gradients, patterns, textures, and image fills.

  - @id:dc.styling.effects
    Users can apply effects such as shadows, blur, reflections, sketch styling, rounding, isometric treatment, and
    opacity changes.

  - @id:dc.styling.custom-shapes
    Users can edit custom paths and use geometry operations to create shapes beyond the standard built-in forms.

  - @id:dc.styling.copy
    Users can copy and reuse styling between elements.

- @id:dc.editing-assistance
  Users can use alignment, snapping, guides, and automatic layout to produce more structured diagrams efficiently.

  - @id:dc.editing-assistance.alignment
    Users can align and distribute selected elements using common horizontal and vertical arrangements.

  - @id:dc.editing-assistance.snapping
    Users can snap elements to grids, guides, other elements, distances, and matching sizes.

  - @id:dc.editing-assistance.guides-rulers
    Users can display rulers and guides and use guide-related context actions while editing.

  - @id:dc.editing-assistance.auto-layout
    Users can apply tree, layered, orthogonal, force-directed, and series-parallel layouts, then refine the result
    manually.

  - @id:dc.editing-assistance.boolean-geometry
    Users can combine and refine paths with boolean operations and other geometry operations.

- @id:dc.stencils
  Users can choose visual building blocks from general-purpose and notation-specific stencil packages.

  - @id:dc.stencils.general
    Users can work with basic shapes and arrows for general diagrams and early-stage sketches.

  - @id:dc.stencils.notations
    Users can use notation packages for C4, BPMN, UML, data modelling, ArchiMate, and other specialized diagram types.

  - @id:dc.stencils.optional-packages
    Users can enable optional Draw.io-backed stencil packs and recognizable cloud or vendor icon libraries.

  - @id:dc.stencils.document-selection
    Users can manage the active stencil packages for a document and browse them through list, grid, and search views.

  - @id:dc.stencils.templates
    Users can create, rename, update, remove, and reuse data-linked element templates within a document.

  - @id:dc.stencils.custom-authoring @status:planned
    Custom stencil authoring, library management, sharing, and stencil-library import/export are identified as future
    documentation and product scope rather than a currently established end-user workflow.

- @id:dc.data
  Users can attach structured data to diagram elements using either local document data or records from external data
  providers.

  - @id:dc.data.schemas
    Users can define or enable schemas and use them to structure data associated with diagram elements.

  - @id:dc.data.local-data
    Users can store and edit local field values in the document when data should remain diagram-specific.

  - @id:dc.data.external-data
    Users can link elements to records from external data providers, create records where supported, and unlink or
    remove external data references.

    - @id:dc.data.external-data.local-overrides
      When configured, users can stage local additions, updates, or deletions for external data before applying those
      changes back to the provider.

  - @id:dc.data.field-substitution
    Data-aware nodes can display linked record values through field tokens and other schema-driven text behavior.

  - @id:dc.data.dynamic-updates @status:partial
    Diagrams can react to refreshed provider data when the configured provider and consuming rules, templates, or
    queries support the update path.

  - @id:dc.data.rules
    Users can define rules that change element appearance, visibility, or actions based on data and diagram state.

  - @id:dc.data.query-language
    Users can search diagram content with simple search, advanced search, and DJQL query scopes.

- @id:dc.collaboration
  Diagram Craft supports shared diagram workflows with real-time synchronization, awareness, comments, and local
  working history when collaboration services are configured.

  - @id:dc.collaboration.real-time-editing
    Multiple users can edit the same collaborative diagram and see ordinary changes converge without taking turns.

  - @id:dc.collaboration.awareness
    Users can see awareness information about other participants in a shared editing session.

  - @id:dc.collaboration.comments
    Users can add, view, sort, and manage comments associated with diagram elements.

    - @id:dc.collaboration.comments.resolve
      Users can resolve comments so their review state is visibly different from open discussion.

  - @id:dc.collaboration.working-history
    Users can inspect and recover recent undoable actions during an editing session, including collaboration-aware undo
    behavior where configured.

  - @id:dc.collaboration.document-history @status:partial
    A Document History surface exists, but the current workflow is not yet a complete long-term timeline with preview
    and restore behavior.

- @id:dc.ai @status:experimental
  Diagram Craft provides AI- and text-oriented workflows that can reduce manual diagram construction when configured.

  - @id:dc.ai.text-to-diagram
    Users can convert supported text descriptions into structured diagram content.

  - @id:dc.ai.diagram-to-text
    Users can convert diagram content into structured text representations for documentation and accessibility.

  - @id:dc.ai.assistant @status:experimental
    Users can use an AI assistant tool window when an AI provider is configured, with the current behavior remaining
    provider-dependent and experimental.

- @id:dc.import-export
  Users can move diagrams into and out of Diagram Craft in editable and presentation-oriented formats.

  - @id:dc.import-export.drawio
    Users can import Draw.io diagrams and use Draw.io-backed shapes where supported.

  - @id:dc.import-export.image
    Users can export diagrams as PNG images for presentations, tickets, chat, and documentation.

  - @id:dc.import-export.svg
    Users can export diagrams as SVG and use embedded Diagram Craft SVG for editable structure where supported.

- @id:dc.interface
  Users can reach editor functionality through toolbars, sidebars, tool windows, menus, keyboard shortcuts, and a
  command palette.

  - @id:dc.interface.tools
    Users can switch between move, rectangle, edge, text, freehand, pen, node, zoom, and related editing tools.

  - @id:dc.interface.tool-windows
    Users can inspect objects, structure, history, search, diagram code, AI, style, information, data, and comments
    through dedicated tool windows.

  - @id:dc.interface.command-palette
    Users can search for and run editor commands through the command palette.

  - @id:dc.interface.shortcuts
    Users can use keyboard shortcuts for common tools, file actions, navigation, selection, layout, preview, and
    sidebar operations.

  - @id:dc.interface.dark-mode
    Users can switch the editor between light and dark presentation modes.

  - @id:dc.interface.preview
    Users can enter a preview mode that presents the diagram with editing chrome reduced or hidden.

- @id:dc.platform
  Diagram Craft can be used as a hosted browser application, a desktop application, a self-hosted deployment, or an
  embeddable editor configured by an integrating application.

  - @id:dc.platform.browser
    Users can run Diagram Craft in the browser with configurable filesystem, collaboration, stencil, and AI providers.

  - @id:dc.platform.desktop
    Users can use the Electron desktop application with desktop menus, file access, autosave, and platform integration.

  - @id:dc.platform.self-hosting
    Operators can deploy and configure the application and its server components themselves.

  - @id:dc.platform.embedding
    Integrators can embed the editor and configure document loading, autosave, stencils, collaboration, filesystem,
    and AI behavior programmatically.
