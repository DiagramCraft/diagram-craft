# Diagram Craft Features

## Core Diagramming

**Interactive canvas.** The diagram editor provides a high-performance canvas for creating and editing diagrams. Elements can be freely positioned, resized, rotated, and styled. The canvas supports zooming, panning, and precise alignment with intelligent snapping to grids, guides, and other elements. Multiple selection modes enable efficient bulk operations on diagram elements.

**Shape library.** A comprehensive collection of built-in shapes covers common diagramming needs including rectangles, circles, polygons, arrows, and specialized shapes. Shapes can be customized with fills, strokes, shadows, and effects. Custom shapes can be created through boolean operations or imported from external sources.

**Connectors and edges.** Flexible edge routing connects diagram elements with straight lines, curved paths, or orthogonal routing. Edges automatically attach to connection points on shapes and reroute intelligently when elements are moved. Multiple edge styles are available including arrows, dashed lines, and custom decorations at start and end points.

**Text editing.** Rich text capabilities allow formatting within diagram elements and standalone text boxes. Text supports multiple fonts, sizes, colors, alignment options, and basic markdown formatting. Text automatically wraps within shape boundaries and can be positioned relative to the shape.

**Styling system.** A comprehensive styling system controls the visual appearance of all diagram elements. Styles can be applied individually or through style presets. The system supports gradients, patterns, shadows, reflections, and advanced effects like glass surfaces and hand-drawn aesthetics. Styles can be copied between elements and saved as reusable templates.

---

## Stencils and Templates

**Stencil libraries.** Pre-built stencil collections provide domain-specific shapes and notation systems. Available stencils include C4 architecture diagrams, ArchiMate enterprise architecture, BPMN business processes, UML software modeling, and data modeling entities. Each stencil includes properly styled shapes that follow the conventions of their respective notation systems.

**Custom stencils.** Users can create custom stencil libraries by grouping frequently used shapes, styles, and configurations. Custom stencils can be shared across diagrams and exported for team distribution.

**Diagram templates.** Start new diagrams from templates that provide pre-configured layouts, styles, and example content. Templates accelerate common diagramming tasks and ensure consistency across similar diagram types.

---

## Advanced Editing

**Boolean operations.** Combine multiple shapes using union, intersection, difference, and exclusion operations to create complex custom shapes. Boolean operations preserve styling and can be applied to any combination of basic shapes, enabling precise geometric constructions without external tools.

**Layer management.** Organize diagram elements across multiple layers for better control over complex diagrams. Layers can be locked to prevent accidental edits, hidden to reduce visual clutter, or grouped for hierarchical organization. Specialized rule layers enable conditional visibility and styling based on data properties.

**Nested tabs.** Structure complex projects with hierarchical tabs that organize related diagrams together. Tabs can be nested to create logical groupings while maintaining a clean workspace. This enables managing large diagram sets within a single project without losing context.

**Alignment and distribution.** Precise alignment tools snap elements to grids, guides, and other elements. Distribution commands evenly space selected elements horizontally or vertically. Auto-align features automatically organize elements based on their relationships and connections.

**Geometry operations.** Advanced geometric transformations include rotation, flipping, scaling, and skewing. Elements can be grouped to move and transform together. Path operations allow editing of shape vertices and control points for fine-grained control over custom shapes.

---

## Layout Algorithms

**Automatic layouts.** Multiple graph layout algorithms automatically arrange diagram elements based on their connections. Algorithms include tree layout for hierarchical structures, force-directed layout for network visualization, layered layout for directed graphs, orthogonal layout for right-angle routing, and series-parallel layout for specific graph types. Each algorithm has configurable parameters to tune the resulting layout.

**Manual refinement.** Automatically generated layouts can be manually adjusted while preserving the overall structure. Elements can be repositioned, and the layout algorithm can be reapplied to specific subgraphs without affecting the entire diagram.

---

## Data Integration

**External data sources.** Connect diagrams to external data sources to create data-driven visualizations. Elements can be bound to data records, with properties automatically updating when the underlying data changes. Supported data sources include REST APIs, JSON files, and custom data providers.

**Data queries.** A built-in query language (DJQL) enables filtering, transforming, and aggregating data within diagrams. Query results can drive element visibility, styling, and content. The query tool window provides an interactive interface for building and testing queries against the diagram's data model.

**Dynamic updates.** Diagrams automatically reflect changes in connected data sources. Elements can be configured to update their appearance, position, or visibility based on data values, enabling live dashboards and monitoring views.

---

## Collaboration

**Real-time editing.** Multiple users can edit the same diagram simultaneously with changes synchronized in real time. The collaboration system uses Conflict-free Replicated Data Types (CRDTs) via Yjs to ensure consistent state across all participants without requiring a central coordination server.

