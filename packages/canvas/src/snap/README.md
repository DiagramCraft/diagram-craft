# Snap Package

The snap package provides a snapping system, enabling precise alignment and positioning of
elements during move and resize operations.

## Overview

The snapping system helps users create well-aligned diagrams by automatically snapping elements to various targets such
as:

- **Grid lines** for consistent spacing
- **Canvas boundaries** for proper positioning
- **Other nodes** for alignment and layout consistency
- **Equal distances** between elements for balanced layouts
- **Matching dimensions** for visual consistency
- **User-defined guides** for custom alignment rules

## Architecture

The snap system follows a provider-based architecture where different types of snapping are implemented as separate
providers, all coordinated by a central snap manager.

### Core Components

#### SnapManager (`snapManager.ts`)

The central coordinator that:

- Manages multiple snap providers
- Handles configuration and settings
- Processes snap requests and finds the best matches
- Generates visual feedback during snapping operations

#### SnapManagerConfig (`snapManagerConfig.ts`)

Configuration manager that controls:

- Which snap types are enabled (`magnetTypes`)
- Snap sensitivity threshold (`threshold`)
- Global enable/disable state (`enabled`)
- Event notifications for configuration changes

### Snap Providers

Each snap provider implements the `SnapProvider` interface and handles a specific type of snapping:

#### CanvasSnapProvider (`canvasSnapProvider.ts`)

Provides snapping to canvas center lines:

- Vertical center line of the entire canvas/diagram area
- Horizontal center line of the entire canvas/diagram area
- Helps align elements to the center of the canvas for balanced layouts

#### GridSnapProvider (`gridSnapProvider.ts`)

Creates grid-based alignment magnets:

- Generates magnetic lines at regular grid intervals
- Both vertical and horizontal grid lines around the element being snapped
- Grid size based on diagram's grid configuration (default: 10px)

#### GuidesSnapProvider (`guidesSnapProvider.ts`)

Handles user-defined guide line snapping:

- Creates magnets for horizontal and vertical guides defined in the diagram
- Supports custom positioning based on user-defined guide locations

#### NodeSnapProvider (`nodeSnapProvider.ts`)

Provides snapping to edges and centers of existing nodes:

- Node edges (top, bottom, left, right)
- Node centers (horizontal and vertical center lines)

#### NodeSizeSnapProvider (`nodeSizeSnapProvider.ts`)

Enables dimension matching during resize operations:

- Snap to match width of existing nodes
- Snap to match height of existing nodes

#### NodeDistanceSnapProvider (`nodeDistanceSnapProvider.ts`)

Maintains equal spacing between elements:

- Detects distance patterns between existing nodes
- Creates "distance magnets" for consistent spacing
- Helps create evenly distributed layouts

### Core Types

#### Magnet (`magnet.ts`)

The fundamental unit of the snapping system:

```typescript
type Magnet = {
  line: Line;           // The geometric line that defines the snap target
  axis: Axis;           // Whether this is horizontal or vertical
  type: MagnetType;     // What kind of snap this represents
  // ... additional type-specific properties
}
```

## How Snapping Works

### 1. Magnet Generation

When an element is moved or resized:

1. Each enabled snap provider generates relevant magnets
2. Magnets represent potential snap targets as geometric lines
3. Providers filter and prioritize magnets based on relevance

### 2. Snap Detection

During user interaction:

1. The SnapManager collects magnets from all enabled providers
2. Source magnets are generated from the element being manipulated
3. The system finds the closest matching magnetic lines within the threshold distance

### 3. Snap Execution

When a match is found:

1. The element position/size is adjusted to align with the target magnet
2. Visual feedback is generated to show the alignment
3. Highlight lines span between source and target elements

### 4. Visual Feedback

The system provides visual feedback:

- **Snap lines** show active alignment relationships
- **Distance indicators** display measurements between elements
- **Highlight spans** connect aligned elements for clarity

## Extension Points

### Custom Snap Providers

Implement the `SnapProvider<T>` interface:

```typescript
class CustomSnapProvider implements SnapProvider<'custom'> {
  getMagnets(box: Box): MagnetOfType<'custom'>[] {
    // Generate custom magnetic lines
  }

  mark(box: Box, match: MatchingMagnetPair<'custom'>, axis: Axis): SnapMarker {
    // Create visual feedback for snapping
  }

  filterMarkers(markers: SnapMarker[]): SnapMarker[] {
    // Optional: filter or consolidate markers
  }
}
```
