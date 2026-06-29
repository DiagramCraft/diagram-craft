# Diagram Craft Documentation Outline Plan

## Proposed Structure

Based on the Arch Register documentation template and Diagram Craft's feature set, here's the proposed documentation structure:

### 1. Overview
- **Core Concepts**: Introduction to diagrams, elements, layers, and the canvas
- **Key Features**: Overview of major capabilities

### 2. Getting Started
- **Introduction**: What is Diagram Craft and who is it for
- **Installation**: How to access (web, desktop, self-hosted)
- **First Diagram**: Create your first simple diagram
- **Basic Shapes and Connectors**: Working with fundamental elements
- **Styling Basics**: Applying colors, strokes, and basic effects
- **Saving and Exporting**: File management and export options
- **Next Steps**: Where to go from here

### 3. Using Diagram Craft

#### Core Diagramming
- **Canvas Navigation**: Zooming, panning, and viewport control
- **Shapes and Elements**: Working with the shape library
- **Connectors and Edges**: Creating and styling connections
- **Text and Labels**: Adding and formatting text
- **Selection and Manipulation**: Selecting, moving, resizing, rotating elements

#### Styling and Appearance
- **Styling System**: Understanding styles and presets
- **Colors and Gradients**: Working with fills and strokes
- **Effects**: Shadows, reflections, glass effects, hand-drawn styles
- **Custom Shapes**: Creating shapes with boolean operations

#### Organization
- **Layers**: Managing layers, locking, hiding, and grouping
- **Tabs and Documents**: Working with nested tabs and multiple diagrams
- **Groups**: Grouping elements for easier manipulation
- **Document Structure**: Using the structure panel

#### Advanced Editing
- **Alignment and Distribution**: Precise positioning tools
- **Snapping and Guides**: Grid, guide, and element snapping
- **Boolean Operations**: Union, intersection, difference, exclusion
- **Geometry Operations**: Advanced transformations and path editing

#### Layout and Automation
- **Automatic Layouts**: Tree, force-directed, layered, orthogonal layouts
- **Layout Configuration**: Tuning layout algorithm parameters
- **Manual Refinement**: Adjusting auto-generated layouts

#### Data and Integration
- **Data Sources**: Connecting to external data
- **Data Binding**: Binding element properties to data
- **Query Language (DJQL)**: Filtering and transforming data
- **Dynamic Updates**: Creating data-driven diagrams

#### Collaboration
- **Real-time Editing**: Working with multiple users
- **Comments and Review**: Adding feedback and discussions
- **Presence Awareness**: Seeing other users' activity
- **Version History**: Tracking and restoring changes

#### AI Features
- **Text-to-Diagram**: Generating diagrams from text
- **Diagram-to-Text**: Exporting diagrams as text
- **AI Assistant**: Using the AI tool window

#### Import and Export
- **Drawio Import**: Migrating from Drawio
- **Image Export**: PNG export options
- **SVG Export**: Vector graphics export
- **File Formats**: Understanding Diagram Craft file format

### 4. Stencils and Templates
- **Built-in Stencils**: C4, ArchiMate, BPMN, UML, Data Modeling
- **Custom Stencils**: Creating and sharing custom stencil libraries
- **Diagram Templates**: Using and creating templates

### 5. User Interface
- **Tool Windows**: Overview of all tool windows
- **Command Palette**: Keyboard-driven command access
- **Toolbars**: Customizing and using toolbars
- **Keyboard Shortcuts**: Complete shortcut reference
- **Dark Mode**: Switching themes
- **Preview Mode**: Presentation view

### 6. Reference
- **Keyboard Shortcuts**: Complete reference
- **Tool Windows Reference**: Detailed tool window documentation
- **Query Language (DJQL)**: Complete DJQL syntax reference
- **File Format**: Technical specification of file format
- **Stencil Reference**: Complete stencil documentation

### 7. Developing with Diagram Craft
- **Custom Development**: Extending Diagram Craft with custom nodes, edges, and stencils
- **Self-hosting**: Deployment options and configuration
- **Troubleshooting**: Common issues and solutions
- **Contributing**: How to contribute to the project

### 8. API
- **TypeDoc Reference**: Auto-generated API documentation for all packages (existing)

**Note**: The API section already exists with TypeDoc-generated documentation and will be preserved in the sidebar structure.

## Comparison with Arch Register Structure

| Arch Register | Diagram Craft | Notes |
|---------------|---------------|-------|
| Overview | Overview | Similar - core concepts |
| Getting Started | Getting Started | Similar - onboarding flow |
| Use Arch Register | Using Diagram Craft | Main usage documentation |
| Workspace Administration | (Not applicable) | Diagram Craft is single-user focused |
| Reference | Reference | Similar - technical references |
| (None) | Stencils and Templates | Diagram Craft specific |
| (None) | User Interface | More UI-focused than Arch Register |
| (None) | Developing with Diagram Craft | Developer-focused content |
| API | API | TypeDoc-generated API docs (existing) |

## Next Steps

1. Create directory structure for all sections
2. Create dummy markdown files with intent descriptions
3. Update `sidebars-diagram-craft.ts` with the new structure (preserving existing API section)
4. Review with stakeholders before populating content