**Presence awareness.** See where other users are working within the diagram through cursor positions and selection highlights. User avatars and names are displayed in the awareness toolbar, showing who is currently viewing or editing the diagram.

**Comments and review.** Add comments directly to diagram elements or specific locations on the canvas. Comments support threaded discussions, mentions, and resolution tracking. The comments tool window provides an overview of all comments and their status, facilitating review workflows and feedback collection.

**Version history.** Every change to the diagram is recorded in the undo/redo history. The history tool window displays a chronological list of all modifications with the ability to preview and restore previous states. This provides both an audit trail and a safety net for experimental changes.

---

## AI and Automation

**Text-to-diagram conversion.** Automatically generate diagrams from text descriptions using natural language processing. The system supports multiple text formats including structured notations (Mermaid, PlantUML) and free-form descriptions. Generated diagrams can be further refined manually.

**Diagram-to-text export.** Convert existing diagrams back to structured text representations for documentation, version control, and accessibility. This enables round-trip workflows where diagrams can be edited as text or visually.

**AI assistant.** An integrated AI tool window provides contextual assistance for diagramming tasks. The assistant can suggest improvements, answer questions about diagram structure, and help with complex operations. It understands the current diagram context and can reference specific elements.

---

## Import and Export

**Drawio import.** Import existing diagrams from Drawio (draw.io) format, preserving layouts, styles, and connections. This enables migration from Drawio to Diagram Craft while maintaining existing diagram assets.

**Image export.** Export diagrams as high-quality PNG images with configurable resolution and transparency. Exports can include the entire diagram or selected regions, with options for background color and padding.

**SVG export.** Export diagrams as scalable vector graphics (SVG) for use in web pages, documentation, and print materials. SVG exports preserve all styling and can be further edited in vector graphics tools.

**File management.** Save and load diagrams in Diagram Craft's native format. The file system supports both local storage and cloud-based providers depending on the deployment configuration. Recent files are tracked for quick access.

---

## User Interface

**Tool windows.** Specialized panels provide focused interfaces for different aspects of diagram editing. Available tool windows include object properties, document structure, history, search/query, AI assistant, style overview, text formatting, data binding, and comments. Tool windows can be shown, hidden, and arranged to suit individual workflows.

**Command palette.** A keyboard-driven command palette provides quick access to all editor functions. Commands can be searched by name, and frequently used commands are prioritized. The palette displays keyboard shortcuts for rapid execution.

**Customizable toolbars.** The main toolbar provides one-click access to common tools and operations. Tool selection is persistent across sessions, and the toolbar adapts to show contextually relevant options based on the current selection.

**Ruler and guides.** Optional rulers along the canvas edges display measurements in the current unit system. Guides can be dragged from rulers to create alignment references. The ruler can be toggled on or off based on preference.

**Dark mode.** A dark color scheme reduces eye strain during extended editing sessions. Dark mode applies to the entire interface including the canvas, tool windows, and dialogs. The mode can be toggled instantly without restarting.

**Preview mode.** A distraction-free preview mode hides all UI chrome to display only the diagram canvas. This is useful for presentations, screenshots, and reviewing the final appearance without editing controls.

---

## Document Organization

**Document structure.** The structure tool window displays a hierarchical view of all elements in the diagram organized by layers and groups. Elements can be selected, renamed, and reordered through this view. The structure provides an alternative navigation method for complex diagrams with many elements.

**Search and filtering.** Find diagram elements by name, type, or properties using the search tool window. Search results are highlighted on the canvas and can be selected for bulk operations. Filters can be saved and reused for common queries.

**Object properties.** The object info tool window displays detailed properties of selected elements including position, size, styling, and custom data. Properties can be edited directly through this interface, providing precise control over element attributes.

---

## Accessibility and Usability

**Keyboard shortcuts.** Comprehensive keyboard shortcuts accelerate common operations. All major functions are accessible via keyboard, enabling efficient workflows without mouse interaction. Shortcuts are displayed in tooltips and the command palette.

**Undo and redo.** Unlimited undo/redo history allows reverting any change made during the editing session. The history is preserved across saves, enabling recovery from mistakes even after closing and reopening the diagram.

**Help system.** An integrated help overlay provides contextual assistance and keyboard shortcut references. The help system can be toggled on or off and displays relevant information based on the current tool or selection.

**Responsive canvas.** The canvas adapts to different screen sizes and resolutions, maintaining usability on both large desktop monitors and smaller laptop screens. Touch gestures are supported on touch-enabled devices for panning and zooming.
