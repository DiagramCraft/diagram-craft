# Layout System

A flexbox-inspired layout engine for automatically arranging diagram nodes in containers.

## Overview

The layout system provides automatic positioning and sizing of child nodes within container nodes. It implements a
simplified flexbox-like algorithm that handles:

- **Flexible sizing** - Children can grow or shrink to fill available space
- **Intrinsic sizing** - Containers automatically calculate minimum/maximum sizes from nested children
- **Alignment** - Precise control over child positioning on both main and cross axes
- **Aspect ratio preservation** - Elements maintain their proportions when resized
- **Padding and gaps** - Spacing around and between children
- **Container auto-sizing** - Parents grow to fit children when needed
- **Nested layouts** - Recursive layout of deeply nested containers

## Architecture

The layout system uses a tree-based approach with three main phases:

### 1. Build Phase (`buildLayoutTree`)

Converts the diagram node hierarchy into a layout tree:

- Transforms absolute bounds to relative bounds (relative to parent)
- Extracts layout instructions from node properties
- Only includes DiagramNode children (excludes edges)

```ts
const layoutTree = buildLayoutTree(containerNode);
```

### 2. Layout Phase (`layoutChildren`)

Performs the actual layout calculation:

- Calculates intrinsic sizes from nested children
- Distributes space using flex-grow/flex-shrink
- Applies alignment and positioning
- Handles aspect ratio preservation
- Recursively layouts nested containers

```ts
layoutChildren(layoutTree);
```

### 3. Apply Phase (`applyLayoutTree`)

Applies calculated layout back to diagram nodes:

- Converts relative bounds back to absolute bounds
- Updates all node positions and sizes via UnitOfWork
- Matches children by ID to handle reordering

```ts
applyLayoutTree(containerNode, layoutTree, uow);
```

## Key Concepts

### Layout Axes

Every container has a **direction** (axis) along which children are arranged:

- **Horizontal** - Children laid out left to right
- **Vertical** - Children laid out top to bottom

The **main axis** is the direction of layout. The **cross axis** is perpendicular.

### Container Instructions

Configure how a container arranges its children:

```ts
{
  direction: 'horizontal',      // Layout direction
    gap
:
  10,                       // Space between children
    justifyContent
:
  'start',       // Main axis alignment
    alignItems
:
  'center',          // Cross axis alignment
    padding
:
  {
    top: 5, right
  :
    5, bottom
  :
    5, left
  :
    5
  }
,
  enabled: true                  // Enable/disable layout
}
```

**Main Axis Alignment** (`justifyContent`):

- `start` - Pack children at the start
- `end` - Pack children at the end
- `center` - Center children
- `space-between` - Distribute with first at start, last at end

**Cross Axis Alignment** (`alignItems`):

- `start` - Align to start of cross axis
- `end` - Align to end of cross axis
- `center` - Center on cross axis
- `stretch` - Stretch to fill cross axis (respects aspect ratio)
- `preserve` - Keep original cross-axis position

### Element Instructions

Configure how an element behaves within its parent container:

```ts
{
  width: {
    min: 50, max
  :
    200
  }
,    // Width constraints
  height: {
    min: 30, max
  :
    100
  }
,   // Height constraints
  grow: 1,                          // Flex-grow factor
    shrink
:
  1,                        // Flex-shrink factor
    preserveAspectRatio
:
  true,        // Maintain aspect ratio
    isAbsolute
:
  false                 // Exclude from layout
}
```

**Flex Growth** (`grow`):

