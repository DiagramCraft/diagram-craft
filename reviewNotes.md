**Model**
[
`packages/model/src/endpoint.ts`](/Users/magnusjohansson/Documents/Private/projects/diagram-craft/packages/model/src/endpoint.ts)
adds the new edge-attached endpoint type, `PointOnEdgeEndpoint`, backed by `EdgeConnectedEndpoint`. It serializes as an
edge reference plus normalized `pathPosition`, resolves its position from the target edge’s live routed path, and
participates in endpoint deserialization. This file also now requires explicit `edgeLookup` during deserialization so
edge-relative endpoints can always be resolved cleanly.

OK

[
`packages/model/src/diagramEdge.ts`](/Users/magnusjohansson/Documents/Private/projects/diagram-craft/packages/model/src/diagramEdge.ts)
contains the core behavior for edge-to-edge attachments. It now registers and unregisters dependent edges when start/end
endpoints attach to another edge, rejects cycles when assigning such endpoints, propagates invalidation to attached
edges so they redraw immediately when the target edge moves, and derives endpoint normal direction from the target edge
path tangent for edge-attached endpoints. This is the main behavioral center of the PR.

Comments

[
`packages/model/src/serialization/serializedTypes.ts`](/Users/magnusjohansson/Documents/Private/projects/diagram-craft/packages/model/src/serialization/serializedTypes.ts)
and [
`packages/model/src/serialization/utils.ts`](/Users/magnusjohansson/Documents/Private/projects/diagram-craft/packages/model/src/serialization/utils.ts)
were extended to represent and recognize the new serialized “point on edge” endpoint shape.

OK

[
`packages/model/src/diagramEdgeUtils.ts`](/Users/magnusjohansson/Documents/Private/projects/diagram-craft/packages/model/src/diagramEdgeUtils.ts)
was adjusted so node-specific path clipping logic only applies to node-attached endpoints. That keeps edge-attached
endpoints stable against the routed path itself rather than incorrectly treating them as node perimeter connections.

OK

[
`packages/model/src/diagramNode.ts`](/Users/magnusjohansson/Documents/Private/projects/diagram-craft/packages/model/src/diagramNode.ts)
was updated in duplication and detach flows so node-scoped reconnection logic remains node-only, and edge-relative
endpoints are not accidentally treated as node endpoints.

**Canvas / Interaction**
[
`packages/canvas/src/drag/edgeEndpointMoveDrag.ts`](/Users/magnusjohansson/Documents/Private/projects/diagram-craft/packages/canvas/src/drag/edgeEndpointMoveDrag.ts)
adds the new interaction: when dragging an edge endpoint, the pointer now projects onto hovered edge paths and snaps if
it is within threshold. On drop, it commits a `PointOnEdgeEndpoint` instead of a free endpoint. It also blocks
self-targeting / dependency cycles during drag, and still preserves the existing node-anchor and point-in-node
behaviors.

[
`packages/canvas/src/components/EdgeSelectionComponent.ts`](/Users/magnusjohansson/Documents/Private/projects/diagram-craft/packages/canvas/src/components/EdgeSelectionComponent.ts)
and related drag handling keep endpoint handle visuals and behaviors correct for both node-connected and edge-connected
endpoints.

[
`packages/canvas-app/src/actions/duplicateAction.ts`](/Users/magnusjohansson/Documents/Private/projects/diagram-craft/packages/canvas-app/src/actions/duplicateAction.ts)
now remaps edge-relative endpoints when both the source edge and referenced target edge are duplicated together. If the
target edge is not duplicated, it degrades the copied endpoint to a free endpoint at the resolved absolute position.

**Serialization / Deserialization / Downstream Consumers**
[
`packages/model/src/serialization/deserialize.ts`](/Users/magnusjohansson/Documents/Private/projects/diagram-craft/packages/model/src/serialization/deserialize.ts), [
`packages/model/src/delegatingDiagramEdge.ts`](/Users/magnusjohansson/Documents/Private/projects/diagram-craft/packages/model/src/delegatingDiagramEdge.ts),
and the restore path in [
`packages/model/src/diagramEdge.ts`](/Users/magnusjohansson/Documents/Private/projects/diagram-craft/packages/model/src/diagramEdge.ts)
were updated so deserialization and CRDT-backed edge state can resolve edge-relative endpoints through `edgeLookup`.

[
`packages/canvas-app/src/text-to-diagram/formats/default/serializer.ts`](/Users/magnusjohansson/Documents/Private/projects/diagram-craft/packages/canvas-app/src/text-to-diagram/formats/default/serializer.ts), [
`packages/canvas-app/src/text-to-diagram/textToDiagram.ts`](/Users/magnusjohansson/Documents/Private/projects/diagram-craft/packages/canvas-app/src/text-to-diagram/textToDiagram.ts), [
`packages/main/src/react-app/context-menu-dispatcher/ConnectedNodesSubmenu.tsx`](/Users/magnusjohansson/Documents/Private/projects/diagram-craft/packages/main/src/react-app/context-menu-dispatcher/ConnectedNodesSubmenu.tsx), [
`packages/main/src/react-app/NodeLinkPopup.tsx`](/Users/magnusjohansson/Documents/Private/projects/diagram-craft/packages/main/src/react-app/NodeLinkPopup.tsx),
and [
`packages/main/src/react-app/ai/aiModel.ts`](/Users/magnusjohansson/Documents/Private/projects/diagram-craft/packages/main/src/react-app/ai/aiModel.ts)
were adjusted so code that specifically means “node-connected endpoint” continues to behave correctly and does not
assume every connected endpoint has a node behind it.

**Routing / Graph Logic**
[
`packages/model/src/edgePathBuilder.axisAligned.ts`](/Users/magnusjohansson/Documents/Private/projects/diagram-craft/packages/model/src/edgePathBuilder.axisAligned.ts), [
`packages/model/src/edgePathBuilder.orthogonal.ts`](/Users/magnusjohansson/Documents/Private/projects/diagram-craft/packages/model/src/edgePathBuilder.orthogonal.ts),
and [
`packages/model/src/diagramGraph.ts`](/Users/magnusjohansson/Documents/Private/projects/diagram-craft/packages/model/src/diagramGraph.ts)
were tightened so node-specific routing and graph construction only treat node-attached endpoints as graph/node
connections. Edge-relative endpoints remain valid attachments, but they are not misinterpreted as node graph links.
