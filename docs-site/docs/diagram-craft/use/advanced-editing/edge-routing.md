---
sidebar_position: 7
related_reading:
  - label: Geometry Operations
    to: /diagram-craft/diagram-craft/use/advanced-editing/geometry-operations
  - label: Connectors and Edges
    to: /diagram-craft/diagram-craft/use/core-diagramming/connectors-edges
  - label: Snapping and Guides
    to: /diagram-craft/diagram-craft/use/advanced-editing/snapping-guides
---

# Edge Routing

Edge routing controls the path a connector follows between its source and target nodes. Select an edge to expose its routing controls and handles.

## Choose An Edge Type

Diagram Craft supports several edge geometries:

- **Straight** for a direct connection
- **Orthogonal** for right-angle routes
- **Curved** for smooth non-linear paths
- **Bezier** for paths controlled by handles
- **Axis-aligned** for routes constrained to an axis

Choose the edge type that matches the structure of the connection, then refine its path with waypoints or handles.

## Adjust The Route

Use the mouse to drag a waypoint to reposition a bend or drag a Bezier handle to change the curve. Add waypoints when a connector needs to pass around nearby nodes, and remove unnecessary waypoints when the route becomes difficult to maintain.

Changing an edge's route preserves its connection to the source and target nodes. If the connected nodes move, review the waypoints and handles to keep the path clear.