- When extra space is available, distribute it proportionally
- Element with `grow: 2` gets twice as much space as `grow: 1`
- Default is `0` (don't grow)

**Flex Shrink** (`shrink`):

- When space is insufficient, reduce sizes proportionally
- Weighted by original size (larger elements shrink more)
- Default is `0` (don't shrink)

**Absolute Positioning** (`isAbsolute`):

- Elements excluded from layout calculation
- Position/size unchanged by parent layout
- Children of absolute elements are still laid out

### Intrinsic Sizing

The layout engine automatically calculates natural minimum and maximum sizes by walking the entire subtree:

**Minimum Size** - Space needed to show all content:

- Leaf nodes: `0` (or explicit `min` constraint)
- Same-axis container: Sum of children's minimums + gaps + padding
- Cross-axis container: Maximum of children's minimums + padding

**Maximum Size** - Space available before overflow:

- Leaf nodes: `Infinity` (or explicit `max` constraint)
- Same-axis container: Sum of children's maximums + gaps + padding
- Cross-axis container: Maximum of children's maximums + padding

These intrinsic sizes are combined with explicit constraints to determine effective min/max values.

### Container Auto-Sizing

Containers automatically grow to fit their children:

- **Main axis**: If children don't fit after layout, container expands
- **Cross axis**: Container expands to fit the widest/tallest child

This ensures content is never clipped due to insufficient container size.

## Layout Algorithm

The `layoutChildren` function implements the following algorithm:

### Step 1: Collect Child Information

For each non-absolute child:

- Calculate bounding box (accounting for rotation)
- Get intrinsic min/max sizes from nested children
- Combine with explicit constraints to get effective min/max
- Extract flex-grow and flex-shrink factors

### Step 2: Calculate Available Space

```
availableSpace = containerSize - padding - gaps
totalOriginalSize = sum of all child sizes
freeSpace = availableSpace - totalOriginalSize
```

### Step 3: Distribute Space

**If freeSpace > 0 and children have grow factors:**

- Distribute proportionally based on `grow` values
- Respect maximum size constraints

**If freeSpace < 0 and children have shrink factors:**

- Reduce sizes proportionally based on `shrink * originalSize`
- Respect minimum size constraints

**If freeSpace > 0 and no grow factors:**

- Apply `justifyContent` to position children within available space

### Step 4: Apply Aspect Ratio

For children with `preserveAspectRatio: true` that were resized:

- Calculate new cross-axis size to maintain aspect ratio
- Respect cross-axis min/max constraints

### Step 5: Auto-Size Container

If children don't fit on main or cross axis:

- Expand container to accommodate content
- Prevents clipping of child elements

### Step 6: Position and Size Children

For each child:

- Calculate main axis position (with gap and justify-content offset)
- Calculate cross axis position (based on align-items)
- Apply stretch sizing if `alignItems: 'stretch'`
- Set final bounds

### Step 7: Recursive Layout

- Recursively layout children of each child
- Also process children of absolute-positioned elements

## Usage Example

```ts
import {buildLayoutTree, layoutChildren, applyLayoutTree} from '@diagram-craft/canvas/layout';

// Assuming you have a container node with layout instructions
const containerNode: DiagramNode = {
  // ...
  renderProps: {
    layout: {
      container: {
        direction: 'horizontal',
        gap: 10,
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: {top: 10, right: 10, bottom: 10, left: 10}
      }
    }
  }, children: [// Child nodes with layout instructions
    {
      renderProps: {
        layout: {
          element: {
            grow: 1, shrink: 1, width: {min: 50}, preserveAspectRatio: true
          }
        }
      }
    }]
};

// Perform layout
const layoutTree = buildLayoutTree(containerNode);
layoutChildren(layoutTree);
applyLayoutTree(containerNode, layoutTree, uow);
```

## Configuration via Node Properties

Layout instructions are stored in the `renderProps.layout` property of DiagramNodes:

```ts
node.renderProps.layout = {
  container: {
    // ContainerLayoutInstructions when this node has children
  }, element: {
    // ElementLayoutInstructions when this node is in a parent container
  }
};
```

A node can have both:

- **Container instructions** - How it lays out its own children
- **Element instructions** - How it behaves in its parent's layout

## Disabling Layout

To disable layout for a specific container while keeping it for nested children:

```ts
{
  container: {
    enabled: false, direction
  :
    'horizontal'  // Still required but ignored
  }
}
```

Children will maintain their current positions, but their children will still be laid out.

## Differences from CSS Flexbox

While inspired by CSS Flexbox, this layout system has some key differences:

**Similarities:**

- Main/cross axis concept
- Flex-grow and flex-shrink
- Justify-content and align-items
- Padding and gap

**Differences:**

- No `flex-basis` (uses current size instead)
- Intrinsic sizing walks entire subtree (more powerful than CSS)
- Container auto-sizing (containers grow to fit children)
- No wrapping support (single line only)
- No `flex-direction` reverse modes
- Simpler shrink algorithm (weighted by original size only)
- `preserve` alignment option to maintain original positions


